require('dotenv').config();
const express = require('express');
const multer = require('multer');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 4000;

const upload = multer({ dest: 'uploads/' });

app.post('/convert', upload.single('score'), (req, res) => {
    const pdfPath = req.file.path;
    const baseName = path.parse(req.file.originalname).name;
    const outputDir = path.join(__dirname, 'output');
    const musicXMLPath = path.join(outputDir, `${baseName}.musicxml`);
    const msczPath = path.join(outputDir, `${baseName}.mscz`);

    const audiverisCmd = `${process.env.AUDIVERIS_PATH} -batch -export -output "${outputDir}" "${pdfPath}"`;
    const musescoreCmd = `${process.env.MUSESCORE_PATH} -o "${msczPath}" "${musicXMLPath}"`;

    exec(audiverisCmd, (err) => {
        if (err) {
            console.error('Audiveris failed:', err);
            return res.status(500).send('Audiveris conversion failed');
        }
        exec(musescoreCmd, (err2) => {
            if (err2) {
                console.error('MuseScore CLI failed:', err2);
                return res.status(500).send('MuseScore conversion failed');
            }

            res.download(msczPath, `${baseName}.mscz`, () => {
                fs.unlinkSync(pdfPath);
                fs.unlinkSync(musicXMLPath);
                fs.unlinkSync(msczPath);
            });
        });
    });
});

app.listen(PORT, () => {
    console.log(`🎼 Sheetra backend running at http://localhost:${PORT}`);
});
