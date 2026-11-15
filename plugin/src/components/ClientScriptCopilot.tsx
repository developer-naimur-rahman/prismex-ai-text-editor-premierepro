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
  Type
} from 'lucide-react';

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

  // Setup Web Speech API for voice assistant
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = isBn ? 'bn-BD' : 'en-US';

        recognition.onstart = () => {
          setIsListening(true);
        };

        recognition.onresult = (event: any) => {
          let currentTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            currentTranscript += event.results[i][0].transcript;
          }
          if (currentTranscript.trim()) {
            setCommandInput(currentTranscript);
          }
        };

        recognition.onerror = (event: any) => {
          console.warn('Speech recognition error:', event.error);
          setIsListening(false);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      } catch (e) {
        console.warn('Speech recognition init error:', e);
      }
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
    };
  }, [isBn]);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      showToast?.(
        isBn
          ? 'এই ব্রাউজার বা সিইপি প্যানেলে ভয়েস রিকগনিশন সক্রিয় নেই। টেক্সট লিখে কমান্ড দিন।'
          : 'Microphone recognition not available in this environment. Please type your command.',
        'info'
      );
      return;
    }

    if (isListening) {
      try {
        recognitionRef.current.stop();
      } catch {}
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.lang = isBn ? 'bn-BD' : 'en-US';
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.warn('Speech recognition start failed:', err);
        setIsListening(false);
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
                  className={`p-2.5 rounded-lg transition-all ${
                    isListening
                      ? 'bg-rose-500 text-white animate-pulse shadow-lg shadow-rose-500/40'
                      : 'text-gray-400 hover:text-indigo-400 hover:bg-white/5'
                  }`}
                  title={isListening ? (isBn ? 'ভয়েস রেকর্ডিং বন্ধ করুন' : 'Stop listening') : (isBn ? 'মাইক্রোফোনে কথা বলুন' : 'Speak command')}
                >
                  {isListening ? <Mic className="w-4 h-4 animate-bounce" /> : <Mic className="w-4 h-4" />}
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
                      ? (isBn ? 'বলুন... আপনার কথা শোনা হচ্ছে...' : 'Listening... Speak now...')
                      : (isBn
                          ? "কী করতে চান বলুন বা লিখুন (যেমন: 'সব দাড়ি কমা বাদ দাও', 'Teal & Orange কালার দাও')..."
                          : "Type or speak command (e.g. 'remove all punctuation', 'apply teal & orange look')...")
                  }
                  className="flex-1 bg-transparent px-3 text-xs text-gray-200 placeholder-gray-500 outline-none"
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