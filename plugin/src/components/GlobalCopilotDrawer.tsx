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
  Music,
  CheckCircle2,
  Sliders,
  Type,
  FileText
} from 'lucide-react';

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
    clientBriefText,
    brandKit,
    setRecommendedBgmData,
    setScriptAuditReport,
    showToast
  } = usePrismexStore();

  const isBn = language === 'bn';
  const client = PrismexDaemonClient.getInstance();
  const bridge = PremiereHostBridge.getInstance();

  const [commandInput, setCommandInput] = useState<string>('');
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [responseHistory, setResponseHistory] = useState<Array<{
    id: string;
    sender: 'user' | 'assistant';
    text: string;
    action?: string;
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
  const recognitionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [responseHistory]);

  // Setup Web Speech API
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = isBn ? 'bn-BD' : 'en-US';

        recognition.onstart = () => setIsListening(true);
        recognition.onresult = (event: any) => {
          let curr = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            curr += event.results[i][0].transcript;
          }
          if (curr.trim()) setCommandInput(curr);
        };
        recognition.onerror = () => setIsListening(false);
        recognition.onend = () => setIsListening(false);
        recognitionRef.current = recognition;
      } catch (e) {
        console.warn('Speech rec error:', e);
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
          ? 'এই ব্রাউজার বা সিইপি প্যানেলে ভয়েস রিকগনিশন সক্রিয় নেই। টেক্সট লিখে পাঠান।'
          : 'Microphone not available in this window. Please type.',
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
      } catch {
        setIsListening(false);
      }
    }
  };

  const handleSendCommand = async (cmdText?: string) => {
    const finalCmd = (cmdText || commandInput).trim();
    if (!finalCmd) return;

    // Push user message
    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setResponseHistory((prev) => [
      ...prev,
      { id: `usr_${Date.now()}`, sender: 'user', text: finalCmd, time: nowStr }
    ]);

    setCommandInput('');
    setIsProcessing(true);

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
      if (res.action === 'update_text' && res.words) {
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
    <div
      style={{
        position: 'fixed',
        bottom: '68px',
        right: '16px',
        width: '380px',
        maxHeight: '520px',
        height: '80vh',
        backgroundColor: '#13141c',
        border: '1px solid #2e3044',
        borderRadius: '16px',
        boxShadow: '0 16px 48px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.06)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 9995,
        overflow: 'hidden'
      }}
    >
      {/* Top Header */}
      <div className="p-3 bg-gradient-to-r from-[#1c1d2b] to-[#161722] border-b border-[#2a2c3e] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
            <Mic className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-xs text-white">
                {isBn ? 'এআই কো-পাইলট' : 'AI Co-Pilot'}
              </span>
              <span className="text-[9px] bg-emerald-500/20 text-emerald-300 font-mono px-1.5 py-0.2 rounded border border-emerald-500/30">
                Live
              </span>
            </div>
            {brandKit.brandName && (
              <span className="text-[10px] text-gray-400">
                Brand: <strong className="text-gray-200">{brandKit.brandName}</strong>
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {undoSnapshot && (
            <button
              onClick={handleUndo}
              className="px-2 py-0.5 rounded text-[10px] font-medium text-amber-300 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 flex items-center gap-1"
            >
              <RotateCcw className="w-2.5 h-2.5" />
              <span>Undo</span>
            </button>
          )}

          <button
            onClick={() => setIsGlobalCopilotOpen(false)}
            className="p-1 text-gray-400 hover:text-white rounded hover:bg-white/10"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Brand Color Indicator Strip */}
      {brandKit.palette && brandKit.palette.length > 0 && (
        <div className="px-3 py-1.5 bg-[#0f1017] border-b border-[#232432] flex items-center justify-between text-[10px]">
          <span className="text-gray-400">{isBn ? 'ব্র্যান্ড প্যালেট:' : 'Brand Palette:'}</span>
          <div className="flex items-center gap-1">
            {brandKit.palette.slice(0, 5).map((hex: string, i: number) => (
              <div
                key={i}
                className="w-3.5 h-3.5 rounded-full border border-black/40 shadow-sm"
                style={{ backgroundColor: hex }}
                title={hex}
              />
            ))}
          </div>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 text-xs">
        {responseHistory.map((item) => (
          <div
            key={item.id}
            className={`flex flex-col ${item.sender === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[88%] p-2.5 rounded-xl whitespace-pre-wrap leading-relaxed shadow-sm ${
                item.sender === 'user'
                  ? 'bg-indigo-600 text-white rounded-br-none'
                  : 'bg-[#1e202d] text-gray-200 border border-[#2d2f42] rounded-bl-none'
              }`}
            >
              {item.text}
            </div>
            <span className="text-[9.5px] text-gray-500 mt-1 px-1">{item.time}</span>
          </div>
        ))}

        {isProcessing && (
          <div className="flex items-center gap-2 text-indigo-400 p-2 text-xs">
            <Sparkles className="w-3.5 h-3.5 animate-spin" />
            <span>{isBn ? 'বিশ্লেষণ হচ্ছে...' : 'Analyzing instruction...'}</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Action Chips Carousel */}
      <div className="px-2.5 py-1.5 bg-[#171822] border-t border-[#252737] flex items-center gap-1.5 overflow-x-auto scrollbar-none">
        <button
          onClick={() => handleSendCommand('ক্লায়েন্ট কয়টা ফরম্যাটে চাইছে?')}
          className="px-2 py-0.5 rounded text-[10px] bg-[#222434] hover:bg-[#2b2d42] border border-[#33364c] text-indigo-300 hover:text-white shrink-0 transition-colors"
        >
          📋 {isBn ? 'ফরম্যাট কয়টা?' : 'Format Request?'}
        </button>

        <button
          onClick={() => handleSendCommand('লোগো এবং ব্র্যান্ডের কালার কোড কী?')}
          className="px-2 py-0.5 rounded text-[10px] bg-[#222434] hover:bg-[#2b2d42] border border-[#33364c] text-emerald-300 hover:text-white shrink-0 transition-colors"
        >
          🎨 {isBn ? 'কালার কোড কী?' : 'Color Codes?'}
        </button>

        <button
          onClick={() => handleSendCommand('সব দাড়ি কমা বাদ দিয়ে দাও')}
          className="px-2 py-0.5 rounded text-[10px] bg-[#222434] hover:bg-[#2b2d42] border border-[#33364c] text-rose-300 hover:text-white shrink-0 transition-colors"
        >
          🚫 {isBn ? 'দাড়ি-কমা মুছুন' : 'Strip Punctuation'}
        </button>

        <button
          onClick={() => handleSendCommand('সিনেমাটিক টিল অ্যান্ড অরেঞ্জ কালার দাও')}
          className="px-2 py-0.5 rounded text-[10px] bg-[#222434] hover:bg-[#2b2d42] border border-[#33364c] text-amber-300 hover:text-white shrink-0 transition-colors"
        >
          🎬 {isBn ? 'Teal & Orange গ্রেড' : 'Teal & Orange'}
        </button>

        <button
          onClick={() => handleSendCommand('ফ্রি ব্যাকগ্রাউন্ড মিউজিক সাজেস্ট করো')}
          className="px-2 py-0.5 rounded text-[10px] bg-[#222434] hover:bg-[#2b2d42] border border-[#33364c] text-sky-300 hover:text-white shrink-0 transition-colors"
        >
          🎵 {isBn ? 'BGM মিউজিক' : 'Free BGM'}
        </button>
      </div>

      {/* Input Bar */}
      <div className="p-2 bg-[#151620] border-t border-[#262838] flex items-center gap-1.5">
        <button
          onClick={toggleListening}
          className={`p-2 rounded-lg transition-all ${
            isListening
              ? 'bg-rose-500 text-white animate-pulse shadow-md shadow-rose-500/50'
              : 'text-gray-400 hover:text-indigo-400 hover:bg-white/5'
          }`}
          title={isListening ? (isBn ? 'ভয়েস অফ করুন' : 'Stop listening') : (isBn ? 'ভয়েসে বলুন' : 'Speak command')}
        >
          <Mic className="w-3.5 h-3.5" />
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
              ? (isBn ? 'শোনা হচ্ছে... বলুন...' : 'Listening... Speak now...')
              : (isBn ? 'মুখে বলুন বা টাইপ করুন...' : 'Speak or type command...')
          }
          className="flex-1 bg-transparent px-2 text-xs text-gray-200 placeholder-gray-500 outline-none"
        />

        <button
          onClick={() => handleSendCommand()}
          disabled={!commandInput.trim() || isProcessing}
          className="p-1.5 px-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg text-xs font-medium transition-colors"
        >
          <Send className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};