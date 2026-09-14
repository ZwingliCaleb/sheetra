const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const { XMLParser } = require('fast-xml-parser');
const { exec } = require('child_process');

/**
 * Converts MIDI Pitch (0-127) to MuseScore Tonal Pitch Class (TPC).
 */
function pitchToTpc(pitch, alter = 0) {
  const stepTpc = { 0: 14, 2: 16, 4: 18, 5: 13, 7: 15, 9: 17, 11: 19 };
  const basePitch = (pitch % 12 + 12) % 12;
  const tpc = stepTpc[basePitch] || 14;
  return tpc + (alter * 7);
}

/**
 * Converts MusicXML step + octave + alter into MIDI pitch.
 */
function stepOctaveToPitch(step, octave = 4, alter = 0) {
  const stepOffsets = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const base = stepOffsets[step.toUpperCase()] ?? 0;
  return (octave + 1) * 12 + base + Number(alter || 0);
}

/**
 * Resolves explicit voice part names (Soprano, Alto, Tenor, Bass) from MusicXML meta.
 */
function resolvePartName(partMeta, partObj, pIdx, totalParts) {
  let rawName = '';
  if (typeof partMeta?.['part-name'] === 'string') rawName = partMeta['part-name'];
  else if (partMeta?.['part-name']?.['#text']) rawName = partMeta['part-name']['#text'];
  else if (typeof partObj?.['@_id'] === 'string') rawName = partObj['@_id'];

  rawName = (rawName || '').trim();
  const lower = rawName.toLowerCase();

  if (lower.includes('soprano')) return { name: 'Soprano', short: 'S.', clef: 'G' };
  if (lower.includes('alto')) return { name: 'Alto', short: 'A.', clef: 'G' };
  if (lower.includes('tenor')) return { name: 'Tenor', short: 'T.', clef: 'F' };
  if (lower.includes('bass')) return { name: 'Bass', short: 'B.', clef: 'F' };

  if (totalParts === 4) {
    const satbDefaults = [
      { name: 'Soprano', short: 'S.', clef: 'G' },
      { name: 'Alto', short: 'A.', clef: 'G' },
      { name: 'Tenor', short: 'T.', clef: 'F' },
      { name: 'Bass', short: 'B.', clef: 'F' }
    ];
    return satbDefaults[pIdx] || { name: `Voice ${pIdx + 1}`, short: `V${pIdx + 1}.`, clef: 'G' };
  }

  if (totalParts === 2) {
    const duets = [
      { name: 'Soprano / Alto', short: 'S./A.', clef: 'G' },
      { name: 'Tenor / Bass', short: 'T./B.', clef: 'F' }
    ];
    return duets[pIdx] || { name: `Voice ${pIdx + 1}`, short: `V${pIdx + 1}.`, clef: 'G' };
  }

  return { name: rawName || `Voice ${pIdx + 1}`, short: `${(rawName || 'V').slice(0, 3)}.`, clef: pIdx >= 2 ? 'F' : 'G' };
}

/**
 * Converts a MusicXML string into MuseScore .mscx XML string with explicit SATB voice part labeling.
 */
function musicXmlToMscx(musicXmlContent, metadata = {}) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    isArray: (name) => ['part', 'measure', 'note', 'score-part', 'lyric', 'attributes'].includes(name)
  });

  let parsed;
  try {
    parsed = parser.parse(musicXmlContent);
  } catch (err) {
    console.warn('XML Parser warning, fallback default structure:', err.message);
  }

  const scorePartwise = parsed?.['score-partwise'] || {};
  const workTitle = metadata.title || scorePartwise?.['work']?.['work-title'] || scorePartwise?.['movement-title'] || 'Converted Sheet';
  const composer = metadata.composer || scorePartwise?.['identification']?.['creator']?.['#text'] || scorePartwise?.['identification']?.['creator'] || 'Sheetra Converter';

  const scorePartsMeta = scorePartwise?.['part-list']?.['score-part'] || [];
  const partsList = scorePartwise?.part || [];
  const totalParts = partsList.length;

  let mscxPartsHeader = '';
  let mscxStavesXml = '';
  let globalStaffCounter = 1;

  partsList.forEach((partObj, pIdx) => {
    const partMeta = Array.isArray(scorePartsMeta) ? scorePartsMeta[pIdx] : scorePartsMeta;
    const partInfo = resolvePartName(partMeta, partObj, pIdx, totalParts);
    const staffId = globalStaffCounter++;

    mscxPartsHeader += `
    <Part>
      <Staff id="${staffId}">
        <StaffType group="pitched">
          <name>stdNormal</name>
        </StaffType>
      </Staff>
      <trackName>${escapeXml(partInfo.name)}</trackName>
      <Instrument id="${partObj['@_id'] || partInfo.name.toLowerCase()}">
        <longName>${escapeXml(partInfo.name)}</longName>
        <shortName>${escapeXml(partInfo.short)}</shortName>
        <trackName>${escapeXml(partInfo.name)}</trackName>
        <clef>${partInfo.clef}</clef>
        <Articulation>
          <velocity>100</velocity>
          <gateTime>100</gateTime>
        </Articulation>
      </Instrument>
    </Part>`;

    let partMeasuresXml = '';
    const measures = partObj.measure || [];

    measures.forEach((m) => {
      let measureContent = '';

      if (m.attributes) {
        const attrs = Array.isArray(m.attributes) ? m.attributes[0] : m.attributes;
        if (attrs['time']) {
          const beats = attrs.time.beats || 4;
          const beatType = attrs.time['beat-type'] || 4;
          measureContent += `
          <TimeSig>
            <sigN>${beats}</sigN>
            <sigD>${beatType}</sigD>
          </TimeSig>`;
        }
        if (attrs['clef']) {
          const sign = attrs.clef.sign || partInfo.clef;
          measureContent += `
          <Clef>
            <concertClefType>${sign}</concertClefType>
            <transposingClefType>${sign}</transposingClefType>
          </Clef>`;
        }
        if (attrs['key']) {
          const fifths = attrs.key.fifths || 0;
          measureContent += `
          <KeySig>
            <accidental>${fifths}</accidental>
          </KeySig>`;
        }
      }

      const notes = m.note || [];
      notes.forEach((n) => {
        const isRest = !!n.rest;
        const durationType = n.type || 'quarter';
        const typeStr = typeof durationType === 'object' ? durationType['#text'] || 'quarter' : durationType;

        let lyricsXml = '';
        if (n.lyric) {
          const lyricsArr = Array.isArray(n.lyric) ? n.lyric : [n.lyric];
          lyricsArr.forEach(l => {
            const txt = l.text || l['#text'] || '';
            const syllabic = l.syllabic || 'single';
            if (txt) {
              lyricsXml += `
          <Lyrics>
            <syllabic>${syllabic}</syllabic>
            <text>${escapeXml(txt)}</text>
          </Lyrics>`;
            }
          });
        }

        if (isRest) {
          measureContent += `
          <Rest>
            <durationType>${typeStr}</durationType>
          </Rest>`;
        } else if (n.pitch) {
          const step = n.pitch.step || 'C';
          const octave = parseInt(n.pitch.octave || 4, 10);
          const alter = parseInt(n.pitch.alter || 0, 10);
          const pitchVal = stepOctaveToPitch(step, octave, alter);
          const tpcVal = pitchToTpc(pitchVal, alter);

          measureContent += `
          <Chord>
            <durationType>${typeStr}</durationType>
            ${lyricsXml}
            <Note>
              <pitch>${pitchVal}</pitch>
              <tpc>${tpcVal}</tpc>
            </Note>
          </Chord>`;
        }
      });

      if (!measureContent.trim()) {
        measureContent = `
          <Rest>
            <durationType>measure</durationType>
          </Rest>`;
      }

      partMeasuresXml += `
      <Measure>
        <voice>
          ${measureContent}
        </voice>
      </Measure>`;
    });

    mscxStavesXml += `
    <Staff id="${staffId}">
      ${partMeasuresXml}
    </Staff>`;
  });

  if (!mscxPartsHeader) {
    mscxPartsHeader = `
    <Part>
      <Staff id="1">
        <StaffType group="pitched"><name>stdNormal</name></StaffType>
      </Staff>
      <trackName>Voice</trackName>
    </Part>`;
    mscxStavesXml = `
    <Staff id="1">
      <Measure><voice><Clef><concertClefType>G</concertClefType></Clef><Rest><durationType>measure</durationType></Rest></voice></Measure>
    </Staff>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<museScore version="3.02">
  <programVersion>4.0.0</programVersion>
  <programRevision>3224f34</programRevision>
  <Score>
    <LayerTag id="0" tag="default"></LayerTag>
    <currentLayer>0</currentLayer>
    <Division>480</Division>
    <Style>
      <pageWidth>8.27</pageWidth>
      <pageHeight>11.69</pageHeight>
      <pagePrintableWidth>7.48</pagePrintableWidth>
      <enableTitle>1</enableTitle>
    </Style>
    <showTitle>1</showTitle>
    <metaTag name="workTitle">${escapeXml(workTitle)}</metaTag>
    <metaTag name="composer">${escapeXml(composer)}</metaTag>
    ${mscxPartsHeader}
    ${mscxStavesXml}
  </Score>
</museScore>`;
}

function escapeXml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Creates a valid .mscz zip file from MusicXML string or object.
 */
async function packMscz(musicXmlContent, outputPath, metadata = {}) {
  const mscxContent = musicXmlToMscx(musicXmlContent, metadata);
  const containerXml = `<?xml version="1.0" encoding="UTF-8"?>
<container>
  <rootfiles>
    <rootfile full-path="score.mscx"/>
  </rootfiles>
</container>`;

  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => resolve(outputPath));
    archive.on('error', (err) => reject(err));

    archive.pipe(output);
    archive.append(containerXml, { name: 'META-INF/container.xml' });
    archive.append(mscxContent, { name: 'score.mscx' });
    archive.finalize();
  });
}

/**
 * Wrapper using native MuseScore CLI if installed.
 */
function convertWithMuseScoreCli(musicXmlPath, msczOutputPath) {
  const musescoreBin = process.env.MUSESCORE_PATH || '/home/caleb/.local/musescore/musescore4';
  return new Promise((resolve, reject) => {
    const cmd = `"${musescoreBin}" --appimage-extract-and-run -o "${msczOutputPath}" "${musicXmlPath}"`;
    exec(cmd, { timeout: 60000 }, (err) => {
      if (err) return reject(err);
      resolve(msczOutputPath);
    });
  });
}

module.exports = {
  musicXmlToMscx,
  packMscz,
  convertWithMuseScoreCli,
  pitchToTpc,
  stepOctaveToPitch,
  resolvePartName
};
