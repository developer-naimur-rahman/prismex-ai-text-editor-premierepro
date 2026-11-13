import React, { useState } from 'react';
import { usePrismexStore } from '../state/usePrismexStore';
import { PremiereHostBridge } from '../host/PremiereHostBridge';
import { TimecodeConverter } from '../host/TimecodeConverter';
import { translations } from '../i18n/translations';
import { Layers, Play, Scissors, CheckCircle, Mic } from 'lucide-react';

export const TakesView: React.FC = () => {
  const {
    reviewItems,
    sequenceManifest,
    deleteTranscriptRange,
    updateReviewItemStatus,
    transcribeSequence,
    language
  } = usePrismexStore();

  const t = translations[language];
  const hostBridge = PremiereHostBridge.getInstance();
  const fps = sequenceManifest?.fps || 24;
  const [cuttingId, setCuttingId] = useState<string | null>(null);

  const repeatedTakes = reviewItems.filter((item) => item.category === 'REPEATED_TAKE');

  const handleCutSingleTake = async (id: string, startSec: number, endSec: number) => {
    setCuttingId(id);
    try {
      await deleteTranscriptRange(startSec, endSec);
      updateReviewItemStatus(id, 'ACCEPTED');
    } finally {
      setCuttingId(null);
    }
  };

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', height: '100%', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '13px', fontWeight: 600 }}>
            {t.tabTakes} — {t.doubleLines} ({repeatedTakes.length})
          </h2>
          <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            {language === 'bn'
              ? 'যেকোনো ডাবল লাইনে ক্লিক করলে প্লেহেড সরাসরি সেখানে যাবে এবং ১ ক্লিকে কাটতে পারবেন।'
              : 'Click any repeated take to jump the playhead there, or cut it directly from the timeline.'}
          </p>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '2px' }}>
        {repeatedTakes.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>
            <Layers size={24} color="var(--text-muted)" />
            <div style={{ fontSize: '11.5px' }}>
              {language === 'bn'
                ? 'এখনো কোনো ডাবল লাইন পাওয়া যায়নি। প্রথমে সিকোয়েন্স ট্রান্সক্রাইব করুন।'
                : 'No repeated takes detected yet. Transcribe your sequence first.'}
            </div>
            <button onClick={transcribeSequence} className="btn-primary" style={{ padding: '6px 12px', fontSize: '11px' }}>
              <Mic size={13} />
              <span>{t.transcribeBtn}</span>
            </button>
          </div>
        ) : (
          repeatedTakes.map((item, idx) => (
            <div
              key={item.id}
              onClick={() => hostBridge.setPlayheadPosition(item.startSeconds)}
              style={{
                flexShrink: 0,
                padding: '10px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid rgba(139, 92, 246, 0.35)',
                borderLeft: '3px solid #a78bfa',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                cursor: 'pointer'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '10px', fontWeight: 700, color: '#c4b5fd' }}>
                    #{idx + 1} • {TimecodeConverter.formatTimecode(item.startSeconds, fps)}
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                    ({item.durationSeconds.toFixed(2)}s)
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '6px' }} onClick={(e) => e.stopPropagation()}>
                  <button
                    className="btn-secondary"
                    style={{ padding: '3px 7px', fontSize: '10px' }}
                    onClick={() => hostBridge.setPlayheadPosition(item.startSeconds)}
                  >
                    <Play size={10} />
                    <span>{t.jumpToLine}</span>
                  </button>
                  <button
                    className="btn-primary"
                    disabled={cuttingId === item.id}
                    style={{ padding: '3px 8px', fontSize: '10px', backgroundColor: '#ef4444' }}
                    onClick={() => handleCutSingleTake(item.id, item.startSeconds, item.endSeconds)}
                  >
                    <Scissors size={10} />
                    <span>{cuttingId === item.id ? '...' : t.cutDoubleLine}</span>
                  </button>
                </div>
              </div>

              <div style={{ fontSize: '11.5px', color: 'var(--text-primary)', lineHeight: 1.4 }}>
                "{item.transcriptSnippet}"
              </div>

              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                {item.reason} • Confidence: {Math.round(item.confidence * 100)}%
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
