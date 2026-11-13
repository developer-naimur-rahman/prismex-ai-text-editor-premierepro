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
  Video,
  Layers,
  ArrowRight,
  BookmarkPlus,
  MessageSquare
} from 'lucide-react';

interface ViralShortItem {
  id: string;
  title: string;
  hook: string;
  startSeconds: number;
  endSeconds: number;
  durationSeconds: number;
  startFrame: number;
  endFrame: number;
  viralityScore: number;
  reason: string;
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
    setStatusMessage(language === 'bn' ? 'AI ভাইরাল শর্টস ও হুক বিশ্লেষণ করছে...' : 'AI Analyzing viral hooks & moments...');
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
            ? `${res.length} টি ভাইরাল শর্টস ক্যান্ডিডেট তৈরি হয়েছে!`
            : `Generated ${res.length} viral short candidates!`
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

  const handleCreateSingleSequence = async (item: ViralShortItem) => {
    setStatusMessage(language === 'bn' ? `৯:১৬ সিকোয়েন্স তৈরি হচ্ছে (${item.title})...` : `Building 9:16 Sequence (${item.title})...`);
    try {
      const res = await hostBridge.createVerticalShortSequence(
        item.title,
        item.startSeconds,
        item.endSeconds,
        item.markers
      );
      if (res.success && res.sequenceName) {
        setCreatedSequences(prev => ({ ...prev, [item.id]: res.sequenceName! }));
        setStatusMessage(
          language === 'bn'
            ? `নতুন ৯:১৬ সিকোয়েন্স তৈরি হয়েছে: ${res.sequenceName} (Bin: ${res.bin})`
            : `Created 9:16 Sequence: ${res.sequenceName} (Bin: ${res.bin})`
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
        await hostBridge.createVerticalShortSequence(
          item.title,
          item.startSeconds,
          item.endSeconds,
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
              1080x1920 Vertical
            </span>
          </div>
          <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
            {language === 'bn'
              ? 'লং ভিডিও থেকে স্বয়ংক্রিয়ভাবে কাট ও এডিটিংসহ নতুন ৯:১৬ সিকোয়েন্স তৈরি করুন'
              : 'Auto-extract viral 30-60s vertical sequences with all original edits intact'}
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
                ? 'এআই-কে নির্দিষ্ট নির্দেশনা দিন (যেমন: ৪৫ সেকেন্ডের মধ্যে ক্যালিফোর্নিয়া ছাড়ার গল্পটা দাও)...'
                : 'Specific AI instruction (e.g., under 45s, focus on why we left, high energy)...'
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
                  gap: '6px',
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  borderColor: isCreated ? 'rgba(52, 211, 153, 0.4)' : 'rgba(249, 115, 22, 0.25)',
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
                      [{TimecodeConverter.formatTimecode(item.startSeconds, fps)} → {TimecodeConverter.formatTimecode(item.endSeconds, fps)} • {item.durationSeconds}s]
                    </span>
                  </div>
                </div>

                {/* Hook Box */}
                {item.hook && (
                  <div
                    style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      backgroundColor: 'rgba(234, 179, 8, 0.1)',
                      border: '1px solid rgba(234, 179, 8, 0.25)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '11px',
                      color: '#fef08a'
                    }}
                  >
                    <span style={{ fontWeight: 700, color: '#facc15' }}>💡 Hook:</span>
                    <span style={{ fontStyle: 'italic' }}>"{item.hook}"</span>
                  </div>
                )}

                {/* Script Preview */}
                {item.scriptText && (
                  <div
                    style={{
                      fontSize: '11px',
                      color: 'var(--text-secondary)',
                      lineHeight: '1.4',
                      maxHeight: '65px',
                      overflowY: 'auto',
                      padding: '4px 6px',
                      backgroundColor: 'var(--bg-tertiary)',
                      borderRadius: '4px',
                      border: '1px solid var(--border-subtle)'
                    }}
                  >
                    {item.scriptText}
                  </div>
                )}

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
                    placeholder={language === 'bn' ? 'এই শর্টটি পরিবর্তন করতে বলুন (যেমন: ৩৫ সেকেন্ড করো)...' : 'Refine this short (e.g., make it 35s, punchier)...'}
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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px', paddingTop: '4px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <button
                    onClick={() => hostBridge.setPlayheadPosition(item.startSeconds)}
                    className="btn-secondary"
                    style={{ padding: '3px 8px', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '3px' }}
                    title={language === 'bn' ? 'টাইমলাইনে এই অংশে প্লেহেড নিন' : 'Seek playhead to short start'}
                  >
                    <Play size={10} />
                    <span>{language === 'bn' ? 'প্লেহেড সেখানে নিন' : 'Preview / Seek'}</span>
                  </button>

                  <button
                    onClick={() => handleCreateSingleSequence(item)}
                    className="btn-primary"
                    style={{
                      padding: '4px 10px',
                      fontSize: '10px',
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
                    {isCreated ? <CheckCircle2 size={11} /> : <Scissors size={11} />}
                    <span>
                      {isCreated
                        ? (language === 'bn' ? 'তৈরি হয়েছে (আবার তৈরি করুন)' : 'Sequence Created (Re-create)')
                        : (language === 'bn' ? '১-ক্লিকে ৯:১৬ সিকোয়েন্স তৈরি করুন' : 'Create 9:16 Sequence')}
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
