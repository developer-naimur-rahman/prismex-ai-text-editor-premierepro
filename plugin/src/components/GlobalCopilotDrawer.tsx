import React, { useState, useRef, useEffect } from 'react';
import { usePrismexStore } from '../state/usePrismexStore';
import { PrismexDaemonClient } from '../api/PrismexDaemonClient';
import { PremiereHostBridge } from '../host/PremiereHostBridge';
import {
  Mic,
  Send,
  Sparkles,
  RotateCcw,
  X,
  Palette,
  CheckCircle2,
  Copy,
  Check,
  Loader2,
  ChevronDown,
  SlidersHorizontal,
  Volume2
} from 'lucide-react';
import { copyToClipboard } from '../utils/clipboard';

export const GlobalCopilotDrawer: React.FC = () => {
  const {
    language,
    isGlobalCopilotOpen,
    setIsGlobalCopilotOpen,
    transcriptWords,
    setTranscriptWords,
    srtCues,
    setSrtCues,
    clientScriptText,
    setClientScriptText,
    clientBriefText,
    setClientBriefText,
    setClientDossier,
    brandKit,
    sequenceManifest,
    clientRevisions,
    setRecommendedBgmData,
    setScriptAuditReport,
    showToast,
    changeSequenceAspectRatio,
    setViralShorts,
    setActiveTab
  } = usePrismexStore();

  const isBn = language === 'bn';
  const client = PrismexDaemonClient.getInstance();
  const bridge = PremiereHostBridge.getInstance();

  const [commandInput, setCommandInput] = useState<string>('');
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [showQuickChips, setShowQuickChips] = useState<boolean>(true);
  const [responseHistory, setResponseHistory] = useState<Array<{
    id: string;
    sender: 'user' | 'assistant';
    text: string;
    action?: string;
    imageUrl?: string;
    imageFilePath?: string;
    time: string;
  }>>([
    {
      id: 'init_welcome',
      sender: 'assistant',
      text: isBn
        ? 'স্বাগতম! আমি আপনার প্রিজমেক্স এআই কো-পাইলট। ক্লায়েন্ট ব্রিফ, ফরম্যাট, লোগোর কালার কোড বা যেকোনো এডিটিং কমান্ড মুখে বলুন বা লিখুন।'
        : 'Welcome! I am your Prismex AI Co-Pilot. Ask about client formats, brand colors, or speak any editing command.',
      time: 'Just now'
    }
  ]);

  const [undoSnapshot, setUndoSnapshot] = useState<{ words: any[]; cues: any[] } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [responseHistory]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isGlobalCopilotOpen) {
        setIsGlobalCopilotOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isGlobalCopilotOpen, setIsGlobalCopilotOpen]);

  // Listener for prompt dispatch from transcript phrase selection
  useEffect(() => {
    const handleCopilotPrompt = (e: any) => {
      const p = e.detail?.prompt;
      if (p) {
        setCommandInput(p);
        if (e.detail?.autoSend) {
          handleSendCommand(p);
        }
      }
    };
    window.addEventListener('prismex-copilot-prompt', handleCopilotPrompt);
    return () => window.removeEventListener('prismex-copilot-prompt', handleCopilotPrompt);
  }, []);

  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [isTranscribingVoice, setIsTranscribingVoice] = useState(false);

  // Native Microphone Recording & Whisper Transcription
  const toggleListening = async () => {
    if (isListening) {
      setIsListening(false);
      setIsTranscribingVoice(true);
      showToast?.(isBn ? '🎙️ কথা প্রসেস হচ্ছে...' : '🎙️ Transcribing voice...', 'info');
      try {
        const lang = isBn ? 'bn' : 'auto';
        const res = await client.stopVoiceRecording(lang);
        setIsTranscribingVoice(false);
        if (res.success && res.text && res.text.trim()) {
          const text = res.text.trim();
          setCommandInput(text);
          showToast?.(isBn ? `🎙️ ভয়েস গৃহীত: "${text}"` : `🎙️ Voice: "${text}"`, 'success');
        } else if (res.warning) {
          showToast?.(res.warning, 'info');
        } else {
          showToast?.(isBn ? 'কোনো স্পষ্ট ভয়েস শোনা যায়নি। আরেকবার বলুন।' : 'No speech detected. Please speak closer.', 'info');
        }
      } catch (e: any) {
        setIsTranscribingVoice(false);
        showToast?.(`ভয়েস ত্রুটি: ${e.message}`, 'error');
      }
    } else {
      try {
        const res = await client.startVoiceRecording();
        if (res.success) {
          setIsListening(true);
          showToast?.(isBn ? '🎙️ শুনছি... মাইকে কথা বলুন (শেষ হলে মাইকে আবার চাপুন)' : '🎙️ Listening... speak now (tap mic to stop)', 'info');
        } else {
          showToast?.(res.error || 'মাইক্রোফোন চালু করা যায়নি', 'error');
        }
      } catch (e: any) {
        showToast?.(`মাইক্রোফোন ত্রুটি: ${e.message}`, 'error');
      }
    }
  };

  const handleSendCommand = async (cmdText?: string) => {
    const finalCmd = (cmdText || commandInput).trim();
    if (!finalCmd) return;

    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setResponseHistory((prev) => [
      ...prev,
      { id: `usr_${Date.now()}`, sender: 'user', text: finalCmd, time: nowStr }
    ]);

    setCommandInput('');
    setIsProcessing(true);

    // Check for AI Image Generation Request
    const isImageReq = finalCmd.startsWith('/image ') ||
      /^(ছবি|ইমেজ|image|picture|photo)\b/i.test(finalCmd) ||
      finalCmd.includes('ছবি তৈরি') || finalCmd.includes('ছবি বানাও') || finalCmd.includes('image generate');

    if (isImageReq) {
      const cleanPrompt = finalCmd
        .replace(/^\/image\s*/i, '')
        .replace(/^(ছবি|ইমেজ|image)\s*(বানাও|করো|তৈরি করো)?\s*/i, '')
        .trim();
      const promptToUse = cleanPrompt || finalCmd;

      try {
        const imgRes = await client.generateAiImage(promptToUse);
        if (imgRes && imgRes.success && imgRes.base64) {
          setResponseHistory((prev) => [
            ...prev,
            {
              id: `ai_img_${Date.now()}`,
              sender: 'assistant',
              text: isBn 
                ? `✓ "${promptToUse}" এর জন্য সিনেমাটিক এআই ইমেজ তৈরি হয়েছে:` 
                : `✓ Cinematic AI Image generated for "${promptToUse}":`,
              imageUrl: imgRes.base64,
              imageFilePath: imgRes.filePath,
              time: nowStr
            }
          ]);
          setIsProcessing(false);
          return;
        }
      } catch (imgErr) {
        console.error('Image gen error:', imgErr);
      }
    }

    // Check for 1-Click Sequence Aspect Ratio Change Request
    const isAspectCommand = /(স্কয়ার|square|১:১|1:1|রিলস|reels|ভার্টিক্যাল|vertical|৯:১৬|9:16|ল্যান্ডস্কেপ|landscape|১৬:৯|16:9|রেশিও|aspect\s*ratio|ফরম্যাট)/i.test(finalCmd);
    if (isAspectCommand && (finalCmd.includes('করো') || finalCmd.includes('বানাও') || finalCmd.includes('change') || finalCmd.includes('set') || finalCmd.includes('কনভার্ট') || finalCmd.includes('convert') || finalCmd.includes('রূপান্তর'))) {
      let width = 1080;
      let height = 1080;
      let label = isBn ? '১:১ স্কয়ার' : '1:1 Square';
      let rKey = 'square';

      if (/(৯:১৬|9:16|রিলস|reels|শর্টস|shorts|ভার্টিক্যাল|vertical)/i.test(finalCmd)) {
        width = 1080;
        height = 1920;
        label = isBn ? '৯:১৬ রিলস/শর্টস' : '9:16 Reels/Shorts';
        rKey = 'vertical';
      } else if (/(১৬:৯|16:9|ল্যান্ডস্কেপ|landscape|ইউটিউব|youtube)/i.test(finalCmd)) {
        width = 1920;
        height = 1080;
        label = isBn ? '১৬:৯ ল্যান্ডস্কেপ' : '16:9 Landscape';
        rKey = 'landscape';
      } else if (/(৪:৫|4:5|পোর্ট্রেট|portrait)/i.test(finalCmd)) {
        width = 1080;
        height = 1350;
        label = isBn ? '৪:৫ পোর্ট্রেট' : '4:5 Portrait';
        rKey = 'portrait';
      }

      await changeSequenceAspectRatio({
        width,
        height,
        label,
        ratioKey: rKey,
        fitMode: 'fill',
        clone: true
      });

      setResponseHistory((prev) => [
        ...prev,
        {
          id: `ai_${Date.now()}`,
          sender: 'assistant',
          text: isBn 
            ? `✓ আপনার নির্দেশ অনুযায়ী সিকোয়েন্সটি **${label} (${width}x${height})** ফরম্যাটে রূপান্তরিত করা হয়েছে এবং টাইমলাইনের ক্লিপগুলো স্বয়ংক্রিয়ভাবে অটো-ফিট (Auto-Fill) করা হয়েছে! 🎬`
            : `✓ Converted sequence to **${label} (${width}x${height})** and auto-fitted all video clips!`,
          time: nowStr
        }
      ]);
      setIsProcessing(false);
      return;
    }

    // Save snapshot for 1-click Undo
    setUndoSnapshot({
      words: JSON.parse(JSON.stringify(transcriptWords || [])),
      cues: JSON.parse(JSON.stringify(srtCues || []))
    });

    try {
      const res = await client.executeAssistantCommand(
        finalCmd,
        transcriptWords || [],
        srtCues || [],
        clientScriptText || '',
        clientBriefText || '',
        brandKit,
        sequenceManifest,
        clientRevisions,
        language
      );

      if (!res) {
        setResponseHistory((prev) => [
          ...prev,
          {
            id: `ai_${Date.now()}`,
            sender: 'assistant',
            text: isBn ? 'কমান্ড নির্বাহে ব্যর্থ হয়েছে।' : 'Could not execute command.',
            time: nowStr
          }
        ]);
        return;
      }

      setResponseHistory((prev) => [
        ...prev,
        {
          id: `ai_${Date.now()}`,
          sender: 'assistant',
          text: res.message,
          action: res.action,
          time: nowStr
        }
      ]);

      // Apply action updates
      if (res.clientScript) setClientScriptText(res.clientScript);
      if (res.clientBrief) setClientBriefText(res.clientBrief);
      if (res.clientDossier) setClientDossier(res.clientDossier);

      if ((res.action === 'update_text' || res.action === 'ingest_script') && res.words) {
        setTranscriptWords(res.words);
        if (res.srtCues) setSrtCues(res.srtCues);
        if (res.auditReport && res.auditReport.length > 0) {
          setScriptAuditReport(res.auditReport);
        }
      } else if (res.action === 'color_grade' && res.basicCorrection) {
        const lutName = res.lutFileName || 'Prismex_Teal_Orange.cube';
        await bridge.applyLumetriColorToActiveClip(
          `/Library/Application Support/Adobe/Common/LUTs/Creative/${lutName}`,
          res.preset || 'teal_orange',
          res.basicCorrection,
          false
        );
      } else if (res.action === 'music_recommendation' && res.musicData) {
        setRecommendedBgmData(res.musicData);
      } else if (res.action === 'audio_master') {
        showToast?.(isBn ? '⏳ টাইমলাইনের সমস্ত অডিও ক্লিপ ব্যালেন্স হচ্ছে...' : '⏳ Harmonizing timeline audio...', 'info');
        const seqName = sequenceManifest?.sequenceName || 'Sequence';
        const enhanceRes = await client.enhanceAudio({
          sequenceName: seqName,
          sourceClips: sequenceManifest?.sourceClips || [],
          durationSeconds: sequenceManifest?.durationSeconds || 60,
          profileId: 'auto-harmonize',
          settings: (res as any).audioSettings || { truePeak: -6.0, targetLufs: -14.0, vocalRider: true, denoise: 60 }
        });
        if (enhanceRes.success && enhanceRes.outputPath) {
          await bridge.applyEnhancedAudioTrack(enhanceRes.outputPath, 1, true);
          showToast?.(
            isBn ? '✓ সমস্ত অডিও ক্লিপ ব্যালেন্সড ও -৬dB পীকে টাইমলাইনে অ্যাপ্লাই করা হয়েছে!' : '✓ Audio clips harmonized to -6dB peak!',
            'success'
          );
        } else {
          showToast?.(enhanceRes.error || 'অডিও প্রসেসিং ব্যর্থ', 'error');
        }
      } else if (res.action === 'bgm_master') {
        showToast?.(isBn ? '✓ ব্যাকগ্রাউন্ড মিউজিক -২৬ dB-তে ব্যালেন্স করা হয়েছে!' : '✓ BGM mastered to -26dB!', 'success');
      } else if (res.action === 'script_rough_cut') {
        const scriptToUse = (res as any).scriptText || clientScriptText;
        if (!scriptToUse) {
          showToast?.(isBn ? 'ক্লায়েন্ট স্ক্রিপ্ট পাওয়া যায়নি।' : 'Client script missing.', 'error');
          return;
        }
        showToast?.(isBn ? '⏳ স্ক্রিপ্ট অনুযায়ী রাফ-কাট তৈরি হচ্ছে...' : '⏳ Generating script rough-cut...', 'info');
        const roughCutRes = await client.generateScriptRoughCut(
          scriptToUse,
          transcriptWords || [],
          sequenceManifest?.durationSeconds || 600,
          sequenceManifest?.fps || 23.976
        );

        if (roughCutRes.success) {
          const premiereRes = await bridge.createScriptRoughCutSequence({
            cuts: roughCutRes.cuts || [],
            punchIns: roughCutRes.punchIns || [],
            colorLabels: roughCutRes.colorLabels || [],
            markers: roughCutRes.markers || []
          });

          if (premiereRes.success) {
            const summaryMsg = isBn
              ? `🎉 **নতুন সিকোয়েন্স তৈরি হয়েছে:** \`${premiereRes.sequenceName}\`\n\n✓ ${roughCutRes.cutsCount || 0}টি অবাঞ্ছিত অংশ বাদ দেওয়া হয়েছে\n✓ ডায়নামিক পাঞ্চ-ইন ও কালার কোডিং সম্পন্ন!`
              : `🎉 **New Sequence Created:** \`${premiereRes.sequenceName}\``;

            setResponseHistory((prev) => [
              ...prev,
              {
                id: `ai_${Date.now()}`,
                sender: 'assistant',
                text: summaryMsg,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              }
            ]);
            showToast?.(isBn ? '✓ নতুন রাফ-কাট সিকোয়েন্স তৈরি হয়েছে!' : '✓ Script rough-cut created!', 'success');
          }
        }
      } else if (res.action === 'viral_shorts' || res.action === 'batch_shorts') {
        if ((res as any).shorts && (res as any).shorts.length > 0) {
          setViralShorts((res as any).shorts);
          showToast?.(
            isBn ? `✓ ${(res as any).shorts.length}টি ৯:১৬ শর্টস তৈরি ও লোড হয়েছে!` : `✓ ${(res as any).shorts.length} shorts created!`,
            'success'
          );
        }
      }
    } catch (e: any) {
      setResponseHistory((prev) => [
        ...prev,
        {
          id: `ai_${Date.now()}`,
          sender: 'assistant',
          text: `Error: ${String(e)}`,
          time: nowStr
        }
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUndo = () => {
    if (!undoSnapshot) return;
    setTranscriptWords(undoSnapshot.words);
    setSrtCues(undoSnapshot.cues);
    setUndoSnapshot(null);
    showToast?.(isBn ? '✓ পূর্বাবস্থায় ফিরিয়ে নেওয়া হয়েছে (Undo Success)!' : '✓ Action undone successfully!', 'info');
  };

  if (!isGlobalCopilotOpen) return null;

  return (
    /* BACKDROP: CLICK OUTSIDE CLOSES */
    <div
      onClick={() => setIsGlobalCopilotOpen(false)}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        alignItems: 'center'
      }}
    >
      {/* BOTTOM-DOCKED RESILIENT DIALOG BOX */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '560px',
          maxHeight: '68vh',
          backgroundColor: '#161720',
          borderTop: '1.5px solid rgba(99, 102, 241, 0.45)',
          borderLeft: '1px solid #272838',
          borderRight: '1px solid #272838',
          borderTopLeftRadius: '14px',
          borderTopRightRadius: '14px',
          boxShadow: '0 -10px 40px rgba(0,0,0,0.85), 0 0 24px rgba(99, 102, 241, 0.2)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          color: '#e2e8f0',
          fontFamily: 'inherit',
          animation: 'slideUp 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* Header Bar */}
        <div
          style={{
            padding: '8px 12px',
            backgroundColor: '#1b1c28',
            borderBottom: '1px solid #262737',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '6px',
                backgroundColor: 'rgba(99, 102, 241, 0.2)',
                border: '1px solid rgba(99, 102, 241, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#818cf8'
              }}
            >
              <Mic size={13} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ fontWeight: 700, fontSize: '11.5px', color: '#fff' }}>
                  {isBn ? 'এআই কো-পাইলট' : 'AI Co-Pilot'}
                </span>
                <span
                  style={{
                    fontSize: '8.5px',
                    backgroundColor: 'rgba(16, 185, 129, 0.18)',
                    color: '#34d399',
                    padding: '1px 5px',
                    borderRadius: '4px',
                    fontWeight: 600
                  }}
                >
                  Online
                </span>
              </div>
              <div style={{ fontSize: '9.5px', color: '#94a3b8', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {brandKit.brandName ? `Brand: ${brandKit.brandName}` : (sequenceManifest?.sequenceName || 'Active Sequence')}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            {undoSnapshot && (
              <button
                onClick={handleUndo}
                style={{
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontSize: '9.5px',
                  fontWeight: 600,
                  color: '#fbbf24',
                  backgroundColor: 'rgba(245, 158, 11, 0.15)',
                  border: '1px solid rgba(245, 158, 11, 0.35)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px'
                }}
              >
                <RotateCcw size={10} />
                <span>Undo</span>
              </button>
            )}

            <button
              onClick={() => setShowQuickChips(!showQuickChips)}
              title={isBn ? 'কুইক প্রম্পট চিপস অন/অফ' : 'Toggle quick action chips'}
              style={{
                background: showQuickChips ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                border: showQuickChips ? '1px solid rgba(99, 102, 241, 0.4)' : 'none',
                color: showQuickChips ? '#a5b4fc' : '#94a3b8',
                cursor: 'pointer',
                padding: '3px 6px',
                borderRadius: '4px',
                fontSize: '9.5px',
                display: 'flex',
                alignItems: 'center',
                gap: '3px'
              }}
            >
              <SlidersHorizontal size={10} />
              <span>{isBn ? 'প্রম্পট' : 'Chips'}</span>
            </button>

            <button
              onClick={() => setIsGlobalCopilotOpen(false)}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#cbd5e1',
                cursor: 'pointer',
                padding: '3px 6px',
                borderRadius: '4px',
                fontSize: '11px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title={isBn ? 'মিনিমাইজ / বন্ধ করুন' : 'Minimize'}
            >
              <ChevronDown size={14} />
            </button>
          </div>
        </div>

        {/* Brand Palette Strip (If available) */}
        {brandKit.palette && brandKit.palette.length > 0 && (
          <div
            style={{
              padding: '4px 12px',
              backgroundColor: '#12131b',
              borderBottom: '1px solid #1e202c',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '9.5px',
              flexShrink: 0
            }}
          >
            <span style={{ color: '#94a3b8' }}>{isBn ? 'ব্র্যান্ড কালার:' : 'Brand Palette:'}</span>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              {brandKit.palette.slice(0, 5).map((hex: string, idx: number) => (
                <div
                  key={idx}
                  title={`Color: ${hex}`}
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    backgroundColor: hex,
                    border: '1px solid rgba(255,255,255,0.3)'
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Conversation Message List */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '10px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            fontSize: '11px',
            minHeight: '120px'
          }}
        >
          {responseHistory.map((item) => (
            <div
              key={item.id}
              style={{
                alignSelf: item.sender === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '92%',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px'
              }}
            >
              <div
                style={{
                  padding: '7px 11px',
                  borderRadius: item.sender === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                  backgroundColor: item.sender === 'user' ? '#4f46e5' : '#1e1f2c',
                  color: item.sender === 'user' ? '#ffffff' : '#f1f5f9',
                  border: item.sender === 'user' ? 'none' : '1px solid #2d2e40',
                  lineHeight: 1.45,
                  wordBreak: 'break-word',
                  userSelect: 'text'
                }}
              >
                {item.text}

                {/* Render Generated AI Image & 1-Click Timeline Placement Button */}
                {item.imageUrl && (
                  <div style={{ marginTop: '8px', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(56, 189, 248, 0.45)' }}>
                    <img 
                      src={item.imageUrl} 
                      alt="Generated AI Visual" 
                      style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', display: 'block' }} 
                    />
                    <div style={{ padding: '6px 8px', backgroundColor: '#13141f', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '9px', color: '#94a3b8' }}>1920x1080 PNG</span>
                      <button
                        onClick={async () => {
                          if (!item.imageFilePath) return;
                          showToast?.(isBn ? 'টাইমলাইন V2 ট্র্যাকে প্লেস হচ্ছে...' : 'Placing on Track V2...', 'info');
                          const playhead = await bridge.getPlayheadPosition();
                          const placeRes = await bridge.importAndPlaceClipOnTrack(
                            item.imageFilePath,
                            playhead,
                            2, // Video Track 2
                            'video',
                            5.0
                          );
                          if (placeRes && placeRes.success) {
                            showToast?.(isBn ? '✓ ইমেজ সফলভাবে V2 ট্র্যাকে বসেছে!' : '✓ Image placed on Track V2!', 'success');
                          } else {
                            showToast?.(placeRes?.error || (isBn ? 'প্লেসমেন্ট ব্যর্থ' : 'Placement failed'), 'error');
                          }
                        }}
                        style={{
                          padding: '4px 8px',
                          backgroundColor: '#059669',
                          color: '#ffffff',
                          borderRadius: '4px',
                          fontSize: '10px',
                          fontWeight: 700,
                          border: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          boxShadow: '0 2px 6px rgba(5, 150, 105, 0.4)'
                        }}
                      >
                        <Sparkles size={11} />
                        <span>{isBn ? 'টাইমলাইনে বসান (V2)' : 'Insert to Track V2'}</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Render Direct Action Button for Viral Shorts */}
                {(item.action === 'viral_shorts' || item.action === 'batch_shorts') && (
                  <button
                    onClick={() => {
                      setActiveTab('viral-shorts');
                      setIsGlobalCopilotOpen(false);
                    }}
                    style={{
                      marginTop: '8px',
                      padding: '5px 12px',
                      backgroundColor: '#ea580c',
                      color: '#ffffff',
                      borderRadius: '5px',
                      fontSize: '10.5px',
                      fontWeight: 700,
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      boxShadow: '0 2px 8px rgba(234, 88, 12, 0.4)'
                    }}
                  >
                    <Sparkles size={12} />
                    <span>{isBn ? '👉 শর্টস স্টুডিওতে দেখুন ও সিকোয়েন্স বানান' : '👉 Open in Shorts Studio'}</span>
                  </button>
                )}
              </div>
              <div
                style={{
                  fontSize: '8.5px',
                  color: '#64748b',
                  alignSelf: item.sender === 'user' ? 'flex-end' : 'flex-start',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '0 2px'
                }}
              >
                <span>{item.time}</span>
                {item.sender === 'assistant' && (
                  <button
                    onClick={async () => {
                      await copyToClipboard(item.text);
                      setCopiedMsgId(item.id);
                      setTimeout(() => setCopiedMsgId(null), 1200);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: copiedMsgId === item.id ? '#34d399' : '#94a3b8',
                      cursor: 'pointer',
                      padding: 0,
                      fontSize: '8.5px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '2px'
                    }}
                  >
                    {copiedMsgId === item.id ? <Check size={8} /> : <Copy size={8} />}
                    <span>{copiedMsgId === item.id ? 'কপি হয়েছে' : 'কপি'}</span>
                  </button>
                )}
              </div>
            </div>
          ))}

          {isProcessing && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#818cf8', fontSize: '10.5px', padding: '4px' }}>
              <Sparkles size={12} className="animate-spin" />
              <span>{isBn ? 'বিশ্লেষণ হচ্ছে...' : 'Analyzing instruction...'}</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Clean, Non-Breaking Quick Action Chips (Horizontally Scrollable Without Clipping) */}
        {showQuickChips && (
          <div
            style={{
              padding: '6px 8px',
              backgroundColor: '#14151f',
              borderTop: '1px solid #20222f',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              overflowX: 'auto',
              width: '100%',
              maxWidth: '100%',
              boxSizing: 'border-box',
              whiteSpace: 'nowrap',
              WebkitOverflowScrolling: 'touch',
              flexShrink: 0
            }}
          >
            {[
              { label: isBn ? '⬛ ১:১ স্কয়ার' : '⬛ 1:1 Square', cmd: 'সিকোয়েন্স ১:১ স্কয়ার রেশিওতে রূপান্তর করো' },
              { label: isBn ? '📱 ৯:১৬ রিলস' : '📱 9:16 Reels', cmd: 'সিকোয়েন্স ৯:১৬ রিলস ভার্টিক্যাল রেশিওতে রূপান্তর করো' },
              { label: isBn ? '📋 ফরম্যাট?' : '📋 Formats?', cmd: 'ক্লায়েন্ট কয়টা ফরম্যাটে চাইছে?' },
              { label: isBn ? '🎨 কালার কোড?' : '🎨 Colors?', cmd: 'লোগো এবং ব্র্যান্ডের কালার কোড কী?' },
              { label: isBn ? '🚫 দাড়ি-কমা মুছুন' : '🚫 Strip Punct', cmd: 'সব দাড়ি কমা বাদ দিয়ে দাও' },
              { label: isBn ? '🎬 Teal & Orange' : '🎬 Teal & Orange', cmd: 'সিনেমাটিক টিল অ্যান্ড অরেঞ্জ কালার দাও' },
              { label: isBn ? '🎛️ ভয়েস ব্যালেন্স' : '🎛️ Balance Voice', cmd: 'সব অডিও ক্লিপের ভলিউম ব্যালেন্স করো এবং পিক -৬ ডিবি তে রাখো' },
              { label: isBn ? '🎵 BGM ব্যালেন্স' : '🎵 BGM Bed', cmd: 'ব্যাকগ্রাউন্ড মিউজিক -২৫ থেকে -৩০ ডিবি রেঞ্জে ব্যালেন্স করো' },
              { label: isBn ? '✂️ রাফ-কাট সিকোয়েন্স' : '✂️ Rough Cut', cmd: 'ক্লায়েন্ট স্ক্রিপ্ট অনুযায়ী রাফ কাট সিকোয়েন্স বানাও' }
            ].map((chip, cIdx) => (
              <button
                key={cIdx}
                onClick={() => handleSendCommand(chip.cmd)}
                style={{
                  flex: '0 0 auto',
                  whiteSpace: 'nowrap',
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '4px 9px',
                  borderRadius: '12px',
                  fontSize: '10.5px',
                  fontWeight: 500,
                  backgroundColor: '#1e202d',
                  border: '1px solid #2f3248',
                  color: '#cbd5e1',
                  cursor: 'pointer',
                  boxSizing: 'border-box',
                  transition: 'background-color 0.1s ease'
                }}
              >
                {chip.label}
              </button>
            ))}
          </div>
        )}

        {/* Sleek Input Bar */}
        <div
          style={{
            padding: '7px 10px',
            backgroundColor: '#181923',
            borderTop: '1px solid #262837',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            flexShrink: 0
          }}
        >
          <button
            onClick={toggleListening}
            disabled={isTranscribingVoice}
            style={{
              padding: '6px',
              borderRadius: '6px',
              backgroundColor: isListening ? '#ef4444' : (isTranscribingVoice ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255,255,255,0.06)'),
              border: isListening ? '1px solid #dc2626' : '1px solid rgba(255,255,255,0.1)',
              color: isListening ? '#ffffff' : (isTranscribingVoice ? '#818cf8' : '#94a3b8'),
              cursor: isTranscribingVoice ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
            title={
              isListening
                ? (isBn ? '🎙️ কথা বলা শেষ হলে ক্লিক করুন' : 'Click to finish speaking')
                : (isBn ? '🎙️ মাইকে কথা বলুন (ভয়েস কমান্ড)' : 'Speak voice command')
            }
          >
            {isTranscribingVoice ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Mic size={13} style={{ animation: isListening ? 'pulse 1s infinite' : 'none' }} />
            )}
          </button>

          <input
            type="text"
            value={commandInput}
            onChange={(e) => setCommandInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSendCommand();
            }}
            placeholder={
              isListening
                ? (isBn ? '🎙️ শুনছি... মাইকে কথা বলুন...' : '🎙️ Listening... speak now...')
                : isTranscribingVoice
                ? (isBn ? '⏳ কথা প্রসেস হচ্ছে...' : '⏳ Transcribing voice...')
                : (isBn ? 'মুখে বলুন বা টাইপ করুন...' : 'Type or speak command...')
            }
            style={{
              flex: 1,
              backgroundColor: 'transparent',
              border: 'none',
              outline: 'none',
              fontSize: '11px',
              color: '#ffffff',
              userSelect: 'text',
              cursor: 'text',
              minWidth: '60px'
            }}
          />

          <button
            onClick={() => handleSendCommand()}
            disabled={!commandInput.trim() || isProcessing}
            style={{
              padding: '5px 10px',
              borderRadius: '6px',
              backgroundColor: commandInput.trim() ? '#4f46e5' : 'rgba(255,255,255,0.08)',
              border: 'none',
              color: '#ffffff',
              fontSize: '10.5px',
              fontWeight: 600,
              cursor: commandInput.trim() ? 'pointer' : 'default',
              opacity: commandInput.trim() ? 1 : 0.4,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              flexShrink: 0
            }}
          >
            <Send size={11} />
            <span>{isBn ? 'সেন্ড' : 'Send'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
