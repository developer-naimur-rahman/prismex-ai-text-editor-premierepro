import React from 'react';
import { usePrismexStore } from '../state/usePrismexStore';
import { Sparkles, Clock, CheckCircle, Scissors, FileText, ArrowRight, RefreshCw } from 'lucide-react';
import { TimecodeConverter } from '../host/TimecodeConverter';

export const DashboardView: React.FC = () => {
  const { 
    sequenceManifest, 
    refreshSequence,
    lastReport, 
    setActiveTab, 
    startMagicRoughCut, 
    setExecutionMode 
  } = usePrismexStore();

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', height: '100%', overflowY: 'auto' }}>
      {/* Quick Launch Hero */}
      <div className="card" style={{ 
        background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(139, 92, 246, 0.12))',
        borderColor: 'rgba(59, 130, 246, 0.3)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: '14px', fontWeight: 600 }}>Magic Rough Cut</h2>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              1-Click AI Rough Cut & Assembly for Premiere Pro
            </p>
          </div>
          <Sparkles color="#8b5cf6" size={20} />
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            className="btn-primary" 
            style={{ flex: 1, padding: '8px 12px', fontSize: '12px' }}
            onClick={() => {
              setExecutionMode('AUTO_EDIT');
              startMagicRoughCut();
            }}
          >
            <Sparkles size={14} />
            <span>Magic Auto Edit (1-Click)</span>
          </button>

          <button 
            className="btn-secondary"
            style={{ flex: 1, padding: '8px 12px', fontSize: '12px' }}
            onClick={() => {
              setExecutionMode('REVIEW_EDIT');
              startMagicRoughCut();
            }}
          >
            <span>Review Edit Mode</span>
            <ArrowRight size={13} />
          </button>
        </div>
      </div>

      {/* Active Sequence Stats Card */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <h3 style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', margin: 0 }}>
            ACTIVE SEQUENCE
          </h3>
          <button 
            onClick={() => refreshSequence()}
            title="Refresh Active Sequence"
            style={{
              background: 'transparent',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-secondary)',
              padding: '3px 8px',
              fontSize: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={10} />
            <span>Refresh</span>
          </button>
        </div>
        {sequenceManifest ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px' }}>
            <div style={{ minWidth: 0, overflow: 'hidden' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Sequence Name</div>
              <div 
                title={sequenceManifest.sequenceName}
                style={{ 
                  fontWeight: 600, 
                  fontSize: '11px', 
                  overflow: 'hidden', 
                  textOverflow: 'ellipsis', 
                  whiteSpace: 'nowrap',
                  maxWidth: '100%' 
                }}
              >
                {sequenceManifest.sequenceName}
              </div>
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Duration</div>
              <div style={{ fontWeight: 600, fontSize: '11px' }}>
                {TimecodeConverter.formatTimecode(sequenceManifest.durationSeconds, sequenceManifest.fps)}
              </div>
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Framerate</div>
              <div style={{ fontWeight: 600, fontSize: '11px' }}>{sequenceManifest.fps} fps</div>
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Audio Tracks</div>
              <div style={{ fontWeight: 600, fontSize: '11px' }}>{sequenceManifest.sourceClips.length} dialogue track items</div>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '12px', color: 'var(--text-muted)' }}>
            No active sequence open in Premiere Pro.
          </div>
        )}
      </div>

      {/* Recent Rough Cut Report */}
      {lastReport && (
        <div className="card" style={{ borderColor: 'rgba(16, 185, 129, 0.3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', color: 'var(--success-color)' }}>
            <CheckCircle size={15} />
            <h3 style={{ fontSize: '12px', fontWeight: 600 }}>ROUGH CUT COMPLETED</h3>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: 'var(--text-secondary)', flexShrink: 0 }}>Cloned Sequence:</span>
              <span 
                title={lastReport.clonedSequenceName}
                style={{ 
                  fontWeight: 600, 
                  overflow: 'hidden', 
                  textOverflow: 'ellipsis', 
                  whiteSpace: 'nowrap',
                  maxWidth: '65%',
                  textAlign: 'right'
                }}
              >
                {lastReport.clonedSequenceName}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Time Saved:</span>
              <span style={{ fontWeight: 700, color: 'var(--success-color)' }}>
                {Math.round(lastReport.timeSavedSeconds)}s ({lastReport.percentSaved}% shorter)
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Cuts Applied:</span>
              <span>{lastReport.totalCutsApplied} cuts ({lastReport.silencesRemovedCount} pauses, {lastReport.takesPrunedCount} takes)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>A/V Sync Verification:</span>
              <span style={{ color: lastReport.syncVerified ? 'var(--success-color)' : 'var(--danger-color)' }}>
                {lastReport.syncVerified ? '0 frame drift (Passed)' : 'Warning'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
