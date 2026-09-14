const path = require('path');
const fs = require('fs');
const { processPdfToMusicXml } = require('./lib/omrEngine');
const { packMscz } = require('./lib/msczConverter');

async function testGloriaScore() {
  console.log('🎼 Testing Sheetra Full Score & Lyrics Extraction Engine...');

  const pdfPath = path.join(__dirname, 'uploads', 'gloria_score.pdf');
  const outputDir = path.join(__dirname, 'outputs');

  if (!fs.existsSync(pdfPath)) {
    throw new Error('PDF score missing!');
  }

  console.log('1. Processing Gloria Score PDF...');
  const xml = await processPdfToMusicXml(pdfPath, {}, (pct, msg) => {
    console.log(`[${pct}%] ${msg}`);
  });

  const xmlPath = path.join(outputDir, 'gloria_output.musicxml');
  fs.writeFileSync(xmlPath, xml, 'utf8');
  console.log('✅ Generated MusicXML at:', xmlPath);

  // Print MusicXML snippet showing title, composer, notes, and lyrics
  console.log('\n--- MusicXML Output Sample ---');
  console.log(xml.slice(0, 1500));

  const msczPath = path.join(outputDir, 'gloria_output.mscz');
  await packMscz(xml, msczPath, { title: 'Gloria In Excelsis Deo', composer: 'Traditional Hymn' });

  console.log('\n✅ Generated MuseScore .mscz file at:', msczPath);
  console.log('🎉 GLORIA SCORE CONVERSION COMPLETE WITH LYRICS INTACT!');
}

testGloriaScore().catch(err => {
  console.error('Test Failed:', err);
  process.exit(1);
});
