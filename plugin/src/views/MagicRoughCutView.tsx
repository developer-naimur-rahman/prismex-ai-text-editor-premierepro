import React from 'react';
import { usePrismexStore } from '../state/usePrismexStore';
import { Sparkles, CheckSquare, Zap, Cpu, Sliders } from 'lucide-react';

export const MagicRoughCutView: React.FC = () => {
  const { 
    sequenceManifest, 
    executionMode, 
    setExecutionMode, 
    activeProfileId, 
    setActiveProfileId,
    profiles, 
    startMagicRoughCut, 
    jobStatus, 
    jobProgress, 
    jobMessage 
  } = usePrismexStore();

  const isRunning = jobStatus !== 'COMPLETE' && jobProgress > 0 && jobProgress < 100;

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', height: '100%', overflowY: 'auto' }}>
      <div>
        <h2 style={{ fontSize: '13px', fontWeight: 600 }}>Magic Rough Cut Configuration</h2>
        <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
          Target Sequence: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{sequenceManifest?.sequenceName || 'None'}</span>
        </p>
      </div>

      {/* Mode Selection */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>
          EXECUTION MODE
        </div>

        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer' }}>
          <input 
            type="radio" 
            name="execMode" 
            checked={executionMode === 'AUTO_EDIT'} 
            onChange={() => setExecutionMode('AUTO_EDIT')} 
            style={{ marginTop: '2px' }}
          />
          <div>
            <div style={{ fontWeight: 600, fontSize: '11px' }}>Mode A: Magic Auto Edit (Fastest)</div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
              Automatically clones sequence and executes approved cuts in one operation.
            </div>
          </div>
        </label>

        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer' }}>
          <input 
            type="radio" 
            name="execMode" 
            checked={executionMode === 'REVIEW_EDIT'} 
            onChange={() => setExecutionMode('REVIEW_EDIT')} 
            style={{ marginTop: '2px' }}
          />
          <div>
            <div style={{ fontWeight: 600, fontSize: '11px' }}>Mode B: Magic Review Edit (Human Audit)</div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
              Analyzes footage and stages all suggested cuts in the Review Queue for your inspection.
            </div>
          </div>
        </label>
      </div>

      {/* Profile Selection */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>
          EDITING PROFILE
        </div>
        <select 
          value={activeProfileId}
          onChange={(e) => setActiveProfileId(e.target.value)}
          style={{
            backgroundColor: 'var(--bg-tertiary)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
            padding: '6px 8px',
            fontSize: '11px'
          }}
        >
          {profiles.map(p => (
            <option key={p.id} value={p.id}>
              {p.name} {p.isBuiltIn ? '(Built-in)' : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Included Rules Checkboxes */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>
          AUTOMATED FIXES INCLUDED
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px' }}>
          <input type="checkbox" defaultChecked />
          <span>Remove Silence & Awkward Pauses (&gt; 500ms)</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px' }}>
          <input type="checkbox" defaultChecked />
          <span>Prune Repeated Takes &amp; Restarts (Keep Best Take)</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px' }}>
          <input type="checkbox" defaultChecked />
          <span>Excise Vocalic Fillers ("um", "uh", "er")</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px' }}>
          <input type="checkbox" defaultChecked />
          <span>Trim Broken Phonemic Stutters</span>
        </label>
      </div>

      {/* Progress & Launch Button */}
      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {isRunning && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>{jobMessage}</span>
              <span style={{ fontWeight: 600 }}>{Math.round(jobProgress)}%</span>
            </div>
            <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ 
                width: `${jobProgress}%`, 
                height: '100%', 
                backgroundColor: 'var(--accent-color)', 
                transition: 'width 0.3s ease' 
              }} />
            </div>
          </div>
        )}

        <button 
          className="btn-primary" 
          disabled={isRunning || !sequenceManifest}
          onClick={startMagicRoughCut}
          style={{ padding: '10px 14px', fontSize: '13px', fontWeight: 600 }}
        >
          <Sparkles size={16} />
          <span>{isRunning ? 'Processing Magic Rough Cut...' : 'Generate Magic Rough Cut'}</span>
        </button>
      </div>
    </div>
  );
};
