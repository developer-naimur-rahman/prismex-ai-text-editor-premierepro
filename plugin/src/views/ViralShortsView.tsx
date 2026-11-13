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
  HelpCircle,
  Megaphone,
  Check,
  ChevronDown,
  ChevronUp
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

  // Auto-generate shorts on first load if transcript exists
  useEffect(() => {
    if (transcriptWords.length > 0 && shorts.length === 0) {
      handleGenerateShorts();
    }
  }, [transcriptWords.length]);

  const handleGenerateShorts = async () => {
    if (transcriptWords.length === 0) {
      setStatusMessage(language === 'bn' ? 'অনুগ্রহ করে প্রথমে টেক্সট প্যানেলে সিকোয়েন্স ট্রান্সক্রাইব করুন।' : 'Please transcribe sequence in Text Panel first.');
      return;
    }
    setIsGenerating(true);
    setStatusMessage(language === 'bn' ? 'AI ভাইরাল হুক, বডি ও শিক্ষণীয় সিটিএ বিশ্লেষণ করছে...' : 'AI Analyzing viral hooks, body & educational CTAs...');
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
        setStatusMessage(
          language === 'bn'
            ? `${res.length} টি সুসংগঠিত ভাইরাল শর্টস (হুক + বডি + সিটিএ) তৈরি হয়েছে!`
            : `Generated ${res.length} structured viral shorts (Hook + Body + CTA)!`
        );
      } else {
        setStatusMessage(language === 'bn' ? 'কোনো শর্ট তৈরি করা সম্ভব হয়নি।' : 'Could not generate shorts.');
      }
    } catch (err) {
      console.error('generateViralShorts error:', err);
      setStatusMessage(language === 'bn' ? 'জেনারেট করতে সমস্যা হয়েছে।' : 'Failed to generate shorts.');
    } finally {
      setIsGenerating(false);
      setTimeout(() => setStatusMessage(null), 4000);
    }
  };

  const handleRefineShort = async (item: ViralShortItem) => {
    const instruction = refineInstructions[item.id];
    if (!instruction || !instruction.trim()) return;

    setRefiningId(item.id);
    setStatusMessage(language === 'bn' ? 'AI শর্টটি অ্যাডজাস্ট করছে...' : 'AI Refining short...');
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

  // Helper to extract segments from a short item (Hook, Body, CTA)
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

  const handleCreateSingleSequence = async (item: ViralShortItem) => {
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
            ? `নতুন ৯:১৬ সিকোয়েন্স তৈরি হয়েছে: ${res.sequenceName} (${res.segmentCount || segments.length}টি সেগমেন্ট স্প্লাইসড)`
            : `Created 9:16 Sequence: ${res.sequenceName} (${res.segmentCount || segments.length} segments spliced)`
        );
      } else {
        setStatusMessage(res.error || 'Failed to create sequence');
      }
    } catch (e: any) {
      setStatusMessage(String(e));
    }
    setTimeout(() => setStatusMessage(null), 5000);
  };

  const handleBatchCreateAll = async () => {
    if (shorts.length === 0) return;
    setIsBatchCreating(true);
    setStatusMessage(language === 'bn' ? 'সবগুলো ৯:১৬ সিকোয়েন্স তৈরি হচ্ছে...' : 'Batch creating 9:16 sequences in Premiere Pro...');
    try {
      for (const item of shorts) {
        const segments = extractShortSegments(item);
        await hostBridge.createMultiSegmentVerticalShortSequence(
          item.title,
          segments,
          item.markers
        );
      }
      setStatusMessage(
        language === 'bn'
          ? `সবগুলো (${shorts.length} টি) ৯:১৬ সিকোয়েন্স প্রজেক্টের "_Prismex_Viral_Shorts" ফোল্ডারে যোগ হয়েছে!`
          : `All ${shorts.length} vertical sequences created in "_Prismex_Viral_Shorts" bin!`
      );
    } finally {
      setIsBatchCreating(false);
      setTimeout(() => setStatusMessage(null), 6000);
    }
  };

  const handleCopyScript = (item: ViralShortItem) => {
    let script = item.scriptText || '';
    if (!script) {
      const hookText = typeof item.hook === 'string' ? item.hook : item.hook?.text || '';
      const bodyText = item.body?.text || '';
      const ctaText = item.cta?.text || '';
      script = `🎯 HOOK (০-৫ সেকেন্ড):\n"${hookText}"\n\n📖 BODY / STORY:\n"${bodyText}"\n\n📢 CTA / TAKEAWAY:\n"${ctaText}"`;
    }

    navigator.clipboard.writeText(script);
    setCopiedId(item.id);
    setStatusMessage(language === 'bn' ? 'সম্পূর্ণ স্ক্রিপ্ট ক্লিপবোর্ডে কপি হয়েছে!' : 'Full script copied to clipboard!');
    setTimeout(() => {
      setCopiedId(null);
      setStatusMessage(null);
    }, 3000);
  };

  // Update a specific block's text or timecodes
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
              ? '৩-পার্ট ভাইরাল ব্লুপ্রিন্ট (🎯 হুক + 📖 শিক্ষণীয় বডি + 📢 সিটিএ) এবং ভিন্ন ভিন্ন অংশ থেকে অটো-স্প্লাইসিং'
              : '3-Part Viral Blueprint (🎯 Hook + 📖 Educational Body + 📢 CTA) with non-linear multi-segment splicing'}
          </span>
        </div>

        {statusMessage && (
          <span style={{ fontSize: '10px', color: '#fb923c', fontWeight: 600, backgroundColor: 'rgba(249, 115, 22, 0.15)', padding: '3px 8px', borderRadius: '4px' }}>
            {statusMessage}
          </span>
        )}
      </div>

      {/* AI Guidance & Target Selector Card */}
      <div className="card" style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
              {language === 'bn' ? 'শর্টস সংখ্যা:' : 'Shorts Count:'}
            </span>
            {[3, 5, 8, 10].map(cnt => (
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
          </div>

          {shorts.length > 0 && (
            <button
              onClick={handleBatchCreateAll}
              disabled={isBatchCreating}
              className="btn-primary"
              style={{
                padding: '4px 10px',
                fontSize: '10px',
                backgroundColor: '#ea580c',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer'
              }}
              title={language === 'bn' ? 'সবগুলো শর্টস এক ক্লিকে আলাদা ৯:১৬ সিকোয়েন্সে রূপান্তর করুন' : 'Batch create all vertical sequences in Premiere Pro'}
            >
              <FolderPlus size={11} />
              <span>{language === 'bn' ? `সবগুলো (${shorts.length}) সিকোয়েন্স তৈরি করুন` : `Batch Create All (${shorts.length})`}</span>
            </button>
          )}
        </div>

        {/* Custom Goal Prompt Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
          <input
            type="text"
            placeholder={
              language === 'bn'
                ? 'এআই-কে নির্দিষ্ট নির্দেশনা দিন (যেমন: শিক্ষণীয় পয়েন্টসহ ১ মিনিটের মধ্যে ক্যালিফোর্নিয়ার খরচ নিয়ে শর্টস দাও)...'
                : 'Specific AI instruction (e.g., educational lesson under 60s, focus on why we left, high energy)...'
            }
            value={customGoal}
            onChange={(e) => setCustomGoal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleGenerateShorts();
            }}
            style={{
              flex: 1,
              backgroundColor: 'var(--bg-tertiary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '4px',
              color: 'var(--text-primary)',
              fontSize: '10.5px',
              padding: '5px 8px',
              outline: 'none',
              fontFamily: language === 'bn' ? 'var(--font-family-bn)' : 'inherit'
            }}
          />
          <button
            onClick={handleGenerateShorts}
            disabled={isGenerating || transcriptWords.length === 0}
            className="btn-primary"
            style={{
              padding: '5px 10px',
              fontSize: '10.5px',
              backgroundColor: '#ea580c',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              cursor: 'pointer'
            }}
          >
            <Sparkles size={11} />
            <span>{isGenerating ? (language === 'bn' ? 'বিশ্লেষণ হচ্ছে...' : 'Analyzing...') : (language === 'bn' ? 'শর্টস বের করুন' : 'Find Shorts')}</span>
          </button>
        </div>
      </div>

      {/* Shorts Candidate List */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          paddingRight: '4px'
        }}
      >
        {shorts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '11px' }}>
            {transcriptWords.length === 0
              ? (language === 'bn' ? 'কোনো ট্রান্সক্রিপ্ট পাওয়া যায়নি। অনুগ্রহ করে প্রথমে ১ নম্বর ট্যাবে সিকোয়েন্স ট্রান্সক্রাইব করুন।' : 'No transcript found. Please transcribe sequence in Tab 1 first.')
              : (language === 'bn' ? 'শর্টস জেনারেট করতে উপরের "শর্টস বের করুন" বাটনে ক্লিক করুন।' : 'Click "Find Shorts" above to extract viral vertical moments.')}
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

            return (
              <div
                key={item.id}
                className="card"
                style={{
                  flexShrink: 0,
                  minHeight: 'fit-content',
                  padding: '10px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  borderColor: isCreated ? 'rgba(52, 211, 153, 0.4)' : 'rgba(249, 115, 22, 0.3)',
                  borderRadius: '6px'
                }}
              >
                {/* Short Card Header */}
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
                    <span
                      style={{
                        fontSize: '9.5px',
                        padding: '1px 6px',
                        borderRadius: '3px',
                        backgroundColor: 'rgba(249, 115, 22, 0.15)',
                        color: '#fb923c',
                        fontWeight: 700
                      }}
                    >
                      🔥 {item.viralityScore}% Virality
                    </span>
                    <span style={{ fontSize: '9.5px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                      [মোট সময়: {totalDur}s]
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
                      title={language === 'bn' ? 'সম্পূর্ণ স্ক্রিপ্ট কপি করুন' : 'Copy Full Script'}
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

                {/* 3 DISTINCT CORE BLOCKS: 1. HOOK, 2. BODY, 3. CTA */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {/* Block 1: 🎯 Hook */}
                  <div
                    style={{
                      padding: '6px 8px',
                      borderRadius: '5px',
                      backgroundColor: 'rgba(234, 179, 8, 0.08)',
                      border: '1px solid rgba(234, 179, 8, 0.25)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#facc15', fontWeight: 600 }}>
                        <Flame size={11} />
                        <span>{language === 'bn' ? '১. হুক (০-৫ সে.):' : '1. Hook (0-5s):'}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: '9.5px', color: '#fef08a' }}>
                          [{TimecodeConverter.formatTimecode(hookObj.startSeconds, fps)} → {TimecodeConverter.formatTimecode(hookObj.endSeconds, fps)}]
                        </span>
                        <button
                          onClick={() => hostBridge.setPlayheadPosition(hookObj.startSeconds)}
                          style={{
                            padding: '1px 5px',
                            fontSize: '9px',
                            backgroundColor: 'rgba(234, 179, 8, 0.2)',
                            color: '#facc15',
                            border: 'none',
                            borderRadius: '3px',
                            cursor: 'pointer'
                          }}
                          title="Seek playhead to Hook"
                        >
                          <Play size={8} style={{ verticalAlign: 'middle', marginRight: '2px' }} />
                          {language === 'bn' ? 'প্লে' : 'Seek'}
                        </button>
                      </div>
                    </div>
                    <textarea
                      rows={2}
                      value={hookObj.text}
                      onChange={(e) => handleUpdateBlock(item.id, 'hook', 'text', e.target.value)}
                      placeholder={language === 'bn' ? 'হুক টেক্সট লিখুন...' : 'Hook sentence text...'}
                      style={{
                        backgroundColor: 'rgba(0,0,0,0.25)',
                        border: '1px solid rgba(234, 179, 8, 0.3)',
                        borderRadius: '3px',
                        color: '#fef08a',
                        fontSize: '11px',
                        padding: '4px 6px',
                        outline: 'none',
                        resize: 'vertical',
                        fontFamily: language === 'bn' ? 'var(--font-family-bn)' : 'inherit'
                      }}
                    />
                  </div>

                  {/* Block 2: 📖 Body / Story */}
                  <div
                    style={{
                      padding: '6px 8px',
                      borderRadius: '5px',
                      backgroundColor: 'rgba(52, 211, 153, 0.08)',
                      border: '1px solid rgba(52, 211, 153, 0.25)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#34d399', fontWeight: 600 }}>
                        <BookOpen size={11} />
                        <span>{language === 'bn' ? '২. মূল গল্প / বডি (শিক্ষণীয় বিষয়):' : '2. Body / Story (Educational Value):'}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: '9.5px', color: '#a7f3d0' }}>
                          [{TimecodeConverter.formatTimecode(bodyObj.startSeconds, fps)} → {TimecodeConverter.formatTimecode(bodyObj.endSeconds, fps)}]
                        </span>
                        <button
                          onClick={() => hostBridge.setPlayheadPosition(bodyObj.startSeconds)}
                          style={{
                            padding: '1px 5px',
                            fontSize: '9px',
                            backgroundColor: 'rgba(52, 211, 153, 0.2)',
                            color: '#34d399',
                            border: 'none',
                            borderRadius: '3px',
                            cursor: 'pointer'
                          }}
                          title="Seek playhead to Body"
                        >
                          <Play size={8} style={{ verticalAlign: 'middle', marginRight: '2px' }} />
                          {language === 'bn' ? 'প্লে' : 'Seek'}
                        </button>
                      </div>
                    </div>
                    <textarea
                      rows={3}
                      value={bodyObj.text}
                      onChange={(e) => handleUpdateBlock(item.id, 'body', 'text', e.target.value)}
                      placeholder={language === 'bn' ? 'মূল গল্প ও শিক্ষণীয় টেক্সট...' : 'Main story and value content...'}
                      style={{
                        backgroundColor: 'rgba(0,0,0,0.25)',
                        border: '1px solid rgba(52, 211, 153, 0.3)',
                        borderRadius: '3px',
                        color: '#ecfdf5',
                        fontSize: '11px',
                        padding: '4px 6px',
                        outline: 'none',
                        resize: 'vertical',
                        fontFamily: language === 'bn' ? 'var(--font-family-bn)' : 'inherit'
                      }}
                    />
                  </div>

                  {/* Block 3: 📢 CTA / Outro */}
                  <div
                    style={{
                      padding: '6px 8px',
                      borderRadius: '5px',
                      backgroundColor: 'rgba(168, 85, 247, 0.08)',
                      border: '1px solid rgba(168, 85, 247, 0.25)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#c084fc', fontWeight: 600 }}>
                        <Megaphone size={11} />
                        <span>{language === 'bn' ? '৩. সিটিএ / টেকঅ্যাওয়ে (সমাপ্তি):' : '3. CTA / Takeaway (Outro):'}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: '9.5px', color: '#e9d5ff' }}>
                          [{TimecodeConverter.formatTimecode(ctaObj.startSeconds, fps)} → {TimecodeConverter.formatTimecode(ctaObj.endSeconds, fps)}]
                        </span>
                        <button
                          onClick={() => hostBridge.setPlayheadPosition(ctaObj.startSeconds)}
                          style={{
                            padding: '1px 5px',
                            fontSize: '9px',
                            backgroundColor: 'rgba(168, 85, 247, 0.2)',
                            color: '#c084fc',
                            border: 'none',
                            borderRadius: '3px',
                            cursor: 'pointer'
                          }}
                          title="Seek playhead to CTA"
                        >
                          <Play size={8} style={{ verticalAlign: 'middle', marginRight: '2px' }} />
                          {language === 'bn' ? 'প্লে' : 'Seek'}
                        </button>
                      </div>
                    </div>
                    <textarea
                      rows={2}
                      value={ctaObj.text}
                      onChange={(e) => handleUpdateBlock(item.id, 'cta', 'text', e.target.value)}
                      placeholder={language === 'bn' ? 'কল-টু-অ্যাকশন টেক্সট লিখুন...' : 'Call-to-action text...'}
                      style={{
                        backgroundColor: 'rgba(0,0,0,0.25)',
                        border: '1px solid rgba(168, 85, 247, 0.3)',
                        borderRadius: '3px',
                        color: '#fae8ff',
                        fontSize: '11px',
                        padding: '4px 6px',
                        outline: 'none',
                        resize: 'vertical',
                        fontFamily: language === 'bn' ? 'var(--font-family-bn)' : 'inherit'
                      }}
                    />
                  </div>
                </div>

                {/* B-Roll & Visual Suggestions */}
                {item.brollSuggestions && item.brollSuggestions.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap', fontSize: '9.5px', color: 'var(--text-muted)' }}>
                    <span style={{ color: '#34d399', fontWeight: 600 }}>🟢 B-Roll:</span>
                    {item.brollSuggestions.map((b, bIdx) => (
                      <span key={`b_${bIdx}`} style={{ backgroundColor: 'rgba(52, 211, 153, 0.1)', padding: '1px 5px', borderRadius: '3px', color: '#6ee7b7' }}>
                        {b}
                      </span>
                    ))}
                  </div>
                )}

                {/* Refinement Chat Bar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                  <input
                    type="text"
                    placeholder={language === 'bn' ? 'এই শর্টটি পরিবর্তন করতে বলুন (যেমন: হুক আরও আকর্ষণীয় করো, বা বডি ৪৫ সেকেন্ড করো)...' : 'Refine this short (e.g., make hook punchier, shorten body to 40s)...'}
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

                {/* Action Buttons */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px', paddingTop: '6px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <button
                    onClick={() => hostBridge.setPlayheadPosition(hookObj.startSeconds)}
                    className="btn-secondary"
                    style={{ padding: '3px 8px', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '3px' }}
                    title={language === 'bn' ? 'টাইমলাইনে হুক অংশে প্লেহেড নিন' : 'Seek playhead to short start'}
                  >
                    <Play size={10} />
                    <span>{language === 'bn' ? 'শুরুর প্লেহেডে যান' : 'Preview / Seek'}</span>
                  </button>

                  <button
                    onClick={() => handleCreateSingleSequence(item)}
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
  );
};
