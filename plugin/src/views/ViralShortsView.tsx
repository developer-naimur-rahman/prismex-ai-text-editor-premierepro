import React, { useState, useEffect } from 'react';
import { usePrismexStore } from '../state/usePrismexStore';
import { PremiereHostBridge } from '../host/PremiereHostBridge';
import { PrismexDaemonClient } from '../api/PrismexDaemonClient';
import { TimecodeConverter } from '../host/TimecodeConverter';
import {
  Flame,
  Sparkles,
  Play,
  Scissors,
  CheckCircle2,
  FolderPlus,
  Send,
  RefreshCw,
  Copy,
  BookOpen,
  Megaphone,
  Check,
  Lightbulb,
  FileText,
  ListFilter,
  ChevronDown,
  ChevronUp,
  Sliders,
  MessageSquare,
  HelpCircle,
  TrendingUp,
  Zap
} from 'lucide-react';

interface ShortBlock {
  text: string;
  startSeconds: number;
  endSeconds: number;
  durationSeconds?: number;
}

interface ShortSegment {
  role: 'HOOK' | 'BODY' | 'CTA' | string;
  startSeconds: number;
  endSeconds: number;
  durationSeconds?: number;
  text?: string;
}

interface AlternativeOption {
  type: string;
  label: string;
  text: string;
  startSeconds: number;
  endSeconds: number;
  durationSeconds?: number;
}

interface TopicItem {
  id: string;
  topicTitle: string;
  topicSummaryBn: string;
  keyPoints: string[];
  viralityScore: number;
  estimatedDurationSeconds: number;
  startSeconds: number;
  endSeconds: number;
}

interface ViralShortItem {
  id: string;
  title: string;
  educationalLesson?: string;
  viralityScore: number;
  reason: string;
  hook: ShortBlock | string;
  body?: ShortBlock;
  cta?: ShortBlock;
  segments?: ShortSegment[];
  startSeconds: number;
  endSeconds: number;
  durationSeconds: number;
  totalDurationSeconds?: number;
  startFrame?: number;
  endFrame?: number;
  brollSuggestions?: string[];
  loopIdea?: string;
  aspectRatio?: string;
  scriptText?: string;
  markers?: Array<{ seconds: number; type: string; name: string; comment: string }>;
  alternativeHooks?: AlternativeOption[];
  alternativeCtas?: AlternativeOption[];
}

export const ViralShortsView: React.FC = () => {
  const {
    sequenceManifest,
    transcriptWords,
    transcriptSentences,
    language
  } = usePrismexStore();

  const hostBridge = PremiereHostBridge.getInstance();
  const client = PrismexDaemonClient.getInstance();
  const fps = sequenceManifest?.fps || 24;

  // Sub-tabs: 'TOPICS' | 'STUDIO' | 'CLIENT_SCRIPT'
  const [subTab, setSubTab] = useState<'TOPICS' | 'STUDIO' | 'CLIENT_SCRIPT'>('TOPICS');

  // Topic discovery state
  const [topics, setTopics] = useState<TopicItem[]>([]);
  const [isDiscoveringTopics, setIsDiscoveringTopics] = useState<boolean>(false);
  const [topicPrompt, setTopicPrompt] = useState<string>('');

  // Active Shorts state
  const [shorts, setShorts] = useState<ViralShortItem[]>([]);
  const [targetCount, setTargetCount] = useState<number>(5);
  const [customGoal, setCustomGoal] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [refiningId, setRefiningId] = useState<string | null>(null);
  const [refineInstructions, setRefineInstructions] = useState<{ [key: string]: string }>({});
  const [createdSequences, setCreatedSequences] = useState<{ [key: string]: string }>({});
  const [isBatchCreating, setIsBatchCreating] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Alternative Hooks & CTAs state
  const [expandedHooksId, setExpandedHooksId] = useState<string | null>(null);
  const [expandedCtasId, setExpandedCtasId] = useState<string | null>(null);
  const [loadingAlternatives, setLoadingAlternatives] = useState<{ [key: string]: boolean }>({});

  // Client Script Matcher state
  const [clientScriptInput, setClientScriptInput] = useState<string>('');
  const [matchedClientShort, setMatchedClientShort] = useState<ViralShortItem | null>(null);
  const [isMatchingScript, setIsMatchingScript] = useState<boolean>(false);

  // Auto-discover topics on first load if transcript exists
  useEffect(() => {
    if (transcriptWords.length > 0 && topics.length === 0) {
      handleDiscoverTopics();
    }
  }, [transcriptWords.length]);

  // Discover High-Potential Topics
  const handleDiscoverTopics = async (promptOverride?: string) => {
    if (transcriptWords.length === 0) {
      setStatusMessage(language === 'bn' ? 'অনুগ্রহ করে প্রথমে টেক্সট প্যানেলে সিকোয়েন্স ট্রান্সক্রাইব করুন।' : 'Please transcribe sequence in Text Panel first.');
      return;
    }
    setIsDiscoveringTopics(true);
    setStatusMessage(language === 'bn' ? 'AI ভিডিও বিশ্লেষণ করে সেরা টপিক ও সারমর্ম বের করছে...' : 'AI Discovering viral topics & summaries...');
    try {
      const res = await client.discoverShortTopics(
        transcriptWords,
        transcriptSentences,
        6,
        promptOverride || topicPrompt || undefined
      );
      if (res && res.length > 0) {
        setTopics(res);
        setStatusMessage(
          language === 'bn'
            ? `${res.length} টি দুর্দান্ত টপিক খুঁজে পাওয়া গেছে! আপনার পছন্দমতো টপিক সিলেক্ট করুন।`
            : `Discovered ${res.length} potential topics! Select any to build short.`
        );
      } else {
        setStatusMessage(language === 'bn' ? 'কোনো টপিক পাওয়া যায়নি।' : 'No topics found.');
      }
    } catch (err) {
      console.error('discoverShortTopics error:', err);
      setStatusMessage(language === 'bn' ? 'টপিক বের করতে সমস্যা হয়েছে।' : 'Failed to discover topics.');
    } finally {
      setIsDiscoveringTopics(false);
      setTimeout(() => setStatusMessage(null), 4000);
    }
  };

  // Convert a selected topic into an active Short
  const handleSelectTopicToShort = async (topic: TopicItem) => {
    setIsGenerating(true);
    setStatusMessage(language === 'bn' ? `"${topic.topicTitle}" থেকে হুক, বডি ও সিটিএ তৈরি হচ্ছে...` : `Building 3-part short for "${topic.topicTitle}"...`);
    try {
      const res = await client.generateViralShorts(
        transcriptWords,
        transcriptSentences,
        1,
        `Topic: ${topic.topicTitle}. Key details: ${topic.topicSummaryBn}. Focus between ${topic.startSeconds}s and ${topic.endSeconds}s`,
        fps
      );
      if (res && res.length > 0) {
        const newShort = res[0];
        setShorts(prev => [newShort, ...prev.filter(s => s.id !== newShort.id)]);
        setSubTab('STUDIO');
        setStatusMessage(
          language === 'bn'
            ? `"${topic.topicTitle}" শর্টস স্টুডিওতে যুক্ত হয়েছে!`
            : `Added "${topic.topicTitle}" to Shorts Studio!`
        );
      }
    } finally {
      setIsGenerating(false);
      setTimeout(() => setStatusMessage(null), 4000);
    }
  };

  // Batch generate all shorts from custom prompt
  const handleGenerateAllShorts = async () => {
    if (transcriptWords.length === 0) return;
    setIsGenerating(true);
    setStatusMessage(language === 'bn' ? 'AI ভাইরাল হুক, বডি ও সিটিএ তৈরি করছে...' : 'AI Generating viral shorts...');
    try {
      const res = await client.generateViralShorts(
        transcriptWords,
        transcriptSentences,
        targetCount,
        customGoal || undefined,
        fps
      );
      if (res && res.length > 0) {
        setShorts(res);
        setSubTab('STUDIO');
        setStatusMessage(
          language === 'bn'
            ? `${res.length} টি সুসংগঠিত শর্টস তৈরি হয়েছে!`
            : `Generated ${res.length} structured viral shorts!`
        );
      }
    } finally {
      setIsGenerating(false);
      setTimeout(() => setStatusMessage(null), 4000);
    }
  };

  // Fetch 5 Alternative Hooks for a short
  const handleFetchAlternativeHooks = async (item: ViralShortItem) => {
    if (expandedHooksId === item.id) {
      setExpandedHooksId(null);
      return;
    }
    setExpandedHooksId(item.id);
    if (item.alternativeHooks && item.alternativeHooks.length > 0) return;

    setLoadingAlternatives(prev => ({ ...prev, [`hook_${item.id}`]: true }));
    try {
      const hooks = await client.getAlternativeHooks(item, transcriptWords, transcriptSentences);
      if (hooks && hooks.length > 0) {
        setShorts(prev => prev.map(s => s.id === item.id ? { ...s, alternativeHooks: hooks } : s));
      }
    } finally {
      setLoadingAlternatives(prev => ({ ...prev, [`hook_${item.id}`]: false }));
    }
  };

  // Apply an alternative hook
  const handleApplyAlternativeHook = (shortId: string, opt: AlternativeOption) => {
    setShorts(prev => prev.map(s => {
      if (s.id !== shortId) return s;
      const updatedHook: ShortBlock = {
        text: opt.text,
        startSeconds: opt.startSeconds,
        endSeconds: opt.endSeconds,
        durationSeconds: opt.durationSeconds || (opt.endSeconds - opt.startSeconds)
      };

      const segs = s.segments ? s.segments.map(sg => sg.role === 'HOOK' ? { ...sg, text: opt.text, startSeconds: opt.startSeconds, endSeconds: opt.endSeconds } : sg) : undefined;

      return {
        ...s,
        hook: updatedHook,
        segments: segs
      };
    }));
    setExpandedHooksId(null);
    setStatusMessage(language === 'bn' ? 'বিকল্প হুক সফলভাবে প্রয়োগ করা হয়েছে!' : 'Alternative hook applied!');
    setTimeout(() => setStatusMessage(null), 3000);
  };

  // Fetch 3-5 Alternative CTAs for a short
  const handleFetchAlternativeCtas = async (item: ViralShortItem) => {
    if (expandedCtasId === item.id) {
      setExpandedCtasId(null);
      return;
    }
    setExpandedCtasId(item.id);
    if (item.alternativeCtas && item.alternativeCtas.length > 0) return;

    setLoadingAlternatives(prev => ({ ...prev, [`cta_${item.id}`]: true }));
    try {
      const ctas = await client.getAlternativeCtas(item, transcriptWords, transcriptSentences);
      if (ctas && ctas.length > 0) {
        setShorts(prev => prev.map(s => s.id === item.id ? { ...s, alternativeCtas: ctas } : s));
      }
    } finally {
      setLoadingAlternatives(prev => ({ ...prev, [`cta_${item.id}`]: false }));
    }
  };

  // Apply an alternative CTA
  const handleApplyAlternativeCta = (shortId: string, opt: AlternativeOption) => {
    setShorts(prev => prev.map(s => {
      if (s.id !== shortId) return s;
      const updatedCta: ShortBlock = {
        text: opt.text,
        startSeconds: opt.startSeconds,
        endSeconds: opt.endSeconds,
        durationSeconds: opt.durationSeconds || (opt.endSeconds - opt.startSeconds)
      };

      const segs = s.segments ? s.segments.map(sg => sg.role === 'CTA' ? { ...sg, text: opt.text, startSeconds: opt.startSeconds, endSeconds: opt.endSeconds } : sg) : undefined;

      return {
        ...s,
        cta: updatedCta,
        segments: segs
      };
    }));
    setExpandedCtasId(null);
    setStatusMessage(language === 'bn' ? 'বিকল্প সিটিএ সফলভাবে প্রয়োগ করা হয়েছে!' : 'Alternative CTA applied!');
    setTimeout(() => setStatusMessage(null), 3000);
  };

  // Client Script Matcher: Conform client script to timeline
  const handleMatchClientScript = async () => {
    if (!clientScriptInput.trim()) return;
    setIsMatchingScript(true);
    setStatusMessage(language === 'bn' ? 'ভিডিও থেকে ক্লায়েন্টের ডায়ালগ খোঁজা হচ্ছে...' : 'Matching client script to spoken dialogue...');
    try {
      const matched = await client.matchClientScript(
        clientScriptInput,
        transcriptWords,
        transcriptSentences,
        fps
      );
      if (matched && matched.segments && matched.segments.length > 0) {
        setMatchedClientShort(matched);
        setStatusMessage(
          language === 'bn'
            ? `স্ক্রিপ্ট সফলভাবে ম্যাচ হয়েছে (${matched.segments.length} টি ক্লিপ টাইমলাইনে চিহ্নিত)!`
            : `Matched ${matched.segments.length} clips on timeline from script!`
        );
      } else {
        setStatusMessage(language === 'bn' ? 'স্ক্রিপ্টের সাথে ডায়ালগ মেলানো সম্ভব হয়নি।' : 'Could not match dialogue.');
      }
    } finally {
      setIsMatchingScript(false);
      setTimeout(() => setStatusMessage(null), 5000);
    }
  };

  // Helper to extract segments from a short item
  const extractShortSegments = (item: ViralShortItem): Array<{ role: string; startSeconds: number; endSeconds: number }> => {
    if (item.segments && item.segments.length > 0) {
      return item.segments.map(s => ({
        role: s.role,
        startSeconds: Number(s.startSeconds) || 0,
        endSeconds: Number(s.endSeconds) || 0
      }));
    }

    const segs: Array<{ role: string; startSeconds: number; endSeconds: number }> = [];
    if (typeof item.hook === 'object' && item.hook.startSeconds !== undefined) {
      segs.push({ role: 'HOOK', startSeconds: item.hook.startSeconds, endSeconds: item.hook.endSeconds });
    }
    if (item.body && item.body.startSeconds !== undefined) {
      segs.push({ role: 'BODY', startSeconds: item.body.startSeconds, endSeconds: item.body.endSeconds });
    }
    if (item.cta && item.cta.startSeconds !== undefined) {
      segs.push({ role: 'CTA', startSeconds: item.cta.startSeconds, endSeconds: item.cta.endSeconds });
    }

    if (segs.length === 0) {
      segs.push({ role: 'SHORT', startSeconds: item.startSeconds, endSeconds: item.endSeconds });
    }
    return segs;
  };

  // Create 9:16 Sequence in Premiere Pro
  const handleCreateSequence = async (item: ViralShortItem) => {
    setStatusMessage(language === 'bn' ? `৯:১৬ সিকোয়েন্স তৈরি হচ্ছে (${item.title})...` : `Building 9:16 Sequence (${item.title})...`);
    try {
      const segments = extractShortSegments(item);
      const res = await hostBridge.createMultiSegmentVerticalShortSequence(
        item.title,
        segments,
        item.markers
      );
      if (res.success && res.sequenceName) {
        setCreatedSequences(prev => ({ ...prev, [item.id]: res.sequenceName! }));
        setStatusMessage(
          language === 'bn'
            ? `নতুন ৯:১৬ সিকোয়েন্স তৈরি হয়েছে: ${res.sequenceName} (${res.segmentCount || segments.length}টি ক্লিপ স্প্লাইসড)`
            : `Created 9:16 Sequence: ${res.sequenceName} (${res.segmentCount || segments.length} clips spliced)`
        );
      } else {
        setStatusMessage(res.error || 'Failed to create sequence');
      }
    } catch (e: any) {
      setStatusMessage(String(e));
    }
    setTimeout(() => setStatusMessage(null), 5000);
  };

  // Interactive AI Refine
  const handleRefineShort = async (item: ViralShortItem) => {
    const instruction = refineInstructions[item.id];
    if (!instruction || !instruction.trim()) return;

    setRefiningId(item.id);
    setStatusMessage(language === 'bn' ? 'AI শর্টটি সংশোধন করছে...' : 'AI Refining short...');
    try {
      const refined = await client.refineViralShort(item, instruction, transcriptWords, fps);
      if (refined) {
        setShorts(prev => prev.map(s => s.id === item.id ? { ...s, ...refined } : s));
        setRefineInstructions(prev => ({ ...prev, [item.id]: '' }));
        setStatusMessage(language === 'bn' ? 'শর্টটি সফলভাবে আপডেট হয়েছে!' : 'Short updated successfully!');
      }
    } finally {
      setRefiningId(null);
      setTimeout(() => setStatusMessage(null), 3000);
    }
  };

  // Copy Full Script
  const handleCopyScript = (item: ViralShortItem) => {
    let script = item.scriptText || '';
    if (!script) {
      const hookText = typeof item.hook === 'string' ? item.hook : item.hook?.text || '';
      const bodyText = item.body?.text || '';
      const ctaText = item.cta?.text || '';
      script = `🎯 HOOK:\n"${hookText}"\n\n📖 BODY:\n"${bodyText}"\n\n📢 CTA:\n"${ctaText}"`;
    }

    navigator.clipboard.writeText(script);
    setCopiedId(item.id);
    setStatusMessage(language === 'bn' ? 'সম্পূর্ণ স্ক্রিপ্ট ক্লিপবোর্ডে কপি হয়েছে!' : 'Full script copied to clipboard!');
    setTimeout(() => {
      setCopiedId(null);
      setStatusMessage(null);
    }, 3000);
  };

  // Update Block text directly
  const handleUpdateBlock = (shortId: string, role: 'hook' | 'body' | 'cta', field: 'text' | 'startSeconds' | 'endSeconds', value: any) => {
    setShorts(prev => prev.map(s => {
      if (s.id !== shortId) return s;
      const currentBlock = (s as any)[role] || { text: '', startSeconds: 0, endSeconds: 0 };
      const updatedBlock = typeof currentBlock === 'string'
        ? { text: field === 'text' ? value : currentBlock, startSeconds: s.startSeconds, endSeconds: s.endSeconds }
        : { ...currentBlock, [field]: value };

      return {
        ...s,
        [role]: updatedBlock
      };
    }));
  };

  return (
    <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', height: '100%', overflow: 'hidden', minHeight: 0 }}>
      {/* Header & Status Alert */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px', flexShrink: 0 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Flame size={15} color="#f97316" />
            <h2 style={{ fontSize: '13px', fontWeight: 600 }}>
              {language === 'bn' ? 'AI ভাইরাল শর্টস ও রিলস মেকার (৯:১৬)' : 'AI Viral Shorts & Reels Creator (9:16)'}
            </h2>
            <span
              style={{
                fontSize: '9.5px',
                padding: '2px 6px',
                borderRadius: '3px',
                backgroundColor: 'rgba(249, 115, 22, 0.15)',
                color: '#fb923c',
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
                fontWeight: 600
              }}
            >
              ১০৮০x১৯২০ Vertical
            </span>
          </div>
          <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
            {language === 'bn'
              ? 'এআই টপিক সাজেশন, বিকল্প হুক/সিটিএ জেনারেটর এবং ক্লায়েন্ট স্ক্রিপ্ট ম্যাচিং'
              : 'AI Topic Discovery, 5x Hook/CTA Alternatives, and Client Script Conforming'}
          </span>
        </div>

        {statusMessage && (
          <span style={{ fontSize: '10px', color: '#fb923c', fontWeight: 600, backgroundColor: 'rgba(249, 115, 22, 0.15)', padding: '3px 8px', borderRadius: '4px' }}>
            {statusMessage}
          </span>
        )}
      </div>

      {/* Sub-Nav Bar (3 Modes: Topics, Shorts Studio, Client Script) */}
      <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px', flexShrink: 0 }}>
        <button
          onClick={() => setSubTab('TOPICS')}
          style={{
            padding: '5px 10px',
            fontSize: '11px',
            borderRadius: '4px',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: subTab === 'TOPICS' ? '#ea580c' : 'var(--bg-tertiary)',
            color: subTab === 'TOPICS' ? '#ffffff' : 'var(--text-secondary)',
            fontWeight: subTab === 'TOPICS' ? 600 : 400,
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          <Lightbulb size={12} />
          <span>{language === 'bn' ? `টপিক সাজেশন (${topics.length})` : `Topic Ideas (${topics.length})`}</span>
        </button>

        <button
          onClick={() => setSubTab('STUDIO')}
          style={{
            padding: '5px 10px',
            fontSize: '11px',
            borderRadius: '4px',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: subTab === 'STUDIO' ? '#ea580c' : 'var(--bg-tertiary)',
            color: subTab === 'STUDIO' ? '#ffffff' : 'var(--text-secondary)',
            fontWeight: subTab === 'STUDIO' ? 600 : 400,
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          <Flame size={12} />
          <span>{language === 'bn' ? `শর্টস স্টুডিও (${shorts.length})` : `Shorts Studio (${shorts.length})`}</span>
        </button>

        <button
          onClick={() => setSubTab('CLIENT_SCRIPT')}
          style={{
            padding: '5px 10px',
            fontSize: '11px',
            borderRadius: '4px',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: subTab === 'CLIENT_SCRIPT' ? '#ea580c' : 'var(--bg-tertiary)',
            color: subTab === 'CLIENT_SCRIPT' ? '#ffffff' : 'var(--text-secondary)',
            fontWeight: subTab === 'CLIENT_SCRIPT' ? 600 : 400,
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          <FileText size={12} />
          <span>{language === 'bn' ? 'ক্লায়েন্ট স্ক্রিপ্ট টু সিকোয়েন্স' : 'Client Script to Sequence'}</span>
        </button>
      </div>

      {/* ===================== VIEW 1: TOPIC SUGGESTIONS ===================== */}
      {subTab === 'TOPICS' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', overflow: 'hidden', minHeight: 0 }}>
          {/* Topic Finder Control */}
          <div className="card" style={{ padding: '8px 10px', display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
            <input
              type="text"
              placeholder={language === 'bn' ? 'টপিকের ফোকাস দিন (যেমন: ক্যালিফোর্নিয়া ছাড়ার গল্প, বাড়িভাড়ার সমস্যা)...' : 'Focus topic direction (e.g., why we moved, cost differences)...'}
              value={topicPrompt}
              onChange={(e) => setTopicPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleDiscoverTopics();
              }}
              style={{
                flex: 1,
                backgroundColor: 'var(--bg-tertiary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '4px',
                color: 'var(--text-primary)',
                fontSize: '11px',
                padding: '5px 8px',
                outline: 'none',
                fontFamily: language === 'bn' ? 'var(--font-family-bn)' : 'inherit'
              }}
            />
            <button
              onClick={() => handleDiscoverTopics()}
              disabled={isDiscoveringTopics || transcriptWords.length === 0}
              className="btn-primary"
              style={{
                padding: '5px 12px',
                fontSize: '11px',
                backgroundColor: '#ea580c',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer'
              }}
            >
              <Sparkles size={12} />
              <span>{isDiscoveringTopics ? (language === 'bn' ? 'টপিক খোঁজা হচ্ছে...' : 'Discovering...') : (language === 'bn' ? 'টপিক বের করুন' : 'Find Topics')}</span>
            </button>
          </div>

          {/* Topics List Container */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px', minHeight: 0 }}>
            {topics.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '11px' }}>
                {transcriptWords.length === 0
                  ? (language === 'bn' ? 'কোনো ট্রান্সক্রিপ্ট নেই। প্রথমে টেক্সট প্যানেলে সিকোয়েন্স ট্রান্সক্রাইব করুন।' : 'No transcript found. Please transcribe sequence in Text Panel first.')
                  : (language === 'bn' ? 'উপরে "টপিক বের করুন" বাটনে ক্লিক করুন।' : 'Click "Find Topics" above to discover viral ideas.')}
              </div>
            ) : (
              topics.map((topic, tIdx) => (
                <div
                  key={topic.id}
                  className="card"
                  style={{
                    padding: '10px 12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    borderColor: 'rgba(249, 115, 22, 0.25)',
                    borderRadius: '6px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#fb923c' }}>
                        #{tIdx + 1}
                      </span>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#ffffff' }}>
                        {topic.topicTitle}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '9.5px', color: '#fb923c', backgroundColor: 'rgba(249, 115, 22, 0.15)', padding: '1px 6px', borderRadius: '3px', fontWeight: 700 }}>
                        🔥 {topic.viralityScore}% পটেনশিয়াল
                      </span>
                      <span style={{ fontSize: '9.5px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                        ~{topic.estimatedDurationSeconds}s
                      </span>
                    </div>
                  </div>

                  {/* Bengali Summary */}
                  <div
                    style={{
                      fontSize: '11px',
                      color: '#93c5fd',
                      backgroundColor: 'rgba(59, 130, 246, 0.08)',
                      padding: '6px 8px',
                      borderRadius: '4px',
                      border: '1px solid rgba(59, 130, 246, 0.2)',
                      lineHeight: '1.4'
                    }}
                  >
                    <span style={{ fontWeight: 600, color: '#60a5fa' }}>💡 সারমর্ম: </span>
                    {topic.topicSummaryBn}
                  </div>

                  {/* Key Points */}
                  {topic.keyPoints && topic.keyPoints.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', paddingLeft: '4px' }}>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>
                        {language === 'bn' ? 'আলোচিত মূল পয়েন্টসমূহ:' : 'Key Points Discussed:'}
                      </span>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {topic.keyPoints.map((kp, kIdx) => (
                          <span
                            key={`kp_${kIdx}`}
                            style={{
                              fontSize: '9.5px',
                              backgroundColor: 'rgba(255, 255, 255, 0.05)',
                              padding: '2px 6px',
                              borderRadius: '3px',
                              color: 'var(--text-primary)',
                              border: '1px solid var(--border-subtle)'
                            }}
                          >
                            • {kp}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions Bar */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px', paddingTop: '4px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <button
                      onClick={() => hostBridge.setPlayheadPosition(topic.startSeconds)}
                      className="btn-secondary"
                      style={{ padding: '3px 8px', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '3px' }}
                    >
                      <Play size={10} />
                      <span>{language === 'bn' ? 'ভিডিওতে শুনুন' : 'Seek Timeline'}</span>
                    </button>

                    <button
                      onClick={() => handleSelectTopicToShort(topic)}
                      disabled={isGenerating}
                      className="btn-primary"
                      style={{
                        padding: '4px 10px',
                        fontSize: '10.5px',
                        fontWeight: 600,
                        backgroundColor: '#ea580c',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <CheckCircle2 size={11} />
                      <span>{language === 'bn' ? '✓ এই টপিক দিয়ে শর্টস বানান' : '✓ Build Short from this Topic'}</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ===================== VIEW 2: ACTIVE SHORTS STUDIO ===================== */}
      {subTab === 'STUDIO' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', overflow: 'hidden', minHeight: 0 }}>
          {/* Top Control Bar */}
          <div className="card" style={{ padding: '8px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                {language === 'bn' ? 'শর্টস সংখ্যা:' : 'Shorts Count:'}
              </span>
              {[3, 5, 8].map(cnt => (
                <button
                  key={`cnt_${cnt}`}
                  onClick={() => setTargetCount(cnt)}
                  style={{
                    padding: '2px 8px',
                    fontSize: '9.5px',
                    borderRadius: '4px',
                    border: 'none',
                    cursor: 'pointer',
                    backgroundColor: targetCount === cnt ? '#ea580c' : 'var(--bg-tertiary)',
                    color: targetCount === cnt ? '#fff' : 'var(--text-secondary)',
                    fontWeight: targetCount === cnt ? 600 : 400
                  }}
                >
                  {cnt} {language === 'bn' ? 'টি' : ''}
                </button>
              ))}
              <button
                onClick={handleGenerateAllShorts}
                disabled={isGenerating || transcriptWords.length === 0}
                className="btn-secondary"
                style={{ padding: '2px 8px', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '3px' }}
              >
                <Sparkles size={10} />
                <span>{language === 'bn' ? 'পুনরায় তৈরি' : 'Re-generate'}</span>
              </button>
            </div>

            {shorts.length > 0 && (
              <span style={{ fontSize: '10px', color: '#fb923c', fontWeight: 600 }}>
                {shorts.length} {language === 'bn' ? 'টি শর্টস রেডি' : 'Shorts Ready'}
              </span>
            )}
          </div>

          {/* Shorts Cards Container */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px', minHeight: 0 }}>
            {shorts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '11px' }}>
                {language === 'bn'
                  ? 'কোনো শর্টস তৈরি করা নেই। বামপাশের "টপিক সাজেশন" থেকে টপিক সিলেক্ট করুন অথবা উপরে "পুনরায় তৈরি" বাটনে ক্লিক করুন।'
                  : 'No shorts built yet. Select a topic from the Topic Ideas tab or click Re-generate above.'}
              </div>
            ) : (
              shorts.map((item, idx) => {
                const isCreated = !!createdSequences[item.id];
                const isCopied = copiedId === item.id;

                const hookObj: ShortBlock = typeof item.hook === 'string'
                  ? { text: item.hook, startSeconds: item.startSeconds, endSeconds: item.startSeconds + 5 }
                  : item.hook || { text: '', startSeconds: item.startSeconds, endSeconds: item.startSeconds + 5 };

                const bodyObj: ShortBlock = item.body || {
                  text: '',
                  startSeconds: hookObj.endSeconds,
                  endSeconds: item.endSeconds - 5
                };

                const ctaObj: ShortBlock = item.cta || {
                  text: '',
                  startSeconds: Math.max(hookObj.endSeconds, item.endSeconds - 5),
                  endSeconds: item.endSeconds
                };

                const totalDur = item.totalDurationSeconds || item.durationSeconds;
                const isHookExpanded = expandedHooksId === item.id;
                const isCtaExpanded = expandedCtasId === item.id;

                return (
                  <div
                    key={item.id}
                    className="card"
                    style={{
                      padding: '10px 12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      backgroundColor: 'rgba(255, 255, 255, 0.03)',
                      borderColor: isCreated ? 'rgba(52, 211, 153, 0.4)' : 'rgba(249, 115, 22, 0.3)',
                      borderRadius: '6px'
                    }}
                  >
                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#fb923c' }}>
                          #{idx + 1}
                        </span>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#ffffff' }}>
                          {item.title}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '9.5px', padding: '1px 6px', borderRadius: '3px', backgroundColor: 'rgba(249, 115, 22, 0.15)', color: '#fb923c', fontWeight: 700 }}>
                          🔥 {item.viralityScore}%
                        </span>
                        <span style={{ fontSize: '9.5px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                          [{totalDur}s]
                        </span>
                        <button
                          onClick={() => handleCopyScript(item)}
                          style={{
                            padding: '2px 8px',
                            fontSize: '9.5px',
                            backgroundColor: isCopied ? '#059669' : 'rgba(255,255,255,0.08)',
                            color: isCopied ? '#fff' : 'var(--text-primary)',
                            border: '1px solid rgba(255,255,255,0.15)',
                            borderRadius: '3px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px'
                          }}
                        >
                          {isCopied ? <Check size={10} /> : <Copy size={10} />}
                          <span>{isCopied ? (language === 'bn' ? 'কপি হয়েছে' : 'Copied!') : (language === 'bn' ? 'স্ক্রিপ্ট কপি' : 'Copy Script')}</span>
                        </button>
                      </div>
                    </div>

                    {/* Educational Lesson Badge */}
                    {item.educationalLesson && (
                      <div
                        style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          backgroundColor: 'rgba(59, 130, 246, 0.1)',
                          border: '1px solid rgba(59, 130, 246, 0.25)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '10.5px',
                          color: '#93c5fd'
                        }}
                      >
                        <BookOpen size={11} color="#60a5fa" />
                        <span style={{ fontWeight: 600 }}>{language === 'bn' ? 'শিক্ষণীয় উদ্দেশ্য:' : 'Key Lesson:'}</span>
                        <span>{item.educationalLesson}</span>
                      </div>
                    )}

                    {/* 3 CORE BLOCKS: HOOK, BODY, CTA */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {/* 1. HOOK BLOCK */}
                      <div style={{ padding: '6px 8px', borderRadius: '5px', backgroundColor: 'rgba(234, 179, 8, 0.08)', border: '1px solid rgba(234, 179, 8, 0.25)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#facc15', fontWeight: 600 }}>
                            <Flame size={11} />
                            <span>{language === 'bn' ? '১. হুক (০-৫ সে.):' : '1. Hook (0-5s):'}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <button
                              onClick={() => handleFetchAlternativeHooks(item)}
                              style={{
                                padding: '1px 6px',
                                fontSize: '9px',
                                backgroundColor: 'rgba(234, 179, 8, 0.2)',
                                color: '#facc15',
                                border: '1px solid rgba(234, 179, 8, 0.4)',
                                borderRadius: '3px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '3px'
                              }}
                              title="Generate 5 alternative hooks from dialogue"
                            >
                              <RefreshCw size={8} />
                              <span>{language === 'bn' ? 'বিকল্প ৫টি হুক দেখুন' : '5x Alternative Hooks'}</span>
                            </button>
                            <span style={{ fontFamily: 'monospace', fontSize: '9.5px', color: '#fef08a' }}>
                              [{TimecodeConverter.formatTimecode(hookObj.startSeconds, fps)}]
                            </span>
                            <button
                              onClick={() => hostBridge.setPlayheadPosition(hookObj.startSeconds)}
                              style={{ padding: '1px 5px', fontSize: '9px', backgroundColor: 'rgba(234, 179, 8, 0.2)', color: '#facc15', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
                            >
                              <Play size={8} />
                            </button>
                          </div>
                        </div>

                        <textarea
                          rows={2}
                          value={hookObj.text}
                          onChange={(e) => handleUpdateBlock(item.id, 'hook', 'text', e.target.value)}
                          style={{ backgroundColor: 'rgba(0,0,0,0.25)', border: '1px solid rgba(234, 179, 8, 0.3)', borderRadius: '3px', color: '#fef08a', fontSize: '11px', padding: '4px 6px', outline: 'none', resize: 'vertical', fontFamily: language === 'bn' ? 'var(--font-family-bn)' : 'inherit' }}
                        />

                        {/* Dropdown Alternative Hooks List */}
                        {isHookExpanded && (
                          <div style={{ marginTop: '4px', padding: '6px', backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: '4px', border: '1px solid rgba(234, 179, 8, 0.3)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span style={{ fontSize: '9.5px', color: '#facc15', fontWeight: 600 }}>
                              {language === 'bn' ? 'পছন্দমতো যেকোনো হুক সিলেক্ট করুন (১-ক্লিকে রিপ্লেস হবে):' : 'Select any hook to replace instantly:'}
                            </span>
                            {loadingAlternatives[`hook_${item.id}`] ? (
                              <div style={{ fontSize: '10px', color: '#fef08a', padding: '4px' }}>{language === 'bn' ? 'বিকল্প হুক খোঁজা হচ্ছে...' : 'Searching alternative hooks...'}</div>
                            ) : (
                              item.alternativeHooks?.map((alt, aIdx) => (
                                <div
                                  key={`h_alt_${aIdx}`}
                                  onClick={() => handleApplyAlternativeHook(item.id, alt)}
                                  style={{
                                    padding: '4px 6px',
                                    borderRadius: '3px',
                                    backgroundColor: 'rgba(255,255,255,0.05)',
                                    cursor: 'pointer',
                                    fontSize: '10px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '2px',
                                    border: '1px solid rgba(255,255,255,0.1)'
                                  }}
                                >
                                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#fbbf24', fontSize: '9px', fontWeight: 600 }}>
                                    <span>[{alt.label}]</span>
                                    <span>{TimecodeConverter.formatTimecode(alt.startSeconds, fps)}</span>
                                  </div>
                                  <span style={{ color: '#ffffff' }}>"{alt.text}"</span>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>

                      {/* 2. BODY BLOCK */}
                      <div style={{ padding: '6px 8px', borderRadius: '5px', backgroundColor: 'rgba(52, 211, 153, 0.08)', border: '1px solid rgba(52, 211, 153, 0.25)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#34d399', fontWeight: 600 }}>
                            <BookOpen size={11} />
                            <span>{language === 'bn' ? '২. মূল বডি / গল্প:' : '2. Body / Story:'}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ fontFamily: 'monospace', fontSize: '9.5px', color: '#a7f3d0' }}>
                              [{TimecodeConverter.formatTimecode(bodyObj.startSeconds, fps)}]
                            </span>
                            <button
                              onClick={() => hostBridge.setPlayheadPosition(bodyObj.startSeconds)}
                              style={{ padding: '1px 5px', fontSize: '9px', backgroundColor: 'rgba(52, 211, 153, 0.2)', color: '#34d399', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
                            >
                              <Play size={8} />
                            </button>
                          </div>
                        </div>

                        <textarea
                          rows={3}
                          value={bodyObj.text}
                          onChange={(e) => handleUpdateBlock(item.id, 'body', 'text', e.target.value)}
                          style={{ backgroundColor: 'rgba(0,0,0,0.25)', border: '1px solid rgba(52, 211, 153, 0.3)', borderRadius: '3px', color: '#ecfdf5', fontSize: '11px', padding: '4px 6px', outline: 'none', resize: 'vertical', fontFamily: language === 'bn' ? 'var(--font-family-bn)' : 'inherit' }}
                        />
                      </div>

                      {/* 3. CTA BLOCK */}
                      <div style={{ padding: '6px 8px', borderRadius: '5px', backgroundColor: 'rgba(168, 85, 247, 0.08)', border: '1px solid rgba(168, 85, 247, 0.25)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#c084fc', fontWeight: 600 }}>
                            <Megaphone size={11} />
                            <span>{language === 'bn' ? '৩. সিটিএ / সমাপ্তি:' : '3. CTA / Outro:'}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <button
                              onClick={() => handleFetchAlternativeCtas(item)}
                              style={{
                                padding: '1px 6px',
                                fontSize: '9px',
                                backgroundColor: 'rgba(168, 85, 247, 0.2)',
                                color: '#c084fc',
                                border: '1px solid rgba(168, 85, 247, 0.4)',
                                borderRadius: '3px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '3px'
                              }}
                              title="Generate 3-5 alternative CTAs"
                            >
                              <RefreshCw size={8} />
                              <span>{language === 'bn' ? 'বিকল্প সিটিএ দেখুন' : 'Alternative CTAs'}</span>
                            </button>
                            <span style={{ fontFamily: 'monospace', fontSize: '9.5px', color: '#e9d5ff' }}>
                              [{TimecodeConverter.formatTimecode(ctaObj.startSeconds, fps)}]
                            </span>
                            <button
                              onClick={() => hostBridge.setPlayheadPosition(ctaObj.startSeconds)}
                              style={{ padding: '1px 5px', fontSize: '9px', backgroundColor: 'rgba(168, 85, 247, 0.2)', color: '#c084fc', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
                            >
                              <Play size={8} />
                            </button>
                          </div>
                        </div>

                        <textarea
                          rows={2}
                          value={ctaObj.text}
                          onChange={(e) => handleUpdateBlock(item.id, 'cta', 'text', e.target.value)}
                          style={{ backgroundColor: 'rgba(0,0,0,0.25)', border: '1px solid rgba(168, 85, 247, 0.3)', borderRadius: '3px', color: '#fae8ff', fontSize: '11px', padding: '4px 6px', outline: 'none', resize: 'vertical', fontFamily: language === 'bn' ? 'var(--font-family-bn)' : 'inherit' }}
                        />

                        {/* Dropdown Alternative CTAs List */}
                        {isCtaExpanded && (
                          <div style={{ marginTop: '4px', padding: '6px', backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: '4px', border: '1px solid rgba(168, 85, 247, 0.3)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span style={{ fontSize: '9.5px', color: '#c084fc', fontWeight: 600 }}>
                              {language === 'bn' ? 'পছন্দমতো যেকোনো সিটিএ সিলেক্ট করুন:' : 'Select any CTA to replace:'}
                            </span>
                            {loadingAlternatives[`cta_${item.id}`] ? (
                              <div style={{ fontSize: '10px', color: '#fae8ff', padding: '4px' }}>{language === 'bn' ? 'বিকল্প সিটিএ খোঁজা হচ্ছে...' : 'Searching alternative CTAs...'}</div>
                            ) : (
                              item.alternativeCtas?.map((alt, cIdx) => (
                                <div
                                  key={`c_alt_${cIdx}`}
                                  onClick={() => handleApplyAlternativeCta(item.id, alt)}
                                  style={{
                                    padding: '4px 6px',
                                    borderRadius: '3px',
                                    backgroundColor: 'rgba(255,255,255,0.05)',
                                    cursor: 'pointer',
                                    fontSize: '10px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '2px',
                                    border: '1px solid rgba(255,255,255,0.1)'
                                  }}
                                >
                                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#d8b4fe', fontSize: '9px', fontWeight: 600 }}>
                                    <span>[{alt.label}]</span>
                                    <span>{TimecodeConverter.formatTimecode(alt.startSeconds, fps)}</span>
                                  </div>
                                  <span style={{ color: '#ffffff' }}>"{alt.text}"</span>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* AI Co-Pilot Refine Chat Bar */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                      <input
                        type="text"
                        placeholder={language === 'bn' ? 'এআই-কে বলুন (যেমন: হুক ও সিটিএর সাথে মিলিয়ে বডি আরও শার্প করো)...' : 'Ask AI (e.g. tighten body to match hook, 35s duration)...'}
                        value={refineInstructions[item.id] || ''}
                        onChange={(e) => setRefineInstructions(prev => ({ ...prev, [item.id]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRefineShort(item);
                        }}
                        style={{
                          flex: 1,
                          backgroundColor: 'var(--bg-tertiary)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: '3px',
                          color: 'var(--text-primary)',
                          fontSize: '10px',
                          padding: '3px 6px',
                          outline: 'none',
                          fontFamily: language === 'bn' ? 'var(--font-family-bn)' : 'inherit'
                        }}
                      />
                      <button
                        onClick={() => handleRefineShort(item)}
                        disabled={refiningId === item.id}
                        className="btn-secondary"
                        style={{ padding: '3px 7px', fontSize: '9.5px', display: 'flex', alignItems: 'center', gap: '2px' }}
                      >
                        <Send size={9} />
                        <span>{language === 'bn' ? 'সংশোধন' : 'Refine'}</span>
                      </button>
                    </div>

                    {/* Bottom Action Bar */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px', paddingTop: '6px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      <button
                        onClick={() => hostBridge.setPlayheadPosition(hookObj.startSeconds)}
                        className="btn-secondary"
                        style={{ padding: '3px 8px', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '3px' }}
                      >
                        <Play size={10} />
                        <span>{language === 'bn' ? 'শুরুর প্লেহেড' : 'Seek Start'}</span>
                      </button>

                      <button
                        onClick={() => handleCreateSequence(item)}
                        className="btn-primary"
                        style={{
                          padding: '5px 12px',
                          fontSize: '10.5px',
                          fontWeight: 600,
                          backgroundColor: isCreated ? '#059669' : '#ea580c',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        {isCreated ? <CheckCircle2 size={12} /> : <Scissors size={12} />}
                        <span>
                          {isCreated
                            ? (language === 'bn' ? 'সিকোয়েন্স তৈরি হয়েছে (পুনরায় তৈরি)' : 'Sequence Created (Re-create)')
                            : (language === 'bn' ? '১-ক্লিকে ৯:১৬ সিকোয়েন্স তৈরি করুন' : '1-Click Create 9:16 Sequence')}
                        </span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ===================== VIEW 3: CLIENT SCRIPT CONFORMER ===================== */}
      {subTab === 'CLIENT_SCRIPT' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', overflow: 'hidden', minHeight: 0 }}>
          <div className="card" style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#fb923c', fontWeight: 600, fontSize: '11px' }}>
              <FileText size={13} />
              <span>{language === 'bn' ? 'ক্লায়েন্টের দেওয়া কাস্টম স্ক্রিপ্ট পেস্ট করুন:' : 'Paste Client Custom Script:'}</span>
            </div>
            <textarea
              rows={4}
              placeholder={
                language === 'bn'
                  ? 'ক্লায়েন্ট যে ডায়ালগ বা স্ক্রিপ্ট দিয়েছে তা এখানে পেস্ট করুন। এআই পুরো ভিডিও স্ক্যান করে ঠিক কোন কোন সেকেন্ডে এই ডায়ালগগুলো বলা হয়েছে তা স্বয়ংক্রিয়ভাবে খুঁজে বের করবে...'
                  : 'Paste client script or dialogue paragraphs here. AI will scan the entire timeline and match exact spoken moments...'
              }
              value={clientScriptInput}
              onChange={(e) => setClientScriptInput(e.target.value)}
              style={{
                backgroundColor: 'var(--bg-tertiary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '4px',
                color: 'var(--text-primary)',
                fontSize: '11px',
                padding: '6px 8px',
                outline: 'none',
                resize: 'none',
                fontFamily: language === 'bn' ? 'var(--font-family-bn)' : 'inherit'
              }}
            />

            <button
              onClick={handleMatchClientScript}
              disabled={isMatchingScript || !clientScriptInput.trim() || transcriptWords.length === 0}
              className="btn-primary"
              style={{
                alignSelf: 'flex-end',
                padding: '5px 12px',
                fontSize: '11px',
                backgroundColor: '#ea580c',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer'
              }}
            >
              <Sparkles size={11} />
              <span>{isMatchingScript ? (language === 'bn' ? 'ডায়ালগ মেলানো হচ্ছে...' : 'Matching Dialogue...') : (language === 'bn' ? 'ভিডিওতে ডায়ালগ খুঁজুন ও শর্টস সাজান' : 'Match Dialogue & Conform')}</span>
            </button>
          </div>

          {/* Matched Result Card */}
          {matchedClientShort && (
            <div
              className="card"
              style={{
                padding: '10px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                backgroundColor: 'rgba(52, 211, 153, 0.04)',
                borderColor: 'rgba(52, 211, 153, 0.3)',
                borderRadius: '6px',
                flex: 1,
                overflowY: 'auto'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#34d399' }}>
                  ✓ {matchedClientShort.title}
                </span>
                <span style={{ fontSize: '10px', color: '#a7f3d0', fontFamily: 'monospace' }}>
                  মোট দৈর্ঘ্য: ~{matchedClientShort.totalDurationSeconds}s ({matchedClientShort.segments?.length} টি ক্লিপ)
                </span>
              </div>

              {/* Matched Segments Preview */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {matchedClientShort.segments?.map((seg, sIdx) => (
                  <div
                    key={`seg_${sIdx}`}
                    style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      backgroundColor: 'rgba(0,0,0,0.25)',
                      border: '1px solid rgba(52, 211, 153, 0.2)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px',
                      fontSize: '10.5px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#34d399', fontSize: '9px', fontWeight: 600 }}>
                      <span>{seg.role}</span>
                      <span>{TimecodeConverter.formatTimecode(seg.startSeconds, fps)} → {TimecodeConverter.formatTimecode(seg.endSeconds, fps)}</span>
                    </div>
                    <span style={{ color: '#ffffff' }}>"{seg.text}"</span>
                  </div>
                ))}
              </div>

              {/* 1-Click Create Sequence Button */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                <button
                  onClick={() => handleCreateSequence(matchedClientShort)}
                  className="btn-primary"
                  style={{
                    padding: '6px 14px',
                    fontSize: '11px',
                    fontWeight: 600,
                    backgroundColor: '#059669',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Scissors size={12} />
                  <span>{language === 'bn' ? '১-ক্লিকে ক্লায়েন্ট স্ক্রিপ্ট অনুযায়ী ৯:১৬ সিকোয়েন্স বানান' : 'Create 9:16 Sequence from Client Script'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
