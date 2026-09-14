import React, { useEffect, useRef, useState } from 'react';
import { Play, Square, Volume2, Music, CheckCircle2, AlertCircle } from 'lucide-react';
import * as Tone from 'tone';

/**
 * Parses MusicXML XML string into playable note events for Tone.js polyphonic synthesis.
 */
function parseMusicXmlNotes(xmlString) {
  if (!xmlString) return [];
  const events = [];

  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
    const parts = xmlDoc.getElementsByTagName('part');

    for (let p = 0; p < parts.length; p++) {
      const part = parts[p];
      const measures = part.getElementsByTagName('measure');
      let currentTimeSeconds = 0;

      for (let m = 0; m < measures.length; m++) {
        const measure = measures[m];
        const notes = measure.getElementsByTagName('note');

        for (let n = 0; n < notes.length; n++) {
          const noteNode = notes[n];
          const isRest = noteNode.getElementsByTagName('rest').length > 0;
          const isChord = noteNode.getElementsByTagName('chord').length > 0;
          const typeNode = noteNode.getElementsByTagName('type')[0];

          let noteType = typeNode ? typeNode.textContent : 'quarter';
          let durationSec = 0.5; // default quarter note at 120bpm

          if (noteType === 'whole') durationSec = 2.0;
          else if (noteType === 'half') durationSec = 1.0;
          else if (noteType === 'quarter') durationSec = 0.5;
          else if (noteType === 'eighth') durationSec = 0.25;
          else if (noteType === 'sixteenth') durationSec = 0.125;

          if (!isChord && !isRest) {
            currentTimeSeconds += durationSec;
          }

          if (!isRest) {
            const pitchNode = noteNode.getElementsByTagName('pitch')[0];
            if (pitchNode) {
              const step = pitchNode.getElementsByTagName('step')[0]?.textContent || 'C';
              const octave = pitchNode.getElementsByTagName('octave')[0]?.textContent || '4';
              const alterNode = pitchNode.getElementsByTagName('alter')[0];

              let noteName = step;
              if (alterNode) {
                const alter = parseInt(alterNode.textContent, 10);
                if (alter === 1) noteName += '#';
                else if (alter === -1) noteName += 'b';
              }
              noteName += octave;

              events.push({
                time: currentTimeSeconds,
                note: noteName,
                duration: durationSec
              });
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn('Error parsing MusicXML for audio playback:', err);
  }

  return events;
}

export default function ScoreViewer({ xmlData, scoreTitle, scoreComposer }) {
  const osmdContainerRef = useRef(null);
  const osmdInstanceRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [renderStatus, setRenderStatus] = useState('loading'); // loading, ready, error
  const [tempo, setTempo] = useState(120);

  // Render score using OpenSheetMusicDisplay
  useEffect(() => {
    let isMounted = true;

    async function loadOsmd() {
      if (!osmdContainerRef.current || !xmlData) return;

      try {
        setRenderStatus('loading');
        const { OpenSheetMusicDisplay } = await import('opensheetmusicdisplay');

        if (!osmdInstanceRef.current) {
          osmdContainerRef.current.innerHTML = '';
          osmdInstanceRef.current = new OpenSheetMusicDisplay(osmdContainerRef.current, {
            autoResize: true,
            drawTitle: true,
            drawSubtitle: false,
            drawComposer: true,
            backend: 'svg'
          });
        }

        await osmdInstanceRef.current.load(xmlData);
        if (isMounted) {
          osmdInstanceRef.current.render();
          setRenderStatus('ready');
        }
      } catch (err) {
        console.error('OSMD Render Error:', err);
        if (isMounted) setRenderStatus('error');
      }
    }

    loadOsmd();

    return () => {
      isMounted = false;
    };
  }, [xmlData]);

  // Web Audio Polyphonic Tone Synthesis Playback from XML
  const handlePlayToggle = async () => {
    if (isPlaying) {
      Tone.Transport.stop();
      Tone.Transport.cancel();
      setIsPlaying(false);
      return;
    }

    try {
      await Tone.start();
      Tone.Transport.cancel();

      const synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.02, decay: 0.1, sustain: 0.3, release: 0.8 }
      }).toDestination();

      Tone.Transport.bpm.value = tempo;
      const noteEvents = parseMusicXmlNotes(xmlData);

      if (noteEvents.length === 0) {
        alert('No playable notes found in converted score XML');
        return;
      }

      let maxEndTime = 0;
      const tempoRatio = 120 / tempo;

      noteEvents.forEach(({ time, note, duration }) => {
        const scaledTime = time * tempoRatio;
        const scaledDuration = duration * tempoRatio;
        if (scaledTime + scaledDuration > maxEndTime) {
          maxEndTime = scaledTime + scaledDuration;
        }

        Tone.Transport.schedule((t) => {
          try {
            synth.triggerAttackRelease(note, scaledDuration, t);
          } catch (e) {}
        }, scaledTime);
      });

      Tone.Transport.start();
      setIsPlaying(true);

      Tone.Transport.schedule(() => {
        setIsPlaying(false);
      }, maxEndTime + 0.5);
    } catch (err) {
      console.error('Audio playback error:', err);
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '24px', marginTop: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Music style={{ color: 'var(--accent-purple)' }} />
            {scoreTitle || 'Converted Sheet Preview'}
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '2px' }}>
            Composer: {scoreComposer || 'Unknown'}
          </p>
        </div>

        {/* Audio Player Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(15, 23, 42, 0.6)', padding: '6px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
          <button
            onClick={handlePlayToggle}
            className="btn-primary"
            style={{ padding: '8px 16px', fontSize: '0.85rem' }}
          >
            {isPlaying ? <Square size={16} /> : <Play size={16} />}
            {isPlaying ? 'Stop Playback' : 'Play SATB Score'}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            <Volume2 size={16} />
            <span>Tempo: {tempo} BPM</span>
            <input
              type="range"
              min="60"
              max="200"
              value={tempo}
              onChange={(e) => setTempo(Number(e.target.value))}
              style={{ width: '80px', accentColor: 'var(--primary)' }}
            />
          </div>
        </div>
      </div>

      {/* Sheet Music Render Area */}
      <div style={{ position: 'relative' }}>
        {renderStatus === 'loading' && (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Rendering vector sheet music notation...
          </div>
        )}
        {renderStatus === 'error' && (
          <div style={{ padding: '20px', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={18} />
            Could not render SVG score layout preview, but MSCZ file is ready for download below.
          </div>
        )}
        <div id="osmdContainer" ref={osmdContainerRef} />
      </div>
    </div>
  );
}
