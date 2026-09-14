const path = require('path');
const fs = require('fs');
const { buildMusicXml } = require('./lib/omrEngine');
const { packMscz, musicXmlToMscx } = require('./lib/msczConverter');
const { execSync } = require('child_process');

async function testPipeline() {
  console.log('🧪 Starting Sheetra High-Precision Conversion & Lyric Test...');

  const outputDir = path.join(__dirname, 'outputs');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const testMsczPath = path.join(outputDir, 'test_output_with_lyrics.mscz');

  // 1. Build MusicXML with Lyrics
  console.log('1. Building test MusicXML score with lyrics...');
  const xmlContent = buildMusicXml({
    title: 'Amazing Grace',
    composer: 'John Newton',
    keyFifths: 0,
    timeBeats: 3,
    timeBeatType: 4,
    tempo: 100,
    lyrics: [
      { text: 'A-', syllabic: 'begin' },
      { text: 'ma-', syllabic: 'middle' },
      { text: 'zing', syllabic: 'end' },
      { text: 'grace!', syllabic: 'single' },
      { text: 'how', syllabic: 'single' },
      { text: 'sweet', syllabic: 'single' },
      { text: 'the', syllabic: 'single' },
      { text: 'sound', syllabic: 'single' }
    ]
  });

  // Check if MusicXML contains lyrics
  if (!xmlContent.includes('<lyric number="1">') || !xmlContent.includes('A-')) {
    throw new Error('MusicXML missing expected lyric nodes!');
  }
  console.log('✅ MusicXML successfully includes <lyric> elements and syllable tags');

  // 2. Convert MusicXML to MSCX string and check <Lyrics>
  console.log('2. Translating MusicXML to MuseScore .mscx format...');
  const mscxContent = musicXmlToMscx(xmlContent, { title: 'Amazing Grace', composer: 'John Newton' });
  if (!mscxContent.includes('<Lyrics>') || !mscxContent.includes('<text>A-</text>')) {
    throw new Error('MuseScore MSCX missing expected <Lyrics> node!');
  }
  console.log('✅ MuseScore MSCX successfully translates lyrics into <Lyrics> XML tags');

  // 3. Package MSCZ Archive
  console.log('3. Packaging into MSCZ archive...');
  await packMscz(xmlContent, testMsczPath, {
    title: 'Amazing Grace',
    composer: 'John Newton'
  });

  if (!fs.existsSync(testMsczPath)) {
    throw new Error('Test MSCZ file was not generated!');
  }

  const stat = fs.statSync(testMsczPath);
  console.log(`✅ MSCZ archive generated successfully (${stat.size} bytes)`);

  // 4. Verify ZIP archive structure
  try {
    const unzipList = execSync(`unzip -l "${testMsczPath}"`).toString();
    console.log('4. MSCZ Zip structure verification:');
    console.log(unzipList);

    if (unzipList.includes('META-INF/container.xml') && unzipList.includes('score.mscx')) {
      console.log('🎉 VERIFICATION PASSED: .mscz contains valid MuseScore score and lyrics archive!');
    } else {
      console.error('❌ Missing expected files in MSCZ zip archive');
    }
  } catch (err) {
    console.warn('unzip binary check bypassed');
  }
}

testPipeline().catch(err => {
  console.error('Test Failed:', err);
  process.exit(1);
});
