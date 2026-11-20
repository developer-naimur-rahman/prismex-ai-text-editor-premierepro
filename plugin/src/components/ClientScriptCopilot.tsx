import React, { useState, useRef, useEffect } from 'react';
import { usePrismexStore } from '../state/usePrismexStore';
import { PrismexDaemonClient } from '../api/PrismexDaemonClient';
import { PremiereHostBridge } from '../host/PremiereHostBridge';
import {
  FileText,
  Upload,
  Mic,
  MicOff,
  Send,
  Sparkles,
  Check,
  RotateCcw,
  Trash2,
  Save,
  Palette,
  Music,
  CheckCircle2,
  AlertCircle,
  X,
  ChevronDown,
  ChevronUp,
  FileCode,
  Sliders,
  Type,
  Copy,
  Loader2,
  Film,
  Scissors,
  Bookmark
} from 'lucide-react';
import { copyToClipboard } from '../utils/clipboard';

interface AuditItem {
  id: string;
  original: string;
  replacement: string;
  start?: number;
  end?: number;
  reason: string;
  scriptContext?: string;
  applied: boolean;
}

export const ClientScriptCopilot: React.FC = () => {
  const {
    language,
    sequenceManifest,
    transcriptWords,
    setTranscriptWords,
    srtCues,
    setSrtCues,
    clientScriptText,
    setClientScriptText,
    clientBriefText,
    setClientBriefText,
    scriptAuditReport,
    setScriptAuditReport,
    brandKit,
    clientRevisions,
    setRecommendedBgmData,
    setViralShorts,
    setActiveTab,
    showToast
  } = usePrismexStore();

  const client = PrismexDaemonClient.getInstance();
  const bridge = PremiereHostBridge.getInstance();

  const isBn = language === 'bn';
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [activeSubTab, setActiveSubTab] = useState<'copilot' | 'script' | 'brief' | 'audit'>('copilot');

  // Command & Speech state
  const [commandInput, setCommandInput] = useState<string>('');
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isProcessingCommand, setIsProcessingCommand] = useState<boolean>(false);
  const [lastCommandResult, setLastCommandResult] = useState<any | null>(null);

  // Script & Brief edit states
  const [scriptDraft, setScriptDraft] = useState<string>(clientScriptText || '');
  const [briefDraft, setBriefDraft] = useState<string>(clientBriefText || '');
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [isAligningScript, setIsAligningScript] = useState<boolean>(false);

  // 1-Click Script Rough Cut States
  const [isCreatingRoughCut, setIsCreatingRoughCut] = useState<boolean>(false);
  const [roughCutProgressStep, setRoughCutProgressStep] = useState<string>('');
  const [roughCutResult, setRoughCutResult] = useState<{
    sequenceName?: string;
    cutsExecuted?: number;
    punchesApplied?: number;
    markersPlaced?: number;
    totalCutDuration?: number;
    summary?: string;
  } | null>(null);

  // Undo snapshot state
  const [undoSnapshot, setUndoSnapshot] = useState<{ words: any[]; cues: any[] } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  // Sync drafts when external state changes
  useEffect(() => {
    setScriptDraft(clientScriptText || '');
  }, [clientScriptText]);

  useEffect(() => {
    setBriefDraft(clientBriefText || '');
  }, [clientBriefText]);

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

  // Smart File Parser for .txt, .srt, .json
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);
    const reader = new FileReader();

    reader.onload = (event) => {
      const content = String(event.target?.result || '');
      const ext = file.name.split('.').pop()?.toLowerCase();

      let parsedDialogue = content;

      if (ext === 'srt') {
        // Strip SRT cue numbers and timestamps (00:00:01,000 --> 00:00:04,000)
        parsedDialogue = content
          .replace(/^\d+\r?\n/gm, '')
          .replace(/\d\d:\d\d:\d\d,\d\d\d\s*-->\s*\d\d:\d\d:\d\d,\d\d\d\r?\n?/gm, '')
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line.length > 0)
          .join(' ');
      } else if (ext === 'json') {
        try {
          const parsedJson = JSON.parse(content);
          if (Array.isArray(parsedJson)) {
            parsedDialogue = parsedJson
              .map((item) => (typeof item === 'object' ? item.text || item.dialogue || item.content || JSON.stringify(item) : String(item)))
              .join(' ');
          } else if (typeof parsedJson === 'object') {
            parsedDialogue = parsedJson.script || parsedJson.dialogue || parsedJson.content || parsedJson.text || JSON.stringify(parsedJson, null, 2);
          }
        } catch {
          parsedDialogue = content;
        }
      }

      setScriptDraft(parsedDialogue);
      setClientScriptText(parsedDialogue);
      showToast?.(
        isBn
          ? `✓ '${file.name}' সফলভাবে আপলোড ও পার্স হয়েছে (${parsedDialogue.split(/\s+/).length} শব্দ)`
          : `✓ '${file.name}' loaded & parsed (${parsedDialogue.split(/\s+/).length} words)`,
        'success'
      );
    };

    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Save drafts into store & persistent storage
  const handleSaveAndSync = () => {
    setClientScriptText(scriptDraft);
    setClientBriefText(briefDraft);
    showToast?.(
      isBn ? '✓ ক্লায়েন্ট ব্রিফ ও স্ক্রিপ্ট সফলভাবে প্রজেক্টে সংরক্ষিত হয়েছে!' : '✓ Client brief & script saved to project cache!',
      'success'
    );
  };

  // Run Script-Grounded Spell Check
  const handleScriptAlignedSpellCheck = async () => {
    if (!transcriptWords || transcriptWords.length === 0) {
      showToast?.(isBn ? 'প্রথমে টাইমলাইন ট্রান্সক্রাইব করুন।' : 'Transcribe sequence first.', 'error');
      return;
    }

    const scriptToUse = scriptDraft || clientScriptText;
    if (!scriptToUse.trim()) {
      showToast?.(
        isBn
          ? 'দয়া করে ক্লায়েন্টের স্ক্রিপ্ট টেক্সট পেস্ট বা ফাইল আপলোড করুন।'
          : 'Please paste client script or upload a script file first.',
        'error'
      );
      setActiveSubTab('script');
      return;
    }

    setIsAligningScript(true);
    // Take snapshot for undo
    setUndoSnapshot({
      words: JSON.parse(JSON.stringify(transcriptWords)),
      cues: JSON.parse(JSON.stringify(srtCues || []))
    });

    try {
      const res = await client.scriptAlignedSpellCheck(
        transcriptWords,
        scriptToUse,
        briefDraft || clientBriefText,
        language
      );

      if (res && res.words && res.words.length > 0) {
        setTranscriptWords(res.words);
        const audits = res.auditReport || [];
        setScriptAuditReport(audits);

        showToast?.(
          isBn
            ? res.summary || `✓ ${res.corrections}টি শব্দ স্ক্রিপ্টের সাথে মিলিয়ে ঠিক করা হয়েছে!`
            : res.summary || `✓ ${res.corrections} words corrected against client script!`,
          'success'
        );

        if (audits.length > 0) {
          setActiveSubTab('audit');
        }
      } else {
        showToast?.(
          isBn ? 'স্ক্রিপ্ট অনুসারে কোনো নতুন বানান সংশোধনের প্রয়োজন নেই।' : 'No script misspellings detected.',
          'info'
        );
      }
    } catch (err) {
      console.error('Script align error:', err);
      showToast?.(isBn ? 'স্ক্রিপ্ট এলাইনমেন্ট ব্যর্থ হয়েছে।' : 'Script alignment failed.', 'error');
    } finally {
      setIsAligningScript(false);
    }
  };

  // 1-Click Non-Destructive Script-to-Rough Cut Sequence Handler
  const handleCreateScriptRoughCut = async (explicitScript?: string) => {
    const scriptToUse = (explicitScript || scriptDraft || clientScriptText || '').trim();
    if (!scriptToUse) {
      showToast?.(
        isBn
          ? 'দয়া করে প্রথমে ক্লায়েন্টের স্ক্রিপ্ট টেক্সট পেস্ট বা ফাইল আপলোড করুন।'
          : 'Please paste client script or upload file first.',
        'error'
      );
      setActiveSubTab('script');
      return;
    }

    if (!transcriptWords || transcriptWords.length === 0) {
      showToast?.(
        isBn ? 'প্রথমে টাইমলাইনের অডিও ট্রান্সক্রাইব করুন।' : 'Transcribe timeline audio first.',
        'error'
      );
      return;
    }

    setIsCreatingRoughCut(true);
    setRoughCutResult(null);
    setRoughCutProgressStep(isBn ? '১/৪: স্ক্রিপ্ট বিশ্লেষণ ও সেরা টেক বাছাই চলছে...' : '1/4: Analyzing script & matching takes...');

    try {
      const dur = sequenceManifest?.durationSeconds || 600.0;
      const fps = sequenceManifest?.fps || 23.976;

      const res = await client.generateScriptRoughCut(scriptToUse, transcriptWords, dur, fps);

      if (!res || !res.success) {
        showToast?.(res?.error || (isBn ? 'স্ক্রিপ্ট রাফ-কাট গণনা ব্যর্থ হয়েছে।' : 'Rough-cut calculation failed.'), 'error');
        setIsCreatingRoughCut(false);
        return;
      }

      setRoughCutProgressStep(isBn ? '২/৪: নতুন সিকোয়েন্স ক্লোন ও অটো রিপল কাট চলছে...' : '2/4: Cloning sequence & applying ripple cuts...');

      const premiereRes = await bridge.createScriptRoughCutSequence({
        cuts: res.cuts || [],
        punchIns: res.punchIns || [],
        colorLabels: res.colorLabels || [],
        markers: res.markers || []
      });

      if (!premiereRes || !premiereRes.success) {
        showToast?.(premiereRes?.error || (isBn ? 'প্রিমিয়ার প্রোতে সিকোয়েন্স তৈরি ব্যর্থ হয়েছে।' : 'Sequence creation failed in Premiere.'), 'error');
        setIsCreatingRoughCut(false);
        return;
      }

      setRoughCutProgressStep(isBn ? '৩/৪: A/B Cam পাঞ্চ-ইন ও কালার কোডিং সম্পন্ন...' : '3/4: A/B Cam punch-in & act color-coding applied...');

      setRoughCutResult({
        sequenceName: premiereRes.sequenceName,
        cutsExecuted: premiereRes.executedCuts,
        punchesApplied: premiereRes.punchesApplied,
        markersPlaced: premiereRes.markersPlaced,
        totalCutDuration: res.totalCutDuration,
        summary: res.summary
      });

      showToast?.(
        isBn
          ? `🎉 নতুন সিকোয়েন্স '${premiereRes.sequenceName}' তৈরি হয়েছে!`
          : `🎉 New sequence '${premiereRes.sequenceName}' created!`,
        'success'
      );
    } catch (err) {
      console.error('Rough cut error:', err);
      showToast?.(isBn ? 'রাফ-কাট সিকোয়েন্স তৈরিতে ত্রুটি ঘটেছে।' : 'Failed to create rough-cut sequence.', 'error');
    } finally {
      setIsCreatingRoughCut(false);
    }
  };

  // Execute Natural Language / Voice Co-Pilot Command
  const handleExecuteCommand = async (cmdToRun?: string) => {
    const finalCmd = (cmdToRun || commandInput).trim();
    if (!finalCmd) return;

    setIsProcessingCommand(true);

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
        scriptDraft || clientScriptText || '',
        briefDraft || clientBriefText || '',
        brandKit,
        sequenceManifest,
        clientRevisions,
        language
      );

      if (!res) {
        showToast?.(isBn ? 'কমান্ড নির্বাহে সমস্যা হয়েছে।' : 'Could not execute command.', 'error');
        setIsProcessingCommand(false);
        return;
      }

      setLastCommandResult(res);

      // Handle ACTION: Text modification (e.g. Strip punctuation, word replacement)
      if (res.action === 'update_text' && res.words) {
        setTranscriptWords(res.words);
        if (res.srtCues) {
          setSrtCues(res.srtCues);
        }
        if (res.auditReport && res.auditReport.length > 0) {
          setScriptAuditReport(res.auditReport);
        }
        showToast?.(res.message, 'success');
      }

      // Handle ACTION: Color Grading Lumetri Injection
      else if (res.action === 'color_grade' && res.basicCorrection) {
        const lutName = res.lutFileName || 'Prismex_Teal_Orange.cube';
        const applyRes = await bridge.applyLumetriColorToActiveClip(
          `/Library/Application Support/Adobe/Common/LUTs/Creative/${lutName}`,
          res.preset || 'teal_orange',
          res.basicCorrection,
          false
        );

        if (applyRes && applyRes.success) {
          showToast?.(
            isBn
              ? `✓ টাইমলাইনের ক্লিপে লুমেট্রি কালার সফলভাবে প্রয়োগ হয়েছে! (${res.preset})`
              : `✓ Lumetri Color applied to active timeline clip! (${res.preset})`,
            'success'
          );
        } else {
          showToast?.(res.message, 'info');
        }
      }

      // Handle ACTION: Background Music Recommendation
      else if (res.action === 'music_recommendation' && res.musicData) {
        setRecommendedBgmData(res.musicData);
        showToast?.(res.message, 'success');
      }

      // Handle ACTION: Audio Master & Harmonize
      else if (res.action === 'audio_master') {
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
      } else if (res.action === 'script_rough_cut') {
        showToast?.(res.message, 'info');
        await handleCreateScriptRoughCut((res as any).scriptText);
      } else if (res.action === 'batch_shorts' && (res as any).shorts) {
        setViralShorts((res as any).shorts);
        showToast?.(res.message, 'success');
        // Automatically switch to viral shorts view after a short delay so user sees the generated shorts immediately
        setTimeout(() => {
          setActiveTab('viral-shorts');
        }, 1200);
      } else {
        showToast?.(res.message, 'info');
      }
    } catch (err) {
      console.error('Co-pilot command error:', err);
      showToast?.(isBn ? 'কমান্ড প্রসেস করতে ব্যর্থ হয়েছে।' : 'Failed to process command.', 'error');
    } finally {
      setIsProcessingCommand(false);
      setCommandInput('');
    }
  };

  // Undo last action
  const handleUndo = () => {
    if (!undoSnapshot) return;
    setTranscriptWords(undoSnapshot.words);
    setSrtCues(undoSnapshot.cues);
    setUndoSnapshot(null);
    setLastCommandResult(null);
    showToast?.(isBn ? '✓ পূর্বাবস্থায় ফিরিয়ে নেওয়া হয়েছে (Undo Success)!' : '✓ Action undone successfully!', 'info');
  };

  // Jump playhead in Premiere Pro timeline
  const handleSeek = (sec?: number) => {
    if (typeof sec === 'number' && sec >= 0) {
      bridge.setPlayheadPosition(sec);
    }
  };

  const wordCount = (scriptDraft || '').trim() ? (scriptDraft || '').trim().split(/\s+/).length : 0;

  return (
    <div className="bg-[#1b1c24] border border-[#2a2b36] rounded-xl overflow-hidden mb-4 shadow-xl transition-all">
      {/* Top Banner & Accordion Header */}
      <div className="p-3 bg-gradient-to-r from-[#212330] via-[#1f202c] to-[#1b1c24] border-b border-[#2d2f3f] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-gray-200">
                {isBn ? 'ক্লায়েন্ট ব্রিফ, স্ক্রিপ্ট ও এআই কো-পাইলট' : 'Client Brief, Script & AI Co-Pilot'}
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                {isBn ? 'স্মার্ট গ্রাউন্ডিং' : 'Smart Grounding'}
              </span>
            </div>
            <p className="text-[11px] text-gray-400">
              {isBn
                ? 'টাইমলাইনের রিয়েল ভয়েস বজায় রেখে ক্লায়েন্ট ব্রিফ ও স্ক্রিপ্ট অনুসারে অডিট ও ভয়েস কো-পাইলট'
                : 'Timeline spoken voice is ground truth — audit against client brief & execute natural voice commands'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {undoSnapshot && (
            <button
              onClick={handleUndo}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-amber-300 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 rounded-lg transition-colors"
              title={isBn ? 'আগের অবস্থায় ফেরত যান' : 'Undo last modification'}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Undo</span>
            </button>
          )}

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="p-3.5 space-y-3.5">
          {/* Sub Navigation Tabs */}
          <div className="flex items-center justify-between border-b border-[#2a2c3a] pb-2">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setActiveSubTab('copilot')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeSubTab === 'copilot'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                }`}
              >
                <Mic className="w-3.5 h-3.5" />
                <span>{isBn ? 'ভয়েস ও টেক্সট সহকারী' : 'AI Voice & Text Co-Pilot'}</span>
              </button>

              <button
                onClick={() => setActiveSubTab('script')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeSubTab === 'script'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>{isBn ? 'ক্লায়েন্ট স্ক্রিপ্ট' : 'Client Script'}</span>
                {wordCount > 0 && (
                  <span className="text-[10px] bg-black/40 px-1.5 py-0.2 rounded text-indigo-300 font-mono">
                    {wordCount}w
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveSubTab('brief')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeSubTab === 'brief'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>{isBn ? 'ক্লায়েন্ট ব্রিফ' : 'Client Brief'}</span>
                {briefDraft.trim() && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                )}
              </button>

              <button
                onClick={() => setActiveSubTab('audit')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeSubTab === 'audit'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{isBn ? 'অডিট রিপোর্ট' : 'Audit Report'}</span>
                {scriptAuditReport && scriptAuditReport.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                    {scriptAuditReport.length}
                  </span>
                )}
              </button>
            </div>

            {/* Quick Action: Script Grounded Spell Check */}
            <button
              onClick={handleScriptAlignedSpellCheck}
              disabled={isAligningScript}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-md shadow-emerald-900/30 disabled:opacity-50 transition-all"
              title={isBn ? 'ক্লায়েন্ট স্ক্রিপ্ট মিলিয়ে টাইমলাইনের বানান নিখুঁত করুন' : 'Align STT transcript against client script & proper nouns'}
            >
              <Sparkles className={`w-3.5 h-3.5 ${isAligningScript ? 'animate-spin' : ''}`} />
              <span>{isAligningScript ? (isBn ? 'বিশ্লেষণ হচ্ছে...' : 'Aligning...') : (isBn ? '🎯 স্ক্রিপ্ট মিলিয়ে বানান কারেকশন' : '🎯 Script Grounded Spell Check')}</span>
            </button>
          </div>

          {/* TAB 1: CO-PILOT COMMAND BAR */}
          {activeSubTab === 'copilot' && (
            <div className="space-y-3">
              {/* Input & Mic Bar */}
              <div className="relative flex items-center bg-[#15161e] border border-[#2d2f40] focus-within:border-indigo-500/70 rounded-xl p-1.5 shadow-inner transition-colors">
                <button
                  onClick={toggleListening}
                  disabled={isTranscribingVoice}
                  className={`p-2.5 rounded-lg transition-all ${
                    isListening
                      ? 'bg-rose-500 text-white animate-pulse shadow-lg shadow-rose-500/40'
                      : isTranscribingVoice
                      ? 'bg-indigo-600/30 text-indigo-400'
                      : 'text-gray-400 hover:text-indigo-400 hover:bg-white/5'
                  }`}
                  title={
                    isListening
                      ? (isBn ? '🎙️ কথা বলা শেষ হলে ক্লিক করুন' : 'Click to finish speaking')
                      : (isBn ? '🎙️ মাইক্রোফোনে কথা বলুন' : 'Speak command')
                  }
                >
                  {isTranscribingVoice ? (
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                  ) : isListening ? (
                    <Mic className="w-4 h-4 animate-bounce" />
                  ) : (
                    <Mic className="w-4 h-4" />
                  )}
                </button>

                <input
                  type="text"
                  value={commandInput}
                  onChange={(e) => setCommandInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleExecuteCommand();
                  }}
                  placeholder={
                    isListening
                      ? (isBn ? '🎙️ শুনছি... মাইকে কথা বলুন... শেষ হলে মাইকে চাপুন' : '🎙️ Listening... Speak now... tap mic when done')
                      : isTranscribingVoice
                      ? (isBn ? '⏳ কথা প্রসেস হচ্ছে...' : '⏳ Transcribing voice...')
                      : (isBn
                          ? "কী করতে চান বলুন বা লিখুন (যেমন: 'সব দাড়ি কমা বাদ দাও', 'Teal & Orange কালার দাও')..."
                          : "Type or speak command (e.g. 'remove all punctuation', 'apply teal & orange look')...")
                  }
                  className="flex-1 bg-transparent px-3 text-xs text-gray-200 placeholder-gray-500 outline-none select-text cursor-text"
                />

                <button
                  onClick={() => handleExecuteCommand()}
                  disabled={!commandInput.trim() || isProcessingCommand}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all shadow-md shadow-indigo-900/30"
                >
                  {isProcessingCommand ? (
                    <Sparkles className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>{isProcessingCommand ? (isBn ? 'প্রসেস হচ্ছে...' : 'Running...') : (isBn ? 'সেন্ড' : 'Execute')}</span>
                </button>
              </div>

              {/* Quick Action Chips */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-gray-400 mr-1 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-indigo-400" />
                  {isBn ? 'কুইক অ্যাকশন:' : 'Quick Actions:'}
                </span>

                <button
                  onClick={() => handleExecuteCommand('সব দাড়ি কমা বাদ দিয়ে দাও')}
                  className="px-2.5 py-1 bg-[#232432] hover:bg-[#2c2d3e] border border-[#353648] hover:border-indigo-500/40 rounded-lg text-[11px] text-gray-300 hover:text-white transition-colors"
                >
                  🚫 {isBn ? 'দাড়ি-কমা মুছুন' : 'Strip All Punctuation'}
                </button>

                <button
                  onClick={() => handleExecuteCommand('স্ক্রিপ্ট অনুযায়ী ব্র্যান্ড নাম ঠিক করো')}
                  className="px-2.5 py-1 bg-[#232432] hover:bg-[#2c2d3e] border border-[#353648] hover:border-indigo-500/40 rounded-lg text-[11px] text-gray-300 hover:text-white transition-colors"
                >
                  🔠 {isBn ? 'ব্র্যান্ড ও নাম ফিক্স' : 'Fix Brand Names'}
                </button>

                <button
                  onClick={() => handleExecuteCommand('সিনেমাটিক টিল অ্যান্ড অরেঞ্জ কালার গ্রেড দাও')}
                  className="px-2.5 py-1 bg-[#232432] hover:bg-[#2c2d3e] border border-[#353648] hover:border-indigo-500/40 rounded-lg text-[11px] text-gray-300 hover:text-white transition-colors"
                >
                  🎨 {isBn ? 'Teal & Orange কালার গ্রেড' : 'Teal & Orange Grade'}
                </button>

                <button
                  onClick={() => handleExecuteCommand('সিনেমাটিক ব্যাকগ্রাউন্ড মিউজিক সাজেস্ট করো')}
                  className="px-2.5 py-1 bg-[#232432] hover:bg-[#2c2d3e] border border-[#353648] hover:border-indigo-500/40 rounded-lg text-[11px] text-gray-300 hover:text-white transition-colors"
                >
                  🎵 {isBn ? 'ফ্রি BGM সাজেশন' : 'Pixabay Free BGM'}
                </button>

                <button
                  onClick={() => handleExecuteCommand('সব অডিও ক্লিপের ভলিউম ব্যালেন্স করো এবং পিক -৬ ডিবি তে রাখো')}
                  className="px-2.5 py-1 bg-[#232432] hover:bg-[#2c2d3e] border border-[#353648] hover:border-purple-500/40 rounded-lg text-[11px] text-purple-300 hover:text-white transition-colors"
                >
                  🎛️ {isBn ? 'ভয়েস ব্যালেন্স (-6dB)' : 'Harmonize Audio (-6dB)'}
                </button>

                <button
                  onClick={() => handleExecuteCommand('সব সংখ্যা ডিজিটে রূপান্তর করো')}
                  className="px-2.5 py-1 bg-[#232432] hover:bg-[#2c2d3e] border border-[#353648] hover:border-indigo-500/40 rounded-lg text-[11px] text-gray-300 hover:text-white transition-colors"
                >
                  🔢 {isBn ? 'সংখ্যাকে ডিজিটে রূপান্তর' : 'Numbers to Digits'}
                </button>
              </div>

              {/* Last Command Status Banner */}
              {lastCommandResult && (
                <div className="p-2.5 rounded-lg bg-indigo-950/40 border border-indigo-500/30 flex items-start justify-between gap-3 text-xs">
                  <div className="flex items-start gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-gray-200">{lastCommandResult.message}</p>
                      {lastCommandResult.corrections > 0 && (
                        <p className="text-[11px] text-indigo-300 mt-0.5">
                          {isBn ? `${lastCommandResult.corrections}টি শব্দ পরিবর্তিত হয়েছে।` : `${lastCommandResult.corrections} words updated.`}
                        </p>
                      )}
                    </div>
                  </div>

                  {undoSnapshot && (
                    <button
                      onClick={handleUndo}
                      className="px-2 py-1 bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white rounded text-[11px] font-medium flex items-center gap-1 shrink-0 transition-colors"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>{isBn ? 'বাতিল (Undo)' : 'Undo'}</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CLIENT SCRIPT INGESTION */}
          {activeSubTab === 'script' && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-300">
                    {isBn ? 'ক্লায়েন্ট স্ক্রিপ্ট বা ডায়ালগ টেক্সট' : 'Client Script or Dialogue'}
                  </span>
                  {uploadedFileName && (
                    <span className="text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      ✓ {uploadedFileName}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.srt,.json"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-[#282937] hover:bg-[#323344] border border-[#3c3e50] text-gray-300 hover:text-white rounded-lg text-xs transition-colors"
                    title={isBn ? '.txt, .srt বা .json ফাইল আপলোড করুন' : 'Upload .txt, .srt, or .json file'}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{isBn ? 'ফাইল আপলোড (.txt, .srt, .json)' : 'Upload File (.txt, .srt, .json)'}</span>
                  </button>

                  <button
                    onClick={handleSaveAndSync}
                    className="flex items-center gap-1.5 px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition-colors shadow-sm"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{isBn ? 'সেভ ও সিঙ্ক' : 'Save & Sync'}</span>
                  </button>
                </div>
              </div>

              <textarea
                value={scriptDraft}
                onChange={(e) => setScriptDraft(e.target.value)}
                rows={5}
                placeholder={
                  isBn
                    ? "এখানে ক্লায়েন্টের দেওয়া মূল স্ক্রিপ্ট পেস্ট করুন, অথবা উপরের 'ফাইল আপলোড' বাটনে ক্লিক করে .txt, .srt, বা .json ফাইল আপলোড করুন। এআই স্বয়ংক্রিয়ভাবে টাইমলাইন অডিওর সাথে মিলিয়ে বানান ও পরিভাষা ঠিক করবে..."
                    : "Paste official client script here, or click 'Upload File' to load .txt, .srt, or .json. AI will align terminology and correct misspellings against it..."
                }
                className="w-full bg-[#15161e] border border-[#2a2c3a] focus:border-indigo-500/70 rounded-xl p-3 text-xs text-gray-200 placeholder-gray-500 outline-none resize-none leading-relaxed"
              />

              <div className="flex items-center justify-between text-[11px] text-gray-400">
                <span>
                  {isBn
                    ? '💡 নোট: ভিডিওর মুখে বলা কথাই গ্রাউন্ড ট্রুথ। স্ক্রিপ্ট থেকে কেবল সঠিক বানান ও পরিভাষা নেওয়া হবে, কোনো না-বলা কথা যোগ করা হবে না।'
                    : '💡 Timeline spoken audio is ground truth. Spoken words are never dropped; only spelling and terminology are aligned.'}
                </span>
                <span className="font-mono text-gray-400">{wordCount} words</span>
              </div>

              {/* 1-Click Script-to-Rough Cut Sequence Action Panel */}
              <div className="mt-3 p-3.5 bg-gradient-to-r from-indigo-950/40 via-[#181926] to-purple-950/30 border border-indigo-500/30 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-indigo-500/20 text-indigo-400 rounded-lg border border-indigo-500/30">
                      <Film className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-white">
                        {isBn ? '১-ক্লিকে স্ক্রিপ্ট-টু-রাফ কাট সিকোয়েন্স' : '1-Click Script-to-Rough Cut Sequence'}
                      </h4>
                      <p className="text-[10px] text-gray-400">
                        {isBn
                          ? 'ব্র্যাকেট ও টেক ফিল্টার করে মূল সিকোয়েন্স ক্লোন করে সরাসরি প্রিমিয়ারে কাট করবে'
                          : 'Filters stage brackets, eliminates bad takes, clones sequence & executes cuts in Premiere'}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleCreateScriptRoughCut()}
                    disabled={isCreatingRoughCut || !scriptDraft.trim()}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-lg ${
                      isCreatingRoughCut || !scriptDraft.trim()
                        ? 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'
                        : 'bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-indigo-600/30 hover:scale-[1.02] active:scale-[0.98]'
                    }`}
                  >
                    {isCreatingRoughCut ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>{isBn ? 'প্রসেসিং হচ্ছে...' : 'Processing...'}</span>
                      </>
                    ) : (
                      <>
                        <Film className="w-3.5 h-3.5" />
                        <span>{isBn ? '🎬 Create Script Rough-Cut' : '🎬 Create Script Rough-Cut'}</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Feature Badges */}
                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-white/5 text-[10px]">
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                    <CheckCircle2 className="w-3 h-3" />
                    {isBn ? '১০০% নন-ডেস্ট্রাক্টিভ (নতুন সিকোয়েন্স)' : '100% Non-Destructive (Clones Seq)'}
                  </span>
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">
                    <Sparkles className="w-3 h-3" />
                    {isBn ? 'A/B Cam পাঞ্চ-ইন (১১২%)' : 'A/B Cam Punch-In (112%)'}
                  </span>
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/20 font-medium">
                    <Palette className="w-3 h-3" />
                    {isBn ? 'অ্যাক্ট কালার কোডিং' : 'Act Color Coding'}
                  </span>
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 font-medium">
                    <Bookmark className="w-3 h-3" />
                    {isBn ? 'চ্যাপ্টার ও বি-রোল মার্কার' : 'Chapter & B-Roll Markers'}
                  </span>
                </div>

                {/* In-progress status banner */}
                {isCreatingRoughCut && roughCutProgressStep && (
                  <div className="p-2.5 bg-indigo-950/60 border border-indigo-500/30 rounded-lg text-xs text-indigo-300 flex items-center gap-2 animate-pulse">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400 shrink-0" />
                    <span>{roughCutProgressStep}</span>
                  </div>
                )}

                {/* Result banner */}
                {roughCutResult && (
                  <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-emerald-300 font-semibold text-xs">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>
                          {isBn ? 'নতুন সিকোয়েন্স তৈরি সম্পন্ন:' : 'Sequence Created Successfully:'}{' '}
                          <code className="text-white bg-black/40 px-1.5 py-0.5 rounded font-mono text-[11px]">
                            {roughCutResult.sequenceName}
                          </code>
                        </span>
                      </div>
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-bold">
                        {roughCutResult.totalCutDuration}s {isBn ? 'সময় সাশ্রয়' : 'saved'}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center text-[10px] text-gray-300 pt-1">
                      <div className="p-1.5 bg-black/30 rounded-lg border border-white/5">
                        <span className="block font-bold text-emerald-400 text-xs">
                          {roughCutResult.cutsExecuted || 0}
                        </span>
                        <span>{isBn ? 'অপ্রয়োজনীয় টেক কাট' : 'Bad Takes Cut'}</span>
                      </div>
                      <div className="p-1.5 bg-black/30 rounded-lg border border-white/5">
                        <span className="block font-bold text-amber-400 text-xs">
                          {roughCutResult.punchesApplied || 0}
                        </span>
                        <span>{isBn ? 'পাঞ্চ-ইন (১১২%)' : 'Punch-Ins (112%)'}</span>
                      </div>
                      <div className="p-1.5 bg-black/30 rounded-lg border border-white/5">
                        <span className="block font-bold text-purple-400 text-xs">
                          {roughCutResult.markersPlaced || 0}
                        </span>
                        <span>{isBn ? 'মার্কার স্থাপিত' : 'Markers Placed'}</span>
                      </div>
                    </div>

                    {roughCutResult.summary && (
                      <p className="text-[10px] text-emerald-300/80 leading-relaxed pt-1">
                        {roughCutResult.summary}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: CLIENT BRIEF INGESTION */}
          {activeSubTab === 'brief' && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-300">
                  {isBn ? 'ক্লায়েন্টের ব্রিফ, ব্র্যান্ড গাইডলাইন ও টোন' : 'Client Brief, Brand Guidelines & Tone'}
                </span>

                <button
                  onClick={handleSaveAndSync}
                  className="flex items-center gap-1.5 px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition-colors shadow-sm"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isBn ? 'সেভ ও সিঙ্ক' : 'Save & Sync'}</span>
                </button>
              </div>

              <textarea
                value={briefDraft}
                onChange={(e) => setBriefDraft(e.target.value)}
                rows={5}
                placeholder={
                  isBn
                    ? "ক্লায়েন্টের কোনো বিশেষ নোট বা নির্দেশনা থাকলে এখানে পেস্ট করুন (যেমন: 'ভিডিওটি টেকনোলজি ওরিয়েন্টেড', 'ব্র্যান্ড নেম সর্বদা ইংরেজি বড় অক্ষরে হবে', 'দাড়ি-কমা পরিহার করুন', 'কালার হবে কুল ব্লু/টিয়াল')..."
                    : "Paste any client brief, notes, audience guidelines, or special instructions (e.g. 'Brand name must be capitalized', 'Avoid commas', 'Target young tech audience')..."
                }
                className="w-full bg-[#15161e] border border-[#2a2c3a] focus:border-indigo-500/70 rounded-xl p-3 text-xs text-gray-200 placeholder-gray-500 outline-none resize-none leading-relaxed"
              />

              <p className="text-[11px] text-gray-400">
                {isBn
                  ? 'এই ব্রিফটি বি-রোল সিলেকশন, সাউন্ড ডিজাইন, কালার গ্রেড এবং টেক্সট টিউনিংয়ের সময় এআই ব্যাকগ্রাউন্ডে বিবেচনা করবে।'
                  : 'AI considers this brief when recommending B-Roll, sound design, color grades, and caption styling.'}
              </p>
            </div>
          )}

          {/* TAB 4: TRANSPARENT AUDIT REPORT */}
          {activeSubTab === 'audit' && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-300">
                    {isBn ? 'স্ক্রিপ্ট এলাইনমেন্ট অডিট হিস্টোরি' : 'Script Alignment Audit History'}
                  </span>
                  {scriptAuditReport && scriptAuditReport.length > 0 && (
                    <span className="text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-bold">
                      {scriptAuditReport.length} {isBn ? 'টি পরিবর্তন' : 'changes applied'}
                    </span>
                  )}
                </div>

                {scriptAuditReport && scriptAuditReport.length > 0 && (
                  <button
                    onClick={() => setScriptAuditReport([])}
                    className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-rose-400 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>{isBn ? 'রিপোর্ট ক্লিয়ার করুন' : 'Clear Report'}</span>
                  </button>
                )}
              </div>

              {(!scriptAuditReport || scriptAuditReport.length === 0) ? (
                <div className="p-6 text-center rounded-xl bg-[#15161e] border border-[#262836]">
                  <CheckCircle2 className="w-8 h-8 text-gray-500 mx-auto mb-2 opacity-60" />
                  <p className="text-xs text-gray-400">
                    {isBn
                      ? "এখনো কোনো অডিট রিপোর্ট নেই। উপরে '🎯 স্ক্রিপ্ট মিলিয়ে বানান কারেকশন' বাটনে ক্লিক করলে সমস্ত পরিবর্তনের তালিকা এখানে দেখা যাবে।"
                      : "No audit records yet. Click '🎯 Script Grounded Spell Check' above to inspect change records."}
                  </p>
                </div>
              ) : (
                <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                  {scriptAuditReport.map((item: AuditItem, idx: number) => (
                    <div
                      key={item.id || idx}
                      className="p-2.5 rounded-lg bg-[#15161e] border border-[#282a38] hover:border-[#383a4c] transition-colors text-xs flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        {typeof item.start === 'number' && (
                          <button
                            onClick={() => handleSeek(item.start)}
                            className="font-mono text-[10px] bg-indigo-500/15 hover:bg-indigo-500/30 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-500/20 transition-colors"
                            title={isBn ? 'টাইমলাইনে যান' : 'Jump to timestamp'}
                          >
                            [{Math.floor(item.start / 60)}:{String(Math.floor(item.start % 60)).padStart(2, '0')}]
                          </button>
                        )}

                        <div className="flex items-center gap-2">
                          <span className="line-through text-rose-400 font-medium">{item.original}</span>
                          <span className="text-gray-500">→</span>
                          <span className="text-emerald-400 font-semibold">{item.replacement}</span>
                        </div>

                        {item.reason && (
                          <span className="text-[10px] text-gray-400 bg-white/5 px-2 py-0.5 rounded">
                            {item.reason}
                          </span>
                        )}
                      </div>

                      {item.scriptContext && (
                        <span className="text-[10px] text-gray-400 italic truncate max-w-[200px]" title={item.scriptContext}>
                          "{item.scriptContext}"
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};