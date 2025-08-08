const { exec } = require('child_process');
const path = require('path');

function convertPdfToMscz(pdfPath, outputDir, callback) {
    const baseName = path.parse(pdfPath).name;
    const musicXmlMxlPath = path.join(outputDir, `${baseName}.mxl`);
    const msczPath = path.join(outputDir, `${baseName}.mscz`);

    const audiverisCmd = `Audiveris -batch -export -output "${outputDir}" "${pdfPath}"`;

    exec(audiverisCmd, (err) => {
        if (err) return callback(new Error('Audiveris failed: ' + err));
        const musescoreCmd = `"/mnt/c/Program Files/Musescore 4/bin/Musescore4.exe" -o "${msczPath}" "${musicXmlMxlPath}"`;

        exec(musescoreCmd, (err2, stdout, stderr) => {
            if (err2) {
                console.error('MuseScore command error:', err2);
                console.error('stderr:', stderr);
                return callback(new Error('MuseScore Failed: ' + err2))
            }

            callback(null, msczPath);
        });
    });
}

const pdfFile = path.resolve(__dirname,'uploads','example.pdf');
const outputFolder = path.resolve('./outputs');

convertPdfToMscz(pdfFile, outputFolder, (err, msczPath) => {
    if (err) {
        console.error(err.message);
    } else {
        console.log('conversion complete! MSCZ saved at:', msczPath);
    }
})