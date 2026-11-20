import React from 'react';
import { usePrismexStore } from '../state/usePrismexStore';
import { 
  FileText, 
  Subtitles, 
  Sparkles, 
  Sliders, 
  Layers, 
  CheckSquare, 
  ArrowLeft 
} from 'lucide-react';

export const EditorTopRibbon: React.FC = () => {
  const { activeTab, setActiveTab, reviewItems, language } = usePrismexStore();
  const isBn = language === 'bn';

  const pendingReviewCount = reviewItems.filter(i => i.status === 'PENDING').length;
  const isSubToolActive = ['magic-cut', 'silence', 'takes', 'review-queue'].includes(activeTab);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        backgroundColor: '#13141f',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        padding: '5px 8px',
        flexShrink: 0
      }}
    >
      {/* Top Row: Premiere Pro Style Sub-Tabs [Transcript] [Captions] */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
          <button
            onClick={() => setActiveTab('transcript')}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '5px',
              padding: '5px 8px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: activeTab === 'transcript' ? 700 : 500,
              backgroundColor: activeTab === 'transcript' ? '#2563eb' : 'transparent',
              color: activeTab === 'transcript' ? '#ffffff' : '#94a3b8',
              border: activeTab === 'transcript' ? '1px solid #3b82f6' : '1px solid transparent',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease'
            }}
          >
            <FileText size={12} />
            <span>{isBn ? 'ট্রান্সক্রিপ্ট' : 'Transcript'}</span>
          </button>

          <button
            onClick={() => setActiveTab('srt-editor')}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '5px',
              padding: '5px 8px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: activeTab === 'srt-editor' ? 700 : 500,
              backgroundColor: activeTab === 'srt-editor' ? '#2563eb' : 'transparent',
              color: activeTab === 'srt-editor' ? '#ffffff' : '#94a3b8',
              border: activeTab === 'srt-editor' ? '1px solid #3b82f6' : '1px solid transparent',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease'
            }}
          >
            <Subtitles size={12} />
            <span>{isBn ? 'ক্যাপশন (SRT)' : 'Captions'}</span>
          </button>
        </div>

        {isSubToolActive && (
          <button
            onClick={() => setActiveTab('transcript')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
              borderRadius: '5px',
              fontSize: '10px',
              fontWeight: 600,
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#38bdf8',
              cursor: 'pointer',
              flexShrink: 0
            }}
          >
            <ArrowLeft size={10} />
            <span>{isBn ? 'ব্যাক' : 'Back'}</span>
          </button>
        )}
      </div>

      {/* Second Row: Quick Editing Operations Strip */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          overflowX: 'auto',
          scrollbarWidth: 'none',
          paddingTop: '2px'
        }}
      >
        <button
          onClick={() => setActiveTab('magic-cut')}
          style={{
            padding: '3px 7px',
            borderRadius: '4px',
            fontSize: '9.5px',
            fontWeight: activeTab === 'magic-cut' ? 700 : 500,
            backgroundColor: activeTab === 'magic-cut' ? 'rgba(139, 92, 246, 0.25)' : 'rgba(255, 255, 255, 0.04)',
            border: activeTab === 'magic-cut' ? '1px solid #8b5cf6' : '1px solid rgba(255, 255, 255, 0.08)',
            color: activeTab === 'magic-cut' ? '#c084fc' : '#cbd5e1',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
            flexShrink: 0,
            whiteSpace: 'nowrap'
          }}
        >
          <Sparkles size={10} />
          <span>{isBn ? 'অটো কাট' : 'Auto Cut'}</span>
        </button>

        <button
          onClick={() => setActiveTab('silence')}
          style={{
            padding: '3px 7px',
            borderRadius: '4px',
            fontSize: '9.5px',
            fontWeight: activeTab === 'silence' ? 700 : 500,
            backgroundColor: activeTab === 'silence' ? 'rgba(245, 158, 11, 0.25)' : 'rgba(255, 255, 255, 0.04)',
            border: activeTab === 'silence' ? '1px solid #f59e0b' : '1px solid rgba(255, 255, 255, 0.08)',
            color: activeTab === 'silence' ? '#fcd34d' : '#cbd5e1',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
            flexShrink: 0,
            whiteSpace: 'nowrap'
          }}
        >
          <Sliders size={10} />
          <span>{isBn ? 'সাইলেন্স কাট' : 'Silence Cut'}</span>
        </button>

        <button
          onClick={() => setActiveTab('takes')}
          style={{
            padding: '3px 7px',
            borderRadius: '4px',
            fontSize: '9.5px',
            fontWeight: activeTab === 'takes' ? 700 : 500,
            backgroundColor: activeTab === 'takes' ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255, 255, 255, 0.04)',
            border: activeTab === 'takes' ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.08)',
            color: activeTab === 'takes' ? '#7dd3fc' : '#cbd5e1',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
            flexShrink: 0,
            whiteSpace: 'nowrap'
          }}
        >
          <Layers size={10} />
          <span>{isBn ? 'টেকস/রিটেক' : 'Takes'}</span>
        </button>

        <button
          onClick={() => setActiveTab('review-queue')}
          style={{
            padding: '3px 7px',
            borderRadius: '4px',
            fontSize: '9.5px',
            fontWeight: activeTab === 'review-queue' ? 700 : 500,
            backgroundColor: activeTab === 'review-queue' ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255, 255, 255, 0.04)',
            border: activeTab === 'review-queue' ? '1px solid #10b981' : '1px solid rgba(255, 255, 255, 0.08)',
            color: activeTab === 'review-queue' ? '#6ee7b7' : '#cbd5e1',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
            flexShrink: 0,
            whiteSpace: 'nowrap'
          }}
        >
          <CheckSquare size={10} />
          <span>{isBn ? 'রিভিউ কিউ' : 'Review Queue'}</span>
          {pendingReviewCount > 0 && (
            <span
              style={{
                backgroundColor: '#ef4444',
                color: '#fff',
                borderRadius: '8px',
                padding: '0 3.5px',
                fontSize: '8px',
                fontWeight: 700,
                lineHeight: '11px',
                marginLeft: '2px'
              }}
            >
              {pendingReviewCount}
            </span>
          )}
        </button>
      </div>
    </div>
  );
};
