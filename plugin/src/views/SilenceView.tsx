import React from 'react';
import { usePrismexStore } from '../state/usePrismexStore';
import { PremiereHostBridge } from '../host/PremiereHostBridge';
import { Scissors, VolumeX, Sparkles, Play } from 'lucide-react';
import { EditorTopRibbon } from '../components/EditorTopRibbon';

export const SilenceView: React.FC = () => {
  const {
    silenceSettings,
    setSilenceSettings,
    detectedSilences,
    transcribeSequence,
    cutAllSilencesNow,
    sequenceManifest,
    jobStatus,
    jobProgress,
    jobMessage
  } = usePrismexStore();

  const isRunning = jobStatus !== 'COMPLETE' && jobProgress > 0 && jobProgress < 100;
  const hostBridge = PremiereHostBridge.getInstance();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <EditorTopRibbon />
      <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '14px', flex: 1, overflowY: 'auto' }}>
        <div>
          <h2 style={{ fontSize: '13px', fontWeight: 600 }}>Silence &amp; Pause Detection</h2>
        <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
          Rule-based RMS energy parameters for dead air excision ({detectedSilences.length} pause(s) detected).
        </p>
      </div>

      {/* Threshold Slider */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
          <span style={{ fontWeight: 600 }}>Silence Energy Threshold</span>
          <span style={{ color: 'var(--accent-color)', fontWeight: 600 }}>{silenceSettings.thresholdDbfs} dBFS</span>
        </div>
        <input
          type="range"
          min="-60"
          max="-20"
          step="1"
          value={silenceSettings.thresholdDbfs}
          onChange={(e) => setSilenceSettings({ thresholdDbfs: Number(e.target.value) })}
        />
        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
          Signals below this level are classified as silence. Lower values are more conservative.
        </span>
      </div>

      {/* Min Duration Slider */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
          <span style={{ fontWeight: 600 }}>Minimum Silence Duration</span>
          <span style={{ color: 'var(--accent-color)', fontWeight: 600 }}>{silenceSettings.minDurationMs} ms</span>
        </div>
        <input
          type="range"
          min="200"
          max="2000"
          step="50"
          value={silenceSettings.minDurationMs}
          onChange={(e) => setSilenceSettings({ minDurationMs: Number(e.target.value) })}
        />
        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
          Pauses shorter than this duration are preserved as natural speech rhythm.
        </span>
      </div>

      {/* Padding Settings */}
      <div className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
        <div>
          <div style={{ fontSize: '10.5px', fontWeight: 600 }}>Pre-Cut Padding (ms)</div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>Attack buffer</div>
          <input
            type="number"
            value={silenceSettings.preCutPaddingMs}
            onChange={(e) => setSilenceSettings({ preCutPaddingMs: Number(e.target.value) })}
            style={{ width: '100%', padding: '4px 6px', background: 'var(--bg-tertiary)', color: '#fff', border: '1px solid var(--border-subtle)', borderRadius: '4px' }}
          />
        </div>

        <div>
          <div style={{ fontSize: '10.5px', fontWeight: 600 }}>Post-Cut Padding (ms)</div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>Decay buffer</div>
          <input
            type="number"
            value={silenceSettings.postCutPaddingMs}
            onChange={(e) => setSilenceSettings({ postCutPaddingMs: Number(e.target.value) })}
            style={{ width: '100%', padding: '4px 6px', background: 'var(--bg-tertiary)', color: '#fff', border: '1px solid var(--border-subtle)', borderRadius: '4px' }}
          />
        </div>
      </div>

      {/* Breathing Toggle */}
      <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: '11px' }}>Natural Breath Preservation</div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
            Protects inhalation sounds directly preceding spoken sentences.
          </div>
        </div>
        <input
          type="checkbox"
          checked={silenceSettings.preserveBreathing}
          onChange={(e) => setSilenceSettings({ preserveBreathing: e.target.checked })}
        />
      </div>

      {/* Progress Bar during Scan */}
      {isRunning && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>{jobMessage}</span>
            <span style={{ fontWeight: 600 }}>{Math.round(jobProgress)}%</span>
          </div>
          <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ width: `${jobProgress}%`, height: '100%', backgroundColor: 'var(--accent-color)', transition: 'width 0.3s ease' }} />
          </div>
        </div>
      )}

      {/* Detected Silences List */}
      {detectedSilences.length > 0 && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
          <div style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>
            DETECTED SILENCES ({detectedSilences.length})
          </div>
          {detectedSilences.map((s: any, idx: number) => (
            <div
              key={`sil_${idx}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '4px 8px',
                borderRadius: '4px',
                backgroundColor: 'var(--bg-tertiary)',
                fontSize: '10.5px'
              }}
            >
              <div>
                <span style={{ fontWeight: 600, color: '#f87171' }}>Silence #{idx + 1}</span>
                <span style={{ color: 'var(--text-muted)', marginLeft: '6px' }}>
                  {s.start_seconds?.toFixed(2)}s - {s.end_seconds?.toFixed(2)}s ({s.duration_seconds?.toFixed(2)}s)
                </span>
              </div>
              <button
                className="btn-secondary"
                style={{ padding: '2px 6px', fontSize: '9.5px' }}
                onClick={() => {
                  hostBridge.setPlayheadPosition(s.start_seconds);
                  hostBridge.startPlayback(1);
                }}
              >
                <Play size={10} />
                <span>Seek</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ marginTop: 'auto', display: 'flex', gap: '8px' }}>
        <button
          className="btn-secondary"
          disabled={isRunning}
          onClick={transcribeSequence}
          style={{ flex: 1, padding: '9px 10px', fontSize: '11.5px' }}
        >
          <VolumeX size={14} />
          <span>Scan Silences</span>
        </button>

        <button
          className="btn-primary"
          disabled={isRunning}
          onClick={cutAllSilencesNow}
          style={{ flex: 1, padding: '9px 10px', fontSize: '11.5px', fontWeight: 600 }}
        >
          <Scissors size={14} />
          <span>
            {detectedSilences.length > 0
              ? `Cut ${detectedSilences.length} Silence(s) Now`
              : 'Scan & Cut Silences'}
          </span>
        </button>
      </div>
      </div>
    </div>
  );
};
