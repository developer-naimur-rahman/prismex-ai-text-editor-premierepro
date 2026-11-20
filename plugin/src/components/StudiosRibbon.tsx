import React from 'react';
import { usePrismexStore } from '../state/usePrismexStore';
import { Flame, Palette, Volume2, Crop } from 'lucide-react';

export const StudiosRibbon: React.FC = () => {
  const { activeTab, setActiveTab, language } = usePrismexStore();
  const isBn = language === 'bn';

  const studios = [
    { id: 'viral-shorts', label: isBn ? '📐 রেশিও ও শর্টস (১:১ / ৯:১৬)' : '📐 Ratio & Shorts (1:1 / 9:16)', icon: <Crop size={12} /> },
    { id: 'color-studio', label: isBn ? '🎨 কালার স্টুডিও' : '🎨 Color Studio', icon: <Palette size={12} /> },
    { id: 'audio-studio', label: isBn ? '🔊 অডিও স্টুডিও' : '🔊 Audio Studio', icon: <Volume2 size={12} /> }
  ];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '4px 6px',
        backgroundColor: '#14151f',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        flexShrink: 0
      }}
    >
      {studios.map((st) => {
        const active = activeTab === st.id;
        return (
          <button
            key={st.id}
            onClick={() => setActiveTab(st.id as any)}
            style={{
              flex: 1,
              padding: '4px 6px',
              borderRadius: '6px',
              fontSize: '10.5px',
              fontWeight: active ? 700 : 500,
              backgroundColor: active ? '#2563eb' : 'transparent',
              color: active ? '#ffffff' : '#94a3b8',
              border: active ? '1px solid #3b82f6' : '1px solid transparent',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              transition: 'all 0.15s ease',
              textAlign: 'center'
            }}
          >
            {st.label}
          </button>
        );
      })}
    </div>
  );
};
