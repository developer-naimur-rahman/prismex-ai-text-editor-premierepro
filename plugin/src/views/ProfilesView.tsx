import React from 'react';
import { usePrismexStore } from '../state/usePrismexStore';
import { Bookmark, Check } from 'lucide-react';

export const ProfilesView: React.FC = () => {
  const { profiles, activeProfileId, setActiveProfileId } = usePrismexStore();

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', height: '100%', overflowY: 'auto' }}>
      <div>
        <h2 style={{ fontSize: '13px', fontWeight: 600 }}>Editing Profiles</h2>
        <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
          Pre-tuned silence, filler, and take threshold packages for different video formats.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {profiles.map(p => {
          const isSelected = activeProfileId === p.id;
          return (
            <div 
              key={p.id}
              className="card"
              onClick={() => setActiveProfileId(p.id)}
              style={{
                cursor: 'pointer',
                border: isSelected ? '1px solid var(--accent-color)' : '1px solid var(--border-subtle)',
                backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.08)' : 'var(--bg-card)',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Bookmark size={13} color={isSelected ? 'var(--accent-color)' : 'var(--text-muted)'} />
                  <span style={{ fontWeight: 600, fontSize: '12px' }}>{p.name}</span>
                </div>
                {isSelected && (
                  <span style={{ color: 'var(--accent-color)', display: 'flex', alignItems: 'center', gap: '2px', fontSize: '10px', fontWeight: 600 }}>
                    <Check size={12} /> Active
                  </span>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px', fontSize: '10px', color: 'var(--text-secondary)' }}>
                <div>Silence Threshold: <span style={{ color: 'var(--text-primary)' }}>{p.silenceThresholdDbfs} dBFS</span></div>
                <div>Min Pause: <span style={{ color: 'var(--text-primary)' }}>{p.minSilenceDurationMs} ms</span></div>
                <div>Remove Fillers: <span style={{ color: 'var(--text-primary)' }}>{p.removeFillers ? 'Yes' : 'No'}</span></div>
                <div>Take Mode: <span style={{ color: 'var(--text-primary)' }}>{p.takeMode}</span></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
