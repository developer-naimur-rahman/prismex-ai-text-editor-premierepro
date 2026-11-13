import React, { useState, useEffect, useMemo } from 'react';
import { usePrismexStore } from '../state/usePrismexStore';
import { PremiereHostBridge } from '../host/PremiereHostBridge';
import { TimecodeConverter } from '../host/TimecodeConverter';
import { PrismexDaemonClient } from '../api/PrismexDaemonClient';
import { translations } from '../i18n/translations';
import {
  Subtitles,
  Sparkles,
  Download,
  Save,
  CheckCircle2,
  Play,
  Scissors,
  Split,
  Trash2,
  Search,
  Type,
  FileCode,
  LayoutList,
  Copy,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

function formatSrtTimestamp(sec: number): string {
  const totalMs = Math.max(0, Math.round(sec * 1000));
  const ms = totalMs % 1000;
  const totalSec = Math.floor(totalMs / 1000);
  const s = totalSec % 60;
  const totalMin = Math.floor(totalSec / 60);
  const m = totalMin % 60;
  const h = Math.floor(totalMin / 60);
  const pad = (n: number, len = 2) => String(n).padStart(len, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
}

export const SrtEditorView: React.FC = () => {
  const {
    sequenceManifest,
    transcriptWords,
    transcriptSentences,
    language
  } = usePrismexStore();

  const t = translations[language];
  const hostBridge = PremiereHostBridge.getInstance();
  const client = PrismexDaemonClient.getInstance();
  const fps = sequenceManifest?.fps || 24;

  const [srtPreset, setSrtPreset] = useState<'SHORTS' | 'YOUTUBE' | 'PODCAST' | 'CUSTOM'>('SHORTS');
  const [targetWords, setTargetWords] = useState(3);
  const [flexibleWords, setFlexibleWords] = useState(true);
  const [targetChars, setTargetChars] = useState(18);
  const [maxChars, setMaxChars] = useState(26);
  const [showSliders, setShowSliders] = useState(false);

  const [cues, setCues] = useState<any[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [engineUsed, setEngineUsed] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'CARDS' | 'RAW'>('CARDS');

  const baseFilename = (sequenceManifest?.sequenceName || 'captions').replace(/[^a-zA-Z0-9_-]/g, '_');

  // Auto-generate cues if transcript words exist and cues are empty
  useEffect(() => {
    if (transcriptWords.length > 0 && cues.length === 0) {
      handleGenerateCues();
    }
  }, [transcriptWords.length]);

  const rawSrtText = useMemo(() => {
    return cues
      .map((c) => `${c.index}\n${c.startSrt} --> ${c.endSrt}\n${c.text}\n`)
      .join('\n');
  }, [cues]);

  const rawTxtText = useMemo(() => {
    return cues
      .map((c) => `[${TimecodeConverter.formatTimecode(c.startSeconds, fps)}] ${c.text}`)
      .join('\n\n');
  }, [cues, fps]);

  const rawJsonText = useMemo(() => {
    const payload = {
      sequenceName: sequenceManifest?.sequenceName || 'Sequence',
      fps,
      totalCues: cues.length,
      cues: cues.map((c) => ({
        index: c.index,
        startSeconds: c.startSeconds,
        endSeconds: c.endSeconds,
        startFrame: c.startFrame,
        endFrame: c.endFrame,
        startTimecode: TimecodeConverter.formatTimecode(c.startSeconds, fps),
        endTimecode: TimecodeConverter.formatTimecode(c.endSeconds, fps),
        text: c.text,
        wordCount: c.wordCount,
        charCount: c.charCount,
        reason: c.reason
      }))
    };
    return JSON.stringify(payload, null, 2);
  }, [cues, fps, sequenceManifest]);

  const handleApplyPreset = (preset: 'SHORTS' | 'YOUTUBE' | 'PODCAST') => {
    setSrtPreset(preset);
    let tw = 3;
    let tc = 18;
    let mc = 26;
    if (preset === 'SHORTS') {
      tw = 3;
      tc = 18;
      mc = 26;
    } else if (preset === 'YOUTUBE') {
      tw = 6;
      tc = 32;
      mc = 42;
    } else if (preset === 'PODCAST') {
      tw = 10;
      tc = 45;
      mc = 60;
    }
    setTargetWords(tw);
    setTargetChars(tc);
    setMaxChars(mc);
    handleGenerateCues(tw, tc, mc, flexibleWords);
  };

  const handleGenerateCues = async (
    customTw?: number,
    customTc?: number,
    customMc?: number,
    customFlex?: boolean
  ) => {
    if (transcriptWords.length === 0) return;
    setIsGenerating(true);
    setStatusMessage(language === 'bn' ? 'AI কিউ ও ফ্রেম স্ন্যাপ তৈরি করছে...' : 'AI Analyzing & Snapping Cues...');
    try {
      const res = await client.generateSmartSrt({
        words: transcriptWords,
        fps,
        targetWords: customTw ?? targetWords,
        minWords: (customFlex ?? flexibleWords) ? Math.max(1, (customTw ?? targetWords) - 1) : (customTw ?? targetWords),
        maxWords: (customFlex ?? flexibleWords) ? (customTw ?? targetWords) + 2 : (customTw ?? targetWords),
        targetChars: customTc ?? targetChars,
        maxChars: customMc ?? maxChars,
        flexible: customFlex ?? flexibleWords,
        useAi: true
      });
      if (res && res.cues) {
        setCues(res.cues);
        setEngineUsed(res.engine);
        setStatusMessage(language === 'bn' ? `${res.totalCues} টি কিউ সফলভাবে ফ্রেম স্ন্যাপ হয়েছে!` : `${res.totalCues} cues generated & frame snapped!`);
      }
    } finally {
      setIsGenerating(false);
      setTimeout(() => setStatusMessage(null), 3500);
    }
  };

  // Keyboard shortcut: Press Enter to split cue into two lines
  const handleCueKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const cue = cues[idx];
      if (!cue) return;
      const wordsInCue = cue.text.split(' ');
      if (wordsInCue.length < 2) return;
      const mid = Math.ceil(wordsInCue.length / 2);
      const text1 = wordsInCue.slice(0, mid).join(' ');
      const text2 = wordsInCue.slice(mid).join(' ');
      const midFrame = Math.round((cue.startFrame + cue.endFrame) / 2);
      const midSec = midFrame / fps;

      const cue1 = {
        ...cue,
        text: text1,
        endFrame: midFrame,
        endSeconds: midSec,
        endSrt: formatSrtTimestamp(midSec),
        wordCount: mid,
        charCount: text1.length
      };
      const cue2 = {
        ...cue,
        index: cue.index + 1,
        text: text2,
        startFrame: midFrame,
        startSeconds: midSec,
        startSrt: formatSrtTimestamp(midSec),
        wordCount: wordsInCue.length - mid,
        charCount: text2.length
      };

      const newCues = [...cues.slice(0, idx), cue1, cue2, ...cues.slice(idx + 1)].map((c, i) => ({ ...c, index: i + 1 }));
      setCues(newCues);
    }
  };

  const handleCueTextChange = (idx: number, newText: string) => {
    const updated = [...cues];
    updated[idx] = { ...updated[idx], text: newText, charCount: newText.length };
    setCues(updated);
  };

  const handleDeleteCue = (idx: number) => {
    const updated = cues.filter((_, i) => i !== idx).map((c, i) => ({ ...c, index: i + 1 }));
    setCues(updated);
  };

  const handleMergeNextCue = (idx: number) => {
    if (idx >= cues.length - 1) return;
    const curr = cues[idx];
    const nxt = cues[idx + 1];
    const mergedCue = {
      ...curr,
      text: `${curr.text} ${nxt.text}`.trim(),
      endFrame: nxt.endFrame,
      endSeconds: nxt.endSeconds,
      endSrt: nxt.endSrt,
      wordCount: curr.wordCount + nxt.wordCount,
      charCount: curr.text.length + nxt.text.length + 1
    };
    const newCues = [...cues.slice(0, idx), mergedCue, ...cues.slice(idx + 2)].map((c, i) => ({ ...c, index: i + 1 }));
    setCues(newCues);
  };

  // Master 1-Click Save All 3 (SRT, TXT, JSON) directly to project directory
  const handleSaveAll3ToProject = async () => {
    setStatusMessage(language === 'bn' ? 'প্রজেক্ট ফোল্ডারে সেভ হচ্ছে...' : 'Saving to project folder...');
    const res = await hostBridge.saveAllProjectFiles(baseFilename, rawSrtText, rawTxtText, rawJsonText);
    if (res.success) {
      setStatusMessage(
        language === 'bn'
          ? `৩টি ফাইল প্রজেক্ট ফোল্ডারে সেভ হয়েছে! (${baseFilename}.srt, .txt, .json)`
          : `Saved 3 files to project directory! (${baseFilename}.srt, .txt, .json)`
      );
    } else {
      setStatusMessage(res.error || 'Failed to save files');
    }
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const handleSendToPremiereCaptions = async () => {
    setStatusMessage(language === 'bn' ? 'Premiere Caption Track তৈরি হচ্ছে...' : 'Creating Premiere Caption Track...');
    const res = await hostBridge.sendSrtToPremiereCaptionTrack(`${baseFilename}.srt`, rawSrtText);
    if (res.success) {
      setStatusMessage(language === 'bn' ? 'Premiere Text Panel (Captions)-এ যোগ হয়েছে!' : 'Added to Premiere Caption Track!');
    } else {
      setStatusMessage(res.error || 'Failed to add caption track');
    }
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const handleExportSingleFile = async (type: 'SRT' | 'TXT' | 'JSON') => {
    if (type === 'SRT') {
      const res = await hostBridge.saveFileWithDialog(`${baseFilename}.srt`, rawSrtText, ['srt']);
      if (res.saved) setStatusMessage('Saved SRT!');
    } else if (type === 'TXT') {
      const res = await hostBridge.saveFileWithDialog(`${baseFilename}.txt`, rawTxtText, ['txt']);
      if (res.saved) setStatusMessage('Saved TXT!');
    } else if (type === 'JSON') {
      const res = await hostBridge.saveFileWithDialog(`${baseFilename}_captions.json`, rawJsonText, ['json']);
      if (res.saved) setStatusMessage('Saved JSON!');
    }
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handlePunctuationTransform = (type: 'COMMAS' | 'PERIODS' | 'ALL' | 'UPPER' | 'TITLE') => {
    const updated = cues.map((c) => {
      let str = c.text;
      if (type === 'COMMAS') str = str.replace(/[,،]/g, '');
      else if (type === 'PERIODS') str = str.replace(/[.।]/g, '');
      else if (type === 'ALL') str = str.replace(/[,.?!।:;—"']/g, '');
      else if (type === 'UPPER') str = str.toUpperCase();
      else if (type === 'TITLE') str = str.replace(/\b\w/g, (char: string) => char.toUpperCase());
      return { ...c, text: str, charCount: str.length };
    });
    setCues(updated);
    setStatusMessage('Cleaned punctuation in all cues!');
    setTimeout(() => setStatusMessage(null), 2500);
  };

  const filteredCues = useMemo(() => {
    if (!searchQuery.trim()) return cues;
    const q = searchQuery.toLowerCase();
    return cues.filter((c) => c.text.toLowerCase().includes(q));
  }, [cues, searchQuery]);

  return (
    <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', height: '100%', overflow: 'hidden' }}>
      {/* Header & Status */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Subtitles size={14} color="#60a5fa" />
            <h2 style={{ fontSize: '12.5px', fontWeight: 600 }}>
              {language === 'bn' ? 'স্মার্ট SRT ও সাবটাইটেল এডিটর' : 'Smart SRT & Caption Editor'}
            </h2>
            <span
              style={{
                fontSize: '9px',
                padding: '1px 5px',
                borderRadius: '3px',
                backgroundColor: 'rgba(52, 211, 153, 0.15)',
                color: '#34d399',
                display: 'flex',
                alignItems: 'center',
                gap: '3px'
              }}
            >
              <CheckCircle2 size={9} /> 100% 0-Frame Drift
            </span>
          </div>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
            {cues.length} cues • {fps} fps {engineUsed ? `• ${engineUsed}` : ''}
          </span>
        </div>

        {/* Status Alert */}
        {statusMessage && (
          <span style={{ fontSize: '10px', color: '#60a5fa', fontWeight: 600, backgroundColor: 'rgba(59, 130, 246, 0.15)', padding: '2px 8px', borderRadius: '4px' }}>
            {statusMessage}
          </span>
        )}
      </div>

      {/* Preset Pill Bar & Sliders Toggle */}
      <div className="card" style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '9.5px', color: 'var(--text-muted)' }}>Pacing Presets:</span>
            <button
              onClick={() => handleApplyPreset('SHORTS')}
              style={{
                padding: '2px 8px',
                fontSize: '9.5px',
                borderRadius: '4px',
                backgroundColor: srtPreset === 'SHORTS' ? '#3b82f6' : 'var(--bg-tertiary)',
                color: srtPreset === 'SHORTS' ? '#fff' : 'var(--text-secondary)'
              }}
            >
              Shorts/TikTok (2-3 words)
            </button>
            <button
              onClick={() => handleApplyPreset('YOUTUBE')}
              style={{
                padding: '2px 8px',
                fontSize: '9.5px',
                borderRadius: '4px',
                backgroundColor: srtPreset === 'YOUTUBE' ? '#3b82f6' : 'var(--bg-tertiary)',
                color: srtPreset === 'YOUTUBE' ? '#fff' : 'var(--text-secondary)'
              }}
            >
              YouTube (5-7 words)
            </button>
            <button
              onClick={() => handleApplyPreset('PODCAST')}
              style={{
                padding: '2px 8px',
                fontSize: '9.5px',
                borderRadius: '4px',
                backgroundColor: srtPreset === 'PODCAST' ? '#3b82f6' : 'var(--bg-tertiary)',
                color: srtPreset === 'PODCAST' ? '#fff' : 'var(--text-secondary)'
              }}
            >
              Podcast (8-12 words)
            </button>
          </div>

          <button
            onClick={() => setShowSliders(!showSliders)}
            className="btn-secondary"
            style={{ padding: '2px 7px', fontSize: '9.5px' }}
          >
            <span>{showSliders ? 'Hide Sliders' : 'Fine Tune'}</span>
            {showSliders ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          </button>
        </div>

        {/* Fine Tuning Sliders */}
        {showSliders && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '6px', paddingTop: '6px', borderTop: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <label style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>Target Words ({targetWords}):</label>
              <input
                type="range"
                min={1}
                max={12}
                value={targetWords}
                onChange={(e) => {
                  setTargetWords(Number(e.target.value));
                  setSrtPreset('CUSTOM');
                }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <label style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>Target Chars ({targetChars}):</label>
              <input
                type="range"
                min={8}
                max={50}
                value={targetChars}
                onChange={(e) => {
                  setTargetChars(Number(e.target.value));
                  setSrtPreset('CUSTOM');
                }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <label style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>Max Width ({maxChars}c):</label>
              <input
                type="range"
                min={12}
                max={80}
                value={maxChars}
                onChange={(e) => {
                  setMaxChars(Number(e.target.value));
                  setSrtPreset('CUSTOM');
                }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', paddingTop: '10px' }}>
              <input
                type="checkbox"
                id="flexCheckSrt"
                checked={flexibleWords}
                onChange={(e) => setFlexibleWords(e.target.checked)}
              />
              <label htmlFor="flexCheckSrt" style={{ fontSize: '9.5px', color: 'var(--text-primary)', cursor: 'pointer' }}>
                Flexible Meaning Fit
              </label>
            </div>
            <button
              onClick={() => handleGenerateCues()}
              disabled={isGenerating}
              className="btn-primary"
              style={{ padding: '3px 8px', fontSize: '10px', height: '24px', alignSelf: 'flex-end' }}
            >
              <Sparkles size={11} /> Re-Segment
            </button>
          </div>
        )}
      </div>

      {/* Master 1-Click Action Bar (Save All 3 + Premiere Captions) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Master 1-Click Save All 3 */}
          <button
            onClick={handleSaveAll3ToProject}
            className="btn-primary"
            title="Auto-saves all 3 files (.SRT, .TXT, .JSON) directly into the Premiere Pro project directory"
            style={{
              padding: '4px 10px',
              fontSize: '10.5px',
              fontWeight: 600,
              backgroundColor: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <Save size={12} />
            <span>{language === 'bn' ? '৩টি ফাইলই প্রজেক্টে সেভ করুন' : 'Save All 3 (SRT+TXT+JSON) to Project'}</span>
          </button>

          {/* Send to Premiere Captions Track */}
          <button
            onClick={handleSendToPremiereCaptions}
            className="btn-secondary"
            title="Create Caption Track in Premiere Pro Timeline and populate Text Panel Captions"
            style={{
              padding: '4px 10px',
              fontSize: '10.5px',
              color: '#34d399',
              borderColor: 'rgba(16, 185, 129, 0.4)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <Subtitles size={12} />
            <span>{language === 'bn' ? 'Premiere Captions-এ পাঠান' : 'Send to Premiere Captions'}</span>
          </button>
        </div>

        {/* Individual File Exports */}
        <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
          <span style={{ fontSize: '9.5px', color: 'var(--text-muted)' }}>Export:</span>
          <button onClick={() => handleExportSingleFile('SRT')} className="btn-secondary" style={{ padding: '2px 6px', fontSize: '9.5px' }}>
            .SRT
          </button>
          <button onClick={() => handleExportSingleFile('TXT')} className="btn-secondary" style={{ padding: '2px 6px', fontSize: '9.5px' }}>
            .TXT
          </button>
          <button onClick={() => handleExportSingleFile('JSON')} className="btn-secondary" style={{ padding: '2px 6px', fontSize: '9.5px' }}>
            .JSON
          </button>
        </div>
      </div>

      {/* Quick Punctuation Tools & View Mode Toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '3px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Punctuation:</span>
          <button onClick={() => handlePunctuationTransform('COMMAS')} className="btn-secondary" style={{ padding: '1px 5px', fontSize: '9px' }}>
            Strip ,
          </button>
          <button onClick={() => handlePunctuationTransform('PERIODS')} className="btn-secondary" style={{ padding: '1px 5px', fontSize: '9px' }}>
            Strip .
          </button>
          <button onClick={() => handlePunctuationTransform('ALL')} className="btn-secondary" style={{ padding: '1px 5px', fontSize: '9px', color: '#f87171' }}>
            Strip All
          </button>
          <button onClick={() => handlePunctuationTransform('UPPER')} className="btn-secondary" style={{ padding: '1px 5px', fontSize: '9px' }}>
            ALL CAPS
          </button>
          <button onClick={() => handlePunctuationTransform('TITLE')} className="btn-secondary" style={{ padding: '1px 5px', fontSize: '9px' }}>
            Title Case
          </button>
        </div>

        <div style={{ display: 'flex', gap: '3px' }}>
          <button
            onClick={() => setViewMode('CARDS')}
            style={{
              padding: '2px 6px',
              fontSize: '9.5px',
              borderRadius: '3px',
              backgroundColor: viewMode === 'CARDS' ? 'var(--bg-tertiary)' : 'transparent',
              color: viewMode === 'CARDS' ? '#fff' : 'var(--text-muted)',
              border: '1px solid var(--border-subtle)'
            }}
          >
            <LayoutList size={10} style={{ marginRight: '2px' }} />
            Cards
          </button>
          <button
            onClick={() => setViewMode('RAW')}
            style={{
              padding: '2px 6px',
              fontSize: '9.5px',
              borderRadius: '3px',
              backgroundColor: viewMode === 'RAW' ? 'var(--bg-tertiary)' : 'transparent',
              color: viewMode === 'RAW' ? '#fff' : 'var(--text-muted)',
              border: '1px solid var(--border-subtle)'
            }}
          >
            <FileCode size={10} style={{ marginRight: '2px' }} />
            Raw SRT
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {viewMode === 'RAW' ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9.5px', color: 'var(--text-muted)' }}>
            <span>Raw SRT Document ({cues.length} cues)</span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(rawSrtText);
                setStatusMessage('Copied SRT to clipboard!');
                setTimeout(() => setStatusMessage(null), 2500);
              }}
              className="btn-secondary"
              style={{ padding: '1px 6px', fontSize: '9px' }}
            >
              <Copy size={9} style={{ marginRight: '2px' }} /> Copy All
            </button>
          </div>
          <textarea
            readOnly
            value={rawSrtText}
            style={{
              flex: 1,
              backgroundColor: 'var(--bg-tertiary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '4px',
              color: '#93c5fd',
              fontFamily: 'monospace',
              fontSize: '10.5px',
              padding: '8px',
              resize: 'none'
            }}
          />
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', overflow: 'hidden' }}>
          {/* Cue Search Bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'var(--bg-tertiary)',
              padding: '4px 8px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)'
            }}
          >
            <Search size={11} color="var(--text-muted)" />
            <input
              type="text"
              placeholder={language === 'bn' ? 'কিউ বা সাবটাইটেল খুঁজুন...' : 'Search cues...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-primary)',
                fontSize: '10px',
                outline: 'none',
                width: '100%'
              }}
            />
          </div>

          {/* Cue Cards Scrollable Container */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              paddingRight: '2px'
            }}
          >
            {filteredCues.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '11px' }}>
                {transcriptWords.length === 0
                  ? 'No transcript available. Please transcribe sequence in Text Panel first.'
                  : 'No cues matching your search.'}
              </div>
            ) : (
              filteredCues.map((cue, idx) => (
                <div
                  key={`cue_${cue.index}`}
                  className="card"
                  style={{
                    padding: '6px 8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    borderColor: 'rgba(255, 255, 255, 0.06)'
                  }}
                >
                  {/* Card Header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '9.5px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span
                        onClick={() => hostBridge.setPlayheadPosition(cue.startSeconds)}
                        style={{ color: '#60a5fa', fontWeight: 700, cursor: 'pointer' }}
                        title="Click to seek playhead to cue start"
                      >
                        #{cue.index}
                      </span>
                      <span style={{ color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                        {cue.startSrt} → {cue.endSrt}
                      </span>
                      <span style={{ color: '#a78bfa', fontFamily: 'monospace', fontSize: '9px' }}>
                        F:{cue.startFrame}-{cue.endFrame}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '9px' }}>
                        {cue.wordCount}w • {cue.charCount}c
                      </span>
                      {cue.reason && (
                        <span
                          style={{
                            fontSize: '8.5px',
                            padding: '1px 4px',
                            borderRadius: '2px',
                            backgroundColor: 'rgba(59, 130, 246, 0.15)',
                            color: '#93c5fd'
                          }}
                        >
                          {cue.reason}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Input & Action Bar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <input
                      type="text"
                      value={cue.text}
                      onChange={(e) => handleCueTextChange(idx, e.target.value)}
                      onKeyDown={(e) => handleCueKeyDown(idx, e)}
                      title="Edit text. Press Enter in text box to split into two lines!"
                      style={{
                        flex: 1,
                        backgroundColor: 'var(--bg-tertiary)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '3px',
                        color: 'var(--text-primary)',
                        fontSize: '11px',
                        padding: '3px 6px'
                      }}
                    />

                    {/* Seek Button */}
                    <button
                      onClick={() => hostBridge.setPlayheadPosition(cue.startSeconds)}
                      className="btn-secondary"
                      style={{ padding: '2px 5px', fontSize: '9px' }}
                      title="Seek playhead in Premiere Pro"
                    >
                      <Play size={9} />
                    </button>

                    {/* Merge Down */}
                    {idx < cues.length - 1 && (
                      <button
                        onClick={() => handleMergeNextCue(idx)}
                        className="btn-secondary"
                        style={{ padding: '2px 5px', fontSize: '9px' }}
                        title="Merge with next line"
                      >
                        Merge ↓
                      </button>
                    )}

                    {/* Delete Cue */}
                    <button
                      onClick={() => handleDeleteCue(idx)}
                      style={{
                        padding: '2px 5px',
                        fontSize: '9px',
                        backgroundColor: 'transparent',
                        color: '#f87171',
                        border: 'none',
                        cursor: 'pointer'
                      }}
                      title="Delete cue"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
