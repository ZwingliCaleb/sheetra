require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const jobQueue = require('./lib/jobQueue');
const { processPdfToMusicXml, isAudiverisAvailable } = require('./lib/omrEngine');
const { packMscz, convertWithMuseScoreCli } = require('./lib/msczConverter');

const app = express();
const PORT = process.env.PORT || 4000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Directories setup
const uploadsDir = path.join(__dirname, 'uploads');
const outputsDir = path.join(__dirname, 'outputs');

if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(outputsDir)) fs.mkdirSync(outputsDir, { recursive: true });

// Multer upload config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname) || '.pdf';
    cb(null, `score-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are supported for sheet music conversion'));
    }
  }
});

// Serve frontend static build if present
const frontendDist = path.join(__dirname, '../frontend/dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
}

// 1. Health check & System capabilities
app.get('/api/health', (req, res) => {
  const audiverisPresent = isAudiverisAvailable();
  const musescorePresent = !!process.env.MUSESCORE_PATH && fs.existsSync(process.env.MUSESCORE_PATH);

  res.json({
    status: 'online',
    app: 'Sheetra PDF to MSCZ Converter',
    version: '1.0.0',
    capabilities: {
      audiveris: audiverisPresent,
      musescoreCli: musescorePresent,
      smartXmlConverter: true,
      directMsczPackager: true
    },
    activeJobsCount: jobQueue.getAllJobs().length
  });
});

// 2. Start conversion job
app.post('/api/convert', upload.single('score'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No PDF score file uploaded' });
  }

  const { title, composer, keyFifths, timeBeats, timeBeatType, clefSign, tempo, engine } = req.body;
  const pdfPath = req.file.path;
  const originalName = req.file.originalname;
  const baseName = path.parse(originalName).name;

  const jobOptions = {
    title: title || baseName,
    composer: composer || 'Unknown Composer',
    keyFifths: keyFifths || 0,
    timeBeats: timeBeats || 4,
    timeBeatType: timeBeatType || 4,
    clefSign: clefSign || 'G',
    tempo: tempo || 120,
    engine: engine || 'smart'
  };

  const job = jobQueue.createJob(originalName, jobOptions);
  job.status = 'processing';

  // Async processing worker
  (async () => {
    try {
      jobQueue.updateProgress(job.id, 10, 'Uploaded PDF score received');

      // Step 1: OMR processing -> MusicXML (Audiveris 5.11.0 + Tesseract OCR)
      const { musicXml, audiverisMxlPath } = await processPdfToMusicXmlFull(pdfPath, jobOptions, (pct, msg) => {
        jobQueue.updateProgress(job.id, pct, msg);
      });

      // Save MusicXML file
      const xmlFilename = `${job.id}.musicxml`;
      const xmlPath = path.join(outputsDir, xmlFilename);
      fs.writeFileSync(xmlPath, musicXml, 'utf8');

      // Copy raw Audiveris .mxl if available (directly openable in MuseScore)
      let mxlFilename = null;
      if (audiverisMxlPath && fs.existsSync(audiverisMxlPath)) {
        mxlFilename = `${job.id}.mxl`;
        fs.copyFileSync(audiverisMxlPath, path.join(outputsDir, mxlFilename));
      }

      jobQueue.updateProgress(job.id, 85, 'Building MuseScore .mscz with accurate SATB voice parts...');

      // Step 2: Package MSCZ - try MuseScore 4 CLI first (most accurate)
      const msczFilename = `${job.id}.mscz`;
      const msczPath = path.join(outputsDir, msczFilename);
      const musescoreBin = process.env.MUSESCORE_PATH || '/home/caleb/.local/musescore/app/AppRun';

      let usedMuseScoreCli = false;
      if (fs.existsSync(musescoreBin)) {
        try {
          jobQueue.updateProgress(job.id, 88, 'Converting with MuseScore 4 Studio CLI for note-perfect output...');
          await convertWithMuseScoreCli(xmlPath, msczPath);
          if (fs.existsSync(msczPath) && fs.statSync(msczPath).size > 100) {
            usedMuseScoreCli = true;
            jobQueue.updateProgress(job.id, 95, 'MuseScore 4 Studio: note-perfect SATB MSCZ generated!');
          }
        } catch (cliErr) {
          jobQueue.updateProgress(job.id, 90, `MuseScore CLI note: ${cliErr.message.slice(0, 80)}. Using MSCZ packager.`);
        }
      }

      if (!usedMuseScoreCli) {
        jobQueue.updateProgress(job.id, 90, 'Packaging MSCZ with Audiveris MusicXML notes and SATB part labels...');
        await packMscz(musicXml, msczPath, { title: jobOptions.title, composer: jobOptions.composer });
      }

      jobQueue.updateProgress(job.id, 98, 'Finalizing score outputs...');

      // Clean up temp upload file
      if (fs.existsSync(pdfPath)) {
        try { fs.unlinkSync(pdfPath); } catch (e) {}
      }

      jobQueue.completeJob(job.id, {
        mscz: msczFilename,
        musicxml: xmlFilename,
        mxl: mxlFilename,
        title: jobOptions.title,
        composer: jobOptions.composer
      });

    } catch (err) {
      console.error(`Job ${job.id} failed:`, err);
      jobQueue.failJob(job.id, err.message || 'Sheet music conversion failed');
    }
  })();

  res.status(202).json({
    jobId: job.id,
    status: job.status,
    message: 'Conversion job started successfully'
  });
});

// 3. Get job status
app.get('/api/jobs/:id', (req, res) => {
  const job = jobQueue.getJob(req.params.id);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  res.json(job);
});

// 4. Get MusicXML score for rendering/preview
app.get('/api/jobs/:id/score', (req, res) => {
  const job = jobQueue.getJob(req.params.id);
  if (!job || job.status !== 'completed' || !job.outputs.musicxml) {
    return res.status(404).json({ error: 'Score not ready or job not found' });
  }

  const xmlPath = path.join(outputsDir, job.outputs.musicxml);
  if (!fs.existsSync(xmlPath)) {
    return res.status(404).json({ error: 'Score XML file missing on server' });
  }

  res.setHeader('Content-Type', 'application/xml');
  res.sendFile(xmlPath);
});

// 5. Download score file
app.get('/api/jobs/:id/download/:format', (req, res) => {
  const { id, format } = req.params;
  const job = jobQueue.getJob(id);

  if (!job || job.status !== 'completed') {
    return res.status(404).json({ error: 'Job not completed or not found' });
  }

  const safeTitle = (job.options.title || 'converted_score').replace(/[^a-zA-Z0-9_-]/g, '_');
  let filename = '';
  let contentType = 'application/octet-stream';

  if (format === 'mscz') {
    filename = job.outputs.mscz;
    contentType = 'application/x-musescore';
  } else if (format === 'musicxml' || format === 'xml') {
    filename = job.outputs.musicxml;
    contentType = 'application/xml';
  } else {
    return res.status(400).json({ error: 'Unsupported download format' });
  }

  const filePath = path.join(outputsDir, filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Requested file not found on disk' });
  }

  const downloadName = `${safeTitle}.${format === 'xml' ? 'musicxml' : format}`;
  res.setHeader('Content-Type', contentType);
  res.download(filePath, downloadName);
});

// 6. Conversion history
app.get('/api/history', (req, res) => {
  const jobs = jobQueue.getAllJobs().map(j => ({
    id: j.id,
    originalName: j.originalName,
    title: j.options.title,
    composer: j.options.composer,
    status: j.status,
    progress: j.progress,
    createdTime: j.createdTime,
    completedTime: j.completedTime
  }));
  res.json({ jobs });
});

// Fallback route for SPA if frontend build exists
if (fs.existsSync(frontendDist)) {
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`🎼 Sheetra PDF to MSCZ Backend listening on port ${PORT}`);
});
