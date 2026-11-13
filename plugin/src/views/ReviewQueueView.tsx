import React, { useState } from 'react';
import { usePrismexStore } from '../state/usePrismexStore';
import { PremiereHostBridge } from '../host/PremiereHostBridge';
import { translations } from '../i18n/translations';
import { 
  Check, 
  X, 
  Play, 
  Layers, 
  Sliders, 
  MessageSquare, 
  CheckCheck, 
  XCircle, 
  Zap 
} from 'lucide-react';

export const ReviewQueueView: React.FC = () => {
  const { 
    reviewItems, 
    updateReviewItemStatus, 
    acceptAllReviewItems, 
    rejectAllReviewItems, 
    applyApprovedReviewQueue,
    language
  } = usePrismexStore();

  const t = translations[language];
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [applying, setApplying] = useState(false);
  const hostBridge = PremiereHostBridge.getInstance();

  const handleApply = async () => {
    setApplying(true);
    try {
      await applyApprovedReviewQueue();
    } finally {
      setApplying(false);
    }
  };

  const filteredItems = reviewItems.filter(item => {
    if (filterCategory === 'ALL') return true;
    return item.category === filterCategory;
  });

  const acceptedCount = reviewItems.filter(i => i.status === 'ACCEPTED').length;

  return (
    <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px', height: '100%', overflow: 'hidden' }}>
      {/* Top Header & Bulk Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: '13px', fontWeight: 600 }}>Review Queue</h2>
          <span style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>
            {reviewItems.length} suggestions ({acceptedCount} approved for cut)
          </span>
        </div>

        <div style={{ display: 'flex', gap: '6px' }}>
          <button className="btn-secondary" style={{ fontSize: '10px' }} onClick={acceptAllReviewItems}>
            <CheckCheck size={12} />
            <span>Approve All</span>
          </button>
          <button className="btn-secondary" style={{ fontSize: '10px' }} onClick={rejectAllReviewItems}>
            <XCircle size={12} />
            <span>Reject All</span>
          </button>
        </div>
      </div>

      {/* Filter Category Pills */}
      <div style={{ display: 'flex', gap: '4px' }}>
        {['ALL', 'SILENCE', 'REPEATED_TAKE', 'FILLER_WORD'].map(cat => (
          <button
            key={cat}
            onClick={() => setFilterCategory(cat)}
            style={{
              padding: '3px 8px',
              fontSize: '10px',
              backgroundColor: filterCategory === cat ? 'var(--accent-color)' : 'var(--bg-tertiary)',
              color: filterCategory === cat ? '#fff' : 'var(--text-secondary)',
              borderRadius: '12px'
            }}
          >
            {cat.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Suggestions List */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '2px' }}>
        {filteredItems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
            No suggested edits in this category.
          </div>
        ) : (
          filteredItems.map((item) => {
            const isAccepted = item.status === 'ACCEPTED';
            const isRejected = item.status === 'REJECTED';

            return (
              <div 
                key={item.id}
                className="card"
                style={{ 
                  flexShrink: 0,
                  minHeight: 'fit-content',
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '6px',
                  padding: '8px 10px',
                  borderLeft: isAccepted ? '3px solid var(--success-color)' : isRejected ? '3px solid var(--danger-color)' : '3px solid var(--warning-color)',
                  opacity: isRejected ? 0.6 : 1.0
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span style={{ 
                      fontSize: '9.5px', 
                      fontWeight: 700, 
                      backgroundColor: 'var(--bg-tertiary)', 
                      padding: '2px 6px', 
                      borderRadius: '4px',
                      color: item.category === 'SILENCE' ? '#38bdf8' : item.category === 'REPEATED_TAKE' ? '#c084fc' : '#facc15'
                    }}>
                      {item.category.replace('_', ' ')}
                    </span>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                      {item.startSeconds.toFixed(2)}s - {item.endSeconds.toFixed(2)}s ({item.durationSeconds.toFixed(2)}s)
                    </span>
                  </div>

                  {/* Audition Playhead Seek */}
                  <button 
                    className="btn-secondary" 
                    style={{ padding: '2px 7px', fontSize: '10px', flexShrink: 0 }}
                    onClick={() => {
                      hostBridge.setPlayheadPosition(item.startSeconds);
                      hostBridge.startPlayback(1);
                    }}
                    title="Jump playhead and start playback in Premiere Pro"
                  >
                    <Play size={10} />
                    <span>Seek</span>
                  </button>
                </div>

                <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.4, wordBreak: 'break-word', whiteSpace: 'normal' }}>
                  {item.transcriptSnippet || (item.category === 'SILENCE' ? '[নীরবতা / Silence Pause]' : '[Take Cutaway]')}
                </div>

                <div style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                  <span style={{ flex: 1, wordBreak: 'break-word' }}>{item.reason}</span>
                  <span style={{ flexShrink: 0 }}>Confidence: {Math.round(item.confidence * 100)}%</span>
                </div>

                {/* Accept / Reject Action Chips */}
                <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
                  <button 
                    style={{
                      flex: 1,
                      backgroundColor: isAccepted ? 'var(--success-color)' : 'var(--bg-tertiary)',
                      color: isAccepted ? '#fff' : 'var(--text-primary)',
                      padding: '5px',
                      fontSize: '10px',
                      borderRadius: '4px',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px'
                    }}
                    onClick={() => updateReviewItemStatus(item.id, 'ACCEPTED')}
                  >
                    <Check size={12} />
                    <span>Approve Cut</span>
                  </button>

                  <button 
                    style={{
                      flex: 1,
                      backgroundColor: isRejected ? 'var(--danger-color)' : 'var(--bg-tertiary)',
                      color: isRejected ? '#fff' : 'var(--text-primary)',
                      padding: '5px',
                      fontSize: '10px',
                      borderRadius: '4px',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px'
                    }}
                    onClick={() => updateReviewItemStatus(item.id, 'REJECTED')}
                  >
                    <X size={12} />
                    <span>Keep in Video</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Bottom Sticky Action Bar */}
      <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}>
        <button 
          className="btn-primary" 
          disabled={acceptedCount === 0 || applying}
          onClick={handleApply}
          style={{ width: '100%', padding: '9px 12px', fontSize: '12px', fontWeight: 600 }}
        >
          <Zap size={14} />
          <span>
            {applying
              ? t.applyingCuts
              : t.applyApproved.replace('{n}', String(acceptedCount))}
          </span>
        </button>
      </div>
    </div>
  );
};
