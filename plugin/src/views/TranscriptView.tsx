import React, { useState } from 'react';
import { usePrismexStore } from '../state/usePrismexStore';
import { PremiereHostBridge } from '../host/PremiereHostBridge';
import { Search, Play, Scissors } from 'lucide-react';

export const TranscriptView: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const { transcriptWords } = usePrismexStore();
  const hostBridge = PremiereHostBridge.getInstance();

  const sampleWords = [
    { id: '1', word: 'Welcome', start: 1.0, end: 1.4 },
    { id: '2', word: 'back', start: 1.45, end: 1.7 },
    { id: '3', word: 'to', start: 1.75, end: 1.9 },
    { id: '4', word: 'the', start: 1.95, end: 2.1 },
    { id: '5', word: 'channel.', start: 2.15, end: 2.6 },
    { id: '6', word: 'Today', start: 3.2, end: 3.6 },
    { id: '7', word: 'we', start: 3.65, end: 3.8 },
    { id: '8', word: 'are', start: 3.85, end: 4.0 },
    { id: '9', word: 'reviewing', start: 4.05, end: 4.5 },
    { id: '10', word: 'the', start: 4.55, end: 4.7 },
    { id: '11', word: 'Prismex', start: 4.75, end: 5.2 },
    { id: '12', word: 'AI', start: 5.25, end: 5.4 },
    { id: '13', word: 'Editor.', start: 5.45, end: 5.9 },
    { id: '14', word: 'So,', start: 6.8, end: 7.0 },
    { id: '15', word: 'um,', start: 7.05, end: 7.4, isFiller: true },
    { id: '16', word: 'the', start: 7.5, end: 7.7 },
    { id: '17', word: 'first', start: 7.75, end: 8.0 },
    { id: '18', word: 'thing', start: 8.05, end: 8.3 },
    { id: '19', word: 'to', start: 8.35, end: 8.5 },
    { id: '20', word: 'notice', start: 8.55, end: 8.9 },
    { id: '21', word: 'is', start: 8.95, end: 9.1 },
    { id: '22', word: 'speed.', start: 9.15, end: 9.6 }
  ];

  const wordsToDisplay = transcriptWords.length > 0
    ? transcriptWords.map((w: any) => ({
        id: w.id,
        word: w.word,
        start: w.start_seconds ?? w.start ?? 0,
        end: w.end_seconds ?? w.end ?? 0,
        isFiller: w.is_filler ?? w.isFiller ?? false
      }))
    : sampleWords;

  return (
    <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px', height: '100%', overflow: 'hidden' }}>
      <div>
        <h2 style={{ fontSize: '13px', fontWeight: 600 }}>Transcript Editor</h2>
        <p style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>
          Click any word to seek the Premiere Pro playhead to that exact timecode.
        </p>
      </div>

      {/* Search Input */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '6px', 
        backgroundColor: 'var(--bg-tertiary)',
        padding: '5px 8px',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--border-subtle)'
      }}>
        <Search size={13} color="var(--text-muted)" />
        <input 
          type="text" 
          placeholder="Search transcript..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-primary)',
            fontSize: '11px',
            outline: 'none',
            width: '100%'
          }}
        />
      </div>

      {/* Transcript Text Box */}
      <div className="card" style={{ flex: 1, overflowY: 'auto', lineHeight: 1.8 }}>
        {wordsToDisplay.map((item) => {
          const matches = searchTerm && item.word.toLowerCase().includes(searchTerm.toLowerCase());
          return (
            <span
              key={item.id}
              onClick={() => hostBridge.setPlayheadPosition(item.start)}
              title={`${item.start.toFixed(2)}s - ${item.end.toFixed(2)}s (Click to seek)`}
              style={{
                display: 'inline-block',
                margin: '2px 3px',
                padding: '2px 4px',
                borderRadius: '3px',
                cursor: 'pointer',
                backgroundColor: matches 
                  ? '#3b82f6' 
                  : item.isFiller 
                  ? 'rgba(250, 204, 21, 0.25)' 
                  : 'transparent',
                color: item.isFiller ? '#facc15' : 'var(--text-primary)',
                border: item.isFiller ? '1px dashed rgba(250, 204, 21, 0.4)' : 'none',
                fontSize: '12px',
                transition: 'background-color 0.1s ease'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = matches ? '#3b82f6' : item.isFiller ? 'rgba(250, 204, 21, 0.25)' : 'transparent')}
            >
              {item.word}
            </span>
          );
        })}
      </div>
    </div>
  );
};
