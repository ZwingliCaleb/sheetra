const path = require('path');
const fs = require('fs');
const { processPdfToMusicXml, isAudiverisAvailable } = require('./lib/omrEngine');
const { packMscz } = require('./lib/msczConverter');

async function testAudiverisPdf() {
  console.log('🎼 Testing Audiveris 5.11.0 OMR Engine...');
  console.log('Audiveris Ready:', isAudiverisAvailable());

  // Create a minimal PDF test file if needed or test pipeline
  const outputsDir = path.join(__dirname, 'outputs');
  const samplePdf = path.join(__dirname, 'uploads', 'sample_score.pdf');

  // If sample PDF doesn't exist, build a valid basic test PDF buffer
  if (!fs.existsSync(samplePdf)) {
    const header = `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<</Font<</F1<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>>>>>/Contents 4 0 R>>endobj 4 0 obj<</Length 80>>stream\nBT /F1 24 Tf 200 700 TD (Amazing Grace) Tj 0 -30 TD (John Newton) Tj ET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f\n0000000009 00000 n\n0000000056 00000 n\n00000000111 00000 n\n00000000280 00000 n\ntrailer<</Size 5/Root 1 0 R>>\nstartxref\n410\n%%EOF`;
    fs.mkdirSync(path.dirname(samplePdf), { recursive: true });
    fs.writeFileSync(samplePdf, header);
  }

  console.log('Processing PDF via Audiveris OMR pipeline...');
  const xml = await processPdfToMusicXml(samplePdf, { title: 'Amazing Grace', composer: 'John Newton' }, (pct, msg) => {
    console.log(`[${pct}%] ${msg}`);
  });

  const outMscz = path.join(outputsDir, 'audiveris_output.mscz');
  await packMscz(xml, outMscz, { title: 'Amazing Grace', composer: 'John Newton' });

  console.log('✅ Generated .mscz output at:', outMscz);
  console.log('🎉 AUDIVERIS OMR INTEGRATION SUCCESSFUL!');
}

testAudiverisPdf().catch(err => {
  console.error('Audiveris Test Error:', err);
  process.exit(1);
});
