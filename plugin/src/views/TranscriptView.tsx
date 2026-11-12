import React, { useState, useMemo } from 'react';
import { usePrismexStore } from '../state/usePrismexStore';
import { PremiereHostBridge } from '../host/PremiereHostBridge';
import { TimecodeConverter } from '../host/TimecodeConverter';
import {
  Search,
  Mic,
  Scissors,
  Sparkles,
  CheckSquare,
  RefreshCw,
  Trash2,
  VolumeX
} from 'lucide-react';

interface WordToken {
  id: string;
  word: string;
  start: number;
  end: number;
  isFiller: boolean;
}

export const TranscriptView: React.FC = () => {
  const {
    sequenceManifest,
    refreshSequence,
    transcriptWords,
    detectedSilences,
    reviewItems,
    transcribeSequence,
    deleteTranscriptRange,
    setExecutionMode,
    startMagicRoughCut,
    setActiveTab,
    jobStatus,
    jobProgress,
    jobMessage
  } = usePrismexStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<'ALL' | 'FILLERS' | 'PAUSES'>('ALL');
  const [selStartIdx, setSelStartIdx] = useState<number | null>(null);
  const [selEndIdx, setSelEndIdx] = useState<number | null>(null);

  const hostBridge = PremiereHostBridge.getInstance();
  const fps = sequenceManifest?.fps || 24;
  const isRunning = jobStatus !== 'COMPLETE' && jobProgress > 0 && jobProgress < 100;

  const words: WordToken[] = useMemo(() => {
    return transcriptWords.map((w: any, idx: number) => ({
      id: w.id || `w_${idx}`,
      word: w.word,
      start: w.start_seconds ?? w.start ?? 0,
      end: w.end_seconds ?? w.end ?? 0,
      isFiller: !!(w.is_filler ?? w.isFiller)
    }));
  }, [transcriptWords]);

  const fillerCount = useMemo(() => words.filter((w) => w.isFiller).length, [words]);

  // Group words into paragraph chunks (~15 words or > 0.7s pause) for Premiere Pro Text Panel layout
  const paragraphs = useMemo(() => {
    const groups: Array<{ startIdx: number; endIdx: number; startTime: number; tokens: Array<WordToken & { globalIdx: number }> }> = [];
    let current: Array<WordToken & { globalIdx: number }> = [];

    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      const prev = i > 0 ? words[i - 1] : null;
      const gap = prev ? w.start - prev.end : 0;

      if (current.length > 0 && (gap > 0.75 || current.length >= 16)) {
        groups.push({
          startIdx: current[0].globalIdx,
          endIdx: current[current.length - 1].globalIdx,
          startTime: current[0].start,
          tokens: current
        });
        current = [];
      }
      current.push({ ...w, globalIdx: i });
    }

    if (current.length > 0) {
      groups.push({
        startIdx: current[0].globalIdx,
        endIdx: current[current.length - 1].globalIdx,
        startTime: current[0].start,
        tokens: current
      });
    }
    return groups;
  }, [words]);

  const handleWordClick = (idx: number, e: React.MouseEvent) => {
    const token = words[idx];
    if (!token) return;
    hostBridge.setPlayheadPosition(token.start);

    if (e.shiftKey && selStartIdx !== null) {
      setSelEndIdx(idx);
    } else {
      setSelStartIdx(idx);
      setSelEndIdx(idx);
    }
  };

  const hasSelection = selStartIdx !== null && selEndIdx !== null && words.length > 0;
  const minSel = hasSelection ? Math.min(selStartIdx!, selEndIdx!) : -1;
  const maxSel = hasSelection ? Math.max(selStartIdx!, selEndIdx!) : -1;
  const selectionStartSec = hasSelection && words[minSel] ? words[minSel].start : 0;
  const selectionEndSec = hasSelection && words[maxSel] ? words[maxSel].end : 0;
  const selectionDuration = Math.max(0, selectionEndSec - selectionStartSec);

  const handleDeleteSelected = async () => {
    if (!hasSelection) return;
    await deleteTranscriptRange(selectionStartSec, selectionEndSec);
    setSelStartIdx(null);
    setSelEndIdx(null);
  };

  // Pre-Transcription State (Premiere Pro Text Panel First Screen)
  if (words.length === 0) {
    return (
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', height: '100%', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '13px', fontWeight: 600 }}>Text Panel — Speech to Text</h2>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              First transcribe your sequence audio, then edit text or run Auto Cut.
            </p>
          </div>
          <button
            onClick={() => refreshSequence()}
            title="Refresh Active Sequence"
            style={{
              background: 'transparent',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-secondary)',
              padding: '4px 8px',
              fontSize: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={11} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Active Sequence Info */}
        <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>ACTIVE SEQUENCE</div>
            <div style={{ fontSize: '12px', fontWeight: 600 }}>
              {sequenceManifest ? sequenceManifest.sequenceName : 'No sequence open in Premiere Pro'}
            </div>
            {sequenceManifest && (
              <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                {TimecodeConverter.formatTimecode(sequenceManifest.durationSeconds, fps)} • {fps} fps • {sequenceManifest.sourceClips.length} audio clip(s)
              </div>
            )}
          </div>
        </div>

        {/* Primary Speech-to-Text Card */}
        <div
          className="card"
          style={{
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(16, 185, 129, 0.08))',
            borderColor: 'rgba(59, 130, 246, 0.35)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            padding: '18px 16px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: 'rgba(59, 130, 246, 0.2)' }}>
              <Mic size={18} color="#60a5fa" />
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600 }}>Step 1: Transcribe Sequence</div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                Generates word-level transcript, detects pauses, fillers &amp; repeated takes locally via Apple Silicon MLX-Whisper.
              </div>
            </div>
          </div>

          {isRunning && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{jobMessage}</span>
                <span style={{ fontWeight: 600 }}>{Math.round(jobProgress)}%</span>
              </div>
              <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ width: `${jobProgress}%`, height: '100%', backgroundColor: 'var(--accent-color)', transition: 'width 0.3s ease' }} />
              </div>
            </div>
          )}

          <button
            className="btn-primary"
            disabled={isRunning || !sequenceManifest}
            onClick={transcribeSequence}
            style={{ padding: '10px 14px', fontSize: '12.5px', fontWeight: 600 }}
          >
            <Mic size={15} />
            <span>{isRunning ? 'Transcribing Sequence...' : 'Transcribe Sequence (Speech-to-Text)'}</span>
          </button>
        </div>

        {/* Step 2 / Other Options Preview */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>
            OR JUMP DIRECTLY TO OTHER OPTIONS
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="btn-secondary"
              disabled={isRunning || !sequenceManifest}
              style={{ flex: 1, fontSize: '11px' }}
              onClick={() => {
                setExecutionMode('AUTO_EDIT');
                startMagicRoughCut();
              }}
            >
              <Sparkles size={13} />
              <span>1-Click Magic Auto Cut</span>
            </button>
            <button
              className="btn-secondary"
              style={{ flex: 1, fontSize: '11px' }}
              onClick={() => setActiveTab('magic-cut')}
            >
              <Scissors size={13} />
              <span>Configure Cut Rules</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Post-Transcription State (Premiere Pro Text Panel Interface)
  return (
    <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px', height: '100%', overflow: 'hidden' }}>
      {/* Top Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ fontSize: '12px', fontWeight: 600 }}>
          Transcript ({words.length} words)
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            className="btn-secondary"
            disabled={isRunning}
            onClick={transcribeSequence}
            style={{ padding: '4px 8px', fontSize: '10.5px' }}
          >
            <Mic size={11} />
            <span>Re-Transcribe</span>
          </button>
          <button
            className="btn-primary"
            disabled={isRunning}
            onClick={() => {
              setExecutionMode('AUTO_EDIT');
              startMagicRoughCut();
            }}
            style={{ padding: '4px 10px', fontSize: '10.5px' }}
          >
            <Sparkles size={11} />
            <span>Auto Cut All</span>
          </button>
          <button
            className="btn-secondary"
            onClick={() => setActiveTab('review-queue')}
            style={{ padding: '4px 8px', fontSize: '10.5px' }}
          >
            <CheckSquare size={11} />
            <span>Review ({reviewItems.length})</span>
          </button>
        </div>
      </div>

      {/* Search & Filter Row */}
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: 'var(--bg-tertiary)',
            padding: '5px 8px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)'
          }}
        >
          <Search size={12} color="var(--text-muted)" />
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

        <button
          onClick={() => setFilterMode(filterMode === 'FILLERS' ? 'ALL' : 'FILLERS')}
          style={{
            padding: '5px 8px',
            fontSize: '10.5px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
            backgroundColor: filterMode === 'FILLERS' ? 'rgba(250, 204, 21, 0.2)' : 'var(--bg-tertiary)',
            color: filterMode === 'FILLERS' ? '#facc15' : 'var(--text-secondary)',
            cursor: 'pointer'
          }}
        >
          Fillers ({fillerCount})
        </button>

        <button
          onClick={() => setFilterMode(filterMode === 'PAUSES' ? 'ALL' : 'PAUSES')}
          style={{
            padding: '5px 8px',
            fontSize: '10.5px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
            backgroundColor: filterMode === 'PAUSES' ? 'rgba(239, 68, 68, 0.2)' : 'var(--bg-tertiary)',
            color: filterMode === 'PAUSES' ? '#f87171' : 'var(--text-secondary)',
            cursor: 'pointer'
          }}
        >
          Pauses ({detectedSilences.length})
        </button>
      </div>

      {/* Text-Based Cut Bar (when words are selected) */}
      {hasSelection && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 10px',
            backgroundColor: 'rgba(239, 68, 68, 0.14)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '11px'
          }}
        >
          <span>
            Selected {maxSel - minSel + 1} word(s) • {selectionDuration.toFixed(2)}s (Shift+Click to extend)
          </span>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={handleDeleteSelected}
              style={{
                backgroundColor: '#ef4444',
                color: '#fff',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                padding: '4px 8px',
                fontSize: '10.5px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer'
              }}
            >
              <Trash2 size={11} />
              <span>Delete from Timeline</span>
            </button>
            <button
              onClick={() => {
                setSelStartIdx(null);
                setSelEndIdx(null);
              }}
              className="btn-secondary"
              style={{ padding: '4px 8px', fontSize: '10.5px' }}
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Pauses Only Filter View */}
      {filterMode === 'PAUSES' ? (
        <div className="card" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {detectedSilences.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '11px', textAlign: 'center', padding: '20px' }}>
              No pauses detected.
            </div>
          ) : (
            detectedSilences.map((s: any, idx: number) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 8px',
                  backgroundColor: 'var(--bg-tertiary)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '11px'
                }}
              >
                <div
                  onClick={() => hostBridge.setPlayheadPosition(s.start_seconds)}
                  style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <VolumeX size={12} color="#f87171" />
                  <span style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                    {TimecodeConverter.formatTimecode(s.start_seconds, fps)}
                  </span>
                  <span>Pause ({s.duration_seconds.toFixed(2)}s)</span>
                </div>
                <button
                  onClick={() => deleteTranscriptRange(s.start_seconds, s.end_seconds)}
                  className="btn-secondary"
                  style={{ padding: '3px 8px', fontSize: '10px', color: '#f87171' }}
                >
                  <Scissors size={10} />
                  <span>Cut Pause</span>
                </button>
              </div>
            ))
          )}
        </div>
      ) : (
        /* Paragraph Transcript Body (Premiere Pro Text Panel Style) */
        <div className="card" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {paragraphs.map((para) => (
            <div key={para.startIdx} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <div
                onClick={() => hostBridge.setPlayheadPosition(para.startTime)}
                title="Click to jump to paragraph start"
                style={{
                  fontFamily: 'monospace',
                  fontSize: '10px',
                  color: 'var(--accent-color)',
                  minWidth: '64px',
                  paddingTop: '4px',
                  cursor: 'pointer',
                  userSelect: 'none'
                }}
              >
                {TimecodeConverter.formatTimecode(para.startTime, fps)}
              </div>

              <div style={{ flex: 1, lineHeight: 1.85 }}>
                {para.tokens.map((item) => {
                  if (filterMode === 'FILLERS' && !item.isFiller) return null;
                  const matches = searchTerm && item.word.toLowerCase().includes(searchTerm.toLowerCase());
                  const isSelected = hasSelection && item.globalIdx >= minSel && item.globalIdx <= maxSel;

                  return (
                    <span
                      key={item.id}
                      onClick={(e) => handleWordClick(item.globalIdx, e)}
                      title={`${item.start.toFixed(2)}s - ${item.end.toFixed(2)}s (Click to seek, Shift+Click to select range)`}
                      style={{
                        display: 'inline-block',
                        margin: '1px 2px',
                        padding: '1px 4px',
                        borderRadius: '3px',
                        cursor: 'pointer',
                        backgroundColor: isSelected
                          ? 'rgba(59, 130, 246, 0.45)'
                          : matches
                          ? '#3b82f6'
                          : item.isFiller
                          ? 'rgba(250, 204, 21, 0.25)'
                          : 'transparent',
                        color: item.isFiller ? '#facc15' : 'var(--text-primary)',
                        border: isSelected
                          ? '1px solid #60a5fa'
                          : item.isFiller
                          ? '1px dashed rgba(250, 204, 21, 0.4)'
                          : '1px solid transparent',
                        fontSize: '12px'
                      }}
                    >
                      {item.word}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
