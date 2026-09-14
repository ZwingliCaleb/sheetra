import React, { useState, useEffect } from 'react';
import {
  FileMusic, UploadCloud, Cpu, Download, RefreshCw, CheckCircle2,
  AlertCircle, Music2, Sparkles, Terminal, Settings, History, Layers
} from 'lucide-react';
import ScoreViewer from './components/ScoreViewer';

export default function App() {
  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [title, setTitle] = useState('');
  const [composer, setComposer] = useState('');
  const [keyFifths, setKeyFifths] = useState(0);
  const [timeBeats, setTimeBeats] = useState(4);
  const [timeBeatType, setTimeBeatType] = useState(4);
  const [tempo, setTempo] = useState(120);
  const [engine, setEngine] = useState('smart');

  // System & Job State
  const [systemHealth, setSystemHealth] = useState(null);
  const [activeJob, setActiveJob] = useState(null);
  const [scoreXml, setScoreXml] = useState(null);
  const [showLogs, setShowLogs] = useState(false);
  const [history, setHistory] = useState([]);

  // Fetch backend health on mount
  useEffect(() => {
    fetchHealth();
    fetchHistory();
  }, []);

  const fetchHealth = async () => {
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        setSystemHealth(data);
      }
    } catch (err) {
      console.warn('Backend server offline or starting...');
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/history');
      if (res.ok) {
        const data = await res.json();
        setHistory(data.jobs || []);
      }
    } catch (err) {}
  };

  // Poll active conversion job status
  useEffect(() => {
    if (!activeJob || activeJob.status === 'completed' || activeJob.status === 'failed') return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/jobs/${activeJob.id}`);
        if (res.ok) {
          const updatedJob = await res.json();
          setActiveJob(updatedJob);

          if (updatedJob.status === 'completed') {
            fetchScoreXml(updatedJob.id);
            fetchHistory();
          }
        }
      } catch (err) {
        console.error('Job polling error:', err);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [activeJob?.id, activeJob?.status]);

  const fetchScoreXml = async (jobId) => {
    try {
      const res = await fetch(`/api/jobs/${jobId}/score`);
      if (res.ok) {
        const xmlText = await res.text();
        setScoreXml(xmlText);
      }
    } catch (err) {}
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type === 'application/pdf' || droppedFile.name.endsWith('.pdf')) {
        setFile(droppedFile);
        if (!title) setTitle(droppedFile.name.replace(/\.pdf$/i, ''));
      }
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      if (!title) setTitle(selectedFile.name.replace(/\.pdf$/i, ''));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return;

    setScoreXml(null);
    const formData = new FormData();
    formData.append('score', file);
    formData.append('title', title);
    formData.append('composer', composer);
    formData.append('keyFifths', keyFifths);
    formData.append('timeBeats', timeBeats);
    formData.append('timeBeatType', timeBeatType);
    formData.append('tempo', tempo);
    formData.append('engine', engine);

    try {
      const res = await fetch('/api/convert', {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        setActiveJob({
          id: data.jobId,
          status: 'processing',
          progress: 5,
          currentStep: 'Starting conversion...',
          logs: ['Upload accepted by server. Worker initialized.']
        });
      } else {
        alert('Failed to launch conversion job.');
      }
    } catch (err) {
      alert('Error connecting to backend server.');
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 20px' }}>
      
      {/* Header Bar */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '36px', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            background: 'linear-gradient(135deg, var(--primary) 0%, var(--accent-purple) 100%)',
            padding: '12px', borderRadius: '16px', display: 'flex', boxShadow: '0 0 20px rgba(99, 102, 241, 0.4)'
          }}>
            <FileMusic size={32} color="#ffffff" />
          </div>
          <div>
            <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.8rem', fontWeight: 800, background: 'linear-gradient(to right, #ffffff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Sheetra
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
              High-Precision PDF to MSCZ Sheet Music Converter
            </p>
          </div>
        </div>

        {/* System Capabilities Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div className="glass-panel" style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: systemHealth ? '#10b981' : '#ef4444' }} />
            {systemHealth ? 'Backend Engine Online' : 'Backend Connecting...'}
          </div>

          <div className="glass-panel" style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Cpu size={14} style={{ color: 'var(--accent-cyan)' }} />
            {systemHealth?.capabilities?.audiveris ? 'Audiveris OMR Ready' : 'Smart OMR & MSCZ Engine Active'}
          </div>
        </div>
      </header>

      {/* Main Workspace Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px' }}>
        
        {/* Left Column: Upload & Options */}
        <div className="glass-panel" style={{ padding: '28px' }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <UploadCloud style={{ color: 'var(--primary)' }} />
            1. Select PDF Sheet Music
          </h2>

          <form onSubmit={handleSubmit}>
            {/* Drag Drop Area */}
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              style={{
                border: `2px dashed ${dragActive ? 'var(--primary)' : file ? 'var(--accent-emerald)' : 'var(--border-color)'}`,
                borderRadius: 'var(--radius-md)',
                padding: '36px 20px',
                textAlign: 'center',
                background: dragActive ? 'rgba(99, 102, 241, 0.1)' : 'rgba(15, 23, 42, 0.4)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                marginBottom: '24px'
              }}
              onClick={() => document.getElementById('pdfInput').click()}
            >
              <input
                id="pdfInput"
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />

              {file ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <FileMusic size={40} style={{ color: 'var(--accent-emerald)' }} />
                  <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{file.name}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    {(file.size / (1024 * 1024)).toFixed(2)} MB PDF Document
                  </span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                  <UploadCloud size={44} style={{ color: 'var(--text-muted)' }} />
                  <div>
                    <span style={{ fontWeight: 600, color: 'var(--primary)' }}>Click to upload</span> or drag PDF sheet here
                  </div>
                  <span style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>Supports scanned and digital score PDFs up to 25MB</span>
                </div>
              )}
            </div>

            {/* Score Configuration Inputs */}
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)' }}>
              <Settings size={16} />
              2. Score Metadata & Options
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Score Title</label>
                <input
                  className="input-field"
                  type="text"
                  placeholder="e.g. Moonlight Sonata"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Composer</label>
                <input
                  className="input-field"
                  type="text"
                  placeholder="e.g. L. v. Beethoven"
                  value={composer}
                  onChange={(e) => setComposer(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '24px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Key (Fifths)</label>
                <select className="input-field" value={keyFifths} onChange={(e) => setKeyFifths(Number(e.target.value))}>
                  <option value={0}>C Major / A Minor (0)</option>
                  <option value={1}>G Major / E Minor (1♯)</option>
                  <option value={2}>D Major (2♯)</option>
                  <option value={3}>A Major (3♯)</option>
                  <option value={-1}>F Major (1♭)</option>
                  <option value={-2}>B♭ Major (2♭)</option>
                  <option value={-3}>E♭ Major (3♭)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Time Sig</label>
                <select className="input-field" value={`${timeBeats}/${timeBeatType}`} onChange={(e) => {
                  const [b, t] = e.target.value.split('/');
                  setTimeBeats(Number(b));
                  setTimeBeatType(Number(t));
                }}>
                  <option value="4/4">4 / 4 Common</option>
                  <option value="3/4">3 / 4 Waltz</option>
                  <option value="2/4">2 / 4 March</option>
                  <option value="6/8">6 / 8 Compound</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Tempo</label>
                <input
                  className="input-field"
                  type="number"
                  min="40"
                  max="240"
                  value={tempo}
                  onChange={(e) => setTempo(Number(e.target.value))}
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn-primary"
              disabled={!file || (activeJob && activeJob.status === 'processing')}
              style={{ width: '100%', justifyContent: 'center', padding: '14px' }}
            >
              <Sparkles size={18} />
              {activeJob?.status === 'processing' ? 'Converting Score...' : 'Convert PDF to MSCZ'}
            </button>
          </form>
        </div>

        {/* Right Column: Status & Downloads */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Progress Tracker Card */}
          <div className="glass-panel" style={{ padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Layers style={{ color: 'var(--accent-purple)' }} />
                Conversion Pipeline
              </h2>

              <button
                onClick={() => setShowLogs(!showLogs)}
                className="btn-secondary"
                style={{ padding: '4px 10px', fontSize: '0.75rem' }}
              >
                <Terminal size={14} />
                {showLogs ? 'Hide Logs' : 'View Terminal'}
              </button>
            </div>

            {activeJob ? (
              <div>
                {/* Progress Bar */}
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.88rem' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{activeJob.currentStep}</span>
                    <span style={{ color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{activeJob.progress}%</span>
                  </div>
                  <div style={{ height: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${activeJob.progress}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, var(--primary) 0%, var(--accent-cyan) 100%)',
                      transition: 'width 0.4s ease'
                    }} />
                  </div>
                </div>

                {/* Status Indicator */}
                {activeJob.status === 'completed' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-emerald)', marginTop: '16px', fontWeight: 600 }}>
                    <CheckCircle2 size={18} />
                    MSCZ conversion finished successfully!
                  </div>
                )}
                {activeJob.status === 'failed' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444', marginTop: '16px', fontWeight: 600 }}>
                    <AlertCircle size={18} />
                    {activeJob.error || 'Conversion failed'}
                  </div>
                )}

                {/* Logs terminal */}
                {showLogs && (
                  <div style={{
                    marginTop: '16px',
                    background: '#090d16',
                    padding: '12px',
                    borderRadius: 'var(--radius-sm)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.78rem',
                    maxHeight: '160px',
                    overflowY: 'auto',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-muted)'
                  }}>
                    {activeJob.logs?.map((log, i) => (
                      <div key={i} style={{ marginBottom: '4px' }}>{log}</div>
                    ))}
                  </div>
                )}

                {/* Download Center when completed */}
                {activeJob.status === 'completed' && (
                  <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <a
                      href={`/api/jobs/${activeJob.id}/download/mscz`}
                      className="btn-primary"
                      style={{ textDecoration: 'none', flex: 1, justifyContent: 'center' }}
                    >
                      <Download size={18} />
                      Download .MSCZ File
                    </a>

                    <a
                      href={`/api/jobs/${activeJob.id}/download/musicxml`}
                      className="btn-secondary"
                      style={{ textDecoration: 'none' }}
                    >
                      <FileMusic size={18} />
                      .MusicXML
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-dim)' }}>
                Upload a PDF file to trigger the automated OMR and MSCZ builder.
              </div>
            )}
          </div>

          {/* History drawer card */}
          {history.length > 0 && (
            <div className="glass-panel" style={{ padding: '24px' }}>
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <History size={16} style={{ color: 'var(--accent-amber)' }} />
                Recent Conversions
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                {history.map((j) => (
                  <div
                    key={j.id}
                    onClick={() => {
                      setActiveJob(j);
                      if (j.status === 'completed') fetchScoreXml(j.id);
                    }}
                    style={{
                      padding: '10px 14px',
                      background: 'rgba(15, 23, 42, 0.5)',
                      borderRadius: 'var(--radius-sm)',
                      display: 'flex',
                      justify: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer',
                      border: '1px solid var(--border-color)',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{j.title || j.originalName}</div>
                      <div style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>{new Date(j.createdTime).toLocaleTimeString()}</div>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: j.status === 'completed' ? 'var(--accent-emerald)' : 'var(--accent-amber)' }}>
                      {j.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Interactive Vector Notation Preview & Audio Player */}
      {scoreXml && activeJob?.status === 'completed' && (
        <ScoreViewer
          xmlData={scoreXml}
          scoreTitle={activeJob.options?.title}
          scoreComposer={activeJob.options?.composer}
        />
      )}

    </div>
  );
}
