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
  Globe,
  FileText,
  AlertTriangle,
  ShieldCheck
} from 'lucide-react';
import { PrismexDaemonClient } from '../api/PrismexDaemonClient';
import { copyToClipboard } from '../utils/clipboard';

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
    language,
    scriptDirectives,
    setScriptDirectives,
    updateScriptDirective,
    customMarkers,
    setCustomMarkers,
    sequenceChangedNotice,
    setSequenceChangedNotice
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

  // Top Bar Dropdowns & Legend State
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [showToolsDropdown, setShowToolsDropdown] = useState(false);
  const [showLegend, setShowLegend] = useState(false);

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
  const [copiedWord, setCopiedWord] = useState<string | null>(null);
  const [isAnalyzingLineIdx, setIsAnalyzingLineIdx] = useState<number | null>(null);
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
  const [showReTranscribeModal, setShowReTranscribeModal] = useState<boolean>(false);
  const [reTranscribeModel, setReTranscribeModel] = useState<string>('large-v3');
  const [reTranscribeLang, setReTranscribeLang] = useState<string>('auto');

  // Paragraph Grouping Mode: 'SENTENCE' (complete sentence grouping) or 'PAUSE' (legacy pause/word-limit)
  const [paragraphGroupingMode, setParagraphGroupingMode] = useState<'SENTENCE' | 'PAUSE'>(() => {
    try {
      return (localStorage.getItem('prismex_para_grouping_mode') as 'SENTENCE' | 'PAUSE') || 'SENTENCE';
    } catch {
      return 'SENTENCE';
    }
  });

  // Full Script Contextual AI Directives (B-Roll, PNG, Typography, Punch & Bengali Explanations)
  const [isAnalyzingScript, setIsAnalyzingScript] = useState<boolean>(false);
  const [expandedDirectiveIdx, setExpandedDirectiveIdx] = useState<number | null>(null);
  const [liveTranslations, setLiveTranslations] = useState<Record<number, string>>({});

  const client = PrismexDaemonClient.getInstance();
  const hostBridge = PremiereHostBridge.getInstance();
  const fps = sequenceManifest?.fps || 24;
  const isRunning = jobStatus !== 'COMPLETE' && jobProgress > 0 && jobProgress < 100;

  const [followPlayhead, setFollowPlayhead] = useState<boolean>(() => {
    try {
      return localStorage.getItem('prismex_follow_playhead') !== 'false';
    } catch {
      return true;
    }
  });
  const transcriptContainerRef = useRef<HTMLDivElement | null>(null);
  const lastScrolledParaIdx = useRef<number | null>(null);
  const prevPlayheadSec = useRef<number>(0);

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

  // Group words into paragraph chunks: either full sentences ('SENTENCE') or pause-based ('PAUSE')
  const paragraphs = useMemo(() => {
    const isSentenceTerminator = (word: string): boolean => {
      if (!word) return false;
      const clean = word.trim();
      return /[.?!।]["'”’)]*$/.test(clean);
    };

    const isAbbreviation = (word: string): boolean => {
      const clean = word.trim().toLowerCase().replace(/[()]/g, '');
      return /^(mr|mrs|ms|dr|prof|vs|etc|e\.g|i\.e|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec|st|ave|rd|gen|col|sgt)\.$/.test(clean);
    };

    const groups: Array<{ startIdx: number; endIdx: number; startTime: number; tokens: Array<WordToken & { globalIdx: number }> }> = [];
    let current: Array<WordToken & { globalIdx: number }> = [];

    if (paragraphGroupingMode === 'PAUSE') {
      // Classic mode: splits on > 0.75s pause or 16 words
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
    } else {
      // Sentence mode: groups 1-3 complete sentences without breaking mid-sentence
      let sentenceCountInCurrent = 0;

      for (let i = 0; i < words.length; i++) {
        const w = words[i];
        current.push({ ...w, globalIdx: i });

        const isTerm = isSentenceTerminator(w.word) && !isAbbreviation(w.word);
        if (isTerm) {
          sentenceCountInCurrent++;
        }

        const next = i + 1 < words.length ? words[i + 1] : null;
        const gapToNext = next ? next.start - w.end : 0;

        let shouldBreak = false;
        if (isTerm) {
          if (sentenceCountInCurrent >= 2) {
            shouldBreak = true;
          } else if (sentenceCountInCurrent >= 1 && (current.length >= 12 || gapToNext >= 0.9)) {
            shouldBreak = true;
          }
        } else {
          // Fallback if speaker gives a very long run-on without punctuation
          if (current.length >= 28 && gapToNext >= 1.2) {
            shouldBreak = true;
          } else if (gapToNext >= 2.5 && current.length >= 8) {
            shouldBreak = true;
          }
        }

        if (shouldBreak && next) {
          groups.push({
            startIdx: current[0].globalIdx,
            endIdx: current[current.length - 1].globalIdx,
            startTime: current[0].start,
            tokens: current
          });
          current = [];
          sentenceCountInCurrent = 0;
        }
      }
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
  }, [words, paragraphGroupingMode]);

  // Auto-translate surrounding paragraphs to maintain a genuine continuous Bengali narrative
  useEffect(() => {
    if (expandedDirectiveIdx === null) return;
    const currentParaPos = paragraphs.findIndex(p => p.startIdx === expandedDirectiveIdx);
    if (currentParaPos < 0) return;

    const nearbyParas = paragraphs.slice(Math.max(0, currentParaPos - 3), Math.min(paragraphs.length, currentParaPos + 4));
    nearbyParas.forEach(p => {
      const pText = p.tokens.map(t => t.word).join(' ').trim();
      const existingMeaning = scriptDirectives[p.startIdx]?.meaningBn;
      const isBadMeaning = !existingMeaning || existingMeaning.includes('বক্তব্যে বিশেষ জোর') || existingMeaning.includes('ইমপ্যাক্ট তৈরি') || existingMeaning.includes('মূল বক্তব্য: "') || existingMeaning.includes('মূল বক্তব্য:');

      if ((isBadMeaning || !liveTranslations[p.startIdx]) && pText) {
        client.translateSentence(pText).then(translated => {
          if (translated && translated.trim() && !translated.includes('মূল বক্তব্য: "')) {
            setLiveTranslations(prev => ({ ...prev, [p.startIdx]: translated.trim() }));
            updateScriptDirective(p.startIdx, { meaningBn: translated.trim() });
          }
        });
      }
    });
  }, [expandedDirectiveIdx, paragraphs, scriptDirectives]);

  // Auto-Follow Playhead: Track Premiere timeline playhead and smoothly scroll to spoken text
  useEffect(() => {
    if (transcriptWords.length === 0) return;
    const timer = setInterval(async () => {
      const pos = await hostBridge.getPlayheadPosition();
      setPlayheadSec(pos);

      // Detect if video is actively playing / playhead is advancing
      const isMoving = Math.abs(pos - prevPlayheadSec.current) > 0.04;
      prevPlayheadSec.current = pos;

      if (followPlayhead && isMoving && paragraphs.length > 0) {
        // Find currently spoken paragraph
        const activePara = paragraphs.find((p) => {
          const pEnd = p.tokens[p.tokens.length - 1]?.end || (p.startTime + 2.5);
          return pos >= p.startTime - 0.15 && pos <= pEnd + 0.15;
        });

        if (activePara && activePara.startIdx !== lastScrolledParaIdx.current) {
          lastScrolledParaIdx.current = activePara.startIdx;
          const el = document.getElementById(`para-${activePara.startIdx}`);
          if (el && transcriptContainerRef.current) {
            const containerRect = transcriptContainerRef.current.getBoundingClientRect();
            const elRect = el.getBoundingClientRect();
            const isComfortablyVisible = (
              elRect.top >= containerRect.top + 35 &&
              elRect.bottom <= containerRect.bottom - 35
            );
            if (!isComfortablyVisible) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }
        }
      }
    }, 200);
    return () => clearInterval(timer);
  }, [transcriptWords.length, paragraphs, followPlayhead, hostBridge]);

  const [floatingSelection, setFloatingSelection] = useState<{
    text: string;
    cleanQuery: string;
    paraStartIdx: number | null;
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

      // Detect nearest paragraph container from DOM node
      let paraStartIdx: number | null = null;
      let startNode: HTMLElement | null = range.startContainer as HTMLElement;
      if (startNode && startNode.nodeType === 3) startNode = startNode.parentElement;
      let paraEl = startNode?.closest('[id^="para-"]');
      if (!paraEl) {
        let ancestor: HTMLElement | null = range.commonAncestorContainer as HTMLElement;
        if (ancestor && ancestor.nodeType === 3) ancestor = ancestor.parentElement;
        paraEl = ancestor?.closest('[id^="para-"]');
      }
      if (paraEl && paraEl.id) {
        const idNum = parseInt(paraEl.id.replace('para-', ''), 10);
        if (!isNaN(idNum)) paraStartIdx = idNum;
      }
      if (paraStartIdx === null) {
        const matched = paragraphs.find((p) =>
          p.tokens.some((tok) => text.toLowerCase().includes(tok.word.toLowerCase()) || tok.word.toLowerCase().includes(text.toLowerCase()))
        );
        if (matched) paraStartIdx = matched.startIdx;
      }

      setFloatingSelection({
        text,
        cleanQuery: clean || text,
        paraStartIdx,
        x: Math.max(8, Math.min(window.innerWidth - 240, rect.left + rect.width / 2 - 120)),
        y: Math.max(8, rect.top - 46)
      });
    } catch {
      setFloatingSelection(null);
    }
  }, [paragraphs]);

  // Manual Visual Directive Marker on Selected Text
  const handleMarkSelectionDirective = (
    type: 'BROLL' | 'PNG' | 'TEXT_ANIMATION' | 'PUNCH',
    customQuery?: string
  ) => {
    if (!floatingSelection) return;
    const cleanKw = customQuery || floatingSelection.cleanQuery;
    const p = paragraphs.find((pr) => pr.startIdx === floatingSelection.paraStartIdx) ||
              paragraphs.find((pr) => pr.tokens.some((tok) => floatingSelection.text.includes(tok.word))) ||
              paragraphs[0];
    const startSec = p ? p.startTime : playheadSec;
    const endSec = p ? p.tokens[p.tokens.length - 1].end : startSec + 4;
    const directiveKey = p ? p.startIdx : (floatingSelection.paraStartIdx ?? Math.round(startSec * 10));

    let badgeLabel = `🎥 B-Roll: ${cleanKw.slice(0, 16)}`;
    let accentColor = '#06b6d4';
    let explanationBn = `"${cleanKw}" অংশের জন্য B-Roll ভিজ্যুয়াল ফুটেজ ব্যবহার করুন।`;
    let directorAdvice = `Relevant stock or B-Roll cutaway for "${cleanKw}"`;
    let searchUrl = `https://www.pexels.com/search/videos/${encodeURIComponent(cleanKw)}/`;
    let platform = 'Pexels';

    if (type === 'PNG') {
      badgeLabel = `🖼️ PNG: ${cleanKw.slice(0, 16)}`;
      accentColor = '#a855f7';
      explanationBn = `"${cleanKw}" অংশের জন্য স্ক্রিনে স্বচ্ছ PNG ছবি বা স্টিকার পপ করুন।`;
      directorAdvice = `On-screen transparent PNG graphic pop for "${cleanKw}"`;
      searchUrl = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(cleanKw + ' transparent png')}`;
      platform = 'Google PNG';
    } else if (type === 'TEXT_ANIMATION') {
      badgeLabel = `✨ টেক্সট: ${cleanKw.slice(0, 16)}`;
      accentColor = '#f59e0b';
      explanationBn = `"${cleanKw}" কথাটি স্ক্রিনে কাইনেটিক টাইপোগ্রাফি বা অ্যানিমেটেড টেক্সট হিসেবে দেখান।`;
      directorAdvice = `Animated kinetic typography on screen for "${cleanKw}"`;
      searchUrl = `https://www.google.com/search?q=${encodeURIComponent(cleanKw)}`;
      platform = 'Google';
    } else if (type === 'PUNCH') {
      badgeLabel = `⚡ পাঞ্চ কাট: ${cleanKw.slice(0, 16)}`;
      accentColor = '#ef4444';
      explanationBn = `"${cleanKw}" মুহূর্তে পাঞ্চ জুম (১১০% স্কেল) বা জাম্প কাটের মাধ্যমে দৃষ্টি আকর্ষণ করুন।`;
      directorAdvice = `Punch Zoom cut-in (1.1x scale) at "${cleanKw}"`;
      searchUrl = '';
      platform = 'Timeline';
    }

    updateScriptDirective(directiveKey, {
      sentenceIndex: floatingSelection.paraStartIdx ?? 0,
      startSeconds: startSec,
      endSeconds: endSec,
      visualType: type,
      badgeLabel,
      accentColor,
      explanationBn,
      directorAdvice,
      primaryKeyword: cleanKw,
      searchUrl,
      platform
    });

    setCreativeStatus(`"${cleanKw}" সফলভাবে ${type} হিসেবে চিহ্নিত হয়েছে!`);
    setFloatingSelection(null);
    setTimeout(() => setCreativeStatus(null), 2500);
  };

  // AI-Powered Directive Analysis on Selected Text
  const handleAnalyzeSelectionAI = async () => {
    if (!floatingSelection) return;
    const cleanKw = floatingSelection.cleanQuery;
    const p = paragraphs.find((pr) => pr.startIdx === floatingSelection.paraStartIdx);
    const startSec = p?.startTime ?? playheadSec;
    const endSec = p ? p.tokens[p.tokens.length - 1].end : startSec + 4;
    const directiveKey = floatingSelection.paraStartIdx ?? Math.round(startSec * 10);

    setCreativeStatus(`AI "${cleanKw}" বিশ্লেষণ করছে...`);
    try {
      const sentenceText = p ? p.tokens.map((t) => t.word).join(' ') : floatingSelection.text;
      const res = await client.getScriptDirectives(
        p ? p.tokens.map((t) => ({ word: t.word, start: t.start, end: t.end, start_seconds: t.start, end_seconds: t.end })) : [],
        [{ text: sentenceText, startSeconds: startSec, endSeconds: endSec }],
        `Analyze specifically this user selection: "${cleanKw}" in sentence: "${sentenceText}". Decide if it should be BROLL, PNG, TEXT_ANIMATION, or PUNCH.`
      );

      if (res && res.directives && res.directives.length > 0) {
        const d = res.directives[0];
        updateScriptDirective(directiveKey, {
          ...d,
          sentenceIndex: floatingSelection.paraStartIdx ?? 0,
          startSeconds: startSec,
          endSeconds: endSec
        });
        setCreativeStatus(`AI টিউন সম্পন্ন: ${d.badgeLabel}`);
      } else {
        handleMarkSelectionDirective('PNG', cleanKw);
      }
    } catch {
      handleMarkSelectionDirective('PNG', cleanKw);
    } finally {
      setFloatingSelection(null);
      setTimeout(() => setCreativeStatus(null), 3000);
    }
  };

  const getMultiSiteBrollLinks = (kw: string) => {
    const clean = encodeURIComponent(kw.trim());
    return [
      { name: 'Pexels', url: `https://www.pexels.com/search/videos/${clean}/`, color: '#06b6d4' },
      { name: 'Pixabay', url: `https://pixabay.com/videos/search/${clean}/`, color: '#10b981' },
      { name: 'Mixkit', url: `https://mixkit.co/free-stock-video/${clean}/`, color: '#8b5cf6' },
      { name: 'Coverr', url: `https://coverr.co/s?q=${clean}`, color: '#f59e0b' },
      { name: 'Videezy', url: `https://www.videezy.com/free-video/${clean}`, color: '#3b82f6' },
      { name: 'YouTube 4K', url: `https://www.youtube.com/results?search_query=${clean}+4k+b-roll+free+stock+footage`, color: '#ef4444' }
    ];
  };

  const getMultiSitePngLinks = (kw: string) => {
    const clean = encodeURIComponent(kw.trim());
    return [
      { name: 'Google PNG', url: `https://www.google.com/search?tbm=isch&q=${clean}+transparent+png`, color: '#3b82f6' },
      { name: 'Flaticon', url: `https://www.flaticon.com/search?word=${clean}`, color: '#10b981' },
      { name: 'Iconfinder', url: `https://www.iconfinder.com/search?q=${clean}&price=free`, color: '#f59e0b' },
      { name: 'PNGWing', url: `https://www.pngwing.com/en/search?q=${clean}`, color: '#8b5cf6' },
      { name: 'Freepik', url: `https://www.freepik.com/search?format=search&query=${clean}&type=icon`, color: '#06b6d4' }
    ];
  };

  const handleOpenAllBrollSites = (kw: string) => {
    const links = getMultiSiteBrollLinks(kw).map(l => l.url);
    hostBridge.openMultipleUrls(links);
    setExportStatus(language === 'bn' ? `"${kw}" এর জন্য ৬টি ভিডিও সাইট ব্রাউজার ট্যাবে খোলা হয়েছে!` : `Opened 6 video sites for "${kw}" in tabs!`);
    setTimeout(() => setExportStatus(null), 3500);
  };

  const handleOpenAllPngSites = (kw: string) => {
    const links = getMultiSitePngLinks(kw).map(l => l.url);
    hostBridge.openMultipleUrls(links);
    setExportStatus(language === 'bn' ? `"${kw}" এর জন্য ৫টি PNG/আইকন সাইট ব্রাউজার ট্যাবে খোলা হয়েছে!` : `Opened 5 PNG/icon sites for "${kw}" in tabs!`);
    setTimeout(() => setExportStatus(null), 3500);
  };

  const handleAnalyzeScriptDirectives = useCallback(async () => {
    if (words.length === 0) return;
    setIsAnalyzingScript(true);
    setCreativeStatus('AI দিয়ে পুরো স্ক্রিপ্ট নতুন করে টিউন করা হচ্ছে...');
    try {
      // CLEAR old directives so stale cache and dummy text are completely purged
      setScriptDirectives({});
      setLiveTranslations({});

      const res = await client.getScriptDirectives(transcriptWords, transcriptSentences);
      if (res && res.directives) {
        const dMap: Record<number, any> = {};
        for (const d of res.directives) {
          dMap[d.sentenceIndex] = d;
        }
        for (let pIdx = 0; pIdx < paragraphs.length; pIdx++) {
          const p = paragraphs[pIdx];
          const pEnd = p.tokens[p.tokens.length - 1]?.end || p.startTime;
          const match = res.directives.find((d: any) =>
            d.sentenceIndex === pIdx ||
            (d.startSeconds <= pEnd && d.endSeconds >= p.startTime)
          );
          if (match) {
            dMap[p.startIdx] = { ...match, sentenceIndex: pIdx };
          }
        }
        setScriptDirectives(dMap);
        setCreativeStatus(`স্ক্রিপ্ট টিউন সম্পন্ন! ${res.totalDirectives}টি খাঁটি বাংলা অনুবাদ ও ভিজ্যুয়াল ডিরেকশন তৈরি হয়েছে (${res.engine})।`);
        setTimeout(() => setCreativeStatus(null), 3500);
      }
    } catch (err) {
      console.error('Failed to get script directives:', err);
      setCreativeStatus('ডিরেকশন লোড করতে ব্যর্থ হয়েছে');
      setTimeout(() => setCreativeStatus(null), 2500);
    } finally {
      setIsAnalyzingScript(false);
    }
  }, [words.length, transcriptWords, transcriptSentences, client]);

  useEffect(() => {
    if (words.length > 0 && Object.keys(scriptDirectives).length === 0 && !isAnalyzingScript) {
      handleAnalyzeScriptDirectives();
    }
  }, [words.length]);

  const seekAndAutoPlay = useCallback((timeSec: number) => {
    hostBridge.setPlayheadPosition(timeSec);
    setPlayheadSec(timeSec);
    if (autoPlayOnJump) {
      setTimeout(() => {
        hostBridge.startPlayback(1);
      }, 60);
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
    let cleanWord = pWord.word.replace(/[^a-zA-Z0-9_\u0980-\u09FF\s]/g, ' ').replace(/\s+/g, ' ').trim();
    if (cleanWord.toLowerCase().includes('zoom') || cleanWord.toLowerCase().includes('punch') || cleanWord.length <= 2) {
      const paraMatch = paragraphs.find(p => p.startIdx === pWord.wordIdx);
      if (paraMatch) {
        const words = paraMatch.tokens.map(t => t.word).filter(w => w.length > 2 && !['the','and','for','that','this','with','from','have','they','what','about'].includes(w.toLowerCase()));
        cleanWord = words.slice(0, 2).join(' ') || 'cinematic communication';
      } else {
        cleanWord = 'cinematic communication';
      }
    }
    setBrollSearchQuery(cleanWord || 'cinematic communication');
    setShowBrollModal(true);
    setPopoverWord(null);

    setIsSearchingBroll(true);
    try {
      const results = await client.searchBrollStock(cleanWord || 'cinematic communication');
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
      setExportStatus(language === 'bn' ? 'B-Roll মার্কার ও V2 প্লেসহোল্ডার টাইমলাইনে যুক্ত হয়েছে!' : 'B-Roll marker placed on timeline!');
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

  // Line-level Action Handlers: Copy, Edit, Typography & On-demand AI
  const handleCopyLine = async (paraIdx: number, text: string) => {
    await copyToClipboard(text);
    setCopiedLineIdx(paraIdx);
    setExportStatus(language === 'bn' ? 'পুরো লাইন ক্লিপবোর্ডে কপি হয়েছে!' : 'Sentence copied to clipboard!');
    setTimeout(() => {
      setCopiedLineIdx(null);
      setExportStatus(null);
    }, 2500);
  };

  // Toggle existing AI Directive card or trigger immediate AI analysis for this line
  const handleToggleOrAnalyzeLineAI = async (
    paraStartIdx: number,
    lineText: string,
    startTime: number,
    endTime: number
  ) => {
    const existing = scriptDirectives[paraStartIdx] || Object.values(scriptDirectives).find(
      (d: any) => d.startSeconds <= endTime && d.endSeconds >= startTime
    );

    if (existing) {
      setExpandedDirectiveIdx(expandedDirectiveIdx === paraStartIdx ? null : paraStartIdx);
      return;
    }

    setIsAnalyzingLineIdx(paraStartIdx);
    setExportStatus(language === 'bn' ? `AI দিয়ে "${lineText.slice(0, 24)}..." বিশ্লেষণ করা হচ্ছে...` : `AI Analyzing line...`);
    try {
      const sentenceWords = words.filter((w) => w.start >= startTime - 0.25 && w.end <= endTime + 0.25);
      const res = await client.getScriptDirectives(
        sentenceWords,
        [{ text: lineText, startSeconds: startTime, endSeconds: endTime }],
        `Analyze dialogue line: "${lineText}". Give clear visual direction (BROLL, PNG, TEXT_ANIMATION, or PUNCH), concise Bengali explanation, and keyword search.`
      );

      if (res && res.directives && res.directives.length > 0) {
        const d = res.directives[0];
        updateScriptDirective(paraStartIdx, {
          ...d,
          sentenceIndex: paraStartIdx,
          startSeconds: startTime,
          endSeconds: endTime
        });
        setExpandedDirectiveIdx(paraStartIdx);
        setExportStatus(`AI বিশ্লেষণ সম্পন্ন: ${d.badgeLabel}`);
      } else {
        const cleanKw = lineText.split(/\s+/).slice(0, 3).join(' ');
        updateScriptDirective(paraStartIdx, {
          sentenceIndex: paraStartIdx,
          startSeconds: startTime,
          endSeconds: endTime,
          visualType: 'BROLL',
          badgeLabel: '🎥 B-Roll',
          accentColor: '#06b6d4',
          query: cleanKw,
          meaningBn: `"${lineText}" - এই বক্তব্যের মূল অর্থ ও আলোচনা তুলে ধরা হয়েছে।`,
          editingIdea: 'বক্তব্যের সাথে সামঞ্জস্যপূর্ণ ১১৪% ক্যামেরা পাঞ্চ ইন বা জাম্প কাট দিন।',
          typographyGuide: 'অন-স্ক্রিন কাইনেটিক সাবটাইটেল ও কী-ওয়ার্ড বোল্ড হাইলাইট অ্যানিমেশন।',
          iconIdea: 'বক্তব্যের মূল ধারণার একটি ক্লিন ভেক্টর আইকন বা ফ্ল্যাশ গ্রাফিক্স ব্যবহার করুন।',
          brollKeywords: [cleanKw, `${cleanKw} 4k footage`],
          pngKeywords: [`${cleanKw} transparent png`, `${cleanKw} icon`],
          banglaExplanation: `"${lineText}" - এই বক্তব্যের মূল অর্থ ও আলোচনা।`,
          editingSuggestion: 'বক্তব্যের সাথে মিলিয়ে প্রাসঙ্গিক সিনেমাটিক বি-রোল ফুটেজ বা গ্রাফিক্স ওভারলে করুন।'
        });
        setExpandedDirectiveIdx(paraStartIdx);
        setExportStatus(language === 'bn' ? 'AI নির্দেশিকা তৈরি হয়েছে!' : 'AI visual directive created!');
      }
    } catch (e: any) {
      console.warn('AI analysis error:', e);
      setExportStatus(language === 'bn' ? 'AI বিশ্লেষণ ব্যর্থ হয়েছে' : 'Failed to analyze line');
    } finally {
      setIsAnalyzingLineIdx(null);
      setTimeout(() => setExportStatus(null), 3500);
    }
  };

  // AI Analysis for Single Word Popover
  const handleAnalyzeWordAI = async (pWord: { wordIdx: number; word: string; start: number; end: number }) => {
    const cleanWord = pWord.word.replace(/[^\w\s\u0980-\u09FF'-]/g, '').trim() || pWord.word.trim();
    const p = paragraphs.find((pr) => pr.tokens.some((tok) => tok.globalIdx === pWord.wordIdx)) || paragraphs[0];
    const paraIdx = p ? p.startIdx : pWord.wordIdx;
    const startSec = p ? p.startTime : pWord.start;
    const endSec = p ? p.tokens[p.tokens.length - 1].end : pWord.end;

    setPopoverWord(null);
    setExportStatus(language === 'bn' ? `AI "${cleanWord}" বিশ্লেষণ করছে...` : `AI analyzing "${cleanWord}"...`);
    try {
      const sentenceText = p ? p.tokens.map((t) => t.word).join(' ') : cleanWord;
      const res = await client.getScriptDirectives(
        p ? p.tokens.map((t) => ({ word: t.word, start: t.start, end: t.end, start_seconds: t.start, end_seconds: t.end })) : [],
        [{ text: sentenceText, startSeconds: startSec, endSeconds: endSec }],
        `Analyze focus word: "${cleanWord}" in sentence: "${sentenceText}". Decide visual direction (BROLL, PNG, TEXT_ANIMATION, or PUNCH).`
      );

      if (res && res.directives && res.directives.length > 0) {
        const d = res.directives[0];
        updateScriptDirective(paraIdx, {
          ...d,
          sentenceIndex: paraIdx,
          startSeconds: startSec,
          endSeconds: endSec
        });
        setExpandedDirectiveIdx(paraIdx);
        setExportStatus(`AI বিশ্লেষণ সম্পন্ন: ${d.badgeLabel}`);
      } else {
        updateScriptDirective(paraIdx, {
          sentenceIndex: paraIdx,
          startSeconds: startSec,
          endSeconds: endSec,
          visualType: 'PNG',
          badgeLabel: `🖼️ PNG: ${cleanWord}`,
          accentColor: '#a855f7',
          explanationBn: `"${cleanWord}" শব্দের জন্য স্ক্রিনে স্বচ্ছ PNG ছবি বা স্টিকার দেখান।`,
          directorAdvice: `On-screen graphic pop for "${cleanWord}"`,
          primaryKeyword: cleanWord,
          searchUrl: `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(cleanWord + ' transparent png')}`,
          platform: 'Google PNG'
        });
        setExpandedDirectiveIdx(paraIdx);
        setExportStatus(`"${cleanWord}" PNG হিসেবে চিহ্নিত হয়েছে!`);
      }
    } catch {
      setExportStatus(`"${cleanWord}" AI বিশ্লেষণ করা সম্ভব হয়নি`);
    } finally {
      setTimeout(() => setExportStatus(null), 3500);
    }
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
      await copyToClipboard(typoText);
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

  const handleCopyAeScript = async () => {
    if (!aeTypographyData) return;
    await copyToClipboard(aeTypographyData.aeSnippet);
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
      setExportStatus(res.path ? `TXT সেভ হয়েছে: ${res.path}` : `Saved TXT!`);
    } else if (res.error) {
      setExportStatus(`TXT সেভ ব্যর্থ: ${res.error}`);
    }
    setTimeout(() => setExportStatus(null), 3500);
  };

  const handleExportSrt = async () => {
    const srt = buildSrtContent();
    const res = await hostBridge.saveFileWithDialog(`${baseFilename}.srt`, srt, ['srt']);
    if (res.saved) {
      setExportStatus(res.path ? `SRT সেভ হয়েছে: ${res.path}` : `Saved SRT (${fps} fps)!`);
    } else if (res.error) {
      setExportStatus(`SRT সেভ ব্যর্থ: ${res.error}`);
    }
    setTimeout(() => setExportStatus(null), 3500);
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
      setExportStatus(res.path ? `JSON সেভ হয়েছে: ${res.path}` : `Saved JSON (${fps} fps)!`);
    } else if (res.error) {
      setExportStatus(`JSON সেভ ব্যর্থ: ${res.error}`);
    }
    setTimeout(() => setExportStatus(null), 3500);
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
    <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', height: '100%', overflow: 'hidden', position: 'relative' }}>
      {/* Floating Status Notification Toast */}
      {exportStatus && (
        <div
          style={{
            position: 'fixed',
            top: '44px',
            right: '16px',
            zIndex: 10002,
            backgroundColor: '#064e3b',
            color: '#6ee7b7',
            border: '1px solid #059669',
            borderRadius: '5px',
            padding: '5px 10px',
            fontSize: '11px',
            fontWeight: 600,
            boxShadow: '0 6px 20px rgba(0,0,0,0.85)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <Check size={13} />
          <span>{exportStatus}</span>
        </div>
      )}

      {/* Sequence Content Change Notification Banner */}
      {sequenceChangedNotice && (
        <div style={{
          backgroundColor: 'rgba(245, 158, 11, 0.15)',
          border: '1px solid rgba(245, 158, 11, 0.45)',
          borderRadius: '6px',
          padding: '6px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '11px',
          color: '#fef3c7',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={14} color="#f59e0b" />
            <span>টাইমলাইনে নতুন ক্লিপ বা দৈর্ঘ্য পরিবর্তন সনাক্ত হয়েছে ({sequenceChangedNotice})।</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              onClick={async () => {
                setSequenceChangedNotice(null);
                await transcribeSequence();
              }}
              style={{
                backgroundColor: '#f59e0b',
                color: '#000',
                border: 'none',
                borderRadius: '4px',
                padding: '3px 8px',
                fontSize: '10.5px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              🔄 নতুন অংশ ট্রান্সক্রাইব করুন
            </button>
            <button
              onClick={() => setSequenceChangedNotice(null)}
              style={{ background: 'transparent', border: 'none', color: '#a1a1aa', cursor: 'pointer', fontSize: '13px' }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Top Toolbar (Compact Single-Row Unified Bar) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', flexWrap: 'wrap', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#fff' }}>
            {language === 'bn' ? `ট্রান্সক্রিপ্ট (${words.length} শব্দ)` : `Transcript (${words.length} words)`}
          </div>
          <span
            style={{
              fontSize: '9px',
              color: '#34d399',
              backgroundColor: 'rgba(52, 211, 153, 0.15)',
              padding: '2px 6px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
              fontWeight: 600
            }}
            title={language === 'bn' ? 'এই প্রজেক্ট ও সিকোয়েন্সের ট্রান্সক্রিপ্ট স্বয়ংক্রিয়ভাবে সংরক্ষিত রয়েছে' : 'Transcript is persistently saved for this project & sequence'}
          >
            <CheckCircle2 size={10} />
            {language === 'bn' ? 'সংরক্ষিত' : 'Saved'}
          </span>
        </div>

        <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Re-Transcribe with Safety Danger Confirmation Modal */}
          <button
            className="btn-secondary"
            disabled={isRunning}
            onClick={() => setShowReTranscribeModal(true)}
            style={{ padding: '3px 8px', fontSize: '10px', height: '26px', display: 'flex', alignItems: 'center', gap: '4px' }}
            title="পুনরায় ট্রান্সক্রাইব করার কনফার্মেশন ও সেটিংস পপ-আপ খুলুন"
          >
            <Mic size={11} />
            <span>{language === 'bn' ? 'রি-ট্রান্সক্রাইব' : 'Re-Transcribe'}</span>
          </button>

          {/* Auto Cut */}
          <button
            className="btn-primary"
            disabled={isRunning}
            onClick={() => {
              setExecutionMode('AUTO_EDIT');
              startMagicRoughCut();
            }}
            style={{ padding: '3px 9px', fontSize: '10px', height: '26px', fontWeight: 600 }}
          >
            <Sparkles size={11} />
            <span>Auto Cut</span>
          </button>

          {/* ✨ AI Tune */}
          <button
            onClick={handleAnalyzeScriptDirectives}
            disabled={isAnalyzingScript || words.length === 0}
            title="AI দিয়ে পুরো স্ক্রিপ্ট বিশ্লেষণ করে B-Roll, PNG, টাইপোগ্রাফি ও বাংলা অর্থ একবারে সেভ করুন"
            style={{
              padding: '3px 9px',
              fontSize: '10px',
              height: '26px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid rgba(168, 85, 247, 0.5)',
              backgroundColor: isAnalyzingScript ? 'rgba(168, 85, 247, 0.35)' : 'rgba(168, 85, 247, 0.18)',
              color: '#d8b4fe',
              cursor: isAnalyzingScript ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontWeight: 700
            }}
          >
            {isAnalyzingScript ? <RefreshCw size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={11} />}
            <span>{isAnalyzingScript ? 'টিউন হচ্ছে...' : '✨ AI টিউন'}</span>
          </button>

          {/* Review Queue Jump */}
          {reviewItems.length > 0 && (
            <button
              className="btn-secondary"
              onClick={() => setActiveTab('review-queue')}
              style={{ padding: '3px 7px', fontSize: '10px', height: '26px' }}
            >
              <CheckSquare size={11} />
              <span>রিভিউ ({reviewItems.length})</span>
            </button>
          )}

          {/* 💾 EXPORT DROPDOWN MENU */}
          {/* 📥 EXPORT BUTTON (Opens Focused Modal) */}
          <button
            onClick={() => {
              setShowExportDropdown(true);
              setShowToolsDropdown(false);
            }}
            className="btn-secondary"
            style={{
              padding: '3px 8px',
              fontSize: '10px',
              height: '26px',
              backgroundColor: showExportDropdown ? 'rgba(5, 150, 105, 0.25)' : 'rgba(255,255,255,0.06)',
              borderColor: showExportDropdown ? '#10b981' : 'rgba(255,255,255,0.15)',
              color: showExportDropdown ? '#34d399' : 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
            title="এক্সপোর্ট ও সাবটাইটেল সেভ হাব খুলুন"
          >
            <Download size={11} />
            <span>{language === 'bn' ? 'এক্সপোর্ট ▾' : 'Export ▾'}</span>
          </button>

          {/* ⚙️ TOOLS BUTTON (Opens Focused Modal) */}
          <button
            onClick={() => {
              setShowToolsDropdown(true);
              setShowExportDropdown(false);
            }}
            className="btn-secondary"
            style={{
              padding: '3px 8px',
              fontSize: '10px',
              height: '26px',
              backgroundColor: showToolsDropdown ? 'rgba(59, 130, 246, 0.25)' : 'rgba(255,255,255,0.06)',
              borderColor: showToolsDropdown ? '#3b82f6' : 'rgba(255,255,255,0.15)',
              color: showToolsDropdown ? '#60a5fa' : 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
            title="এডিটর টুলস ও স্টুডিও হাব খুলুন"
          >
            <Sliders size={11} />
            <span>{language === 'bn' ? 'টুলস ▾' : 'Tools ▾'}</span>
          </button>

          {/* Quick Silence Cut button if silences detected */}
          {detectedSilences.length > 0 && (
            <button
              onClick={cutAllSilencesNow}
              className="btn-secondary"
              style={{ padding: '3px 7px', fontSize: '10px', height: '26px', color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.4)' }}
              title="সব নীরবতা কাটুন"
            >
              <Scissors size={10} />
              <span>Cut {detectedSilences.length}</span>
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

      {/* Search & Filter Row (Slim & Uniform Height) */}
      <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap', flexShrink: 0 }}>
        <div
          style={{
            flex: 1,
            minWidth: '130px',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            backgroundColor: 'var(--bg-tertiary)',
            padding: '2px 7px',
            borderRadius: '4px',
            border: '1px solid var(--border-subtle)',
            height: '24px'
          }}
        >
          <Search size={11} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Search transcript..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-primary)',
              fontSize: '10.5px',
              outline: 'none',
              width: '100%'
            }}
          />
        </div>

        <button
          onClick={() => setFilterMode(filterMode === 'FILLERS' ? 'ALL' : 'FILLERS')}
          style={{
            height: '24px',
            padding: '2px 7px',
            fontSize: '9.5px',
            borderRadius: '4px',
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
            height: '24px',
            padding: '2px 7px',
            fontSize: '9.5px',
            borderRadius: '4px',
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
            height: '24px',
            padding: '2px 7px',
            fontSize: '9.5px',
            borderRadius: '4px',
            border: '1px solid var(--border-subtle)',
            backgroundColor: filterMode === 'TAKES' ? 'rgba(139, 92, 246, 0.25)' : 'var(--bg-tertiary)',
            color: filterMode === 'TAKES' ? '#c4b5fd' : 'var(--text-secondary)',
            cursor: 'pointer'
          }}
        >
          {t.doubleLines} ({repeatedTakes.length})
        </button>

        {/* Paragraph Grouping Mode: Sentence-Complete vs Pause-Based */}
        <button
          onClick={() => {
            const nextMode = paragraphGroupingMode === 'SENTENCE' ? 'PAUSE' : 'SENTENCE';
            setParagraphGroupingMode(nextMode);
            try { localStorage.setItem('prismex_para_grouping_mode', nextMode); } catch {}
          }}
          title={
            paragraphGroupingMode === 'SENTENCE'
              ? (language === 'bn' ? 'বর্তমান মোড: পূর্ণ বাক্যভিত্তিক (ক্লিক করে পজভিত্তিক করতে পারেন)' : 'Mode: Complete Sentences (Click to switch to pause-based)')
              : (language === 'bn' ? 'বর্তমান মোড: পজভিত্তিক (ক্লিক করে পূর্ণ বাক্যভিত্তিক করতে পারেন)' : 'Mode: Pause-Based (Click to switch to sentence-based)')
          }
          style={{
            marginLeft: 'auto',
            height: '24px',
            padding: '2px 8px',
            fontSize: '9.5px',
            fontWeight: 600,
            borderRadius: '4px',
            border: paragraphGroupingMode === 'SENTENCE' ? '1px solid #10b981' : '1px solid #a855f7',
            backgroundColor: paragraphGroupingMode === 'SENTENCE' ? 'rgba(16, 185, 129, 0.18)' : 'rgba(168, 85, 247, 0.18)',
            color: paragraphGroupingMode === 'SENTENCE' ? '#34d399' : '#d8b4fe',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '3px'
          }}
        >
          <span>{paragraphGroupingMode === 'SENTENCE' ? (language === 'bn' ? '🎯 পূর্ণ বাক্য' : '🎯 Sentences') : (language === 'bn' ? '⏱️ পজভিত্তিক' : '⏱️ Pauses')}</span>
        </button>

        <button
          onClick={() => {
            const nextVal = !followPlayhead;
            setFollowPlayhead(nextVal);
            try { localStorage.setItem('prismex_follow_playhead', String(nextVal)); } catch {}
          }}
          title="ভিডিও প্লে হওয়ার সাথে সাথে স্পোকেন টেক্সটে অটোমেটিক স্ক্রোল হবে"
          style={{
            height: '24px',
            padding: '2px 7px',
            fontSize: '9.5px',
            borderRadius: '4px',
            border: followPlayhead ? '1px solid #38bdf8' : '1px solid var(--border-subtle)',
            backgroundColor: followPlayhead ? 'rgba(56, 189, 248, 0.2)' : 'var(--bg-tertiary)',
            color: followPlayhead ? '#38bdf8' : 'var(--text-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '3px'
          }}
        >
          <span>{followPlayhead ? (language === 'bn' ? '📍 ফলো: চালু' : '📍 Follow: ON') : (language === 'bn' ? '📍 ফলো: বন্ধ' : '📍 Follow: OFF')}</span>
        </button>

        <button
          onClick={() => {
            const nextVal = !autoPlayOnJump;
            setAutoPlayOnJump(nextVal);
            try {
              localStorage.setItem('prismex_auto_play_on_jump', String(nextVal));
            } catch {}
          }}
          title="জাম্প বা শব্দে ক্লিক করলেই সরাসরি ভিডিও প্লে হবে"
          style={{
            height: '24px',
            padding: '2px 7px',
            fontSize: '9.5px',
            borderRadius: '4px',
            border: autoPlayOnJump ? '1px solid #10b981' : '1px solid var(--border-subtle)',
            backgroundColor: autoPlayOnJump ? 'rgba(16, 185, 129, 0.2)' : 'var(--bg-tertiary)',
            color: autoPlayOnJump ? '#34d399' : 'var(--text-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '3px'
          }}
        >
          <Zap size={9} />
          <span>{autoPlayOnJump ? (language === 'bn' ? '⚡ অটো-প্লে: চালু' : '⚡ Auto: ON') : (language === 'bn' ? '⚡ অটো-প্লে: বন্ধ' : '⚡ Auto: OFF')}</span>
        </button>

        {/* Legend Toggle Button */}
        <button
          onClick={() => setShowLegend(!showLegend)}
          style={{
            height: '24px',
            padding: '2px 7px',
            fontSize: '9.5px',
            borderRadius: '4px',
            border: showLegend ? '1px solid #a855f7' : '1px solid var(--border-subtle)',
            backgroundColor: showLegend ? 'rgba(168, 85, 247, 0.2)' : 'var(--bg-tertiary)',
            color: showLegend ? '#d8b4fe' : 'var(--text-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '3px'
          }}
          title="কালার কিউ নির্দেশিকা দেখান/লুকান"
        >
          <span>ℹ️ নির্দেশিকা</span>
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
        <div className="card" style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {detectedSilences.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '11px', textAlign: 'center', padding: '20px' }}>
              No pauses detected.
            </div>
          ) : (
            detectedSilences.map((s: any, idx: number) => (
              <div
                key={idx}
                style={{
                  flexShrink: 0,
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
        <div className="card" style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
                  flexShrink: 0,
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
          {/* Subtle Visual Cues Legend Bar (Collapsible to save 100% space) */}
          {showLegend && (
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
          )}

          <div
            className="card"
            ref={transcriptContainerRef}
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

            const directive = scriptDirectives[para.startIdx] || Object.values(scriptDirectives).find(
              (d: any) => d.startSeconds <= paraEnd && d.endSeconds >= para.startTime
            );

            const isPlayingPara = playheadSec > 0 && playheadSec >= para.startTime && playheadSec <= paraEnd;

            let cardBg = matchingTake ? 'rgba(139, 92, 246, 0.08)' : 'transparent';
            let cardBorderLeft = matchingTake ? '2px solid #a78bfa' : 'none';

            if (isPlayingPara) {
              cardBg = 'rgba(16, 185, 129, 0.14)';
              cardBorderLeft = '3px solid #10b981';
            } else if (directive && directive.visualType !== 'NONE') {
              if (directive.visualType === 'BROLL') {
                cardBg = 'rgba(6, 182, 212, 0.07)';
                cardBorderLeft = '3px solid #06b6d4';
              } else if (directive.visualType === 'PNG') {
                cardBg = 'rgba(168, 85, 247, 0.07)';
                cardBorderLeft = '3px solid #a855f7';
              } else if (directive.visualType === 'TEXT_ANIMATION') {
                cardBg = 'rgba(245, 158, 11, 0.07)';
                cardBorderLeft = '3px solid #f59e0b';
              } else if (directive.visualType === 'PUNCH') {
                cardBg = 'rgba(239, 68, 68, 0.07)';
                cardBorderLeft = '3px solid #ef4444';
              }
            }

            return (
            <div
              id={`para-${para.startIdx}`}
              key={para.startIdx}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                padding: matchingTake || (directive && directive.visualType !== 'NONE') || isPlayingPara ? '6px 8px' : '4px 0',
                borderRadius: matchingTake || (directive && directive.visualType !== 'NONE') || isPlayingPara ? '4px' : '0',
                backgroundColor: cardBg,
                borderLeft: cardBorderLeft,
                boxShadow: isPlayingPara ? '0 0 12px rgba(16, 185, 129, 0.22)' : 'none',
                transition: 'background-color 0.15s, border-left 0.15s'
              }}
            >
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
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

                  {/* ✨ AI Analysis & Explanation Toggle */}
                  <button
                    onClick={() => handleToggleOrAnalyzeLineAI(para.startIdx, paraLineText, para.startTime, paraEnd)}
                    title="AI বিশ্লেষণ: এই লাইনের ভিজ্যুয়াল ডিরেকশন ও পরামর্শ তৈরি / দেখুন"
                    style={{
                      backgroundColor: isAnalyzingLineIdx === para.startIdx
                        ? 'rgba(245, 158, 11, 0.35)'
                        : (expandedDirectiveIdx === para.startIdx ? 'rgba(168, 85, 247, 0.35)' : 'rgba(255,255,255,0.06)'),
                      border: isAnalyzingLineIdx === para.startIdx
                        ? '1px solid #f59e0b'
                        : (expandedDirectiveIdx === para.startIdx ? '1px solid #a855f7' : '1px solid rgba(255,255,255,0.12)'),
                      color: isAnalyzingLineIdx === para.startIdx ? '#fbbf24' : (expandedDirectiveIdx === para.startIdx ? '#d8b4fe' : '#c084fc'),
                      borderRadius: '3px',
                      padding: '2px 4px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    {isAnalyzingLineIdx === para.startIdx ? (
                      <RefreshCw size={10} style={{ animation: 'spin 1s linear infinite' }} />
                    ) : (
                      <Sparkles size={10} />
                    )}
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
                  {directive && directive.visualType !== 'NONE' && (
                    <span
                      onClick={() => setExpandedDirectiveIdx(expandedDirectiveIdx === para.startIdx ? null : para.startIdx)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                        marginRight: '6px',
                        padding: '1px 6px',
                        fontSize: '9.5px',
                        fontWeight: 600,
                        borderRadius: '3px',
                        cursor: 'pointer',
                        backgroundColor: directive.visualType === 'BROLL' ? 'rgba(6, 182, 212, 0.22)' :
                                         directive.visualType === 'PNG' ? 'rgba(168, 85, 247, 0.22)' :
                                         directive.visualType === 'TEXT_ANIMATION' ? 'rgba(245, 158, 11, 0.22)' : 'rgba(239, 68, 68, 0.22)',
                        color: directive.visualType === 'BROLL' ? '#67e8f9' :
                               directive.visualType === 'PNG' ? '#d8b4fe' :
                               directive.visualType === 'TEXT_ANIMATION' ? '#fbbf24' : '#fca5a5',
                        border: `1px solid ${directive.accentColor || '#666'}`
                      }}
                      title="ক্লিক করে এই লাইনের বাংলা ব্যাখ্যা ও এডিটিং পরামর্শ দেখুন"
                    >
                      {directive.badgeLabel}
                    </span>
                  )}
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
                    } else if (directive && directive.visualType !== 'NONE') {
                      wordBorderBottom = `1px dotted ${directive.accentColor || '#666'}`;
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

              {/* Expandable Inline AI Directive Card (Spacious, Centered, Context-Aware Multi-Site Hub) */}
              {expandedDirectiveIdx === para.startIdx && directive && (() => {
                const currentParaPos = paragraphs.findIndex(p => p.startIdx === para.startIdx);
                const precedingParas = currentParaPos > 0 ? paragraphs.slice(Math.max(0, currentParaPos - 3), currentParaPos) : [];
                const succeedingParas = currentParaPos < paragraphs.length - 1 ? paragraphs.slice(currentParaPos + 1, Math.min(paragraphs.length, currentParaPos + 4)) : [];

                // Clean semantic query strictly filtering out camera jargon and generic 'cinematic scene'
                const cleanQuery = (() => {
                  const q = (directive.query || '').trim();
                  const lower = q.toLowerCase();
                  if (!q || lower.includes('zoom') || lower.includes('punch') || lower.includes('cinematic') || lower.includes('scene')) {
                    const rawWords = paraLineText.replace(/[^\w\s]/g, '').toLowerCase().split(/\s+/);
                    const stop = new Set(['the','and','for','that','this','with','from','have','they','what','about','reach','time','today','when','tell','someone','must','almost','well','hate','like','think','said','just','really']);
                    const content = rawWords.filter(w => !stop.has(w) && w.length > 2);
                    if (content.length > 0) return content.slice(0, 2).join(' ');
                    return rawWords[0] || 'visual scene';
                  }
                  return q;
                })();

                const actionBrollKws: string[] = ((directive.actionBrollKeywords && directive.actionBrollKeywords.length > 0)
                  ? directive.actionBrollKeywords
                  : (directive.brollKeywords && directive.brollKeywords.length > 0)
                    ? directive.brollKeywords.slice(0, 2)
                    : [cleanQuery]
                ).filter((k: string) => !k.toLowerCase().includes('zoom') && !k.toLowerCase().includes('punch') && !k.toLowerCase().includes('cinematic') && !k.toLowerCase().includes('scene'));

                const moodBrollKws: string[] = ((directive.moodBrollKeywords && directive.moodBrollKeywords.length > 0)
                  ? directive.moodBrollKeywords
                  : (directive.brollKeywords && directive.brollKeywords.length > 2)
                    ? directive.brollKeywords.slice(2, 4)
                    : [`${cleanQuery} atmospheric mood`]
                ).filter((k: string) => !k.toLowerCase().includes('zoom') && !k.toLowerCase().includes('punch') && !k.toLowerCase().includes('cinematic') && !k.toLowerCase().includes('scene'));

                const brollKws: string[] = Array.from(new Set([...actionBrollKws, ...moodBrollKws])).filter(Boolean);
                if (brollKws.length === 0) {
                  brollKws.push(cleanQuery, `${cleanQuery} 4k footage`);
                }

                const pngKws: string[] = ((directive.pngKeywords && directive.pngKeywords.length > 0)
                  ? directive.pngKeywords.filter((k: string) => !k.toLowerCase().includes('zoom') && !k.toLowerCase().includes('punch') && !k.toLowerCase().includes('cinematic') && !k.toLowerCase().includes('scene'))
                  : []
                );
                if (pngKws.length === 0) {
                  pngKws.push(`${cleanQuery} transparent png`, `${cleanQuery} icon`);
                }

                const activeMeaningBn = liveTranslations[para.startIdx]
                  || ((directive.meaningBn && !directive.meaningBn.includes('বক্তব্যে বিশেষ জোর') && !directive.meaningBn.includes('মূল বক্তব্য: "')) ? directive.meaningBn : '')
                  || 'অনুবাদ প্রস্তুত হচ্ছে...';

                return (
                  <div
                    style={{
                      marginTop: '8px',
                      padding: '12px 14px',
                      borderRadius: '8px',
                      backgroundColor: '#16161a',
                      border: `1.5px solid ${directive.accentColor || '#38bdf8'}`,
                      boxShadow: '0 8px 30px rgba(0,0,0,0.85)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                      fontSize: '11px',
                      fontFamily: 'inherit'
                    }}
                  >
                    {/* Drawer Header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '10.5px',
                            fontWeight: 700,
                            backgroundColor: `${directive.accentColor || '#38bdf8'}25`,
                            color: directive.accentColor || '#38bdf8',
                            border: `1px solid ${directive.accentColor || '#38bdf8'}`
                          }}
                        >
                          {directive.badgeLabel}
                        </span>
                        <span style={{ color: '#fff', fontSize: '11.5px', fontWeight: 600 }}>
                          এআই ডিরেক্টর নির্দেশিকা ও সাবটাইটেল গাইড
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {/* 🔄 Re-Tune this specific sentence on-demand with deep LLM Director */}
                        <button
                          onClick={async () => {
                            setCreativeStatus('এআই এই লাইনটির ডিপ ভিজ্যুয়াল অ্যানালাইসিস করছে...');
                            const prevP = precedingParas.length > 0 ? precedingParas[precedingParas.length - 1].tokens.map((t: any) => t.word).join(' ') : '';
                            const nextP = succeedingParas.length > 0 ? succeedingParas[0].tokens.map((t: any) => t.word).join(' ') : '';
                            const tuned = await client.tuneSingleLine(paraLineText, prevP, nextP);
                            if (tuned) {
                              if (tuned.meaningBn) {
                                setLiveTranslations(prev => ({ ...prev, [para.startIdx]: tuned.meaningBn }));
                              }
                              updateScriptDirective(para.startIdx, {
                                ...directive,
                                meaningBn: tuned.meaningBn,
                                banglaExplanation: tuned.meaningBn,
                                actionBrollKeywords: tuned.actionBrollKeywords || [],
                                moodBrollKeywords: tuned.moodBrollKeywords || [],
                                brollKeywords: tuned.brollKeywords || [],
                                pngKeywords: tuned.pngKeywords || [],
                                query: tuned.query || cleanQuery,
                                editingIdea: tuned.editingIdea,
                                editingSuggestion: tuned.editingIdea,
                                typographyGuide: tuned.typographyGuide,
                                iconIdea: tuned.iconIdea
                              });
                              setCreativeStatus('লাইন এআই টিউন সম্পন্ন!');
                            } else {
                              const trans = await client.translateSentence(paraLineText);
                              if (trans) {
                                setLiveTranslations(prev => ({ ...prev, [para.startIdx]: trans }));
                              }
                              setCreativeStatus('লাইন অনুবাদ সম্পন্ন!');
                            }
                            setTimeout(() => setCreativeStatus(null), 3000);
                          }}
                          style={{
                            background: 'rgba(56, 189, 248, 0.15)',
                            border: '1px solid rgba(56, 189, 248, 0.35)',
                            borderRadius: '4px',
                            color: '#38bdf8',
                            cursor: 'pointer',
                            padding: '2px 8px',
                            fontSize: '10px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontWeight: 600
                          }}
                          title="এই লাইনের জন্য এআই ডিরেক্টর দিয়ে ডিপ অ্যাকশন ও মুড বি-রোল এবং পিএনজি নতুন করে বিশ্লেষণ করুন"
                        >
                          <RefreshCw size={10} />
                          <span>এআই টিউন</span>
                        </button>
                        <button
                          onClick={() => setExpandedDirectiveIdx(null)}
                          style={{
                            background: 'rgba(255,255,255,0.06)',
                            border: '1px solid rgba(255,255,255,0.12)',
                            borderRadius: '4px',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            padding: '2px 6px',
                            fontSize: '11px'
                          }}
                          title="প্যানেল বন্ধ করুন"
                        >
                          ✕
                        </button>
                      </div>
                    </div>

                    {/* 📖 CONTEXTUAL SCRIPT & BENGALI TRANSLATION STREAM */}
                    <div style={{
                      backgroundColor: 'rgba(0,0,0,0.45)',
                      borderRadius: '8px',
                      border: '1px solid rgba(255,255,255,0.1)',
                      padding: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <BookOpen size={14} />
                          <span>কনটেক্সট ধারাবাহিকতা ও বাংলা অর্থ</span>
                        </span>
                        <span style={{ fontSize: '9.5px', color: 'var(--text-muted)' }}>
                          (আগের ও পরের বক্তব্য স্ক্রোল করে বাংলায় পড়তে পারেন)
                        </span>
                      </div>

                      {/* Scrollable Context Stream */}
                      <div style={{
                        maxHeight: '260px',
                        overflowY: 'auto',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        paddingRight: '6px'
                      }}>
                        {/* Preceding Paragraphs (Muted Tone, Readable Bengali) */}
                        {precedingParas.map((prevP) => {
                          const prevText = prevP.tokens.map(t => t.word).join(' ');
                          const prevDir = scriptDirectives[prevP.startIdx];
                          const prevBn = liveTranslations[prevP.startIdx] || (prevDir?.meaningBn && !prevDir.meaningBn.includes('বক্তব্যে বিশেষ জোর') ? prevDir.meaningBn : '');
                          return (
                            <div key={`prev_${prevP.startIdx}`} style={{
                              opacity: 0.75,
                              fontSize: '11px',
                              borderLeft: '2px solid rgba(56, 189, 248, 0.4)',
                              paddingLeft: '10px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '2px'
                            }}>
                              <div style={{ fontFamily: 'monospace', fontSize: '9px', color: 'var(--text-muted)' }}>
                                {TimecodeConverter.formatTimecode(prevP.startTime, fps)}
                              </div>
                              <div style={{ color: '#a1a1aa', fontStyle: 'italic', fontSize: '10.5px' }}>"{prevText}"</div>
                              {prevBn && (
                                <div style={{ color: '#7dd3fc', fontSize: '11px', fontWeight: 600, lineHeight: 1.4 }}>
                                  🇧🇩 {prevBn}
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* TARGET FOCUSED PARAGRAPH (Center Highlighted with Bright Contrast & Badge) */}
                        <div style={{
                          backgroundColor: 'rgba(56, 189, 248, 0.12)',
                          border: '2px solid #38bdf8',
                          borderRadius: '8px',
                          padding: '10px 12px',
                          boxShadow: '0 0 20px rgba(56, 189, 248, 0.22)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#38bdf8', backgroundColor: 'rgba(56, 189, 248, 0.22)', padding: '2px 8px', borderRadius: '4px' }}>
                              🎯 মূল ফোকাস বাক্য • {TimecodeConverter.formatTimecode(para.startTime, fps)}
                            </span>
                            <span style={{ fontSize: '10px', color: '#93c5fd', fontFamily: 'monospace' }}>
                              ~{(paraEnd - para.startTime).toFixed(1)}s
                            </span>
                          </div>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff', lineHeight: 1.5 }}>
                            "{paraLineText}"
                          </div>
                          <div style={{
                            paddingTop: '6px',
                            borderTop: '1px solid rgba(56, 189, 248, 0.3)',
                            fontSize: '12.5px',
                            fontWeight: 600,
                            color: '#38bdf8',
                            lineHeight: 1.6
                          }}>
                            <span style={{ color: '#67e8f9', fontWeight: 700 }}>🇧🇩 বাংলা অর্থ: </span>
                            {activeMeaningBn}
                          </div>
                        </div>

                        {/* Succeeding Paragraphs (Muted Tone, Readable Bengali) */}
                        {succeedingParas.map((nextP) => {
                          const nextText = nextP.tokens.map(t => t.word).join(' ');
                          const nextDir = scriptDirectives[nextP.startIdx];
                          const nextBn = liveTranslations[nextP.startIdx] || (nextDir?.meaningBn && !nextDir.meaningBn.includes('বক্তব্যে বিশেষ জোর') ? nextDir.meaningBn : '');
                          return (
                            <div key={`next_${nextP.startIdx}`} style={{
                              opacity: 0.75,
                              fontSize: '11px',
                              borderLeft: '2px solid rgba(56, 189, 248, 0.4)',
                              paddingLeft: '10px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '2px'
                            }}>
                              <div style={{ fontFamily: 'monospace', fontSize: '9px', color: 'var(--text-muted)' }}>
                                {TimecodeConverter.formatTimecode(nextP.startTime, fps)}
                              </div>
                              <div style={{ color: '#a1a1aa', fontStyle: 'italic', fontSize: '10.5px' }}>"{nextText}"</div>
                              {nextBn && (
                                <div style={{ color: '#7dd3fc', fontSize: '11px', fontWeight: 600, lineHeight: 1.4 }}>
                                  🇧🇩 {nextBn}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* 🎬 VIDEO EDITING, TYPOGRAPHY & ICON GUIDANCE */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px' }}>
                      {/* Editing & Typography Guide */}
                      <div style={{
                        backgroundColor: 'rgba(250, 204, 21, 0.08)',
                        border: '1px solid rgba(250, 204, 21, 0.25)',
                        borderRadius: '6px',
                        padding: '8px 10px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px'
                      }}>
                        <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#facc15', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Sparkles size={11} />
                          <span>🎬 এডিটিং ও টাইপোগ্রাফি পরামর্শ</span>
                        </div>
                        <div style={{ fontSize: '11px', color: '#fef08a', lineHeight: 1.5 }}>
                          {directive.editingIdea || directive.editingSuggestion || 'বক্তব্যের মূল মেসেজ অনুযায়ী জাম্প কাট বা ক্যামেরা পাঞ্চ দিন।'}
                        </div>
                        <div style={{ fontSize: '10px', color: '#fde047', fontStyle: 'italic', marginTop: '2px' }}>
                          ↳ {directive.typographyGuide || 'অন-স্ক্রিন কাইনেটিক সাবটাইটেল ও কী-ওয়ার্ড বোল্ড হাইলাইট অ্যানিমেশন।'}
                        </div>
                      </div>

                      {/* Motion Graphics & Icon Guide */}
                      <div style={{
                        backgroundColor: 'rgba(168, 85, 247, 0.08)',
                        border: '1px solid rgba(168, 85, 247, 0.25)',
                        borderRadius: '6px',
                        padding: '8px 10px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px'
                      }}>
                        <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#c084fc', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Image size={11} />
                          <span>📱 মোশন গ্রাফিক্স ও আইকন আইডিয়া</span>
                        </div>
                        <div style={{ fontSize: '11px', color: '#e9d5ff', lineHeight: 1.5 }}>
                          {directive.iconIdea || 'বক্তব্যের ধারণার সাথে মানানসই মিনিমালিস্ট ভেক্টর আইকন বা স্টিকার লোয়ার-থার্ডে ফ্ল্যাশ করুন।'}
                        </div>
                      </div>
                    </div>

                    {/* 🎥 WHOLE PARAGRAPH B-ROLL SEARCH HUB (MULTI-SITE + YOUTUBE) */}
                    <div style={{
                      backgroundColor: 'rgba(6, 182, 212, 0.07)',
                      border: '1px solid rgba(6, 182, 212, 0.25)',
                      borderRadius: '6px',
                      padding: '8px 10px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#22d3ee', display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <Video size={12} />
                          <span>🎥 B-Roll ভিডিও সার্চ হাব (৬টি ফ্রি সাইট + YouTube)</span>
                        </span>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {brollKws.map((bKw: string, kIdx: number) => {
                          const sites = getMultiSiteBrollLinks(bKw);
                          return (
                            <div key={`bkw_${kIdx}`} style={{
                              backgroundColor: 'rgba(0,0,0,0.25)',
                              borderRadius: '5px',
                              padding: '6px 8px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '5px'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{
                                    fontSize: '9px',
                                    fontWeight: 700,
                                    padding: '1px 5px',
                                    borderRadius: '3px',
                                    backgroundColor: actionBrollKws.includes(bKw) ? 'rgba(56, 189, 248, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                                    color: actionBrollKws.includes(bKw) ? '#38bdf8' : '#34d399',
                                    border: `1px solid ${actionBrollKws.includes(bKw) ? '#38bdf8' : '#34d399'}44`
                                  }}>
                                    {actionBrollKws.includes(bKw) ? '🎬 সরাসরি অ্যাকশন' : '🌧️ মুড ও পরিবেশ'}
                                  </span>
                                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#ffffff' }}>
                                    কি-ওয়ার্ড: <span style={{ color: '#67e8f9' }}>"{bKw}"</span>
                                  </span>
                                </div>
                                {/* 🚀 OPEN ALL IN TABS */}
                                <button
                                  onClick={() => handleOpenAllBrollSites(bKw)}
                                  style={{
                                    backgroundColor: '#0891b2',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '4px',
                                    padding: '3px 8px',
                                    fontSize: '9.5px',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '3px'
                                  }}
                                  title="এক ক্লিকে নতুন ব্রাউজার ট্যাবে Pexels, Pixabay, Mixkit, Coverr, Videezy ও YouTube সার্চ ওপেন করুন"
                                >
                                  <span>🚀 সব সাইটে একসাথে খুঁজুন</span>
                                </button>
                              </div>
                              {/* Individual Site Badges */}
                              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                {sites.map(st => (
                                  <button
                                    key={st.name}
                                    onClick={() => hostBridge.openURLInDefaultBrowser(st.url)}
                                    style={{
                                      backgroundColor: 'rgba(255,255,255,0.06)',
                                      border: `1px solid ${st.color}55`,
                                      color: st.color,
                                      borderRadius: '3px',
                                      padding: '2px 6px',
                                      fontSize: '9px',
                                      fontWeight: 600,
                                      cursor: 'pointer'
                                    }}
                                  >
                                    {st.name} ↗
                                  </button>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* 🖼️ WHOLE PARAGRAPH PNG & ICON SEARCH HUB */}
                    <div style={{
                      backgroundColor: 'rgba(168, 85, 247, 0.07)',
                      border: '1px solid rgba(168, 85, 247, 0.25)',
                      borderRadius: '6px',
                      padding: '8px 10px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#c084fc', display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <Image size={12} />
                          <span>🖼️ স্বচ্ছ PNG ও আইকন সার্চ হাব (Google, Flaticon, Iconfinder, PNGWing, Freepik)</span>
                        </span>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {pngKws.map((pKw: string, pIdx: number) => {
                          const sites = getMultiSitePngLinks(pKw);
                          return (
                            <div key={`pkw_${pIdx}`} style={{
                              backgroundColor: 'rgba(0,0,0,0.25)',
                              borderRadius: '5px',
                              padding: '6px 8px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '5px'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
                                <span style={{ fontSize: '11px', fontWeight: 600, color: '#ffffff' }}>
                                  🔍 কি-ওয়ার্ড: <span style={{ color: '#d8b4fe' }}>"{pKw}"</span>
                                </span>
                                {/* 🚀 OPEN ALL IN TABS */}
                                <button
                                  onClick={() => handleOpenAllPngSites(pKw)}
                                  style={{
                                    backgroundColor: '#7c3aed',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '4px',
                                    padding: '3px 8px',
                                    fontSize: '9.5px',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '3px'
                                  }}
                                  title="এক ক্লিকে নতুন ব্রাউজার ট্যাবে Google Transparent PNG, Flaticon, Iconfinder, PNGWing ও Freepik সার্চ ওপেন করুন"
                                >
                                  <span>🚀 সব সাইটে একসাথে খুঁজুন</span>
                                </button>
                              </div>
                              {/* Individual Site Badges */}
                              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                {sites.map(st => (
                                  <button
                                    key={st.name}
                                    onClick={() => hostBridge.openURLInDefaultBrowser(st.url)}
                                    style={{
                                      backgroundColor: 'rgba(255,255,255,0.06)',
                                      border: `1px solid ${st.color}55`,
                                      color: st.color,
                                      borderRadius: '3px',
                                      padding: '2px 6px',
                                      fontSize: '9px',
                                      fontWeight: 600,
                                      cursor: 'pointer'
                                    }}
                                  >
                                    {st.name} ↗
                                  </button>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Quick Action Footer Bar */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px', paddingTop: '6px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        <button
                          onClick={async () => {
                            await copyToClipboard(paraLineText);
                            setCopiedLineIdx(para.startIdx);
                            setTimeout(() => setCopiedLineIdx(null), 2000);
                          }}
                          className="btn-secondary"
                          style={{ padding: '3px 7px', fontSize: '10px' }}
                        >
                          <Copy size={10} />
                          <span>{copiedLineIdx === para.startIdx ? '✓ কপি হয়েছে!' : 'বাক্য কপি'}</span>
                        </button>

                        <button
                          onClick={async () => {
                            const kwStr = brollKws.concat(pngKws).join(' ');
                            await copyToClipboard(kwStr);
                            setExportStatus('কি-ওয়ার্ড কপি হয়েছে!');
                            setTimeout(() => setExportStatus(null), 2500);
                          }}
                          className="btn-secondary"
                          style={{ padding: '3px 7px', fontSize: '10px', color: '#facc15' }}
                        >
                          <Sparkles size={10} />
                          <span>কাইনেটিক কি-ওয়ার্ড কপি</span>
                        </button>
                      </div>

                      <button
                        onClick={() => handleOpenBrollForWord({
                          wordIdx: para.startIdx,
                          word: cleanQuery || brollKws[0] || 'cinematic',
                          start: para.startTime,
                          end: paraEnd
                        })}
                        className="btn-primary"
                        style={{ padding: '3px 9px', fontSize: '10px', backgroundColor: '#10b981' }}
                      >
                        <Video size={10} />
                        <span>V2 ফুটেজ মডাল খুলুন</span>
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
            );
          })}
        </div>
      </div>
      )}

      {/* ===================== FLOATING WORD-LEVEL AI POPOVER (COMPACT & RESPONSIVE) ===================== */}
      {popoverWord && (
        <div
          onMouseDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
          }}
          style={{
            position: 'fixed',
            top: `${Math.max(8, popoverWord.y - 38)}px`,
            left: `${Math.max(8, Math.min(window.innerWidth - 180, popoverWord.x - 85))}px`,
            zIndex: 9999,
            backgroundColor: '#18181b',
            border: '1px solid rgba(255,255,255,0.22)',
            borderRadius: '5px',
            padding: '3px 5px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.85)',
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
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
              padding: '3px 5px',
              backgroundColor: 'rgba(168, 85, 247, 0.2)',
              color: '#d8b4fe',
              border: '1px solid rgba(168, 85, 247, 0.45)',
              borderRadius: '3px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="গুগল ইমেজ সার্চে এই শব্দের স্বচ্ছ PNG ছবি খুঁজুন"
          >
            <Image size={12} />
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
              padding: '3px 5px',
              backgroundColor: 'rgba(6, 182, 212, 0.2)',
              color: '#67e8f9',
              border: '1px solid rgba(6, 182, 212, 0.45)',
              borderRadius: '3px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Pexels.com ভিডিও সার্চ ওপেন করুন ও B-Roll খুঁজুন"
          >
            <Video size={12} />
          </button>

          {/* ✨ AI Directive Analysis */}
          <button
            onClick={() => handleAnalyzeWordAI(popoverWord)}
            style={{
              padding: '3px 5px',
              backgroundColor: 'rgba(245, 158, 11, 0.2)',
              color: '#fbbf24',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              borderRadius: '3px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="AI দিয়ে এই শব্দ বিশ্লেষণ করুন (বি-রোল, পিএনজি বা টেক্সট সাজেশন তৈরি হবে)"
          >
            <Sparkles size={12} />
          </button>

          {/* ⚡ Punch Zoom */}
          <button
            onClick={() => handleAddPunchForWord(popoverWord)}
            style={{
              padding: '3px 5px',
              backgroundColor: 'rgba(239, 68, 68, 0.2)',
              color: '#f87171',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: '3px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="পাঞ্চ কি-ওয়ার্ড মার্ক করুন এবং ১১৪% জুম প্রয়োগ করুন"
          >
            <Zap size={12} />
          </button>

          {/* 📋 Copy Word */}
          <button
            onClick={async () => {
              const cleanWord = popoverWord.word.replace(/[^\w\s\u0980-\u09FF'-]/g, '').trim() || popoverWord.word.trim();
              await copyToClipboard(cleanWord);
              setCopiedWord(cleanWord);
              setExportStatus(language === 'bn' ? `"${cleanWord}" কপি হয়েছে!` : `Copied "${cleanWord}"!`);
              setTimeout(() => {
                setCopiedWord(null);
                setExportStatus(null);
                setPopoverWord(null);
              }, 700);
            }}
            style={{
              padding: '3px 5px',
              backgroundColor: copiedWord === popoverWord.word ? 'rgba(16, 185, 129, 0.35)' : 'rgba(255,255,255,0.06)',
              color: copiedWord === popoverWord.word ? '#34d399' : '#fff',
              border: copiedWord === popoverWord.word ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.15)',
              borderRadius: '3px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="শব্দটি ক্লিপবোর্ডে কপি করুন"
          >
            {copiedWord === popoverWord.word ? <Check size={12} /> : <Copy size={12} />}
          </button>

          {/* ✂️ Instant Ripple Cut Word */}
          <button
            onClick={() => {
              deleteTranscriptRange(popoverWord.start, popoverWord.end);
              setPopoverWord(null);
            }}
            style={{
              padding: '3px 5px',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              color: '#fca5a5',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: '3px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="ইনস্ট্যান্ট নেটিভ রিপল কাট (Shift+Delete-এর মতো সাথে সাথে মুছুন)"
          >
            <Scissors size={12} />
          </button>

          {/* Close */}
          <button
            onClick={() => setPopoverWord(null)}
            style={{
              padding: '2px 4px',
              fontSize: '10px',
              backgroundColor: 'transparent',
              color: 'var(--text-muted)',
              border: 'none',
              cursor: 'pointer'
            }}
            title="পপ-আপ বন্ধ করুন"
          >
            ✕
          </button>
        </div>
      )}

      {/* ===================== FLOATING TEXT DRAG SELECTION TOOLBAR (COMPACT & RESPONSIVE) ===================== */}
      {floatingSelection && (
        <div
          onMouseDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
          }}
          style={{
            position: 'fixed',
            top: `${floatingSelection.y}px`,
            left: `${Math.max(8, Math.min(window.innerWidth - 240, floatingSelection.x))}px`,
            zIndex: 10000,
            backgroundColor: '#18181b',
            border: '1px solid rgba(255,255,255,0.25)',
            borderRadius: '6px',
            padding: '3px 5px',
            boxShadow: '0 8px 28px rgba(0,0,0,0.95)',
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
            fontFamily: 'inherit',
            flexWrap: 'nowrap'
          }}
        >
          {/* 📋 Copy */}
          <button
            onClick={async () => {
              await copyToClipboard(floatingSelection.text);
              setExportStatus(`"${floatingSelection.text.slice(0, 25)}..." কপি হয়েছে!`);
              setTimeout(() => setExportStatus(null), 2500);
            }}
            title="সিলেক্টেড টেক্সট কপি করুন"
            style={{
              padding: '4px 6px',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              color: '#ffffff',
              border: '1px solid rgba(255, 255, 255, 0.18)',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Copy size={12} />
          </button>

          {/* 🎥 Mark as B-Roll (Cyan) */}
          <button
            onClick={() => handleMarkSelectionDirective('BROLL')}
            title="🎥 B-Roll হিসেবে চিহ্নিত করুন (সায়ান কালার ও Pexels লিংক তৈরি হবে)"
            style={{
              padding: '4px 6px',
              backgroundColor: 'rgba(6, 182, 212, 0.22)',
              color: '#67e8f9',
              border: '1px solid rgba(6, 182, 212, 0.55)',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '2px',
              fontSize: '10px',
              fontWeight: 600
            }}
          >
            <Video size={12} />
            <span>B-Roll</span>
          </button>

          {/* 🖼️ Mark as PNG (Purple) */}
          <button
            onClick={() => handleMarkSelectionDirective('PNG')}
            title="🖼️ স্বচ্ছ PNG ছবি হিসেবে চিহ্নিত করুন (পার্পল কালার ও গুগল PNG ইমেজ সার্চ লিংক তৈরি হবে)"
            style={{
              padding: '4px 6px',
              backgroundColor: 'rgba(168, 85, 247, 0.22)',
              color: '#d8b4fe',
              border: '1px solid rgba(168, 85, 247, 0.55)',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '2px',
              fontSize: '10px',
              fontWeight: 600
            }}
          >
            <Image size={12} />
            <span>PNG</span>
          </button>

          {/* ✨ Mark as Text Animation / Typography (Amber) */}
          <button
            onClick={() => handleMarkSelectionDirective('TEXT_ANIMATION')}
            title="✨ টেক্সট অ্যানিমেশন / টাইপোগ্রাফি হিসেবে চিহ্নিত করুন"
            style={{
              padding: '4px 6px',
              backgroundColor: 'rgba(245, 158, 11, 0.22)',
              color: '#fde68a',
              border: '1px solid rgba(245, 158, 11, 0.55)',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '2px',
              fontSize: '10px',
              fontWeight: 600
            }}
          >
            <Sparkles size={12} />
            <span>টেক্সট</span>
          </button>

          {/* ⚡ Mark as Punch Cut Zoom (Red) */}
          <button
            onClick={async () => {
              handleMarkSelectionDirective('PUNCH');
              await hostBridge.addTimelineMarkers([{
                type: 'EMPHASIS' as any,
                name: `Punch: ${floatingSelection.cleanQuery.slice(0, 16)}`,
                comment: `Punch Zoom at '${floatingSelection.cleanQuery}'`,
                startSeconds: playheadSec,
                durationSeconds: 1.5,
                color: 'RED' as any
              }]);
            }}
            title="⚡ পাঞ্চ জুম কাট হিসেবে চিহ্নিত করুন এবং টাইমলাইনে মার্কার দিন"
            style={{
              padding: '4px 6px',
              backgroundColor: 'rgba(239, 68, 68, 0.22)',
              color: '#fca5a5',
              border: '1px solid rgba(239, 68, 68, 0.55)',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '2px',
              fontSize: '10px',
              fontWeight: 600
            }}
          >
            <Zap size={12} />
            <span>পাঞ্চ</span>
          </button>

          {/* 🤖 AI Analyze this Selection */}
          <button
            onClick={handleAnalyzeSelectionAI}
            title="🤖 AI দিয়ে এই অংশ বিশ্লেষণ করুন (বি-রোল, পিএনজি নাকি টেক্সট হবে তা এআই ঠিক করবে)"
            style={{
              padding: '4px 7px',
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.3), rgba(168, 85, 247, 0.3))',
              color: '#ffffff',
              border: '1px solid rgba(168, 85, 247, 0.6)',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
              fontSize: '10px',
              fontWeight: 700
            }}
          >
            <Bot size={12} />
            <span>AI টিউন</span>
          </button>

          {/* 🔍 Direct Google Images Browser Open */}
          <button
            onClick={() => {
              const url = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(floatingSelection.cleanQuery + ' transparent png')}`;
              hostBridge.openURLInDefaultBrowser(url);
            }}
            title="সরাসরি ব্রাউজারে গুগল PNG ইমেজ সার্চ পেজ খুলুন"
            style={{
              padding: '4px 5px',
              backgroundColor: 'rgba(255, 255, 255, 0.06)',
              color: '#94a3b8',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <ExternalLink size={11} />
          </button>

          {/* ✕ Close */}
          <button
            onClick={() => setFloatingSelection(null)}
            title="টুলবার বন্ধ করুন"
            style={{
              padding: '2px 4px',
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

      {/* ===================== FOCUSED EXPORT MODAL ===================== */}
      {showExportDropdown && (
        <div
          onClick={() => setShowExportDropdown(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            backgroundColor: 'rgba(0,0,0,0.72)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="card"
            style={{
              width: '100%',
              maxWidth: '390px',
              backgroundColor: '#18181b',
              border: '1.5px solid rgba(16, 185, 129, 0.45)',
              borderRadius: '8px',
              padding: '16px',
              boxShadow: '0 20px 50px rgba(0,0,0,0.9)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              fontFamily: 'inherit'
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#34d399', fontWeight: 700, fontSize: '13px' }}>
                <Download size={16} />
                <span>{language === 'bn' ? 'এক্সপোর্ট ও ক্যাপশন হাব' : 'Export & Captions Hub'}</span>
              </div>
              <button
                onClick={() => setShowExportDropdown(false)}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '4px',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '2px 7px',
                  fontSize: '12px'
                }}
              >
                ✕
              </button>
            </div>

            {/* Option 1: 3-in-1 Project Save (Hero action) */}
            <button
              onClick={() => {
                handleSaveAll3ToProject();
                setShowExportDropdown(false);
              }}
              style={{
                padding: '10px 12px',
                backgroundColor: 'rgba(16, 185, 129, 0.18)',
                border: '1.5px solid #10b981',
                borderRadius: '6px',
                color: '#34d399',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: '3px',
                textAlign: 'left'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 700 }}>
                <Save size={15} />
                <span>প্রজেক্টে ৩টি ফাইল সেভ (SRT + TXT + JSON)</span>
              </div>
              <div style={{ fontSize: '10px', color: '#a7f3d0', paddingLeft: '23px' }}>
                এক ক্লিকে আপনার প্রিমিয়ার প্রজেক্ট ফোল্ডারে ফুল ডাটা ব্যাকআপ সংরক্ষণ করুন
              </div>
            </button>

            {/* Option 2: Send to Premiere Captions Track */}
            <button
              onClick={() => {
                handleSendToPremiereCaptions();
                setShowExportDropdown(false);
              }}
              style={{
                padding: '10px 12px',
                backgroundColor: 'rgba(59, 130, 246, 0.15)',
                border: '1.5px solid #3b82f6',
                borderRadius: '6px',
                color: '#60a5fa',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: '3px',
                textAlign: 'left'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 700 }}>
                <Subtitles size={15} />
                <span>Premiere Captions ট্র্যাকে সরাসরি পাঠান</span>
              </div>
              <div style={{ fontSize: '10px', color: '#bfdbfe', paddingLeft: '23px' }}>
                টাইমলাইনের সাবটাইটেল ট্র্যাকে অটোমেটিক ক্লিপ তৈরি করে দেবে
              </div>
            </button>

            {/* Option 3: Individual File Downloads */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '2px' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>
                নির্দিষ্ট ফরম্যাটে ফাইল ডাউনলোড করুন:
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                <button
                  onClick={() => { handleExportSrt(); setShowExportDropdown(false); }}
                  className="btn-secondary"
                  style={{
                    padding: '8px 4px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    fontWeight: 600,
                    borderColor: 'rgba(255,255,255,0.18)'
                  }}
                >
                  <FileText size={14} color="#facc15" />
                  <span>.SRT</span>
                  <span style={{ fontSize: '8.5px', color: 'var(--text-muted)' }}>সাবটাইটেল</span>
                </button>

                <button
                  onClick={() => { handleExportTxt(); setShowExportDropdown(false); }}
                  className="btn-secondary"
                  style={{
                    padding: '8px 4px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    fontWeight: 600,
                    borderColor: 'rgba(255,255,255,0.18)'
                  }}
                >
                  <FileText size={14} color="#60a5fa" />
                  <span>.TXT</span>
                  <span style={{ fontSize: '8.5px', color: 'var(--text-muted)' }}>প্লেইন টেক্সট</span>
                </button>

                <button
                  onClick={() => { handleExportJson(); setShowExportDropdown(false); }}
                  className="btn-secondary"
                  style={{
                    padding: '8px 4px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    fontWeight: 600,
                    borderColor: 'rgba(255,255,255,0.18)'
                  }}
                >
                  <FileText size={14} color="#a855f7" />
                  <span>.JSON</span>
                  <span style={{ fontSize: '8.5px', color: 'var(--text-muted)' }}>টাইমকোড ডাটা</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================== FOCUSED TOOLS MODAL ===================== */}
      {showToolsDropdown && (
        <div
          onClick={() => setShowToolsDropdown(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            backgroundColor: 'rgba(0,0,0,0.72)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="card"
            style={{
              width: '100%',
              maxWidth: '390px',
              backgroundColor: '#18181b',
              border: '1.5px solid rgba(59, 130, 246, 0.45)',
              borderRadius: '8px',
              padding: '16px',
              boxShadow: '0 20px 50px rgba(0,0,0,0.9)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              fontFamily: 'inherit'
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#60a5fa', fontWeight: 700, fontSize: '13px' }}>
                <Sliders size={16} />
                <span>{language === 'bn' ? 'প্রিজমেক্স টুলস ও স্টুডিও হাব' : 'Prismex Tools & Studio Hub'}</span>
              </div>
              <button
                onClick={() => setShowToolsDropdown(false)}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '4px',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '2px 7px',
                  fontSize: '12px'
                }}
              >
                ✕
              </button>
            </div>

            {/* Tools List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {/* Tool 1: SRT Editor */}
              <button
                onClick={() => { setActiveTab('srt-editor'); setShowToolsDropdown(false); }}
                style={{
                  padding: '10px 12px',
                  backgroundColor: 'rgba(168, 85, 247, 0.12)',
                  border: '1px solid rgba(168, 85, 247, 0.35)',
                  borderRadius: '6px',
                  color: '#d8b4fe',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  textAlign: 'left'
                }}
              >
                <Subtitles size={16} color="#c084fc" />
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#f3e8ff' }}>📝 SRT সাবটাইটেল এডিটর</div>
                  <div style={{ fontSize: '10px', color: '#c084fc' }}>টাইমকোড ড্র্যাগ, স্প্লিট ও সরাসরি টেক্সট এডিট করুন</div>
                </div>
              </button>

              {/* Tool 2: AI Smart SRT Config */}
              <button
                onClick={() => { setShowSmartSrt(!showSmartSrt); setShowToolsDropdown(false); }}
                style={{
                  padding: '10px 12px',
                  backgroundColor: 'rgba(14, 165, 233, 0.12)',
                  border: '1px solid rgba(14, 165, 233, 0.35)',
                  borderRadius: '6px',
                  color: '#7dd3fc',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  textAlign: 'left'
                }}
              >
                <SlidersHorizontal size={16} color="#38bdf8" />
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#f0f9ff' }}>⚙️ AI স্মার্ট SRT কনফিগারেশন</div>
                  <div style={{ fontSize: '10px', color: '#7dd3fc' }}>শর্টস, ইউটিউব ও পডকাস্ট ফরম্যাটের সাবটাইটেল সিঙ্ক</div>
                </div>
              </button>

              {/* Tool 3: AI Viral Shorts Studio */}
              <button
                onClick={() => { setShowCreativeStudio(!showCreativeStudio); setShowToolsDropdown(false); }}
                style={{
                  padding: '10px 12px',
                  backgroundColor: 'rgba(236, 72, 153, 0.12)',
                  border: '1px solid rgba(236, 72, 153, 0.35)',
                  borderRadius: '6px',
                  color: '#f472b6',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  textAlign: 'left'
                }}
              >
                <Sparkles size={16} color="#ec4899" />
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#fdf2f8' }}>✨ AI ক্রিয়েটিভ স্টুডিও (শর্টস)</div>
                  <div style={{ fontSize: '10px', color: '#f472b6' }}>লং ভিডিও থেকে ৩-পার্ট ভাইরাল ক্লিপ অটো-ডিটেক্ট করুন</div>
                </div>
              </button>

              {/* Tool 4: Find & Replace */}
              <button
                onClick={() => { setShowFindReplace(!showFindReplace); setShowToolsDropdown(false); }}
                style={{
                  padding: '10px 12px',
                  backgroundColor: 'rgba(234, 179, 8, 0.12)',
                  border: '1px solid rgba(234, 179, 8, 0.35)',
                  borderRadius: '6px',
                  color: '#fde047',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  textAlign: 'left'
                }}
              >
                <Type size={16} color="#eab308" />
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#fefce8' }}>🔍 টেক্সট খুঁজুন ও মুছুন</div>
                  <div style={{ fontSize: '10px', color: '#facc15' }}>ট্রান্সক্রিপ্টের নির্দিষ্ট শব্দ সার্চ করুন ও বাল্ক পরিবর্তন করুন</div>
                </div>
              </button>

              {/* Tool 5: AI Assistant */}
              <button
                onClick={() => { setShowAiPanel(!showAiPanel); setShowToolsDropdown(false); }}
                style={{
                  padding: '10px 12px',
                  backgroundColor: 'rgba(59, 130, 246, 0.12)',
                  border: '1px solid rgba(59, 130, 246, 0.35)',
                  borderRadius: '6px',
                  color: '#93c5fd',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  textAlign: 'left'
                }}
              >
                <Bot size={16} color="#3b82f6" />
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#eff6ff' }}>🤖 AI Assistant চ্যাটবট</div>
                  <div style={{ fontSize: '10px', color: '#60a5fa' }}>স্ক্রিপ্ট পরিমার্জন ও ভিডিও কন্টেন্ট পরামর্শ নিন</div>
                </div>
              </button>
            </div>
          </div>
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
                onClick={async () => {
                  await copyToClipboard(youtubeChaptersData.chaptersText);
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
      {/* ⚠️ RE-TRANSCRIBE CONFIRMATION & DANGER WARNING MODAL */}
      {showReTranscribeModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10001,
            backgroundColor: 'rgba(0,0,0,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            backdropFilter: 'blur(4px)'
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '480px',
              backgroundColor: '#18181b',
              border: '1.5px solid rgba(239, 68, 68, 0.5)',
              borderRadius: '10px',
              padding: '18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              boxShadow: '0 16px 40px rgba(0,0,0,0.95)'
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.2)',
                  color: '#ef4444',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 800,
                  border: '1px solid #ef4444'
                }}>
                  DANGER ZONE
                </span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>
                  পুনরায় ট্রান্সক্রাইব কনফার্মেশন
                </span>
              </div>
              <button
                onClick={() => setShowReTranscribeModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '15px' }}
              >
                ✕
              </button>
            </div>

            {/* Danger Notice Box */}
            <div
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                borderRadius: '6px',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f87171', fontWeight: 700, fontSize: '12px' }}>
                <AlertTriangle size={15} />
                <span>⚠️ সতর্কবার্তা / Danger Notice</span>
              </div>
              <div style={{ fontSize: '11.5px', color: '#fca5a5', lineHeight: 1.5 }}>
                পুনরায় ট্রান্সক্রাইব করলে বর্তমান ট্রান্সক্রিপ্টের পূর্বের সকল কাট হিস্ট্রি, ম্যানুয়াল এডিট ও এআই ডিরেক্টিভ রিসেট হয়ে যাবে। বর্তমান সিকোয়েন্সের অডিও থেকে সম্পূর্ণ নতুন করে প্রতিটি শব্দের টাইমকোড তৈরি হবে।
              </div>
              <div style={{ fontSize: '10.5px', color: '#86efac', display: 'flex', alignItems: 'center', gap: '4px', paddingTop: '4px', borderTop: '1px solid rgba(239,68,68,0.2)' }}>
                <ShieldCheck size={13} />
                <span>নিরাপত্তা সুরক্ষা: আপনার বর্তমান ট্রান্সক্রিপ্টের একটি সেফটি ব্যাকআপ .prismex_cache-এ সংরক্ষিত থাকবে।</span>
              </div>
            </div>

            {/* Options (Model & Language) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#d4d4d8', display: 'block', marginBottom: '4px' }}>
                  Whisper মডেল
                </label>
                <select
                  value={reTranscribeModel}
                  onChange={(e) => setReTranscribeModel(e.target.value)}
                  style={{
                    width: '100%',
                    backgroundColor: '#27272a',
                    border: '1px solid rgba(255,255,255,0.15)',
                    color: '#fff',
                    borderRadius: '4px',
                    padding: '6px 8px',
                    fontSize: '11px'
                  }}
                >
                  <option value="large-v3">MLX Large-v3 (সর্বোচ্চ নির্ভুলতা)</option>
                  <option value="medium">MLX Medium (দ্রুত ও ভারসাম্য)</option>
                  <option value="small">MLX Small (সুপার ফাস্ট)</option>
                  <option value="base">MLX Base (হালকা)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#d4d4d8', display: 'block', marginBottom: '4px' }}>
                  অডিওর ভাষা
                </label>
                <select
                  value={reTranscribeLang}
                  onChange={(e) => setReTranscribeLang(e.target.value)}
                  style={{
                    width: '100%',
                    backgroundColor: '#27272a',
                    border: '1px solid rgba(255,255,255,0.15)',
                    color: '#fff',
                    borderRadius: '4px',
                    padding: '6px 8px',
                    fontSize: '11px'
                  }}
                >
                  <option value="auto">স্বয়ংক্রিয় সনাক্তকরণ (Auto)</option>
                  <option value="en">ইংরেজি (English)</option>
                  <option value="bn">বাংলা (Bengali)</option>
                </select>
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
              <button
                onClick={() => setShowReTranscribeModal(false)}
                className="btn-secondary"
                style={{ padding: '6px 14px', fontSize: '11px' }}
              >
                ✕ বাতিল করুন (Cancel)
              </button>
              <button
                onClick={async () => {
                  setShowReTranscribeModal(false);
                  await transcribeSequence({
                    model: reTranscribeModel,
                    language: reTranscribeLang,
                    forceReTranscribe: true
                  });
                }}
                style={{
                  backgroundColor: '#dc2626',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '6px 14px',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 4px 12px rgba(220, 38, 38, 0.4)'
                }}
              >
                <AlertTriangle size={13} />
                <span>⚠️ হ্যাঁ, রি-ট্রান্সক্রাইব করুন</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
