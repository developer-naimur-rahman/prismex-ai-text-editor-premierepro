import React from 'react';
import { usePrismexStore } from '../state/usePrismexStore';
import { Sparkles, CheckSquare, Zap, Cpu, Sliders, Film, ArrowRight } from 'lucide-react';
import { EditorTopRibbon } from '../components/EditorTopRibbon';

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
    jobMessage,
    setActiveTab
  } = usePrismexStore();

  const isRunning = jobStatus !== 'COMPLETE' && jobProgress > 0 && jobProgress < 100;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <EditorTopRibbon />
      <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '14px', flex: 1, overflowY: 'auto' }}>
        <div>
          <h2 style={{ fontSize: '13px', fontWeight: 600 }}>Magic Rough Cut Configuration</h2>
        <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
          Target Sequence: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{sequenceManifest?.sequenceName || 'None'}</span>
        </p>
      </div>

      {/* 1-Click Script Rough Cut Promo / Shortcut */}
      <div style={{
        padding: '12px 14px',
        borderRadius: '10px',
        background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.2) 0%, rgba(147, 51, 234, 0.25) 100%)',
        border: '1px solid rgba(139, 92, 246, 0.45)',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #6366f1, #a855f7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <Film size={16} color="#ffffff" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#ffffff' }}>
              🎬 1-Click Script-to-Rough Cut Sequence
            </div>
            <div style={{ fontSize: '10px', color: '#cbd5e1', marginTop: '3px', lineHeight: 1.4 }}>
              ক্লায়েন্ট স্ক্রিপ্ট অনুযায়ী ডায়ালগ ফিল্টার, A/B Cam পাঞ্চ-ইন ও মার্কারসহ স্বয়ংক্রিয় সিকোয়েন্স কাট করুন
            </div>
          </div>
        </div>

        <button
          onClick={() => setActiveTab('client-hub')}
          style={{
            width: '100%',
            padding: '7px 14px',
            borderRadius: '7px',
            background: 'linear-gradient(135deg, #6366f1, #9333ea)',
            color: '#ffffff',
            border: 'none',
            fontSize: '11px',
            fontWeight: 700,
            cursor: 'pointer',
            textAlign: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            boxShadow: '0 0 12px rgba(147, 51, 234, 0.35)',
            marginTop: '4px'
          }}
        >
          <span>Open Script Rough-Cut</span>
          <ArrowRight size={12} />
        </button>
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
          disabled={isRunning}
          onClick={startMagicRoughCut}
          style={{ padding: '10px 14px', fontSize: '13px', fontWeight: 600 }}
        >
          <Sparkles size={16} />
          <span>{isRunning ? 'Processing Magic Rough Cut...' : 'Generate Magic Rough Cut'}</span>
        </button>
      </div>
      </div>
    </div>
  );
};
