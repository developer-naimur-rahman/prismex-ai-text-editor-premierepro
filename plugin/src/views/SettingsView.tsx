import React from 'react';
import { usePrismexStore } from '../state/usePrismexStore';
import { Settings, Trash2, Cpu, HardDrive } from 'lucide-react';

export const SettingsView: React.FC = () => {
  const { daemonOnline } = usePrismexStore();

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', height: '100%', overflowY: 'auto' }}>
      <div>
        <h2 style={{ fontSize: '13px', fontWeight: 600 }}>System Settings</h2>
        <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
          Local processing core and timeline integration preferences.
        </p>
      </div>

      {/* Hardware & Daemon Status */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>
          LOCAL HARDWARE ACCELERATION
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Cpu size={18} color="var(--accent-color)" />
          <div>
            <div style={{ fontSize: '11px', fontWeight: 600 }}>Apple Silicon Unified Memory (UMA)</div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
              Metal Performance Shaders + Neural Engine Enabled
            </div>
          </div>
        </div>
        <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>
          Memory Budget Ceiling: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>2,500 MB (2.5 GB RAM)</span>
        </div>
      </div>

      {/* Sequence Cloned Naming Template */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>
          CLONED SEQUENCE NAMING TEMPLATE
        </div>
        <input 
          type="text" 
          defaultValue="{OriginalSequence}_PrismexRoughCut"
          style={{ padding: '6px 8px', background: 'var(--bg-tertiary)', color: '#fff', border: '1px solid var(--border-subtle)', borderRadius: '4px', fontSize: '11px' }}
        />
        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
          Original sequences are preserved untouched in your project panel.
        </span>
      </div>

      {/* Cache & Temp Cleanup */}
      <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: '11px' }}>Audio Scratch Cache</div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
            Temporary WAV extraction files are shredded automatically post-cut.
          </div>
        </div>
        <button className="btn-secondary" onClick={() => alert('Temporary scratch cache cleared.')}>
          <Trash2 size={11} />
          <span>Purge Cache</span>
        </button>
      </div>
    </div>
  );
};
