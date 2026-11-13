import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { usePrismexStore } from '../state/usePrismexStore';
import { PremiereHostBridge } from '../host/PremiereHostBridge';
import { TimecodeConverter } from '../host/TimecodeConverter';
import { translations } from '../i18n/translations';
import {
  Search,
  Mic,
  Scissors,
  Sparkles,
  CheckSquare,
  RefreshCw,
  Trash2,
  VolumeX,
  Download,
  Save,
  Bot,
  Key,
  Subtitles,
  Sliders,
  CheckCircle2,
  Type,
  Copy,
  Film,
  Tag,
  BookmarkPlus,
  FileCode,
  RotateCcw,
  SlidersHorizontal,
  Zap,
  Video,
  Volume2,
  BookOpen,
  Check,
  Pencil,
  X,
  AlignLeft,
  Eye,
  Play,
  Image,
  ExternalLink,
  Globe
} from 'lucide-react';
import { PrismexDaemonClient } from '../api/PrismexDaemonClient';

interface WordToken {
  id: string;
  word: string;
  start: number;
  end: number;
  isFiller: boolean;
}

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

function triggerFileDownload(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const TranscriptView: React.FC = () => {
  const {
    sequenceManifest,
    refreshSequence,
    transcriptWords,
    transcriptSentences,
    detectedSilences,
    reviewItems,
    aiSummary,
    setTranscriptWords,
    transcribeSequence,
    deleteTranscriptRange,
    cutAllSilencesNow,
    runTranscriptAI,
    setExecutionMode,
    startMagicRoughCut,
    setActiveTab,
    jobStatus,
    jobProgress,
    jobMessage,
    language
  } = usePrismexStore();

  const t = translations[language];
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<'ALL' | 'FILLERS' | 'PAUSES' | 'TAKES'>('ALL');
  const [selStartIdx, setSelStartIdx] = useState<number | null>(null);
  const [selEndIdx, setSelEndIdx] = useState<number | null>(null);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [playheadSec, setPlayheadSec] = useState(0);

  // Smart Flexible SRT State
  const [showSmartSrt, setShowSmartSrt] = useState(false);
  const [targetWords, setTargetWords] = useState(3);
  const [flexibleWords, setFlexibleWords] = useState(true);
  const [targetChars, setTargetChars] = useState(20);
  const [maxChars, setMaxChars] = useState(28);
  const [smartCues, setSmartCues] = useState<any[]>([]);
  const [smartSrtText, setSmartSrtText] = useState<string>('');
  const [smartSrtEngine, setSmartSrtEngine] = useState<string>('');
  const [isGeneratingSrt, setIsGeneratingSrt] = useState(false);
  const [srtPreset, setSrtPreset] = useState<'SHORTS' | 'YOUTUBE' | 'PODCAST' | 'CUSTOM'>('SHORTS');

  // Find & Replace State
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');

  // AI Creative Studio State (Shorts, Markers, Spell, AE Typography)
  const [showCreativeStudio, setShowCreativeStudio] = useState(false);
  const [creativeTab, setCreativeTab] = useState<'SHORTS' | 'MARKERS' | 'SPELL' | 'AE'>('SHORTS');
  const [viralShorts, setViralShorts] = useState<any[]>([]);
  const [aiMarkersList, setAiMarkersList] = useState<any[]>([]);
  const [aeTypographyData, setAeTypographyData] = useState<{ formattedText: string; lines: string[]; aeSnippet: string } | null>(null);
  const [isProcessingCreative, setIsProcessingCreative] = useState(false);
  const [creativeStatus, setCreativeStatus] = useState<string | null>(null);

  // Word-Level Floating AI Popover & Speed Tools State
  const [popoverWord, setPopoverWord] = useState<{ wordIdx: number; word: string; start: number; end: number; x: number; y: number } | null>(null);
  const [showBrollModal, setShowBrollModal] = useState<boolean>(false);
  const [brollSearchQuery, setBrollSearchQuery] = useState<string>('');
  const [brollResults, setBrollResults] = useState<any[]>([]);
  const [isSearchingBroll, setIsSearchingBroll] = useState<boolean>(false);
  const [targetBrollTime, setTargetBrollTime] = useState<number>(0);
  const [isApplyingPunch, setIsApplyingPunch] = useState<boolean>(false);
  const [isApplyingSfx, setIsApplyingSfx] = useState<boolean>(false);
  const [youtubeChaptersData, setYoutubeChaptersData] = useState<{ chaptersText: string; chapters: any[] } | null>(null);
  const [showChaptersModal, setShowChaptersModal] = useState<boolean>(false);
  const [isGeneratingChapters, setIsGeneratingChapters] = useState<boolean>(false);
  const [copiedChapters, setCopiedChapters] = useState<boolean>(false);

  // Per-line action state: editing, copied feedback, typography
  const [editingParaIdx, setEditingParaIdx] = useState<number | null>(null);
  const [editingParaText, setEditingParaText] = useState<string>('');
  const [copiedLineIdx, setCopiedLineIdx] = useState<number | null>(null);
  const [typographyCopiedIdx, setTypographyCopiedIdx] = useState<number | null>(null);
  const [hoveredWordIdx, setHoveredWordIdx] = useState<number | null>(null);

  // Auto-play on seek/jump preference & Repeated Take comparison modal
  const [autoPlayOnJump, setAutoPlayOnJump] = useState<boolean>(() => {
    try {
      return localStorage.getItem('prismex_auto_play_on_jump') !== 'false';
    } catch {
      return true;
    }
  });
  const [compareTakesItem, setCompareTakesItem] = useState<any | null>(null);

  const client = PrismexDaemonClient.getInstance();
  const hostBridge = PremiereHostBridge.getInstance();
  const fps = sequenceManifest?.fps || 24;
  const isRunning = jobStatus !== 'COMPLETE' && jobProgress > 0 && jobProgress < 100;

  useEffect(() => {
    if (transcriptWords.length === 0) return;
    const timer = setInterval(async () => {
      const pos = await hostBridge.getPlayheadPosition();
      setPlayheadSec(pos);
    }, 400);
    return () => clearInterval(timer);
  }, [transcriptWords.length]);

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
  const repeatedTakes = useMemo(() => reviewItems.filter((i) => i.category === 'REPEATED_TAKE'), [reviewItems]);

  // Group words into paragraph chunks (~15 words or > 0.75s pause) for Premiere Pro Text Panel layout
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

  const [floatingSelection, setFloatingSelection] = useState<{
    text: string;
    cleanQuery: string;
    x: number;
    y: number;
  } | null>(null);

  const wordMarkersMap = useMemo(() => {
    const map: { [wordIdx: number]: {
      type: 'PNG' | 'BROLL' | 'ICON' | 'EMPHASIS' | string;
      color: string;
      label: string;
      suggestion?: string;
      context?: string;
      cleanKeyword?: string;
      pngQuery?: string;
      googleImagesUrl?: string;
      brollQuery?: string;
      pexelsUrl?: string;
      iconQuery?: string;
      flaticonUrl?: string;
      emphasisEffect?: string;
    } } = {};

    for (const m of aiMarkersList) {
      const mSec = m.startSeconds || 0;
      const wIdx = words.findIndex((w) => w.start <= mSec + 0.35 && w.end >= mSec - 0.35);
      if (wIdx !== -1) {
        let themeColor = '#10b981';
        if (m.type === 'PNG') themeColor = '#a855f7';
        else if (m.type === 'BROLL') themeColor = '#06b6d4';
        else if (m.type === 'ICON') themeColor = '#f59e0b';
        else if (m.type === 'EMPHASIS') themeColor = '#ef4444';

        const cleanKw = m.cleanKeyword || m.name?.replace(/^(PNG|B-Roll|Icon|Emphasis):\s*/i, '') || words[wIdx].word;
        const encodedKw = encodeURIComponent(cleanKw);

        map[wIdx] = {
          type: m.type,
          color: themeColor,
          label: m.name,
          suggestion: m.suggestion || m.comment || m.name,
          context: m.context || '',
          cleanKeyword: cleanKw,
          pngQuery: m.pngQuery || `${cleanKw} transparent png`,
          googleImagesUrl: m.googleImagesUrl || `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(cleanKw + ' transparent png')}`,
          brollQuery: m.brollQuery || `${cleanKw} footage`,
          pexelsUrl: m.pexelsUrl || `https://www.pexels.com/search/videos/${encodedKw}/`,
          iconQuery: m.iconQuery || `${cleanKw} icon png`,
          flaticonUrl: m.flaticonUrl || `https://www.flaticon.com/search?word=${encodedKw}`,
          emphasisEffect: m.emphasisEffect || ''
        };
      }
    }
    return map;
  }, [aiMarkersList, words]);

  const handleCheckTextSelection = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) {
      setFloatingSelection(null);
      return;
    }
    const text = sel.toString().trim();
    if (!text || text.length === 0) {
      setFloatingSelection(null);
      return;
    }
    try {
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const clean = text.replace(/[\r\n\t]+/g, ' ').replace(/[^\w\s\u0980-\u09FF'-]/g, '').trim();
      setFloatingSelection({
        text,
        cleanQuery: clean || text,
        x: Math.max(10, Math.min(window.innerWidth - 380, rect.left + rect.width / 2 - 160)),
        y: Math.max(10, rect.top - 46)
      });
    } catch {
      setFloatingSelection(null);
    }
  }, []);

  const seekAndAutoPlay = useCallback((timeSec: number) => {
    hostBridge.setPlayheadPosition(timeSec);
    setPlayheadSec(timeSec);
    if (autoPlayOnJump) {
      hostBridge.startPlayback(1);
    }
  }, [autoPlayOnJump, hostBridge]);

  const handleWordClick = (idx: number, e: React.MouseEvent) => {
    const winSel = window.getSelection();
    if (winSel && winSel.toString().trim().length > 1) {
      handleCheckTextSelection();
      return;
    }

    const token = words[idx];
    if (!token) return;
    seekAndAutoPlay(token.start);

    if (e.shiftKey && selStartIdx !== null) {
      setSelEndIdx(idx);
      setPopoverWord(null);
    } else {
      setSelStartIdx(idx);
      setSelEndIdx(idx);
      const rect = e.currentTarget.getBoundingClientRect();
      setPopoverWord({
        wordIdx: idx,
        word: token.word,
        start: token.start,
        end: token.end,
        x: rect.left + rect.width / 2,
        y: rect.top
      });
    }
  };

  // Word Popover Actions
  const handleOpenBrollForWord = async (pWord: { wordIdx: number; word: string; start: number; end: number }) => {
    setTargetBrollTime(pWord.start);
    const cleanWord = pWord.word.replace(/[^a-zA-Z0-9_\u0980-\u09FF]/g, '').trim();
    setBrollSearchQuery(cleanWord || 'cinematic');
    setShowBrollModal(true);
    setPopoverWord(null);

    setIsSearchingBroll(true);
    try {
      const results = await client.searchBrollStock(cleanWord || 'cinematic');
      setBrollResults(results || []);
    } finally {
      setIsSearchingBroll(false);
    }
  };

  const handleAddPunchForWord = async (pWord: { wordIdx: number; word: string; start: number; end: number }) => {
    setPopoverWord(null);
    setCreativeStatus(`Applying 114% Punch Zoom at "${pWord.word}"...`);
    try {
      await hostBridge.addTimelineMarkers([{
        type: 'EMPHASIS',
        name: `Punch: ${pWord.word}`,
        comment: 'Dynamic 114% scale zoom punch',
        startSeconds: pWord.start,
        durationSeconds: 2.0,
        color: 'RED'
      }]);
      await hostBridge.applyDynamicPunchZoom([pWord.start], 114);
      setCreativeStatus(`"${pWord.word}" শব্দে ১১৪% জুম-ইন পাঞ্চ ও রেড মার্কার যুক্ত হয়েছে!`);
    } catch (e: any) {
      setCreativeStatus(String(e));
    }
    setTimeout(() => setCreativeStatus(null), 4000);
  };

  const handleAddIconForWord = async (pWord: { wordIdx: number; word: string; start: number; end: number }) => {
    setPopoverWord(null);
    try {
      await hostBridge.addTimelineMarkers([{
        type: 'ICON',
        name: `Icon: ${pWord.word}`,
        comment: `Overlay PNG icon for '${pWord.word}'`,
        startSeconds: pWord.start,
        durationSeconds: 1.5,
        color: 'BLUE'
      }]);
      setCreativeStatus(`"${pWord.word}" শব্দে ব্লু পিএনজি আইকন মার্কার যুক্ত হয়েছে!`);
    } catch (e: any) {
      setCreativeStatus(String(e));
    }
    setTimeout(() => setCreativeStatus(null), 4000);
  };

  // Place B-Roll on Track 2 (V2)
  const handlePlaceBrollOnTrack2 = async (stockItem: any) => {
    setCreativeStatus(`Placing B-Roll on Video Track 2 at ${targetBrollTime.toFixed(1)}s...`);
    try {
      await hostBridge.addTimelineMarkers([{
        type: 'BROLL',
        name: stockItem.title || 'Stock B-Roll',
        comment: 'Cutaway B-Roll footage',
        startSeconds: targetBrollTime,
        durationSeconds: stockItem.durationSeconds || 4.0,
        color: 'GREEN'
      }]);
      setCreativeStatus(`B-Roll মার্কার ও V2 প্লেসহোল্ডার সফলভাবে টাইমলাইনে যুক্ত হয়েছে!`);
      setShowBrollModal(false);
    } catch (e: any) {
      setCreativeStatus(String(e));
    }
    setTimeout(() => setCreativeStatus(null), 4000);
  };

  // 1-Click Auto-Punch Zoom for all emphasis keywords
  const handleApplyAllAutoPunch = async () => {
    setIsApplyingPunch(true);
    setCreativeStatus(language === 'bn' ? 'সবগুলো কি-ওয়ার্ডে ১১৪% পাঞ্চ জুম প্রয়োগ হচ্ছে...' : 'Applying 114% Dynamic Punch Zoom to all keywords...');
    try {
      let markers = aiMarkersList;
      if (markers.length === 0) {
        const res = await client.aiMarkers(transcriptWords);
        if (res && res.markers) {
          markers = res.markers;
          setAiMarkersList(res.markers);
        }
      }
      const punchTimes = markers.filter((m) => m.type === 'EMPHASIS').map((m) => m.startSeconds);
      if (punchTimes.length === 0) {
        punchTimes.push(...transcriptSentences.filter((_: any, i: number) => i % 3 === 0).map((s: any) => s.start_seconds || 0));
      }
      const res = await hostBridge.applyDynamicPunchZoom(punchTimes, 114);
      setCreativeStatus(
        language === 'bn'
          ? `১-ক্লিকে ${res.count || punchTimes.length}টি কি-ওয়ার্ডে ১১৪% পাঞ্চ জুম প্রয়োগ সম্পন্ন হয়েছে!`
          : `Applied 114% Dynamic Punch Zoom to ${res.count || punchTimes.length} moments!`
      );
    } catch (err: any) {
      setCreativeStatus(String(err));
    } finally {
      setIsApplyingPunch(false);
      setTimeout(() => setCreativeStatus(null), 5000);
    }
  };

  // 1-Click Auto-SFX Drop on Audio Track 3
  const handleApplyAllAutoSfx = async () => {
    setIsApplyingSfx(true);
    setCreativeStatus(language === 'bn' ? 'অডিও ট্র্যাকে Whoosh ও Pop সাউন্ড এফেক্ট ড্রপ হচ্ছে...' : 'Dropping Whoosh & Pop SFX to Audio Track 3...');
    try {
      const sfx = await client.ensureSfxAssets();
      if (!sfx) {
        setCreativeStatus('SFX assets could not be generated.');
        return;
      }
      let markers = aiMarkersList;
      if (markers.length === 0) {
        const res = await client.aiMarkers(transcriptWords);
        if (res && res.markers) {
          markers = res.markers;
          setAiMarkersList(res.markers);
        }
      }
      const brollTimes = markers.filter((m) => m.type === 'BROLL').map((m) => m.startSeconds);
      const punchTimes = markers.filter((m) => m.type === 'EMPHASIS').map((m) => m.startSeconds);

      let placed = 0;
      if (brollTimes.length > 0) {
        const r1 = await hostBridge.importAndPlaceSfxBatch(sfx.whoosh, brollTimes, 2);
        if (r1.success) placed += (r1.count || brollTimes.length);
      }
      if (punchTimes.length > 0) {
        const r2 = await hostBridge.importAndPlaceSfxBatch(sfx.pop, punchTimes, 2);
        if (r2.success) placed += (r2.count || punchTimes.length);
      }

      setCreativeStatus(
        language === 'bn'
          ? `Audio Track 3-এ মোট ${placed}টি Whoosh ও Pop সাউন্ড এফেক্ট স্বয়ংক্রিয়ভাবে ড্রপ হয়েছে!`
          : `Dropped ${placed} Whoosh & Pop SFX onto Audio Track 3!`
      );
    } catch (err: any) {
      setCreativeStatus(String(err));
    } finally {
      setIsApplyingSfx(false);
      setTimeout(() => setCreativeStatus(null), 5000);
    }
  };

  // 1-Click YouTube Chapters
  const handleGenerateChapters = async () => {
    setIsGeneratingChapters(true);
    setCreativeStatus(language === 'bn' ? 'ইউটিউব চ্যাপ্টার তৈরি হচ্ছে...' : 'Generating YouTube Chapters...');
    try {
      const res = await client.generateYoutubeChapters(transcriptWords, transcriptSentences, sequenceManifest?.sequenceName);
      if (res) {
        setYoutubeChaptersData(res);
        setShowChaptersModal(true);
        setCreativeStatus(language === 'bn' ? 'ইউটিউব চ্যাপ্টার সফলভাবে তৈরি হয়েছে!' : 'YouTube Chapters ready!');
      }
    } finally {
      setIsGeneratingChapters(false);
      setTimeout(() => setCreativeStatus(null), 4000);
    }
  };

  // Line-level Action Handlers: Copy, Edit, Typography
  const handleCopyLine = (paraIdx: number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLineIdx(paraIdx);
    setTimeout(() => setCopiedLineIdx(null), 2000);
  };

  const handleStartEditLine = (paraIdx: number, paraTokens: any[]) => {
    setEditingParaIdx(paraIdx);
    setEditingParaText(paraTokens.map((t) => t.word).join(' '));
  };

  const handleCancelEditLine = () => {
    setEditingParaIdx(null);
    setEditingParaText('');
  };

  const handleSaveEditLine = (paraIdx: number, paraTokens: any[]) => {
    if (!editingParaText.trim()) {
      handleCancelEditLine();
      return;
    }
    const newWordsText = editingParaText.trim().split(/\s+/);
    const startGlobalIdx = paraTokens[0].globalIdx;
    const endGlobalIdx = paraTokens[paraTokens.length - 1].globalIdx;

    const startTime = paraTokens[0].start;
    const endTime = paraTokens[paraTokens.length - 1].end;
    const totalDur = Math.max(0.3, endTime - startTime);
    const wordDur = totalDur / newWordsText.length;

    const replacedTokens = newWordsText.map((w, idx) => ({
      id: `w_edit_${Date.now()}_${idx}`,
      word: w,
      start: Number((startTime + idx * wordDur).toFixed(3)),
      end: Number((startTime + (idx + 1) * wordDur).toFixed(3)),
      start_seconds: Number((startTime + idx * wordDur).toFixed(3)),
      end_seconds: Number((startTime + (idx + 1) * wordDur).toFixed(3)),
      isFiller: false
    }));

    const updatedWords = [
      ...transcriptWords.slice(0, startGlobalIdx),
      ...replacedTokens,
      ...transcriptWords.slice(endGlobalIdx + 1)
    ];

    setTranscriptWords(updatedWords);
    setEditingParaIdx(null);
    setEditingParaText('');
    setCreativeStatus(language === 'bn' ? 'লাইনটি সফলভাবে আপডেট হয়েছে!' : 'Line successfully updated!');
    setTimeout(() => setCreativeStatus(null), 3000);
  };

  const handleCopyTypography = async (paraIdx: number, fullLineText: string) => {
    try {
      const res = await client.extractTypographyKeywords(fullLineText);
      let typoText = res?.typography;
      if (!typoText || !typoText.trim()) {
        const raw = fullLineText.trim().split(/\s+/);
        const stopSet = new Set(['a', 'an', 'the', 'is', 'are', 'was', 'were', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'that', 'this', 'and', 'but', 'or', 'so', 'it', 'i', 'you', 'he', 'she', 'they', 'we', 'এটা', 'ওটা', 'আমি', 'আমার', 'তুমি', 'তোমার', 'এবং', 'আর', 'করে', 'হলো']);
        const filtered = raw.filter((w) => !stopSet.has(w.toLowerCase().replace(/[^a-zA-Z0-9\u0980-\u09FF]/g, '')));
        typoText = (filtered.length > 0 ? filtered.slice(0, 4).join(' ') : raw.slice(0, 3).join(' ')).toUpperCase();
      }
      navigator.clipboard.writeText(typoText);
      setTypographyCopiedIdx(paraIdx);
      setTimeout(() => setTypographyCopiedIdx(null), 2500);
    } catch (err) {
      console.error('Failed to extract typography:', err);
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

  // Keyboard Shortcuts: Spacebar (Play/Pause) & Delete/Backspace/X (Ripple Delete Selected Word)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput = activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA' || (activeEl as HTMLElement)?.isContentEditable;
      if (isInput) return;

      if (e.code === 'Space' || e.key === ' ' || e.keyCode === 32) {
        e.preventDefault();
        e.stopPropagation();
        hostBridge.togglePlayback();
      } else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === 'x' || e.key === 'X') {
        if (hasSelection) {
          e.preventDefault();
          handleDeleteSelected();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [hasSelection, selectionStartSec, selectionEndSec]);

  const baseFilename = (sequenceManifest?.sequenceName || 'transcript').replace(/[^a-zA-Z0-9_-]/g, '_');
  const [exportStatus, setExportStatus] = useState<string | null>(null);

  const handleGenerateSmartSrt = async () => {
    if (words.length === 0) return;
    setIsGeneratingSrt(true);
    try {
      const res = await client.generateSmartSrt({
        words: transcriptWords,
        fps,
        targetWords,
        minWords: flexibleWords ? Math.max(1, targetWords - 1) : targetWords,
        maxWords: flexibleWords ? targetWords + 2 : targetWords,
        targetChars,
        maxChars,
        flexible: flexibleWords,
        useAi: true
      });
      if (res && res.cues) {
        setSmartCues(res.cues);
        setSmartSrtText(res.srt);
        setSmartSrtEngine(res.engine);
        setExportStatus(language === 'bn' ? `${res.totalCues} টি কিউ তৈরি হয়েছে!` : `${res.totalCues} cues generated!`);
        setTimeout(() => setExportStatus(null), 3000);
      }
    } catch (err) {
      console.error('generateSmartSrt failed:', err);
    } finally {
      setIsGeneratingSrt(false);
    }
  };

  const handleApplyPreset = (preset: 'SHORTS' | 'YOUTUBE' | 'PODCAST') => {
    setSrtPreset(preset);
    if (preset === 'SHORTS') {
      setTargetWords(3);
      setTargetChars(18);
      setMaxChars(26);
    } else if (preset === 'YOUTUBE') {
      setTargetWords(6);
      setTargetChars(32);
      setMaxChars(42);
    } else if (preset === 'PODCAST') {
      setTargetWords(10);
      setTargetChars(45);
      setMaxChars(60);
    }
  };

  const handleCueKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const cue = smartCues[idx];
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

      const newCues = [...smartCues.slice(0, idx), cue1, cue2, ...smartCues.slice(idx + 1)].map((c, i) => ({ ...c, index: i + 1 }));
      setSmartCues(newCues);
      const srtText = newCues.map((c) => `${c.index}\n${c.startSrt} --> ${c.endSrt}\n${c.text}\n`).join('\n');
      setSmartSrtText(srtText);
    }
  };

  const handleCueTextChange = (idx: number, newText: string) => {
    const updated = [...smartCues];
    updated[idx] = { ...updated[idx], text: newText, charCount: newText.length };
    setSmartCues(updated);
    const srtText = updated.map((c) => `${c.index}\n${c.startSrt} --> ${c.endSrt}\n${c.text}\n`).join('\n');
    setSmartSrtText(srtText);
  };

  const handleDeleteCue = (idx: number) => {
    const updated = smartCues.filter((_, i) => i !== idx).map((c, i) => ({ ...c, index: i + 1 }));
    setSmartCues(updated);
    const srtText = updated.map((c) => `${c.index}\n${c.startSrt} --> ${c.endSrt}\n${c.text}\n`).join('\n');
    setSmartSrtText(srtText);
  };

  const handleMergeNextCue = (idx: number) => {
    if (idx >= smartCues.length - 1) return;
    const curr = smartCues[idx];
    const nxt = smartCues[idx + 1];
    const mergedCue = {
      ...curr,
      text: `${curr.text} ${nxt.text}`.trim(),
      endFrame: nxt.endFrame,
      endSeconds: nxt.endSeconds,
      endSrt: nxt.endSrt,
      wordCount: curr.wordCount + nxt.wordCount,
      charCount: curr.text.length + nxt.text.length + 1
    };
    const newCues = [...smartCues.slice(0, idx), mergedCue, ...smartCues.slice(idx + 2)].map((c, i) => ({ ...c, index: i + 1 }));
    setSmartCues(newCues);
    const srtText = newCues.map((c) => `${c.index}\n${c.startSrt} --> ${c.endSrt}\n${c.text}\n`).join('\n');
    setSmartSrtText(srtText);
  };

  const handleReplaceAll = () => {
    if (!findText) return;
    const regex = new RegExp(findText, 'gi');
    const updated = transcriptWords.map((w: any) => ({
      ...w,
      word: String(w.word || '').replace(regex, replaceText)
    }));
    setTranscriptWords(updated);
    setExportStatus(`Replaced all "${findText}" with "${replaceText}"`);
    setTimeout(() => setExportStatus(null), 2500);
  };

  const handleStripPunctuation = (type: 'COMMAS' | 'PERIODS' | 'ALL' | 'UPPER') => {
    const updated = transcriptWords.map((w: any) => {
      let str = String(w.word || '');
      if (type === 'COMMAS') {
        str = str.replace(/[,،]/g, '');
      } else if (type === 'PERIODS') {
        str = str.replace(/[.।]/g, '');
      } else if (type === 'ALL') {
        str = str.replace(/[,.?!।:;—"']/g, '');
      } else if (type === 'UPPER') {
        str = str.toUpperCase();
      }
      return { ...w, word: str };
    });
    setTranscriptWords(updated);
    setExportStatus(`Punctuation updated!`);
    setTimeout(() => setExportStatus(null), 2500);
  };

  const handleRunSpellCheck = async () => {
    setIsProcessingCreative(true);
    setCreativeStatus('Checking spelling & grammar...');
    try {
      const res = await client.aiSpellCheck(transcriptWords);
      if (res && res.words) {
        setTranscriptWords(res.words);
        setCreativeStatus(`Fixed ${res.corrections} word(s) (${res.engine})!`);
      }
    } finally {
      setIsProcessingCreative(false);
    }
  };

  const handleDetectViralShorts = async () => {
    setIsProcessingCreative(true);
    setCreativeStatus('Analyzing transcript for 9:16 Viral Shorts...');
    try {
      const shorts = await client.aiViralShorts({
        words: transcriptWords,
        sentences: transcriptSentences,
        targetCount: 5,
        fps
      });
      if (shorts) {
        setViralShorts(shorts);
        setCreativeStatus(`Generated ${shorts.length} viral vertical short moments!`);
      }
    } finally {
      setIsProcessingCreative(false);
    }
  };

  const handleAnalyzeMarkers = useCallback(async () => {
    if (transcriptWords.length === 0) return;
    setIsProcessingCreative(true);
    setCreativeStatus('Analyzing PNG cutouts, B-Roll, & Visual cues...');
    try {
      const res = await client.aiMarkers(transcriptWords);
      if (res && res.markers) {
        setAiMarkersList(res.markers);
        setCreativeStatus(`Identified ${res.markers.length} visual cues (PNG, B-Roll, Icons)!`);
      }
    } finally {
      setIsProcessingCreative(false);
    }
  }, [transcriptWords, client]);

  useEffect(() => {
    if (transcriptWords.length > 0 && aiMarkersList.length === 0) {
      handleAnalyzeMarkers();
    }
  }, [transcriptWords.length, aiMarkersList.length, handleAnalyzeMarkers]);

  const handleSendMarkersToPremiere = async () => {
    if (aiMarkersList.length === 0) return;
    const res = await hostBridge.addTimelineMarkers(aiMarkersList);
    if (res.success) {
      setCreativeStatus(`Added ${res.count} colored markers to Premiere timeline!`);
    } else {
      setCreativeStatus(res.error || 'Failed to add timeline markers');
    }
  };

  const handleGenerateAeTypography = async (sampleText?: string) => {
    const textToFormat = sampleText || (hasSelection ? words.slice(minSel, maxSel + 1).map((w) => w.word).join(' ') : words.slice(0, 15).map((w) => w.word).join(' '));
    if (!textToFormat) return;
    setIsProcessingCreative(true);
    setCreativeStatus('Formatting After Effects Kinetic Typography...');
    try {
      const res = await client.formatAeTypography(textToFormat);
      if (res) {
        setAeTypographyData(res);
        setCreativeStatus('Kinetic typography ready for After Effects!');
      }
    } finally {
      setIsProcessingCreative(false);
    }
  };

  const handleCopyAeScript = () => {
    if (!aeTypographyData) return;
    navigator.clipboard.writeText(aeTypographyData.aeSnippet);
    setCreativeStatus('After Effects Script copied to clipboard!');
    setTimeout(() => setCreativeStatus(null), 3000);
  };

  const buildSrtContent = () => {
    if (smartSrtText && smartSrtText.length > 0) {
      return smartSrtText;
    }
    const cues: string[] = [];
    let cueIdx = 1;
    for (let i = 0; i < words.length; i += 8) {
      const chunk = words.slice(i, i + 8);
      if (chunk.length === 0) continue;
      // Snap start/end to exact sequence framerate grid
      const startFrame = Math.round(chunk[0].start * fps);
      const endFrame = Math.max(startFrame + 1, Math.round(chunk[chunk.length - 1].end * fps));
      const start = formatSrtTimestamp(startFrame / fps);
      const end = formatSrtTimestamp(endFrame / fps);
      const text = chunk.map((w) => w.word).join(' ');
      cues.push(`${cueIdx}\n${start} --> ${end}\n${text}\n`);
      cueIdx++;
    }
    return cues.join('\n');
  };

  const handleExportTxt = async () => {
    const txt = paragraphs
      .map((p) => `[${TimecodeConverter.formatTimecode(p.startTime, fps)}] ` + p.tokens.map((tok) => tok.word).join(' '))
      .join('\n\n');
    const res = await hostBridge.saveFileWithDialog(`${baseFilename}.txt`, txt, ['txt']);
    if (res.saved) {
      setExportStatus(`Saved TXT!`);
      setTimeout(() => setExportStatus(null), 2500);
    }
  };

  const handleExportSrt = async () => {
    const srt = buildSrtContent();
    const res = await hostBridge.saveFileWithDialog(`${baseFilename}.srt`, srt, ['srt']);
    if (res.saved) {
      setExportStatus(`Saved SRT (${fps} fps)!`);
      setTimeout(() => setExportStatus(null), 2500);
    }
  };

  const handleExportJson = async () => {
    const alignedSegments = paragraphs.map((p, idx) => {
      const pEnd = p.tokens[p.tokens.length - 1]?.end || p.startTime;
      const startFrame = Math.round(p.startTime * fps);
      const endFrame = Math.round(pEnd * fps);
      return {
        segmentIndex: idx,
        startSeconds: Number((startFrame / fps).toFixed(4)),
        endSeconds: Number((endFrame / fps).toFixed(4)),
        startFrame,
        endFrame,
        startTimecode: TimecodeConverter.formatTimecode(p.startTime, fps),
        endTimecode: TimecodeConverter.formatTimecode(pEnd, fps),
        text: p.tokens.map((tok) => tok.word).join(' ')
      };
    });

    const alignedWords = words.map((w) => {
      const startFrame = Math.round(w.start * fps);
      const endFrame = Math.round(w.end * fps);
      return {
        id: w.id,
        word: w.word,
        startSeconds: Number((startFrame / fps).toFixed(4)),
        endSeconds: Number((endFrame / fps).toFixed(4)),
        startFrame,
        endFrame,
        startTimecode: TimecodeConverter.formatTimecode(w.start, fps),
        endTimecode: TimecodeConverter.formatTimecode(w.end, fps),
        isFiller: w.isFiller
      };
    });

    const payload = {
      sequenceName: sequenceManifest?.sequenceName || 'Unknown',
      fps,
      totalWords: alignedWords.length,
      segments: alignedSegments,
      words: alignedWords
    };
    const res = await hostBridge.saveFileWithDialog(`${baseFilename}_transcript.json`, JSON.stringify(payload, null, 2), ['json']);
    if (res.saved) {
      setExportStatus(`Saved JSON (${fps} fps)!`);
      setTimeout(() => setExportStatus(null), 2500);
    }
  };

  const handleSendToPremiereCaptions = async () => {
    const srt = buildSrtContent();
    const res = await hostBridge.sendSrtToPremiereCaptionTrack(`${baseFilename}.srt`, srt);
    if (res.success) {
      setExportStatus(language === 'bn' ? 'Premiere Text Panel (Captions)-এ যোগ হয়েছে!' : 'Added to Premiere Caption Track!');
    } else {
      setExportStatus(res.error || 'Failed to add caption track');
    }
    setTimeout(() => setExportStatus(null), 3500);
  };

  const handleSaveAll3ToProject = async () => {
    const srt = smartSrtText || buildSrtContent();
    const txt = paragraphs
      .map((p) => `[${TimecodeConverter.formatTimecode(p.startTime, fps)}] ` + p.tokens.map((tok) => tok.word).join(' '))
      .join('\n\n');
    const alignedSegments = paragraphs.map((p, idx) => {
      const pEnd = p.tokens[p.tokens.length - 1]?.end || p.startTime;
      const startFrame = Math.round(p.startTime * fps);
      const endFrame = Math.round(pEnd * fps);
      return {
        segmentIndex: idx,
        startSeconds: Number((startFrame / fps).toFixed(4)),
        endSeconds: Number((endFrame / fps).toFixed(4)),
        startFrame,
        endFrame,
        startTimecode: TimecodeConverter.formatTimecode(p.startTime, fps),
        endTimecode: TimecodeConverter.formatTimecode(pEnd, fps),
        text: p.tokens.map((tok) => tok.word).join(' ')
      };
    });
    const alignedWords = words.map((w) => {
      const startFrame = Math.round(w.start * fps);
      const endFrame = Math.max(startFrame + 1, Math.round(w.end * fps));
      return {
        word: w.word,
        startSeconds: Number((startFrame / fps).toFixed(4)),
        endSeconds: Number((endFrame / fps).toFixed(4)),
        startFrame,
        endFrame,
        startTimecode: TimecodeConverter.formatTimecode(w.start, fps),
        endTimecode: TimecodeConverter.formatTimecode(w.end, fps),
        isFiller: w.isFiller
      };
    });
    const payload = {
      sequenceName: sequenceManifest?.sequenceName || 'Unknown',
      fps,
      totalWords: alignedWords.length,
      segments: alignedSegments,
      words: alignedWords
    };
    const jsonStr = JSON.stringify(payload, null, 2);
    setExportStatus(language === 'bn' ? 'প্রজেক্ট ফোল্ডারে সেভ হচ্ছে...' : 'Saving to project folder...');
    const res = await hostBridge.saveAllProjectFiles(baseFilename, srt, txt, jsonStr);
    if (res.success) {
      const folderName = res.folder ? res.folder.split('/').pop() || res.folder : '';
      setExportStatus(
        language === 'bn'
          ? `৩টি ফাইল (${baseFilename}.srt, .txt, .json) সফলভাবে সেভ হয়েছে! [${folderName}]`
          : `Saved 3 files (${baseFilename}.srt, .txt, .json) successfully! [${folderName}]`
      );
    } else {
      setExportStatus(res.error || 'Failed to save files');
    }
    setTimeout(() => setExportStatus(null), 4000);
  };

  const handleRunAi = async () => {
    setShowAiPanel(true);
    setAiLoading(true);
    await runTranscriptAI(aiPrompt || undefined);
    setAiLoading(false);
  };

  // Pre-Transcription State (Premiere Pro Text Panel First Screen)
  if (words.length === 0) {
    return (
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', height: '100%', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '13px', fontWeight: 600 }}>Text Panel — Speech to Text</h2>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              First transcribe your sequence audio, then edit text, run AI, export SRT/TXT, or Auto Cut.
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
                Generates word-level transcript locally via Apple Silicon MLX-Whisper, plus detects silences, fillers &amp; repeated takes.
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
              onClick={() => setActiveTab('silence')}
            >
              <VolumeX size={13} />
              <span>Silence Cut</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Post-Transcription State (Premiere Pro Text Panel Interface)
  return (
    <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', height: '100%', overflow: 'hidden' }}>
      {/* Top Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600 }}>
            {language === 'bn' ? `ট্রান্সক্রিপ্ট (${words.length} শব্দ)` : `Transcript (${words.length} words)`}
          </div>
          <span
            style={{
              fontSize: '9.5px',
              color: '#34d399',
              backgroundColor: 'rgba(52, 211, 153, 0.15)',
              padding: '1px 6px',
              borderRadius: '3px',
              display: 'flex',
              alignItems: 'center',
              gap: '3px'
            }}
            title={language === 'bn' ? 'এই প্রজেক্ট ও সিকোয়েন্সের ট্রান্সক্রিপ্ট স্বয়ংক্রিয়ভাবে সংরক্ষিত রয়েছে' : 'Transcript is persistently saved for this project & sequence'}
          >
            <CheckCircle2 size={10} />
            {language === 'bn' ? 'প্রজেক্টে সংরক্ষিত' : 'Project Saved'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          <button
            className="btn-secondary"
            disabled={isRunning}
            onClick={transcribeSequence}
            style={{ padding: '4px 7px', fontSize: '10px' }}
          >
            <Mic size={11} />
            <span>{language === 'bn' ? 'পুনরায় ট্রান্সক্রাইব' : 'Re-Transcribe'}</span>
          </button>
          <button
            className="btn-secondary"
            onClick={handleRunAi}
            style={{ padding: '4px 7px', fontSize: '10px', borderColor: 'rgba(139, 92, 246, 0.5)', color: '#c4b5fd' }}
          >
            <Bot size={11} />
            <span>AI Assistant</span>
          </button>
          <button
            className="btn-primary"
            disabled={isRunning}
            onClick={() => {
              setExecutionMode('AUTO_EDIT');
              startMagicRoughCut();
            }}
            style={{ padding: '4px 8px', fontSize: '10px' }}
          >
            <Sparkles size={11} />
            <span>Auto Cut</span>
          </button>
          <button
            className="btn-secondary"
            onClick={() => setActiveTab('review-queue')}
            style={{ padding: '4px 7px', fontSize: '10px' }}
          >
            <CheckSquare size={11} />
            <span>Review ({reviewItems.length})</span>
          </button>
        </div>
      </div>

      {/* Export Row (TXT / SRT / JSON) + Quick Silence Cut */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={handleSaveAll3ToProject}
            className="btn-primary"
            title={language === 'bn' ? 'প্রজেক্ট ফোল্ডারে এক ক্লিকে SRT, TXT এবং JSON ফাইল সেভ করুন' : '1-Click Save SRT, TXT & JSON directly to active project directory'}
            style={{
              padding: '3px 8px',
              fontSize: '10px',
              backgroundColor: '#059669',
              color: '#ffffff',
              border: 'none',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <Save size={11} />
            <span>{language === 'bn' ? 'প্রজেক্টে ৩টি ফাইল সেভ (SRT+TXT+JSON)' : 'Save 3 to Project (SRT+TXT+JSON)'}</span>
          </button>
          <button
            onClick={() => setActiveTab('srt-editor')}
            className="btn-secondary"
            title={language === 'bn' ? 'পূর্ণাঙ্গ ডেডিকেটেড SRT এডিটরে যান' : 'Go to dedicated full-featured Smart SRT Editor'}
            style={{
              padding: '3px 7px',
              fontSize: '10px',
              color: '#60a5fa',
              borderColor: 'rgba(96, 165, 250, 0.4)',
              backgroundColor: 'rgba(96, 165, 250, 0.1)',
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
              cursor: 'pointer'
            }}
          >
            <Subtitles size={11} />
            <span>{language === 'bn' ? '৬. SRT এডিটর খুলুন' : 'Open SRT Editor'}</span>
          </button>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '3px', marginLeft: '4px' }}>
            <Download size={10} /> Export:
          </span>
          <button onClick={handleExportTxt} className="btn-secondary" style={{ padding: '3px 7px', fontSize: '10px' }}>
            .TXT
          </button>
          <button onClick={handleExportSrt} className="btn-secondary" style={{ padding: '3px 7px', fontSize: '10px' }}>
            .SRT
          </button>
          <button onClick={handleExportJson} className="btn-secondary" style={{ padding: '3px 7px', fontSize: '10px' }}>
            .JSON ({fps}fps)
          </button>
          <button
            onClick={() => setShowSmartSrt(!showSmartSrt)}
            className="btn-secondary"
            title="Configure AI Smart Flexible SRT with 0-Frame Drift"
            style={{
              padding: '3px 7px',
              fontSize: '10px',
              color: showSmartSrt ? '#bfdbfe' : '#60a5fa',
              backgroundColor: showSmartSrt ? 'rgba(59, 130, 246, 0.25)' : 'transparent',
              borderColor: 'rgba(59, 130, 246, 0.5)',
              display: 'flex',
              alignItems: 'center',
              gap: '3px'
            }}
          >
            <Subtitles size={10} />
            <span>{language === 'bn' ? 'AI স্মার্ট SRT' : 'Smart SRT'}</span>
          </button>
          <button
            onClick={() => setShowFindReplace(!showFindReplace)}
            className="btn-secondary"
            title="Find & Replace text and strip punctuation"
            style={{
              padding: '3px 7px',
              fontSize: '10px',
              color: showFindReplace ? '#fef08a' : '#facc15',
              backgroundColor: showFindReplace ? 'rgba(250, 204, 21, 0.2)' : 'transparent',
              borderColor: 'rgba(250, 204, 21, 0.4)',
              display: 'flex',
              alignItems: 'center',
              gap: '3px'
            }}
          >
            <Type size={10} />
            <span>{language === 'bn' ? 'খুঁজুন/মুছুন' : 'Find/Clean'}</span>
          </button>
          <button
            onClick={() => setShowCreativeStudio(!showCreativeStudio)}
            className="btn-secondary"
            title="Viral Shorts (9:16), Colored Timeline Markers, Spell Check, AE Typography"
            style={{
              padding: '3px 7px',
              fontSize: '10px',
              color: showCreativeStudio ? '#f472b6' : '#ec4899',
              backgroundColor: showCreativeStudio ? 'rgba(236, 72, 153, 0.2)' : 'transparent',
              borderColor: 'rgba(236, 72, 153, 0.4)',
              display: 'flex',
              alignItems: 'center',
              gap: '3px'
            }}
          >
            <Sparkles size={10} />
            <span>{language === 'bn' ? 'AI স্টুডিও' : 'AI Studio'}</span>
          </button>
          <button
            onClick={handleSendToPremiereCaptions}
            className="btn-secondary"
            title="Create Caption Track in Premiere Pro & populate Text Panel Captions"
            style={{ padding: '3px 7px', fontSize: '10px', color: '#34d399', borderColor: 'rgba(16, 185, 129, 0.4)' }}
          >
            {language === 'bn' ? 'Premiere Captions-এ পাঠান' : 'Send to Premiere Captions'}
          </button>
        </div>

        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          {exportStatus && (
            <span style={{ fontSize: '10px', color: '#34d399', fontWeight: 600 }}>{exportStatus}</span>
          )}
          {detectedSilences.length > 0 && (
            <button
              onClick={cutAllSilencesNow}
              className="btn-secondary"
              style={{ padding: '3px 8px', fontSize: '10px', color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.4)' }}
            >
              <Scissors size={10} />
              <span>Cut {detectedSilences.length} Silence(s)</span>
            </button>
          )}
        </div>
      </div>

      {/* AI Assistant Panel */}
      {showAiPanel && (
        <div
          className="card"
          style={{
            backgroundColor: 'rgba(139, 92, 246, 0.08)',
            borderColor: 'rgba(139, 92, 246, 0.35)',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            padding: '8px 10px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '10.5px', fontWeight: 600, color: '#c4b5fd', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Bot size={12} /> {t.aiAssistant} {aiSummary?.engine ? `(${aiSummary.engine})` : ''}
            </span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                onClick={() => setActiveTab('providers')}
                style={{
                  background: 'rgba(139, 92, 246, 0.2)',
                  border: '1px solid rgba(139, 92, 246, 0.4)',
                  borderRadius: '4px',
                  color: '#ddd6fe',
                  fontSize: '9.5px',
                  padding: '2px 6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                  cursor: 'pointer'
                }}
              >
                <Key size={10} />
                <span>{t.setupAiKey}</span>
              </button>
              <button
                onClick={() => setShowAiPanel(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '10px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            <input
              type="text"
              placeholder="Ask AI about this transcript (e.g., summarize, find fluff)..."
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              style={{
                flex: 1,
                backgroundColor: 'var(--bg-tertiary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '4px',
                color: 'var(--text-primary)',
                fontSize: '10.5px',
                padding: '4px 8px'
              }}
            />
            <button onClick={handleRunAi} disabled={aiLoading} className="btn-primary" style={{ padding: '4px 10px', fontSize: '10.5px' }}>
              {aiLoading ? 'Thinking...' : 'Ask AI'}
            </button>
          </div>

          {aiSummary && (
            <div style={{ fontSize: '10.5px', color: 'var(--text-primary)', lineHeight: 1.5, maxHeight: '90px', overflowY: 'auto' }}>
              {aiSummary.summary}
            </div>
          )}
        </div>
      )}

      {/* Find & Replace / Punctuation Cleaner Panel */}
      {showFindReplace && (
        <div
          className="card"
          style={{
            backgroundColor: 'rgba(250, 204, 21, 0.08)',
            borderColor: 'rgba(250, 204, 21, 0.35)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            padding: '10px 12px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#fef08a', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Type size={12} /> {language === 'bn' ? 'টেক্সট খুঁজুন ও বিরতিচিহ্ন মুছুন' : 'Find & Replace / Punctuation Cleaner'}
            </span>
            <button
              onClick={() => setShowFindReplace(false)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '11px', cursor: 'pointer' }}
            >
              ✕
            </button>
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            <input
              type="text"
              placeholder={language === 'bn' ? 'কী শব্দ খুঁজবেন...' : 'Find text...'}
              value={findText}
              onChange={(e) => setFindText(e.target.value)}
              style={{
                flex: 1,
                backgroundColor: 'var(--bg-tertiary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '4px',
                color: 'var(--text-primary)',
                fontSize: '11px',
                padding: '4px 8px'
              }}
            />
            <input
              type="text"
              placeholder={language === 'bn' ? 'কী শব্দ দিয়ে বদলাবেন...' : 'Replace with...'}
              value={replaceText}
              onChange={(e) => setReplaceText(e.target.value)}
              style={{
                flex: 1,
                backgroundColor: 'var(--bg-tertiary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '4px',
                color: 'var(--text-primary)',
                fontSize: '11px',
                padding: '4px 8px'
              }}
            />
            <button onClick={handleReplaceAll} className="btn-primary" style={{ padding: '4px 10px', fontSize: '10.5px' }}>
              {language === 'bn' ? 'সব বদলান' : 'Replace All'}
            </button>
          </div>

          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '9.5px', color: 'var(--text-muted)' }}>1-Click Quick Clean:</span>
            <button
              onClick={() => handleStripPunctuation('COMMAS')}
              className="btn-secondary"
              style={{ padding: '2px 6px', fontSize: '9.5px' }}
            >
              Strip Commas (,)
            </button>
            <button
              onClick={() => handleStripPunctuation('PERIODS')}
              className="btn-secondary"
              style={{ padding: '2px 6px', fontSize: '9.5px' }}
            >
              Strip Periods (.)
            </button>
            <button
              onClick={() => handleStripPunctuation('ALL')}
              className="btn-secondary"
              style={{ padding: '2px 6px', fontSize: '9.5px', color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.4)' }}
            >
              Strip All Punctuation
            </button>
            <button
              onClick={() => handleStripPunctuation('UPPER')}
              className="btn-secondary"
              style={{ padding: '2px 6px', fontSize: '9.5px' }}
            >
              ALL CAPS
            </button>
          </div>
        </div>
      )}

      {/* AI Creative Studio Panel (Viral Shorts, Markers, Spell Check, AE Typography) */}
      {showCreativeStudio && (
        <div
          className="card"
          style={{
            backgroundColor: 'rgba(236, 72, 153, 0.08)',
            borderColor: 'rgba(236, 72, 153, 0.35)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            padding: '10px 12px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#f472b6', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Sparkles size={12} /> {language === 'bn' ? 'AI ক্রিয়েটিভ স্টুডিও' : 'AI Creative Studio'}
            </span>
            <button
              onClick={() => setShowCreativeStudio(false)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '11px', cursor: 'pointer' }}
            >
              ✕
            </button>
          </div>

          {/* Subtabs: SHORTS, MARKERS, SPELL, AE */}
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              onClick={() => setCreativeTab('SHORTS')}
              style={{
                padding: '3px 8px',
                fontSize: '10px',
                backgroundColor: creativeTab === 'SHORTS' ? '#ec4899' : 'var(--bg-tertiary)',
                color: creativeTab === 'SHORTS' ? '#fff' : 'var(--text-secondary)',
                borderRadius: '4px'
              }}
            >
              <Film size={10} style={{ marginRight: '3px' }} />
              {language === 'bn' ? 'ভাইরাল শর্টস (9:16)' : 'Viral Shorts (9:16)'}
            </button>
            <button
              onClick={() => setCreativeTab('MARKERS')}
              style={{
                padding: '3px 8px',
                fontSize: '10px',
                backgroundColor: creativeTab === 'MARKERS' ? '#ec4899' : 'var(--bg-tertiary)',
                color: creativeTab === 'MARKERS' ? '#fff' : 'var(--text-secondary)',
                borderRadius: '4px'
              }}
            >
              <Tag size={10} style={{ marginRight: '3px' }} />
              {language === 'bn' ? 'কালার মার্কার (লাল/সবুজ/নীল)' : 'Colored Markers'}
            </button>
            <button
              onClick={() => setCreativeTab('SPELL')}
              style={{
                padding: '3px 8px',
                fontSize: '10px',
                backgroundColor: creativeTab === 'SPELL' ? '#ec4899' : 'var(--bg-tertiary)',
                color: creativeTab === 'SPELL' ? '#fff' : 'var(--text-secondary)',
                borderRadius: '4px'
              }}
            >
              <Type size={10} style={{ marginRight: '3px' }} />
              {language === 'bn' ? 'বানান সংশোধন' : 'Spell Check'}
            </button>
            <button
              onClick={() => setCreativeTab('AE')}
              style={{
                padding: '3px 8px',
                fontSize: '10px',
                backgroundColor: creativeTab === 'AE' ? '#ec4899' : 'var(--bg-tertiary)',
                color: creativeTab === 'AE' ? '#fff' : 'var(--text-secondary)',
                borderRadius: '4px'
              }}
            >
              <FileCode size={10} style={{ marginRight: '3px' }} />
              {language === 'bn' ? 'After Effects টাইপোগ্রাফি' : 'After Effects Kinetic'}
            </button>
          </div>

          {creativeStatus && (
            <div style={{ fontSize: '10px', color: '#f472b6', fontWeight: 600 }}>{creativeStatus}</div>
          )}

          {/* Tab 1: SHORTS */}
          {creativeTab === 'SHORTS' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                  AI analyzes script to identify top 5 high-hook 30-60s vertical moments.
                </span>
                <button
                  onClick={handleDetectViralShorts}
                  disabled={isProcessingCreative}
                  className="btn-primary"
                  style={{ padding: '3px 8px', fontSize: '10px', backgroundColor: '#ec4899' }}
                >
                  {isProcessingCreative ? 'Analyzing...' : 'Generate 5 Viral Shorts'}
                </button>
              </div>

              {viralShorts.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '130px', overflowY: 'auto' }}>
                  {viralShorts.map((sh, idx) => (
                    <div
                      key={`sh_${idx}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        backgroundColor: 'var(--bg-tertiary)',
                        fontSize: '10px'
                      }}
                    >
                      <div>
                        <span style={{ fontWeight: 600, color: '#f472b6' }}>#{idx + 1} {sh.title}</span>
                        <span style={{ color: 'var(--text-muted)', marginLeft: '6px' }}>
                          {sh.startSeconds}s - {sh.endSeconds}s ({sh.durationSeconds}s)
                        </span>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '9px' }}>Hook: "{sh.hook}"</div>
                      </div>
                      <button
                        className="btn-secondary"
                        style={{ padding: '2px 6px', fontSize: '9px' }}
                        onClick={() => hostBridge.setPlayheadPosition(sh.startSeconds)}
                      >
                        Seek
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 2: MARKERS & VISUAL STUDIO */}
          {creativeTab === 'MARKERS' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                  🟢 B-Roll ভিজ্যুয়াল, 🔴 কি-ওয়ার্ড পাঞ্চ (১১৪% জুম) এবং 🔵 PNG আইকন মার্কার।
                </span>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  <button
                    onClick={handleAnalyzeMarkers}
                    disabled={isProcessingCreative}
                    className="btn-secondary"
                    style={{ padding: '3px 8px', fontSize: '10px' }}
                  >
                    ভিজ্যুয়াল বিশ্লেষণ
                  </button>
                  {aiMarkersList.length > 0 && (
                    <button
                      onClick={handleSendMarkersToPremiere}
                      className="btn-primary"
                      style={{ padding: '3px 8px', fontSize: '10px', backgroundColor: '#10b981' }}
                    >
                      টাইমলাইনে সব মার্কার পাঠান
                    </button>
                  )}
                </div>
              </div>

              {/* Master Speed Automation Actions Bar */}
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', padding: '6px 8px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                <button
                  onClick={handleApplyAllAutoPunch}
                  disabled={isApplyingPunch}
                  className="btn-secondary"
                  style={{ padding: '3px 8px', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '3px', color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.4)' }}
                  title="১-ক্লিকে সব পাঞ্চ পয়েন্টে স্বয়ংক্রিয় ১১৪% স্কেল জুম প্রয়োগ করুন"
                >
                  <Zap size={10} />
                  <span>{isApplyingPunch ? 'প্রয়োগ হচ্ছে...' : '⚡ অটো-পাঞ্চ জুম (১১৪%)'}</span>
                </button>

                <button
                  onClick={handleApplyAllAutoSfx}
                  disabled={isApplyingSfx}
                  className="btn-secondary"
                  style={{ padding: '3px 8px', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '3px', color: '#6ee7b7', borderColor: 'rgba(16, 185, 129, 0.4)' }}
                  title="অডিও ট্র্যাক ৩-এ Whoosh ও Pop সাউন্ড এফেক্ট স্বয়ংক্রিয়ভাবে ড্রপ করুন"
                >
                  <Volume2 size={10} />
                  <span>{isApplyingSfx ? 'ড্রপ হচ্ছে...' : '🔊 অটো-SFX ড্রপ (A3)'}</span>
                </button>

                <button
                  onClick={handleGenerateChapters}
                  disabled={isGeneratingChapters}
                  className="btn-secondary"
                  style={{ padding: '3px 8px', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '3px', color: '#93c5fd', borderColor: 'rgba(59, 130, 246, 0.4)' }}
                  title="ইউটিউব ডেসক্রিপশনের জন্য অটো চ্যাপ্টার টাইমস্ট্যাম্প তৈরি করুন"
                >
                  <BookOpen size={10} />
                  <span>{isGeneratingChapters ? 'তৈরি হচ্ছে...' : '📑 ইউটিউব চ্যাপ্টারস'}</span>
                </button>
              </div>

              {aiMarkersList.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', maxHeight: '120px', overflowY: 'auto' }}>
                  {aiMarkersList.map((m, idx) => (
                    <div
                      key={`mk_${idx}`}
                      onClick={() => hostBridge.setPlayheadPosition(m.startSeconds)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '3px 6px',
                        borderRadius: '3px',
                        backgroundColor: 'var(--bg-tertiary)',
                        fontSize: '9.5px',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: m.color === 'RED' ? '#ef4444' : m.color === 'GREEN' ? '#10b981' : '#3b82f6'
                          }}
                        />
                        <span style={{ fontWeight: 600 }}>{m.name}</span>
                        <span style={{ color: 'var(--text-muted)' }}>{m.comment}</span>
                      </div>
                      <span style={{ color: '#a78bfa', fontFamily: 'monospace' }}>{m.startSeconds.toFixed(2)}s</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 3: SPELL CHECK */}
          {creativeTab === 'SPELL' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                  Scans speech-to-text transcript with AI proofreader to eliminate all spelling &amp; grammar errors.
                </span>
                <button
                  onClick={handleRunSpellCheck}
                  disabled={isProcessingCreative}
                  className="btn-primary"
                  style={{ padding: '3px 8px', fontSize: '10px' }}
                >
                  {isProcessingCreative ? 'Checking...' : 'Run Spell Check & Polish'}
                </button>
              </div>
            </div>
          )}

          {/* Tab 4: AE TYPOGRAPHY */}
          {creativeTab === 'AE' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                  Formats text into Kinetic Typography layout with 1-click script for Adobe After Effects.
                </span>
                <button
                  onClick={() => handleGenerateAeTypography()}
                  disabled={isProcessingCreative}
                  className="btn-secondary"
                  style={{ padding: '3px 8px', fontSize: '10px' }}
                >
                  Format Kinetic Text
                </button>
              </div>

              {aeTypographyData && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', backgroundColor: 'var(--bg-tertiary)', padding: '6px', borderRadius: '4px' }}>
                  <div style={{ fontFamily: 'monospace', fontSize: '11px', whiteSpace: 'pre-wrap', color: '#fef08a' }}>
                    {aeTypographyData.formattedText}
                  </div>
                  <button
                    onClick={handleCopyAeScript}
                    className="btn-primary"
                    style={{ alignSelf: 'flex-start', padding: '3px 8px', fontSize: '9.5px', marginTop: '4px' }}
                  >
                    <Copy size={10} style={{ marginRight: '3px' }} />
                    Copy After Effects Script (.jsx)
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* AI Smart Flexible SRT Panel */}
      {showSmartSrt && (
        <div
          className="card"
          style={{
            backgroundColor: 'rgba(59, 130, 246, 0.08)',
            borderColor: 'rgba(59, 130, 246, 0.35)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            padding: '10px 12px'
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Subtitles size={13} color="#60a5fa" />
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#93c5fd' }}>
                {language === 'bn' ? 'AI স্মার্ট ফ্লেক্সিবল SRT ও ক্যাপশন (০-ফ্রেম ড্রিফট)' : 'AI Smart Flexible SRT (100% 0-Frame Drift)'}
              </span>
              {smartSrtEngine && (
                <span
                  style={{
                    fontSize: '9px',
                    padding: '1px 5px',
                    borderRadius: '3px',
                    backgroundColor: 'rgba(59, 130, 246, 0.25)',
                    color: '#bfdbfe'
                  }}
                >
                  {smartSrtEngine}
                </span>
              )}
            </div>
            <button
              onClick={() => setShowSmartSrt(false)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '11px', cursor: 'pointer' }}
            >
              ✕
            </button>
          </div>

          {/* Quick Presets Row */}
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            <span style={{ fontSize: '9.5px', color: 'var(--text-muted)' }}>Presets:</span>
            <button
              onClick={() => handleApplyPreset('SHORTS')}
              style={{
                padding: '2px 7px',
                fontSize: '9.5px',
                borderRadius: '3px',
                backgroundColor: srtPreset === 'SHORTS' ? '#3b82f6' : 'var(--bg-tertiary)',
                color: srtPreset === 'SHORTS' ? '#fff' : 'var(--text-secondary)'
              }}
            >
              Shorts/Reels (2-3 words)
            </button>
            <button
              onClick={() => handleApplyPreset('YOUTUBE')}
              style={{
                padding: '2px 7px',
                fontSize: '9.5px',
                borderRadius: '3px',
                backgroundColor: srtPreset === 'YOUTUBE' ? '#3b82f6' : 'var(--bg-tertiary)',
                color: srtPreset === 'YOUTUBE' ? '#fff' : 'var(--text-secondary)'
              }}
            >
              YouTube Standard (5-7 words)
            </button>
            <button
              onClick={() => handleApplyPreset('PODCAST')}
              style={{
                padding: '2px 7px',
                fontSize: '9.5px',
                borderRadius: '3px',
                backgroundColor: srtPreset === 'PODCAST' ? '#3b82f6' : 'var(--bg-tertiary)',
                color: srtPreset === 'PODCAST' ? '#fff' : 'var(--text-secondary)'
              }}
            >
              Podcast/Full Line (8-12 words)
            </button>
          </div>

          {/* Controls: Target Words, Flexibility, Target Chars, Max Chars */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <label style={{ fontSize: '9.5px', color: 'var(--text-secondary)' }}>
                {language === 'bn' ? 'টার্গেট ওয়ার্ড (যেমন: ৩)' : 'Target Words / Cue:'}
              </label>
              <input
                type="number"
                min={1}
                max={12}
                value={targetWords}
                onChange={(e) => setTargetWords(Math.max(1, parseInt(e.target.value) || 1))}
                style={{
                  backgroundColor: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '4px',
                  color: 'var(--text-primary)',
                  fontSize: '11px',
                  padding: '3px 6px'
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <label style={{ fontSize: '9.5px', color: 'var(--text-secondary)' }}>
                {language === 'bn' ? 'টার্গেট ক্যারেক্টার (যেমন: ২০)' : 'Target Chars / Cue:'}
              </label>
              <input
                type="number"
                min={8}
                max={60}
                value={targetChars}
                onChange={(e) => setTargetChars(Math.max(8, parseInt(e.target.value) || 8))}
                style={{
                  backgroundColor: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '4px',
                  color: 'var(--text-primary)',
                  fontSize: '11px',
                  padding: '3px 6px'
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <label style={{ fontSize: '9.5px', color: 'var(--text-secondary)' }}>
                {language === 'bn' ? 'সর্বোচ্চ ক্যারেক্টার (ফ্রেম ফিট):' : 'Max Chars (Frame Fit):'}
              </label>
              <input
                type="number"
                min={12}
                max={80}
                value={maxChars}
                onChange={(e) => setMaxChars(Math.max(12, parseInt(e.target.value) || 12))}
                style={{
                  backgroundColor: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '4px',
                  color: 'var(--text-primary)',
                  fontSize: '11px',
                  padding: '3px 6px'
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingTop: '10px' }}>
              <input
                type="checkbox"
                id="flexibleWordsCheck"
                checked={flexibleWords}
                onChange={(e) => setFlexibleWords(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              <label htmlFor="flexibleWordsCheck" style={{ fontSize: '10px', color: 'var(--text-primary)', cursor: 'pointer', lineHeight: 1.2 }}>
                {language === 'bn' ? 'ফ্লেক্সিবল ফ্রেজ (২-৪+ ওয়ার্ড)' : 'Flexible (2-4+ words)'}
              </label>
            </div>
          </div>

          {/* Action Row */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '2px' }}>
            <button
              onClick={handleGenerateSmartSrt}
              disabled={isGeneratingSrt || words.length === 0}
              className="btn-primary"
              style={{ padding: '5px 12px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '5px' }}
            >
              <Sparkles size={12} />
              <span>
                {isGeneratingSrt
                  ? (language === 'bn' ? 'AI বাক্য বিশ্লেষণ ও ফ্রেম স্ন্যাপ হচ্ছে...' : 'AI Analyzing & Snapping...')
                  : (language === 'bn' ? 'AI স্মার্ট SRT তৈরি করুন' : 'Generate AI Smart SRT')}
              </span>
            </button>
            {smartCues.length > 0 && (
              <>
                <button
                  onClick={handleSendToPremiereCaptions}
                  className="btn-secondary"
                  style={{ padding: '5px 10px', fontSize: '11px', color: '#34d399', borderColor: 'rgba(16, 185, 129, 0.4)' }}
                >
                  {language === 'bn' ? 'Premiere Captions-এ পাঠান' : 'Send to Premiere Captions'}
                </button>
                <button
                  onClick={handleExportSrt}
                  className="btn-secondary"
                  style={{ padding: '5px 10px', fontSize: '11px' }}
                >
                  <Download size={11} />
                  <span>.SRT</span>
                </button>
              </>
            )}
          </div>

          {/* Cues Interactive Editor & Inspector */}
          {smartCues.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)' }}>
                <span>
                  {language === 'bn'
                    ? `মোট ${smartCues.length} টি কিউ • সিকোয়েন্স ফ্রেমরেট: ${fps} fps • [Enter চাপলে লাইন স্প্লিট হবে]`
                    : `${smartCues.length} Cues • Sequence: ${fps} fps • [Press Enter in box to split line]`}
                </span>
                <span style={{ color: '#34d399', display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <CheckCircle2 size={10} /> {language === 'bn' ? 'ফ্রেম সিঙ্ক সক্রিয়' : 'Frame Synced'}
                </span>
              </div>
              <div
                style={{
                  maxHeight: '150px',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  backgroundColor: 'var(--bg-tertiary)',
                  borderRadius: '4px',
                  padding: '4px',
                  border: '1px solid var(--border-subtle)'
                }}
              >
                {smartCues.map((cue: any, cIdx: number) => (
                  <div
                    key={`cue_${cue.index}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '3px 6px',
                      borderRadius: '3px',
                      backgroundColor: 'rgba(255, 255, 255, 0.03)',
                      fontSize: '10px'
                    }}
                  >
                    <span
                      onClick={() => hostBridge.setPlayheadPosition(cue.startSeconds)}
                      style={{ color: '#60a5fa', fontWeight: 600, width: '22px', cursor: 'pointer' }}
                      title="Click to seek"
                    >
                      #{cue.index}
                    </span>

                    <input
                      type="text"
                      value={cue.text}
                      onChange={(e) => handleCueTextChange(cIdx, e.target.value)}
                      onKeyDown={(e) => handleCueKeyDown(cIdx, e)}
                      title="Edit text (Press Enter to split cue into two lines)"
                      style={{
                        flex: 1,
                        backgroundColor: 'rgba(0,0,0,0.2)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '3px',
                        color: 'var(--text-primary)',
                        fontSize: '10px',
                        padding: '2px 6px'
                      }}
                    />

                    <span style={{ color: '#a78bfa', fontSize: '9px', fontFamily: 'monospace' }}>
                      F:{cue.startFrame}-{cue.endFrame}
                    </span>

                    <button
                      onClick={() => handleMergeNextCue(cIdx)}
                      title="Merge with next cue line"
                      style={{ padding: '1px 4px', fontSize: '8.5px', background: 'transparent', color: 'var(--text-muted)' }}
                    >
                      Merge ↓
                    </button>

                    <button
                      onClick={() => handleDeleteCue(cIdx)}
                      title="Delete this cue"
                      style={{ padding: '1px 4px', fontSize: '8.5px', background: 'transparent', color: '#f87171' }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

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
            padding: '5px 7px',
            fontSize: '10px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
            backgroundColor: filterMode === 'FILLERS' ? 'rgba(250, 204, 21, 0.2)' : 'var(--bg-tertiary)',
            color: filterMode === 'FILLERS' ? '#facc15' : 'var(--text-secondary)',
            cursor: 'pointer'
          }}
        >
          {t.fillers} ({fillerCount})
        </button>

        <button
          onClick={() => setFilterMode(filterMode === 'PAUSES' ? 'ALL' : 'PAUSES')}
          style={{
            padding: '5px 7px',
            fontSize: '10px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
            backgroundColor: filterMode === 'PAUSES' ? 'rgba(239, 68, 68, 0.2)' : 'var(--bg-tertiary)',
            color: filterMode === 'PAUSES' ? '#f87171' : 'var(--text-secondary)',
            cursor: 'pointer'
          }}
        >
          {t.pauses} ({detectedSilences.length})
        </button>

        <button
          onClick={() => setFilterMode(filterMode === 'TAKES' ? 'ALL' : 'TAKES')}
          style={{
            padding: '5px 7px',
            fontSize: '10px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
            backgroundColor: filterMode === 'TAKES' ? 'rgba(139, 92, 246, 0.25)' : 'var(--bg-tertiary)',
            color: filterMode === 'TAKES' ? '#c4b5fd' : 'var(--text-secondary)',
            cursor: 'pointer'
          }}
        >
          {t.doubleLines} ({repeatedTakes.length})
        </button>

        <button
          onClick={() => {
            const nextVal = !autoPlayOnJump;
            setAutoPlayOnJump(nextVal);
            try {
              localStorage.setItem('prismex_auto_play_on_jump', String(nextVal));
            } catch {}
          }}
          title="জাম্প বা শব্দে ক্লিক করলেই সরাসরি ভিডিও প্লে হবে (অন/অফ করুন)"
          style={{
            marginLeft: 'auto',
            padding: '4px 8px',
            fontSize: '10px',
            borderRadius: 'var(--radius-sm)',
            border: autoPlayOnJump ? '1px solid #10b981' : '1px solid var(--border-subtle)',
            backgroundColor: autoPlayOnJump ? 'rgba(16, 185, 129, 0.2)' : 'var(--bg-tertiary)',
            color: autoPlayOnJump ? '#34d399' : 'var(--text-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          <Zap size={10} />
          <span>{autoPlayOnJump ? (language === 'bn' ? '⚡ জাম্পে অটো-প্লে: চালু' : '⚡ Auto-Play: ON') : (language === 'bn' ? '⚡ জাম্পে অটো-প্লে: বন্ধ' : '⚡ Auto-Play: OFF')}</span>
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
      ) : filterMode === 'TAKES' ? (
        /* Double Lines / Repeated Takes Filter View */
        <div className="card" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {repeatedTakes.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '11px', textAlign: 'center', padding: '20px' }}>
              {language === 'bn' ? 'কোনো ডাবল লাইন পাওয়া যায়নি।' : 'No repeated takes / double lines detected.'}
            </div>
          ) : (
            repeatedTakes.map((rt, idx) => (
              <div
                key={rt.id}
                onClick={() => hostBridge.setPlayheadPosition(rt.startSeconds)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '5px',
                  padding: '8px 10px',
                  backgroundColor: 'var(--bg-tertiary)',
                  borderLeft: '3px solid #a78bfa',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '11px',
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: 'monospace', color: '#c4b5fd', fontWeight: 600 }}>
                    #{idx + 1} • {TimecodeConverter.formatTimecode(rt.startSeconds, fps)} ({rt.durationSeconds.toFixed(2)}s)
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteTranscriptRange(rt.startSeconds, rt.endSeconds);
                    }}
                    className="btn-secondary"
                    style={{ padding: '3px 8px', fontSize: '10px', color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.4)' }}
                  >
                    <Scissors size={10} />
                    <span>{t.cutDoubleLine}</span>
                  </button>
                </div>
                <div style={{ color: 'var(--text-primary)' }}>"{rt.transcriptSnippet}"</div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{rt.reason}</div>
              </div>
            ))
          )}
        </div>
      ) : (
        /* Paragraph Transcript Body (Premiere Pro Text Panel Style - Clean & Natural) */
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px', minHeight: 0 }}>
          {/* Subtle Visual Cues Legend Bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '4px 8px',
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
            borderRadius: '4px',
            border: '1px solid var(--border-subtle)',
            fontSize: '10px',
            flexWrap: 'wrap',
            gap: '6px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>
                {language === 'bn' ? 'ভিজ্যুয়াল কিউ নির্দেশিকা:' : 'Visual Cues Guide:'}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: '#c084fc' }} title="পার্পল কালার: ছবি, কাটআউট, লোগো ও ডিভাইস পিকচার">
                <span style={{ width: '8px', height: '8px', backgroundColor: '#a855f7', borderRadius: '2px' }}></span>
                🖼️ PNG / ছবি
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: '#67e8f9' }} title="সায়ান কালার: সিনেম্যাটিক ফুটেজ ও ভিডিও কাটঅ্যাওয়ে">
                <span style={{ width: '8px', height: '8px', backgroundColor: '#06b6d4', borderRadius: '2px' }}></span>
                🎥 B-Roll ভিডিও
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: '#fbbf24' }} title="অরেঞ্জ কালার: ইউআই আইকন, বেল ও বাটন">
                <span style={{ width: '8px', height: '8px', backgroundColor: '#f59e0b', borderRadius: '2px' }}></span>
                🎨 আইকন
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: '#f87171' }} title="রেড কালার: পাঞ্চ জুম ও কি-ওয়ার্ড">
                <span style={{ width: '8px', height: '8px', backgroundColor: '#ef4444', borderRadius: '2px' }}></span>
                ⚡ পাঞ্চ / কি-ওয়ার্ড
              </span>
            </div>
            <span style={{ color: 'var(--text-muted)', fontSize: '9.5px' }}>
              {language === 'bn' ? '💡 টেক্সট সিলেক্ট করলেই ড্র্যাগ টুলবার এবং ক্লিকে ডাইরেক্ট সার্চ ওপেন হবে' : '💡 Drag text to search PNG/Videos or 1-click word'}
            </span>
          </div>

          <div
            className="card"
            onMouseUp={handleCheckTextSelection}
            onKeyUp={handleCheckTextSelection}
            style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', userSelect: 'text' }}
          >
          {paragraphs.map((para) => {
            const paraEnd = para.tokens[para.tokens.length - 1]?.end || para.startTime;
            const matchingTake = repeatedTakes.find(
              (rt) => rt.startSeconds <= paraEnd && rt.endSeconds >= para.startTime
            );
            const paraLineText = para.tokens.map((tok) => tok.word).join(' ');
            const isEditingThis = editingParaIdx === para.startIdx;

            return (
            <div
              key={para.startIdx}
              style={{
                display: 'flex',
                gap: '12px',
                alignItems: 'flex-start',
                padding: matchingTake ? '6px' : '4px 0',
                borderRadius: matchingTake ? '4px' : '0',
                backgroundColor: matchingTake ? 'rgba(139, 92, 246, 0.08)' : 'transparent',
                borderLeft: matchingTake ? '2px solid #a78bfa' : 'none'
              }}
            >
              {/* Left Column: Timecode & Discreet Action Icons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '76px', flexShrink: 0 }}>
                <div
                  onClick={() => seekAndAutoPlay(para.startTime)}
                  title="Click to jump playhead to paragraph start"
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '10px',
                    color: 'var(--accent-color)',
                    paddingTop: '3px',
                    cursor: 'pointer',
                    userSelect: 'none'
                  }}
                >
                  {TimecodeConverter.formatTimecode(para.startTime, fps)}
                </div>

                {/* 3 Discreet Line Action Buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                  {/* 📋 Copy Sentence */}
                  <button
                    onClick={() => handleCopyLine(para.startIdx, paraLineText)}
                    title="পুরো লাইন ক্লিপবোর্ডে কপি করুন"
                    style={{
                      backgroundColor: copiedLineIdx === para.startIdx ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      color: copiedLineIdx === para.startIdx ? '#34d399' : 'var(--text-muted)',
                      borderRadius: '3px',
                      padding: '2px 4px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    {copiedLineIdx === para.startIdx ? <Check size={10} /> : <Copy size={10} />}
                  </button>

                  {/* ✏️ Edit Line */}
                  <button
                    onClick={() => (isEditingThis ? handleCancelEditLine() : handleStartEditLine(para.startIdx, para.tokens))}
                    title={isEditingThis ? 'এডিটিং বাতিল' : 'লাইনটি এডিট করুন'}
                    style={{
                      backgroundColor: isEditingThis ? 'rgba(59, 130, 246, 0.3)' : 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      color: isEditingThis ? '#60a5fa' : 'var(--text-muted)',
                      borderRadius: '3px',
                      padding: '2px 4px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <Pencil size={10} />
                  </button>

                  {/* ✨ Typography Keyword Copy */}
                  <button
                    onClick={() => handleCopyTypography(para.startIdx, paraLineText)}
                    title="টাইপোগ্রাফির জন্য গুরুত্বপূর্ণ কি-ওয়ার্ডগুলো কপি করুন (টেক্সট অপরিবর্তিত থাকবে)"
                    style={{
                      backgroundColor: typographyCopiedIdx === para.startIdx ? 'rgba(234, 179, 8, 0.3)' : 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      color: typographyCopiedIdx === para.startIdx ? '#facc15' : '#c084fc',
                      borderRadius: '3px',
                      padding: '2px 4px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <Sparkles size={10} />
                  </button>
                </div>

                {matchingTake && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '2px' }}>
                    <button
                      onClick={() => setCompareTakesItem(matchingTake)}
                      title="উভয় টেক তুলনা করুন এবং কোনটি রাখবেন সিদ্ধান্ত নিন"
                      style={{
                        backgroundColor: 'rgba(139, 92, 246, 0.25)',
                        border: '1px solid rgba(139, 92, 246, 0.5)',
                        borderRadius: '3px',
                        color: '#ddd6fe',
                        fontSize: '9px',
                        padding: '2px 4px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '2px'
                      }}
                    >
                      <Eye size={9} />
                      <span>টেক তুলনা</span>
                    </button>
                    {matchingTake.takeDetails?.matched_take && (
                      <button
                        onClick={() => seekAndAutoPlay(matchingTake.takeDetails?.matched_take.start_seconds)}
                        title={`বিকল্প টেকটিতে সরাসরি জাম্প করুন (${TimecodeConverter.formatTimecode(matchingTake.takeDetails.matched_take.start_seconds, fps)})`}
                        style={{
                          backgroundColor: 'rgba(16, 185, 129, 0.2)',
                          border: '1px solid rgba(16, 185, 129, 0.4)',
                          borderRadius: '3px',
                          color: '#6ee7b7',
                          fontSize: '8.5px',
                          padding: '1px 3px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '2px'
                        }}
                      >
                        <Play size={8} />
                        <span>টেক {matchingTake.takeDetails.matched_take.candidate_index || 2} শুনুন</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Main Body: Flowing Natural Paragraph Text or Clean Inline Editor */}
              {isEditingThis ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <textarea
                    value={editingParaText}
                    onChange={(e) => setEditingParaText(e.target.value)}
                    rows={2}
                    style={{
                      width: '100%',
                      backgroundColor: '#18181b',
                      color: '#fff',
                      border: '1px solid #3b82f6',
                      borderRadius: '4px',
                      padding: '6px 8px',
                      fontSize: '12px',
                      fontFamily: 'inherit',
                      resize: 'vertical',
                      outline: 'none'
                    }}
                    autoFocus
                  />
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <button
                      onClick={() => handleSaveEditLine(para.startIdx, para.tokens)}
                      style={{
                        backgroundColor: '#059669',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '3px',
                        padding: '3px 9px',
                        fontSize: '11px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <Save size={11} />
                      <span>সেভ</span>
                    </button>
                    <button
                      onClick={handleCancelEditLine}
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.08)',
                        color: 'var(--text-muted)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        borderRadius: '3px',
                        padding: '3px 8px',
                        fontSize: '11px',
                        cursor: 'pointer'
                      }}
                    >
                      বাতিল
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ flex: 1, lineHeight: 1.85, userSelect: 'text' }}>
                  {para.tokens.map((item) => {
                    if (filterMode === 'FILLERS' && !item.isFiller) return null;
                    const matches = searchTerm && item.word.toLowerCase().includes(searchTerm.toLowerCase());
                    const isSelected = hasSelection && item.globalIdx >= minSel && item.globalIdx <= maxSel;
                    const isPlayingWord = playheadSec > 0 && playheadSec >= item.start && playheadSec <= item.end;
                    const markerInfo = wordMarkersMap[item.globalIdx];
                    const isPng = markerInfo?.type === 'PNG';
                    const isBroll = markerInfo?.type === 'BROLL';
                    const isEmphasis = markerInfo?.type === 'EMPHASIS';
                    const isIcon = markerInfo?.type === 'ICON';

                    let wordBg = 'transparent';
                    let wordColor = 'var(--text-primary)';
                    let wordBorder = '1px solid transparent';
                    let wordBorderBottom: string | undefined = undefined;

                    if (isPlayingWord) {
                      wordBg = 'rgba(16, 185, 129, 0.38)';
                      wordColor = '#fff';
                      wordBorder = '1px solid #34d399';
                    } else if (isSelected) {
                      wordBg = 'rgba(59, 130, 246, 0.45)';
                      wordBorder = '1px solid #60a5fa';
                    } else if (matches) {
                      wordBg = '#3b82f6';
                    } else if (item.isFiller) {
                      wordBg = 'rgba(250, 204, 21, 0.25)';
                      wordColor = '#facc15';
                      wordBorder = '1px dashed rgba(250, 204, 21, 0.4)';
                    } else if (isPng) {
                      wordBg = 'rgba(168, 85, 247, 0.18)';
                      wordColor = '#f3e8ff';
                      wordBorderBottom = '2.5px solid #a855f7';
                    } else if (isBroll) {
                      wordBg = 'rgba(6, 182, 212, 0.18)';
                      wordColor = '#cffafe';
                      wordBorderBottom = '2.5px solid #06b6d4';
                    } else if (isIcon) {
                      wordBg = 'rgba(245, 158, 11, 0.18)';
                      wordColor = '#fef3c7';
                      wordBorderBottom = '2.5px solid #f59e0b';
                    } else if (isEmphasis) {
                      wordBg = 'rgba(239, 68, 68, 0.18)';
                      wordColor = '#fee2e2';
                      wordBorderBottom = '2.5px solid #ef4444';
                    }

                    return (
                      <span key={item.id} style={{ display: 'inline-flex', alignItems: 'center', margin: '1px 2px' }}>
                        <span
                          onClick={(e) => handleWordClick(item.globalIdx, e)}
                          title={`${item.start.toFixed(2)}s - ${item.end.toFixed(2)}s${markerInfo ? ' [' + (markerInfo.suggestion || markerInfo.label) + ']' : ''} (ক্লিক করুন AI অ্যাকশনের জন্য, Shift+Click সিলেক্ট)`}
                          style={{
                            display: 'inline-block',
                            padding: '1px 4px',
                            borderRadius: '3px',
                            cursor: 'pointer',
                            backgroundColor: wordBg,
                            color: wordColor,
                            border: wordBorder,
                            borderBottom: wordBorderBottom,
                            textDecoration: isPlayingWord ? 'underline' : 'none',
                            fontSize: '12px',
                            fontWeight: (isPng || isBroll || isEmphasis || isIcon) ? 600 : 400
                          }}
                        >
                          {item.word}
                        </span>

                        {isPng && (
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              setPopoverWord({
                                wordIdx: item.globalIdx,
                                word: item.word,
                                start: item.start,
                                end: item.end,
                                x: e.clientX,
                                y: e.clientY
                              });
                            }}
                            title={`🖼️ PNG / ছবি সাজেশন: ${markerInfo?.suggestion} (ক্লিক করে Google Images ও মার্কার অ্যাকশন দেখুন)`}
                            style={{
                              fontSize: '8.5px',
                              fontWeight: 700,
                              padding: '1px 4px',
                              backgroundColor: '#9333ea',
                              color: '#ffffff',
                              borderRadius: '3px',
                              marginLeft: '2px',
                              cursor: 'pointer',
                              userSelect: 'none',
                              verticalAlign: 'middle'
                            }}
                          >
                            🖼️ PNG
                          </span>
                        )}

                        {isBroll && (
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              setPopoverWord({
                                wordIdx: item.globalIdx,
                                word: item.word,
                                start: item.start,
                                end: item.end,
                                x: e.clientX,
                                y: e.clientY
                              });
                            }}
                            title={`🎥 B-Roll ভিডিও সাজেশন: ${markerInfo?.suggestion} (ক্লিক করে Pexels ভিডিও অ্যাকশন দেখুন)`}
                            style={{
                              fontSize: '8.5px',
                              fontWeight: 700,
                              padding: '1px 4px',
                              backgroundColor: '#0891b2',
                              color: '#ffffff',
                              borderRadius: '3px',
                              marginLeft: '2px',
                              cursor: 'pointer',
                              userSelect: 'none',
                              verticalAlign: 'middle'
                            }}
                          >
                            🎥 B-Roll
                          </span>
                        )}

                        {isIcon && (
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              setPopoverWord({
                                wordIdx: item.globalIdx,
                                word: item.word,
                                start: item.start,
                                end: item.end,
                                x: e.clientX,
                                y: e.clientY
                              });
                            }}
                            title={`🎨 আইকন সাজেশন: ${markerInfo?.suggestion}`}
                            style={{
                              fontSize: '8.5px',
                              fontWeight: 700,
                              padding: '1px 4px',
                              backgroundColor: '#d97706',
                              color: '#ffffff',
                              borderRadius: '3px',
                              marginLeft: '2px',
                              cursor: 'pointer',
                              userSelect: 'none',
                              verticalAlign: 'middle'
                            }}
                          >
                            🎨 Icon
                          </span>
                        )}

                        {isEmphasis && (
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              setPopoverWord({
                                wordIdx: item.globalIdx,
                                word: item.word,
                                start: item.start,
                                end: item.end,
                                x: e.clientX,
                                y: e.clientY
                              });
                            }}
                            title="⚡ পাঞ্চ জুম (১১৪%)"
                            style={{
                              fontSize: '8.5px',
                              fontWeight: 700,
                              padding: '1px 4px',
                              backgroundColor: '#dc2626',
                              color: '#ffffff',
                              borderRadius: '3px',
                              marginLeft: '2px',
                              cursor: 'pointer',
                              userSelect: 'none',
                              verticalAlign: 'middle'
                            }}
                          >
                            ⚡ পাঞ্চ
                          </span>
                        )}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
            );
          })}
        </div>
      </div>
      )}

      {/* ===================== FLOATING WORD-LEVEL AI POPOVER ===================== */}
      {popoverWord && (
        <div
          style={{
            position: 'fixed',
            top: `${Math.max(10, popoverWord.y - 44)}px`,
            left: `${Math.min(window.innerWidth - 380, Math.max(10, popoverWord.x - 160))}px`,
            zIndex: 9999,
            backgroundColor: '#18181b',
            border: '1px solid rgba(255,255,255,0.25)',
            borderRadius: '6px',
            padding: '4px 6px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.85)',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontFamily: 'inherit'
          }}
        >
          {/* 🖼️ Google Images PNG */}
          <button
            onClick={() => {
              const activeMarker = wordMarkersMap[popoverWord.wordIdx];
              const q = activeMarker?.pngQuery || `${popoverWord.word.replace(/[^\w\s\u0980-\u09FF'-]/g, '')} transparent png`;
              const url = activeMarker?.googleImagesUrl || `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(q)}`;
              hostBridge.openURLInDefaultBrowser(url);
              setPopoverWord(null);
            }}
            style={{
              padding: '3px 7px',
              fontSize: '10px',
              backgroundColor: 'rgba(168, 85, 247, 0.2)',
              color: '#d8b4fe',
              border: '1px solid rgba(168, 85, 247, 0.45)',
              borderRadius: '3px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '3px'
            }}
            title="গুগল ইমেজ সার্চে এই শব্দের পিএনজি / ছবি সরাসরি ব্রাউজারে খুঁজুন"
          >
            <Image size={10} />
            <span>+ PNG ছবি</span>
          </button>

          {/* 🎥 Pexels Video */}
          <button
            onClick={() => {
              const activeMarker = wordMarkersMap[popoverWord.wordIdx];
              const cleanWord = popoverWord.word.replace(/[^a-zA-Z0-9_\u0980-\u09FF]/g, '').trim();
              const url = activeMarker?.pexelsUrl || `https://www.pexels.com/search/videos/${encodeURIComponent(cleanWord || 'cinematic')}/`;
              hostBridge.openURLInDefaultBrowser(url);
              handleOpenBrollForWord(popoverWord);
            }}
            style={{
              padding: '3px 7px',
              fontSize: '10px',
              backgroundColor: 'rgba(6, 182, 212, 0.2)',
              color: '#67e8f9',
              border: '1px solid rgba(6, 182, 212, 0.45)',
              borderRadius: '3px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '3px'
            }}
            title="Pexels.com ভিডিও সার্চ ওপেন করুন ও B-Roll খুঁজুন"
          >
            <Video size={10} />
            <span>+ B-Roll (Pexels)</span>
          </button>

          {/* ⚡ Punch Zoom */}
          <button
            onClick={() => handleAddPunchForWord(popoverWord)}
            style={{
              padding: '3px 7px',
              fontSize: '10px',
              backgroundColor: 'rgba(239, 68, 68, 0.2)',
              color: '#f87171',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: '3px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '3px'
            }}
            title="পাঞ্চ কি-ওয়ার্ড মার্ক করুন এবং ১১৪% জুম প্রয়োগ করুন"
          >
            <Zap size={10} />
            <span>+ Punch</span>
          </button>

          {/* 🎨 Icon */}
          <button
            onClick={() => handleAddIconForWord(popoverWord)}
            style={{
              padding: '3px 7px',
              fontSize: '10px',
              backgroundColor: 'rgba(245, 158, 11, 0.2)',
              color: '#fbbf24',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              borderRadius: '3px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '3px'
            }}
            title="PNG আইকন/গ্রাফিক্স সাজেশন ও মার্কার"
          >
            <Sparkles size={10} />
            <span>+ Icon</span>
          </button>

          {/* 📋 Copy Word */}
          <button
            onClick={() => {
              const cleanWord = popoverWord.word.replace(/[^a-zA-Z0-9_\u0980-\u09FF]/g, '').trim();
              navigator.clipboard.writeText(cleanWord);
              setCreativeStatus(`"${cleanWord}" কপি হয়েছে!`);
              setTimeout(() => setCreativeStatus(null), 2500);
            }}
            style={{
              padding: '3px 6px',
              fontSize: '10px',
              backgroundColor: 'rgba(255,255,255,0.06)',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '3px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '3px'
            }}
            title="শব্দটি কপি করুন"
          >
            <Copy size={10} />
          </button>

          {/* ✂️ Cut Word */}
          <button
            onClick={() => {
              deleteTranscriptRange(popoverWord.start, popoverWord.end);
              setPopoverWord(null);
            }}
            style={{
              padding: '3px 6px',
              fontSize: '10px',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              color: '#fca5a5',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: '3px',
              cursor: 'pointer'
            }}
            title="এই শব্দটি টাইমলাইন থেকে ডিলিট করুন"
          >
            <Scissors size={10} />
          </button>

          {/* Close */}
          <button
            onClick={() => setPopoverWord(null)}
            style={{
              padding: '2px 5px',
              fontSize: '10px',
              backgroundColor: 'transparent',
              color: 'var(--text-muted)',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* ===================== FLOATING TEXT DRAG SELECTION TOOLBAR ===================== */}
      {floatingSelection && (
        <div
          style={{
            position: 'fixed',
            top: `${floatingSelection.y}px`,
            left: `${floatingSelection.x}px`,
            zIndex: 10000,
            backgroundColor: '#18181b',
            border: '1px solid rgba(255,255,255,0.28)',
            borderRadius: '6px',
            padding: '4px 7px',
            boxShadow: '0 8px 28px rgba(0,0,0,0.9)',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontFamily: 'inherit'
          }}
        >
          {/* 📋 Copy */}
          <button
            onClick={() => {
              navigator.clipboard.writeText(floatingSelection.text);
              setExportStatus(`"${floatingSelection.text.slice(0, 25)}..." কপি হয়েছে!`);
              setTimeout(() => setExportStatus(null), 2500);
            }}
            title="সিলেক্টেড টেক্সট কপি করুন"
            style={{
              padding: '3px 7px',
              fontSize: '10px',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              color: '#ffffff',
              border: '1px solid rgba(255, 255, 255, 0.18)',
              borderRadius: '3px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
              fontWeight: 600
            }}
          >
            <Copy size={10} />
            <span>কপি</span>
          </button>

          {/* 🖼️ Google Images (PNG) */}
          <button
            onClick={() => {
              const url = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(floatingSelection.cleanQuery + ' transparent png')}`;
              hostBridge.openURLInDefaultBrowser(url);
            }}
            title="সিলেক্টেড অংশের পিএনজি / ছবি সরাসরি গুগল ইমেজে খুঁজুন"
            style={{
              padding: '3px 7px',
              fontSize: '10px',
              backgroundColor: 'rgba(168, 85, 247, 0.25)',
              color: '#d8b4fe',
              border: '1px solid rgba(168, 85, 247, 0.5)',
              borderRadius: '3px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
              fontWeight: 600
            }}
          >
            <Image size={10} />
            <span>গুগল ইমেজ (PNG)</span>
          </button>

          {/* 🎥 Pexels Video Search */}
          <button
            onClick={() => {
              const url = `https://www.pexels.com/search/videos/${encodeURIComponent(floatingSelection.cleanQuery)}/`;
              hostBridge.openURLInDefaultBrowser(url);
            }}
            title="সিলেক্টেড বিষয়ের বি-রোল ফুটেজ Pexels.com-এ খুঁজুন"
            style={{
              padding: '3px 7px',
              fontSize: '10px',
              backgroundColor: 'rgba(6, 182, 212, 0.25)',
              color: '#67e8f9',
              border: '1px solid rgba(6, 182, 212, 0.5)',
              borderRadius: '3px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
              fontWeight: 600
            }}
          >
            <Video size={10} />
            <span>Pexels ভিডিও</span>
          </button>

          {/* 🔍 Google Web Search */}
          <button
            onClick={() => {
              const url = `https://www.google.com/search?q=${encodeURIComponent(floatingSelection.cleanQuery)}`;
              hostBridge.openURLInDefaultBrowser(url);
            }}
            title="গুগল সার্চ"
            style={{
              padding: '3px 6px',
              fontSize: '10px',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              color: 'var(--text-muted)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '3px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '2px'
            }}
          >
            <Search size={10} />
            <span>গুগল</span>
          </button>

          {/* 📍 Add Purple PNG Marker */}
          <button
            onClick={async () => {
              await hostBridge.addTimelineMarkers([{
                type: 'PNG' as any,
                name: `PNG: ${floatingSelection.cleanQuery.slice(0, 20)}`,
                comment: `Overlay PNG picture for '${floatingSelection.cleanQuery}'`,
                startSeconds: playheadSec,
                durationSeconds: 2.0,
                color: 'PURPLE' as any
              }]);
              setCreativeStatus(`টাইমলাইনে পার্পল PNG মার্কার যুক্ত হয়েছে!`);
              setFloatingSelection(null);
              setTimeout(() => setCreativeStatus(null), 2500);
            }}
            title="টাইমলাইনে পার্পল কালার পিএনজি মার্কার দিন"
            style={{
              padding: '3px 6px',
              fontSize: '9.5px',
              backgroundColor: 'rgba(168, 85, 247, 0.18)',
              color: '#c084fc',
              border: '1px solid rgba(168, 85, 247, 0.35)',
              borderRadius: '3px',
              cursor: 'pointer'
            }}
          >
            +PNG মার্কার
          </button>

          {/* 📍 Add Cyan B-Roll Marker */}
          <button
            onClick={async () => {
              await hostBridge.addTimelineMarkers([{
                type: 'BROLL' as any,
                name: `B-Roll: ${floatingSelection.cleanQuery.slice(0, 20)}`,
                comment: `Overlay B-Roll footage for '${floatingSelection.cleanQuery}'`,
                startSeconds: playheadSec,
                durationSeconds: 2.5,
                color: 'CYAN' as any
              }]);
              setCreativeStatus(`টাইমলাইনে সায়ান B-Roll মার্কার যুক্ত হয়েছে!`);
              setFloatingSelection(null);
              setTimeout(() => setCreativeStatus(null), 2500);
            }}
            title="টাইমলাইনে সায়ান কালার বি-রোল মার্কার দিন"
            style={{
              padding: '3px 6px',
              fontSize: '9.5px',
              backgroundColor: 'rgba(6, 182, 212, 0.18)',
              color: '#22d3ee',
              border: '1px solid rgba(6, 182, 212, 0.35)',
              borderRadius: '3px',
              cursor: 'pointer'
            }}
          >
            +B-Roll মার্কার
          </button>

          {/* Close */}
          <button
            onClick={() => setFloatingSelection(null)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '2px',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <X size={11} />
          </button>
        </div>
      )}

      {/* ===================== B-ROLL STOCK SEARCH MODAL ===================== */}
      {showBrollModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            backgroundColor: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '460px',
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              padding: '14px',
              backgroundColor: '#18181b',
              borderColor: 'rgba(16, 185, 129, 0.4)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#34d399', fontWeight: 600, fontSize: '12px' }}>
                <Video size={14} />
                <span>B-Roll স্টক ফুটেজ ও V2 প্লেসমেন্ট ({targetBrollTime.toFixed(1)}s)</span>
              </div>
              <button
                onClick={() => setShowBrollModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '13px' }}
              >
                ✕
              </button>
            </div>

            {/* Search Input Bar */}
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                type="text"
                value={brollSearchQuery}
                onChange={(e) => setBrollSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setIsSearchingBroll(true);
                    client.searchBrollStock(brollSearchQuery).then(res => {
                      setBrollResults(res || []);
                      setIsSearchingBroll(false);
                    });
                  }
                }}
                placeholder="ফুটেজের বিষয় লিখুন (যেমন: city highway, family, truck)..."
                style={{
                  flex: 1,
                  backgroundColor: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '4px',
                  color: 'var(--text-primary)',
                  fontSize: '11px',
                  padding: '5px 8px',
                  outline: 'none'
                }}
              />
              <button
                onClick={() => {
                  setIsSearchingBroll(true);
                  client.searchBrollStock(brollSearchQuery).then(res => {
                    setBrollResults(res || []);
                    setIsSearchingBroll(false);
                  });
                }}
                disabled={isSearchingBroll}
                className="btn-primary"
                style={{ padding: '5px 10px', fontSize: '10px', backgroundColor: '#10b981' }}
              >
                {isSearchingBroll ? 'খোঁজা হচ্ছে...' : 'সার্চ'}
              </button>
            </div>

            {/* Results Grid */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', minHeight: 0 }}>
              {brollResults.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '11px' }}>
                  কোনো স্টক ফুটেজ খুঁজে পাওয়া যায়নি। অন্য কি-ওয়ার্ড লিখে সার্চ করুন।
                </div>
              ) : (
                brollResults.map((stock, sIdx) => (
                  <div
                    key={`b_res_${sIdx}`}
                    style={{
                      padding: '8px',
                      borderRadius: '5px',
                      backgroundColor: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {stock.thumbnail && (
                        <img
                          src={stock.thumbnail}
                          alt="thumb"
                          style={{ width: '48px', height: '36px', objectFit: 'cover', borderRadius: '3px' }}
                        />
                      )}
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: 600, color: '#ffffff' }}>
                          {stock.title}
                        </div>
                        <div style={{ fontSize: '9.5px', color: 'var(--text-muted)' }}>
                          {stock.source} • {stock.durationSeconds}s
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '4px' }}>
                      {stock.directSearchUrl && (
                        <button
                          onClick={() => hostBridge.openExternalUrl(stock.directSearchUrl)}
                          className="btn-secondary"
                          style={{ padding: '3px 6px', fontSize: '9.5px' }}
                          title="Pexels সাইটে সরাসরি দেখুন"
                        >
                          Pexels ↗
                        </button>
                      )}
                      <button
                        onClick={() => handlePlaceBrollOnTrack2(stock)}
                        className="btn-primary"
                        style={{ padding: '4px 8px', fontSize: '10px', backgroundColor: '#10b981' }}
                        title="টাইমলাইনে Video Track 2-তে সরাসরি ড্রপ করুন"
                      >
                        V2 ট্র্যাকে বসান
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===================== YOUTUBE CHAPTERS MODAL ===================== */}
      {showChaptersModal && youtubeChaptersData && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            backgroundColor: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '460px',
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              padding: '14px',
              backgroundColor: '#18181b',
              borderColor: 'rgba(59, 130, 246, 0.4)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#60a5fa', fontWeight: 600, fontSize: '12px' }}>
                <BookOpen size={14} />
                <span>ইউটিউব ভিডিও ডেসক্রিপশন চ্যাপ্টারস</span>
              </div>
              <button
                onClick={() => setShowChaptersModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '13px' }}
              >
                ✕
              </button>
            </div>

            <textarea
              readOnly
              rows={8}
              value={youtubeChaptersData.chaptersText}
              style={{
                backgroundColor: 'var(--bg-tertiary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '4px',
                color: '#93c5fd',
                fontSize: '11px',
                padding: '8px',
                outline: 'none',
                fontFamily: 'monospace',
                lineHeight: '1.5',
                resize: 'none'
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(youtubeChaptersData.chaptersText);
                  setCopiedChapters(true);
                  setTimeout(() => setCopiedChapters(false), 2500);
                }}
                className="btn-primary"
                style={{
                  padding: '5px 12px',
                  fontSize: '11px',
                  backgroundColor: copiedChapters ? '#059669' : '#2563eb',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: 'pointer'
                }}
              >
                {copiedChapters ? <Check size={11} /> : <Copy size={11} />}
                <span>{copiedChapters ? 'কপি হয়েছে!' : '📋 কপি ইউটিউব চ্যাপ্টারস'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== REPEATED TAKE COMPARISON MODAL ===================== */}
      {compareTakesItem && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            backgroundColor: 'rgba(0,0,0,0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '520px',
              backgroundColor: '#18181b',
              border: '1px solid rgba(139, 92, 246, 0.4)',
              borderRadius: '8px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              boxShadow: '0 12px 36px rgba(0,0,0,0.85)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#ddd6fe', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Eye size={14} color="#a78bfa" />
                <span>ডাবল লাইন / রিটেক তুলনা ও কাট সিদ্ধান্ত</span>
              </span>
              <button
                onClick={() => setCompareTakesItem(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '14px' }}
              >
                ✕
              </button>
            </div>

            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              নিচে উভয় টেকের সংলাপ দেওয়া হলো। আপনি শুনে সিদ্ধান্ত নিতে পারেন কোনটি রাখবেন এবং কোনটি কাটবেন:
            </div>

            {/* Take Cards */}
            {(() => {
              const tDetails = (compareTakesItem as any)?.takeDetails || (compareTakesItem as any)?.take_details;
              const matched = tDetails?.matched_take || tDetails?.matchedTake;
              const candIdx = tDetails?.candidateIndex || tDetails?.candidate_index || 1;
              const matchedIdx = matched?.candidate_index || matched?.candidateIndex || 2;
              const matchedStart = matched?.start_seconds || matched?.startSeconds || 0;
              const matchedEnd = matched?.end_seconds || matched?.endSeconds || 0;
              const matchedDur = matched?.duration_seconds || matched?.durationSeconds || Math.max(0.5, matchedEnd - matchedStart);
              const matchedSentence = matched?.sentence || '';

              return (
                <>
                  {/* Take 1 Card */}
                  <div
                    style={{
                      padding: '10px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(239, 68, 68, 0.08)',
                      border: '1px solid rgba(239, 68, 68, 0.35)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: '#f87171' }}>
                        ❌ টেক {candIdx} (কাটার প্রস্তাবিত)
                      </span>
                      <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#fca5a5' }}>
                        {TimecodeConverter.formatTimecode(compareTakesItem.startSeconds, fps)} (~{compareTakesItem.durationSeconds.toFixed(1)}s)
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#fff', fontStyle: 'italic', lineHeight: 1.5 }}>
                      "{compareTakesItem.transcriptSnippet}"
                    </div>
                    <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                      <button
                        onClick={() => seekAndAutoPlay(compareTakesItem.startSeconds)}
                        style={{
                          backgroundColor: 'rgba(239, 68, 68, 0.2)',
                          border: '1px solid rgba(239, 68, 68, 0.4)',
                          color: '#f87171',
                          borderRadius: '3px',
                          padding: '3px 8px',
                          fontSize: '10px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        <Play size={10} />
                        <span>▶ এই টেকটি শুনুন</span>
                      </button>
                      <button
                        onClick={async () => {
                          await deleteTranscriptRange(compareTakesItem.startSeconds, compareTakesItem.endSeconds);
                          setCompareTakesItem(null);
                        }}
                        style={{
                          backgroundColor: '#ef4444',
                          border: 'none',
                          color: '#fff',
                          borderRadius: '3px',
                          padding: '3px 10px',
                          fontSize: '10px',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        ✂️ টেক {candIdx} কাটুন
                      </button>
                    </div>
                  </div>

                  {/* Take 2 Card (Recommended Matched Take) */}
                  {matched && (
                    <div
                      style={{
                        padding: '10px',
                        borderRadius: '6px',
                        backgroundColor: 'rgba(16, 185, 129, 0.08)',
                        border: '1px solid rgba(16, 185, 129, 0.35)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: '#34d399' }}>
                          ✅ টেক {matchedIdx} (রাখার প্রস্তাবিত)
                        </span>
                        <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#6ee7b7' }}>
                          {TimecodeConverter.formatTimecode(matchedStart, fps)} (~{matchedDur.toFixed(1)}s)
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#fff', fontStyle: 'italic', lineHeight: 1.5 }}>
                        "{matchedSentence}"
                      </div>
                      <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                        <button
                          onClick={() => seekAndAutoPlay(matchedStart)}
                          style={{
                            backgroundColor: 'rgba(16, 185, 129, 0.2)',
                            border: '1px solid rgba(16, 185, 129, 0.4)',
                            color: '#34d399',
                            borderRadius: '3px',
                            padding: '3px 8px',
                            fontSize: '10px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            cursor: 'pointer'
                          }}
                        >
                          <Play size={10} />
                          <span>▶ এই টেকটি শুনুন</span>
                        </button>
                        <button
                          onClick={async () => {
                            await deleteTranscriptRange(matchedStart, matchedEnd);
                            setCompareTakesItem(null);
                          }}
                          style={{
                            backgroundColor: 'rgba(255, 255, 255, 0.08)',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            color: '#fff',
                            borderRadius: '3px',
                            padding: '3px 10px',
                            fontSize: '10px',
                            cursor: 'pointer'
                          }}
                        >
                          ⇄ টেক {candIdx} রাখুন (টেক {matchedIdx} কাটুন)
                        </button>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};
