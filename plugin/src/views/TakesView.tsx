import React, { useState } from 'react';
import { Layers, Play, CheckCircle, Sparkles } from 'lucide-react';
import { PremiereHostBridge } from '../host/PremiereHostBridge';

export const TakesView: React.FC = () => {
  const hostBridge = PremiereHostBridge.getInstance();
  const [takeMode, setTakeMode] = useState<'LAST_TAKE' | 'BEST_TAKE' | 'MANUAL'>('BEST_TAKE');

  const sampleCluster = {
    clusterId: 'cluster_01',
    line: 'The primary benefit of our architecture is that it scales to ten thousand users.',
    candidates: [
      {
        index: 1,
        text: 'The primary benefit of our architecture is... wait, sorry, let me restart.',
        start: 14.2,
        end: 18.5,
        fluencyScore: 3.2,
        isRecommended: false
      },
      {
        index: 2,
        text: 'The primary benefit of our architecture is that it effortlessly scales to ten thousand concurrent users.',
        start: 20.1,
        end: 26.4,
        fluencyScore: 9.4,
        isRecommended: true
      }
    ]
  };

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', height: '100%', overflowY: 'auto' }}>
      <div>
        <h2 style={{ fontSize: '13px', fontWeight: 600 }}>Repeated Take Detection</h2>
        <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
          Identify sentence restarts and audition candidate deliveries side-by-side.
        </p>
      </div>

      {/* Mode Selector */}
      <div className="card" style={{ display: 'flex', gap: '8px' }}>
        {[
          { id: 'BEST_TAKE', label: 'Best Take (AI Scored)' },
          { id: 'LAST_TAKE', label: 'Last Take (Deterministic)' },
          { id: 'MANUAL', label: 'Manual Audition' }
        ].map(m => (
          <button
            key={m.id}
            onClick={() => setTakeMode(m.id as any)}
            style={{
              flex: 1,
              backgroundColor: takeMode === m.id ? 'var(--accent-color)' : 'var(--bg-tertiary)',
              color: takeMode === m.id ? '#fff' : 'var(--text-secondary)',
              fontSize: '10px'
            }}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Take Cluster Card */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>
            TAKE GROUP #1 (2 Candidates)
          </span>
          <span style={{ fontSize: '10px', color: 'var(--purple-color)', fontWeight: 600 }}>
            94% Lexical Similarity
          </span>
        </div>

        {sampleCluster.candidates.map(c => (
          <div 
            key={c.index}
            style={{
              padding: '8px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: c.isRecommended ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-tertiary)',
              border: c.isRecommended ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid transparent',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontWeight: 700, fontSize: '11px' }}>Take {c.index}</span>
                {c.isRecommended && (
                  <span style={{ fontSize: '9px', backgroundColor: 'var(--success-color)', color: '#fff', padding: '1px 5px', borderRadius: '4px', fontWeight: 700 }}>
                    RECOMMENDED BEST
                  </span>
                )}
              </div>

              <button 
                className="btn-secondary"
                style={{ padding: '2px 6px', fontSize: '10px' }}
                onClick={() => hostBridge.setPlayheadPosition(c.start)}
              >
                <Play size={10} />
                <span>Play ({c.start}s)</span>
              </button>
            </div>

            <div style={{ fontSize: '11px', color: 'var(--text-primary)' }}>
              "{c.text}"
            </div>

            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
              Fluency Score: {c.fluencyScore} / 10 • Duration: {(c.end - c.start).toFixed(1)}s
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
