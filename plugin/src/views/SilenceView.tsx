import React, { useState } from 'react';
import { Sliders, Volume2, Shield } from 'lucide-react';

export const SilenceView: React.FC = () => {
  const [threshold, setThreshold] = useState(-38);
  const [minDuration, setMinDuration] = useState(500);
  const [preCutPadding, setPreCutPadding] = useState(80);
  const [postCutPadding, setPostCutPadding] = useState(120);
  const [preserveBreathing, setPreserveBreathing] = useState(true);

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', height: '100%', overflowY: 'auto' }}>
      <div>
        <h2 style={{ fontSize: '13px', fontWeight: 600 }}>Silence &amp; Pause Detection</h2>
        <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
          Rule-based RMS energy and Silero VAD parameters for dead air excision.
        </p>
      </div>

      {/* Threshold Slider */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
          <span style={{ fontWeight: 600 }}>Silence Energy Threshold</span>
          <span style={{ color: 'var(--accent-color)', fontWeight: 600 }}>{threshold} dBFS</span>
        </div>
        <input 
          type="range" 
          min="-60" 
          max="-20" 
          step="1"
          value={threshold} 
          onChange={(e) => setThreshold(Number(e.target.value))} 
        />
        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
          Signals below this level are classified as silence. Lower values are more conservative.
        </span>
      </div>

      {/* Min Duration Slider */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
          <span style={{ fontWeight: 600 }}>Minimum Silence Duration</span>
          <span style={{ color: 'var(--accent-color)', fontWeight: 600 }}>{minDuration} ms</span>
        </div>
        <input 
          type="range" 
          min="200" 
          max="2000" 
          step="50"
          value={minDuration} 
          onChange={(e) => setMinDuration(Number(e.target.value))} 
        />
        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
          Pauses shorter than this duration are preserved as natural speech rhythm.
        </span>
      </div>

      {/* Padding Settings */}
      <div className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
        <div>
          <div style={{ fontSize: '10.5px', fontWeight: 600 }}>Pre-Cut Padding</div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>Attack buffer</div>
          <input 
            type="number" 
            value={preCutPadding}
            onChange={(e) => setPreCutPadding(Number(e.target.value))}
            style={{ width: '100%', padding: '4px 6px', background: 'var(--bg-tertiary)', color: '#fff', border: '1px solid var(--border-subtle)', borderRadius: '4px' }}
          />
        </div>

        <div>
          <div style={{ fontSize: '10.5px', fontWeight: 600 }}>Post-Cut Padding</div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>Decay buffer</div>
          <input 
            type="number" 
            value={postCutPadding}
            onChange={(e) => setPostCutPadding(Number(e.target.value))}
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
          checked={preserveBreathing} 
          onChange={(e) => setPreserveBreathing(e.target.checked)} 
        />
      </div>
    </div>
  );
};
