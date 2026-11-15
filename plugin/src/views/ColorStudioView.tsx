import React, { useState, useEffect, useRef } from 'react';
import { usePrismexStore } from '../state/usePrismexStore';
import { PrismexDaemonClient } from '../api/PrismexDaemonClient';
import { PremiereHostBridge } from '../host/PremiereHostBridge';
import { 
  Palette, 
  Camera, 
  Sparkles, 
  ShieldCheck, 
  Sliders, 
  UploadCloud, 
  CheckCircle2, 
  FolderOpen, 
  Layers, 
  Info,
  Wand2,
  RefreshCw,
  Film,
  Sun,
  Eye,
  SlidersHorizontal
} from 'lucide-react';

interface ColorPreset {
  id: string;
  title: string;
  description: string;
  badge: string;
  gradient: string;
}

const PRESETS: ColorPreset[] = [
  {
    id: 'auto_balance',
    title: 'Studio Auto-Balance',
    description: 'Instant 1-click exposure, highlight recovery, and neutral white balance polish.',
    badge: '1-Click Master',
    gradient: 'linear-gradient(135deg, #3b82f6, #06b6d4)'
  },
  {
    id: 'kodak_2383',
    title: 'Kodak 2383 Print Film',
    description: 'Iconic Hollywood motion picture film print with rich cyan-teal shadows and warm amber skin.',
    badge: 'Cinema Classic',
    gradient: 'linear-gradient(135deg, #f59e0b, #ef4444)'
  },
  {
    id: 'arri_alexa',
    title: 'Arri Alexa Commercial',
    description: 'Ultra-wide latitude, velvety smooth black floor, and organic lifelike skin tones.',
    badge: 'Gold Standard',
    gradient: 'linear-gradient(135deg, #10b981, #059669)'
  },
  {
    id: 'netflix_prestige',
    title: 'Netflix Prestige Drama',
    description: 'Sophisticated streaming aesthetic with muted organic tones and cool architectural shadows.',
    badge: 'Prestige Drama',
    gradient: 'linear-gradient(135deg, #6366f1, #8b5cf6)'
  },
  {
    id: 'teal_orange',
    title: 'Modern Teal & Orange',
    description: 'The quintessential blockbuster look. High-energy complementary contrast separating subjects.',
    badge: 'Blockbuster',
    gradient: 'linear-gradient(135deg, #0ea5e9, #f97316)'
  },
  {
    id: 'nordic_noir',
    title: 'Nordic Noir Thriller',
    description: 'David Fincher inspired dark mystery aesthetic with subdued greens and high contrast.',
    badge: 'Moody Noir',
    gradient: 'linear-gradient(135deg, #475569, #1e293b)'
  },
  {
    id: 'golden_hour',
    title: 'Golden Hour Sunset',
    description: 'Dreamy warm afternoon glow with lifted soft shadows and romantic sun-kissed skin.',
    badge: 'Warm Glow',
    gradient: 'linear-gradient(135deg, #fbbf24, #ea580c)'
  },
  {
    id: 'clean_documentary',
    title: 'Clean Documentary Pro',
    description: '100% true-to-life broadcast grading. Optimal neutral white balance and natural greens.',
    badge: 'Broadcast Safe',
    gradient: 'linear-gradient(135deg, #14b8a6, #0284c7)'
  }
];

export const ColorStudioView: React.FC = () => {
  const { language, sequenceManifest } = usePrismexStore();
  const client = PrismexDaemonClient.getInstance();
  const bridge = PremiereHostBridge.getInstance();

  const [frameBase64, setFrameBase64] = useState<string | null>(null);
  const [framePath, setFramePath] = useState<string | null>(null);
  const [referenceBase64, setReferenceBase64] = useState<string | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<string>('auto_balance');
  const [userPrompt, setUserPrompt] = useState<string>('');
  const [intensity, setIntensity] = useState<number>(100); // 0-150%
  const [lockSkinTones, setLockSkinTones] = useState<boolean>(true);
  
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [result, setResult] = useState<any | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-capture playhead frame on mount
  useEffect(() => {
    capturePlayheadFrame();
  }, []);

  const capturePlayheadFrame = async () => {
    setIsCapturing(true);
    setStatusMessage(language === 'bn' ? 'প্লেহেড থেকে ফ্রেম ক্যাপচার করা হচ্ছে...' : 'Capturing playhead frame...');
    try {
      const clipRes = await bridge.getActiveClipAtPlayhead();
      if (clipRes && clipRes.mediaPath) {
        // Extract via daemon ffmpeg
        const sec = clipRes.sourceFrameSeconds || 0.0;
        const ffmpegRes = await client.extractFrameFFmpeg(clipRes.mediaPath, sec);
        if (ffmpegRes && ffmpegRes.frameBase64) {
          setFrameBase64(ffmpegRes.frameBase64);
          setFramePath(ffmpegRes.framePath);
          setStatusMessage(language === 'bn' ? '✓ ফ্রেম ক্যাপচার সফল' : '✓ Frame captured successfully');
          setIsCapturing(false);
          return;
        }
      }

      // Fallback: try exportFrameAtPlayhead
      const tmpPath = `/tmp/prismex_frame_${Date.now()}.png`;
      const expRes = await bridge.exportFrameAtPlayhead(tmpPath);
      if (expRes && expRes.domExported) {
        setFramePath(tmpPath);
        setStatusMessage(language === 'bn' ? '✓ ফ্রেম ক্যাপচার সফল' : '✓ Frame captured successfully');
      } else {
        // Fallback demo frame if no active sequence is open
        setStatusMessage(language === 'bn' ? 'টাইমলাইন থেকে ফ্রেম রিড করা যায়নি, বাটন ক্লিক করে আবার চেষ্টা করুন' : 'Click to capture current sequence playhead frame');
      }
    } catch (err: any) {
      console.error('Capture frame error:', err);
      setStatusMessage(language === 'bn' ? 'ফ্রেম এক্সপোর্ট ত্রুটি' : 'Frame export error');
    } finally {
      setIsCapturing(false);
    }
  };

  const handleReferenceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const b64 = event.target?.result as string;
        setReferenceBase64(b64);
        setSelectedPreset('reference_match');
      };
      reader.readAsDataURL(file);
    }
  };

  const executeColorGrade = async () => {
    if (!frameBase64 && !framePath) {
      await capturePlayheadFrame();
    }

    setIsProcessing(true);
    setStatusMessage(language === 'bn' ? 'এআই সিনেমাটিক গ্রেড তৈরি হচ্ছে...' : 'Generating studio grade .cube LUT...');

    try {
      const payload: any = {
        frameBase64: frameBase64 || undefined,
        framePath: framePath || undefined,
        referenceBase64: selectedPreset === 'reference_match' ? (referenceBase64 || undefined) : undefined,
        stylePreset: selectedPreset,
        userPrompt: userPrompt.trim() ? userPrompt.trim() : undefined,
        intensity: intensity / 100.0,
        lockSkinTones: lockSkinTones,
        customName: `Prismex_${selectedPreset}`
      };

      const res = await client.gradeFrame(payload);
      if (res && res.success) {
        setResult(res);
        setStatusMessage(language === 'bn' ? '✓ স্টুডিও গ্রেড সফলভাবে সম্পন্ন এবং অ্যাডোবিতে সেভ হয়েছে!' : '✓ Studio Grade generated and deployed to Adobe Premiere Pro!');
      } else {
        setStatusMessage(`Error: ${res?.error || 'Failed to grade'}`);
      }
    } catch (err: any) {
      console.error('Grade error:', err);
      setStatusMessage(`Error: ${String(err)}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const revealLut = async () => {
    if (result && result.lut_path) {
      await bridge.revealFileInOS(result.lut_path);
    }
  };

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100%', 
      backgroundColor: 'var(--bg-primary)',
      color: 'var(--text-primary)',
      overflowY: 'auto',
      padding: '16px',
      gap: '16px'
    }}>
      {/* Header Banner */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(139, 92, 246, 0.12))',
        border: '1px solid rgba(139, 92, 246, 0.25)',
        borderRadius: '8px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '6px',
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff'
          }}>
            <Palette size={18} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '13px', letterSpacing: '0.3px', color: '#fff' }}>
              {language === 'bn' ? 'প্রিজমেক্স এআই কালার স্টুডিও' : 'Prismex AI Color Studio'}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              {language === 'bn' ? 'হলিউড মাস্টার গ্রেডিং • স্কিন-টোন ভেক্টর প্রটেকশন • ৩ডি LUT (.cube)' : 'Hollywood Master Grading • Skin Tone Protection • True 3D LUT (.cube)'}
            </div>
          </div>
        </div>

        <button
          onClick={capturePlayheadFrame}
          disabled={isCapturing}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: 'var(--bg-tertiary)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-primary)',
            padding: '6px 12px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          <Camera size={13} className={isCapturing ? 'animate-spin' : ''} />
          <span>{language === 'bn' ? 'প্লেহেড ফ্রেম ক্যাপচার' : 'Capture Playhead'}</span>
        </button>
      </div>

      {/* Frame Comparison & Preview Deck */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: result?.preview_image_base64 ? '1fr 1fr' : '1fr',
        gap: '12px',
        backgroundColor: 'var(--bg-secondary)',
        padding: '12px',
        borderRadius: '8px',
        border: '1px solid var(--border-subtle)'
      }}>
        {/* Source Frame */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Film size={12} />
            <span>{language === 'bn' ? 'মূল ফ্রেম (Original Frame)' : 'Original Playhead Frame'}</span>
          </div>
          <div style={{
            height: '160px',
            backgroundColor: '#0a0a0c',
            borderRadius: '6px',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px dashed rgba(255,255,255,0.1)'
          }}>
            {frameBase64 ? (
              <img src={frameBase64} alt="Playhead Frame" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '11px' }}>
                <Camera size={24} style={{ margin: '0 auto 6px', opacity: 0.5 }} />
                <span>{language === 'bn' ? 'প্লেহেড থেকে ফ্রেম আনা হচ্ছে...' : 'Capturing frame from playhead...'}</span>
              </div>
            )}
          </div>
        </div>

        {/* Graded Preview Frame */}
        {result?.preview_image_base64 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Sparkles size={12} />
              <span>{language === 'bn' ? 'এআই স্টুডিও গ্রেডেড প্রিভিউ' : 'AI Studio Graded Output'}</span>
            </div>
            <div style={{
              height: '160px',
              backgroundColor: '#0a0a0c',
              borderRadius: '6px',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(56, 189, 248, 0.4)'
            }}>
              <img src={result.preview_image_base64} alt="Graded Frame" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
          </div>
        )}
      </div>

      {/* Reference Image Drop Deck (Match Movie Look) */}
      <div style={{
        backgroundColor: 'var(--bg-secondary)',
        padding: '12px',
        borderRadius: '8px',
        border: selectedPreset === 'reference_match' ? '1px solid #3b82f6' : '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <UploadCloud size={14} color="#3b82f6" />
            <span>{language === 'bn' ? 'রেফারেন্স মুভি ফ্রেম ম্যাচিং (Match Movie Reference)' : 'Match Movie / Screenshot Reference'}</span>
          </div>
          {referenceBase64 && (
            <button
              onClick={() => { setReferenceBase64(null); setSelectedPreset('auto_balance'); }}
              style={{ fontSize: '10px', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              {language === 'bn' ? 'মুছে ফেলুন' : 'Remove'}
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              padding: '6px 12px',
              backgroundColor: 'var(--bg-tertiary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '6px',
              color: 'var(--text-primary)',
              fontSize: '11px',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <UploadCloud size={13} />
            <span>{language === 'bn' ? 'রেফারেন্স ছবি আপলোড করুন' : 'Upload Reference Shot'}</span>
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleReferenceUpload} 
            accept="image/*" 
            style={{ display: 'none' }} 
          />
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {language === 'bn' ? 'যেকোনো হলিউড সিনেমা বা ইন্সটাগ্রাম শটের ছবি ফেলে হুবহু ম্যাচ করুন' : 'Drop any film still to automatically transfer its lighting & color palette'}
          </span>
        </div>

        {referenceBase64 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
            <img src={referenceBase64} alt="Ref" style={{ width: '60px', height: '40px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #3b82f6' }} />
            <span style={{ fontSize: '11px', color: '#38bdf8', fontWeight: 600 }}>
              {language === 'bn' ? '✓ রেফারেন্স ছবি লোড হয়েছে — গ্রেড করার জন্য প্রস্তুত' : '✓ Reference loaded and armed for color transfer'}
            </span>
          </div>
        )}
      </div>

      {/* Cinematic Film Look Presets */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Film size={14} color="#f59e0b" />
          <span>{language === 'bn' ? 'হলিউড সিনেমাটিক লুক ও ফিল্ম এমুলেশন' : 'Hollywood Cinematic Looks & Film Stocks'}</span>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: '8px'
        }}>
          {PRESETS.map((p) => {
            const isSelected = selectedPreset === p.id;
            return (
              <div
                key={p.id}
                onClick={() => setSelectedPreset(p.id)}
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  border: isSelected ? '1px solid #38bdf8' : '1px solid var(--border-subtle)',
                  borderRadius: '6px',
                  padding: '10px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  transition: 'all 0.15s ease',
                  boxShadow: isSelected ? '0 0 10px rgba(56, 189, 248, 0.2)' : 'none'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 600, fontSize: '11.5px', color: isSelected ? '#38bdf8' : '#fff' }}>
                    {p.title}
                  </span>
                  <span style={{
                    fontSize: '9px',
                    fontWeight: 700,
                    padding: '1px 5px',
                    borderRadius: '4px',
                    background: p.gradient,
                    color: '#fff'
                  }}>
                    {p.badge}
                  </span>
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-secondary)', lineHeight: '1.3' }}>
                  {p.description}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Creative Director Prompt */}
      <div style={{
        backgroundColor: 'var(--bg-secondary)',
        padding: '12px',
        borderRadius: '8px',
        border: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px'
      }}>
        <div style={{ fontSize: '11.5px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Wand2 size={13} color="#a855f7" />
          <span>{language === 'bn' ? 'এআই ডিরেক্টর ক্রিয়েটিভ প্রম্পট (ঐচ্ছিক)' : 'AI Director Creative Prompt (Optional)'}</span>
        </div>
        <input 
          type="text"
          value={userPrompt}
          onChange={(e) => {
            setUserPrompt(e.target.value);
            if (e.target.value.trim()) setSelectedPreset('prompt_custom');
          }}
          placeholder={language === 'bn' ? 'যেমন: 70s vintage warm look with deep green shadows and glowing faces...' : 'E.g. Warm vintage 70s look with deep green shadows and glowing golden faces...'}
          style={{
            backgroundColor: 'var(--bg-tertiary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '6px',
            padding: '8px 10px',
            fontSize: '11.5px',
            color: '#fff',
            outline: 'none'
          }}
        />
      </div>

      {/* Studio Fine Tuning & Skin Tone Guard */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '12px',
        backgroundColor: 'var(--bg-secondary)',
        padding: '12px',
        borderRadius: '8px',
        border: '1px solid var(--border-subtle)'
      }}>
        {/* Intensity Slider */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', fontWeight: 600 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <SlidersHorizontal size={12} />
              {language === 'bn' ? 'গ্রেডের ঘনত্ব (Intensity)' : 'Look Intensity'}
            </span>
            <span style={{ color: '#38bdf8' }}>{intensity}%</span>
          </div>
          <input 
            type="range" 
            min="10" 
            max="150" 
            value={intensity} 
            onChange={(e) => setIntensity(parseInt(e.target.value))}
            style={{ accentColor: '#38bdf8', cursor: 'pointer' }}
          />
        </div>

        {/* Skin Tone Lock */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '11.5px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', color: lockSkinTones ? '#10b981' : 'var(--text-secondary)' }}>
              <ShieldCheck size={14} color={lockSkinTones ? '#10b981' : '#64748b'} />
              {language === 'bn' ? 'স্কিন-টোন ভেক্টর লক' : 'Lock Skin Tones'}
            </span>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
              {language === 'bn' ? 'মুখের স্বাভাবিক রঙ ও আই-লাইন সুরক্ষিত রাখে' : 'Protects faces along Vectorscope 10:30 line'}
            </span>
          </div>
          <input 
            type="checkbox" 
            checked={lockSkinTones} 
            onChange={(e) => setLockSkinTones(e.target.checked)} 
            style={{ width: '16px', height: '16px', accentColor: '#10b981', cursor: 'pointer' }}
          />
        </div>
      </div>

      {/* Colorist Critique & Rationale Report */}
      {result && (
        <div style={{
          backgroundColor: 'rgba(16, 185, 129, 0.08)',
          border: '1px solid rgba(16, 185, 129, 0.25)',
          borderRadius: '8px',
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#34d399', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle2 size={14} />
              {language === 'bn' ? 'স্টুডিও কোয়ালিটি গ্রেড প্রস্তুত (.cube)' : 'Studio Grade .cube LUT Ready'}
            </span>
            <button
              onClick={revealLut}
              style={{
                fontSize: '10.5px',
                fontWeight: 600,
                color: '#34d399',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid #10b981',
                borderRadius: '4px',
                padding: '3px 8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <FolderOpen size={12} />
              <span>{language === 'bn' ? 'LUT ফাইল ফোল্ডারে দেখুন' : 'Reveal .cube in Finder'}</span>
            </button>
          </div>

          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
            <strong>{language === 'bn' ? 'অ্যানালাইসিস ও কালার সাইন্স:' : 'Colorist Rationale:'}</strong> {result.creative_rationale || result.colorist_critique}
          </div>

          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
            ✓ {language === 'bn' ? 'অ্যাডোবি ক্রিয়েটিভ ফোল্ডারে স্বয়ংক্রিয়ভাবে সেভ হয়েছে — প্রিমিয়ারের লুমিট্রিতে সরাসরি পাওয়া যাবে।' : 'Auto-saved to Adobe Common Creative LUTs folder. Instantly available in Lumetri Look list.'}
          </div>
        </div>
      )}

      {/* Status Bar */}
      {statusMessage && (
        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textAlign: 'center', padding: '2px 0' }}>
          {statusMessage}
        </div>
      )}

      {/* Main Execution CTA */}
      <button
        onClick={executeColorGrade}
        disabled={isProcessing}
        style={{
          backgroundColor: isProcessing ? 'var(--bg-tertiary)' : 'var(--accent-color)',
          color: '#ffffff',
          border: 'none',
          borderRadius: '8px',
          padding: '12px 16px',
          fontSize: '13px',
          fontWeight: 700,
          cursor: isProcessing ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          boxShadow: '0 4px 14px rgba(59, 130, 246, 0.35)',
          marginTop: 'auto'
        }}
      >
        <Sparkles size={16} className={isProcessing ? 'animate-spin' : ''} />
        <span>
          {isProcessing 
            ? (language === 'bn' ? 'কালার সায়েন্স প্রসেসিং চলছে...' : 'Synthesizing Studio Grade 3D LUT...') 
            : (language === 'bn' ? '▶ স্টুডিও গ্রেড জেনারেট এবং প্রিমিয়ারে অ্যাপ্লাই করুন' : '▶ Generate Studio Grade 3D LUT')}
        </span>
      </button>
    </div>
  );
};
