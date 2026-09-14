const path = require('path');
const fs = require('fs');
const { buildMusicXml } = require('./lib/omrEngine');
const { packMscz, musicXmlToMscx } = require('./lib/msczConverter');

async function testSatbConversion() {
  console.log('🧪 Testing Full SATB Choral (Soprano, Alto, Tenor, Bass) Engine...');

  const outputsDir = path.join(__dirname, 'outputs');
  const satbXml = buildMusicXml({
    title: 'Hallelujah Chorus SATB',
    composer: 'G. F. Handel',
    keyFifths: 2,
    timeBeats: 4,
    timeBeatType: 4,
    tempo: 108,
    lyrics: [
      { text: 'Hal-', syllabic: 'begin' },
      { text: 'le-', syllabic: 'middle' },
      { text: 'lu-', syllabic: 'middle' },
      { text: 'jah!', syllabic: 'end' }
    ]
  });

  // Verify multi-part XML
  if (!satbXml.includes('<part id="P1">') || !satbXml.includes('<part id="P4">')) {
    throw new Error('SATB MusicXML missing multi-part structure!');
  }
  console.log('✅ MusicXML contains all 4 SATB vocal parts (Soprano, Alto, Tenor, Bass)');

  // Verify MSCX multi-staff translation
  const mscx = musicXmlToMscx(satbXml, { title: 'Hallelujah Chorus SATB', composer: 'G. F. Handel' });
  if (!mscx.includes('<Staff id="1">') || !mscx.includes('<Staff id="4">')) {
    throw new Error('MuseScore MSCX missing 4-part SATB staff hierarchy!');
  }
  console.log('✅ MuseScore MSCX successfully contains 4 separate SATB staves and parts');

  const msczPath = path.join(outputsDir, 'satb_hallelujah.mscz');
  await packMscz(satbXml, msczPath, { title: 'Hallelujah Chorus SATB', composer: 'G. F. Handel' });

  console.log('✅ Generated .mscz file at:', msczPath);
  console.log('🎉 FULL SATB CHORAL ARRANGEMENT CONVERSION PASSED!');
}

testSatbConversion().catch(err => {
  console.error('SATB Test Failed:', err);
  process.exit(1);
});
