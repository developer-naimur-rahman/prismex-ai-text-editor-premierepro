import React, { useState } from 'react';
import { usePrismexStore } from '../state/usePrismexStore';
import { PrismexDaemonClient } from '../api/PrismexDaemonClient';
import { PremiereHostBridge } from '../host/PremiereHostBridge';
import { StudiosRibbon } from '../components/StudiosRibbon';
import { 
  Volume2, 
  Sparkles, 
  Sliders, 
  Mic, 
  Radio, 
  Flame, 
  Heart, 
  Film, 
  Briefcase, 
  CheckCircle2, 
  Play, 
  Wand2, 
  Loader2, 
  Layers, 
  Info,
  Clock,
  Compass,
  Zap,
  Music,
  Disc,
  ExternalLink,
  Headphones,
  BookmarkPlus,
  RefreshCw
} from 'lucide-react';

interface AudioProfile {
  id: string;
  name: string;
  nameBn: string;
  description: string;
  descriptionBn: string;
  badge: string;
  gradient: string;
  icon: React.ReactNode;
  defaultSettings: {
    denoise: number;
    dereverb: number;
    crispAir: number;
    warmth: number;
    deesser: number;
    targetLufs: number;
    truePeak?: number;
    vocalRider?: boolean;
    loudnessRange?: number;
  };
}

const AUDIO_PROFILES: AudioProfile[] = [
  {
    id: 'auto-harmonize',
    name: '1-Click Auto-Harmonize & Vocal Rider',
    nameBn: '🪄 ১-ক্লিক অটো-হারমোনাইজ ও ভোকাল রাইডার',
    description: 'Sliding-window upward speech leveler (evens start & end volume), strict -6dB True Peak limit, -14 LUFS broadcast master & AC/fan denoise.',
    descriptionBn: 'ভয়েস ফ্যাটিগ ও ড্রপ ফিক্স (সব পিক সমান), পিক সর্বোচ্চ -৬ dB তে লক, ব্যাকগ্রাউন্ড নয়েজ ক্লিন ও মোবাইলের পাতলা সাউন্ডে রেডিও ডেপথ।',
    badge: 'Peak -6dB • -14 LUFS',
    gradient: 'linear-gradient(135deg, #6366f1, #a855f7)',
    icon: <Sparkles size={16} />,
    defaultSettings: { denoise: 60, dereverb: 45, crispAir: 70, warmth: 65, deesser: 65, targetLufs: -14.0, truePeak: -6.0, vocalRider: true, loudnessRange: 7.0 }
  },
  {
    id: 'crispy-podcast',
    name: 'Crispy Podcast & Talking Head',
    nameBn: 'ক্রিস্পি পডকাস্ট ও টকিং হেড',
    description: 'Ultra-crispy vocal presence with air shelf (10kHz+), de-essed sibilance, and upfront radio proximity.',
    descriptionBn: 'উচ্চমানের ক্রিস্পি এয়ার সেল্ফ, নিখুঁত ডি-এসিং এবং সামনের দিকে স্পষ্ট রেডিও ভয়েস।',
    badge: 'Crispy (-14 LUFS)',
    gradient: 'linear-gradient(135deg, #0284c7, #06b6d4)',
    icon: <Radio size={16} />,
    defaultSettings: { denoise: 50, dereverb: 40, crispAir: 80, warmth: 45, deesser: 60, targetLufs: -14.0 }
  },
  {
    id: 'real-estate',
    name: 'Real Estate & Architecture',
    nameBn: 'রিয়েল এস্টেট ও প্রপার্টি ট্যুর',
    description: 'Warm, trustworthy, and relaxed low-end contour with gentle ambient room acoustic balance.',
    descriptionBn: 'উষ্ণ, বিশ্বস্ত ও রিল্যাক্সড লো-এন্ড ব্যালেন্স যা প্রপার্টির আবহকে দারুণ ফুটিয়ে তোলে।',
    badge: 'Warm & Rich (-14 LUFS)',
    gradient: 'linear-gradient(135deg, #10b981, #059669)',
    icon: <Compass size={16} />,
    defaultSettings: { denoise: 45, dereverb: 50, crispAir: 55, warmth: 75, deesser: 50, targetLufs: -14.0 }
  },
  {
    id: 'sports-fitness',
    name: 'High-Energy Sports & Fitness',
    nameBn: 'স্পোর্টস, ওয়ার্কআউট ও হাইপ',
    description: 'Aggressive multi-band punch, tight low-end limiter, and high speech presence cutting through loud music.',
    descriptionBn: 'লাউড ব্যাকগ্রাউন্ড মিউজিকের মধ্যেও ভেসে ওঠার মতো পাঞ্চি মিড-রেঞ্জ ও হাই এনার্জি।',
    badge: 'High-Energy (-13 LUFS)',
    gradient: 'linear-gradient(135deg, #f97316, #ef4444)',
    icon: <Flame size={16} />,
    defaultSettings: { denoise: 60, dereverb: 35, crispAir: 70, warmth: 60, deesser: 55, targetLufs: -13.0 }
  },
  {
    id: 'wedding-emotional',
    name: 'Cinematic Wedding & Emotional',
    nameBn: 'ওয়েডিং ও সিনেমাটিক ইমোশনাল',
    description: 'Silky smooth high-end roll-off, soft vocal warmth, and gentle romantic acoustic space.',
    descriptionBn: 'সিল্কি মসৃণ হাই-ফ্রিকোয়েন্সি, ড্রিম-লাইক সফটনেস এবং আবেগঘন সিনেমাটিক স্পেস।',
    badge: 'Silky (-15 LUFS)',
    gradient: 'linear-gradient(135deg, #ec4899, #8b5cf6)',
    icon: <Heart size={16} />,
    defaultSettings: { denoise: 40, dereverb: 30, crispAir: 60, warmth: 70, deesser: 50, targetLufs: -15.0 }
  },
  {
    id: 'drama-natok',
    name: 'Bangla Drama & Fiction (নাটক)',
    nameBn: 'নাটক ও সিনেমাটিক স্টোরিটেলিং',
    description: 'Naturalistic dialogue preservation, natural room tone matching, dynamic vocal range, zero artificial pumping.',
    descriptionBn: 'কৃত্রিম পাম্পিং ছাড়া খাঁটি ন্যাচারাল ডায়ালগ, পরিচ্ছন্ন রুম টোন এবং সিনেমাটিক প্রক্সিমিটি।',
    badge: 'Natural (-16 LUFS)',
    gradient: 'linear-gradient(135deg, #8b5cf6, #4f46e5)',
    icon: <Film size={16} />,
    defaultSettings: { denoise: 55, dereverb: 45, crispAir: 50, warmth: 55, deesser: 50, targetLufs: -16.0 }
  },
  {
    id: 'corporate-tech',
    name: 'Corporate & Tech Explainer',
    nameBn: 'কর্পোরেট ও টেক এক্সপ্লেইনার',
    description: 'Surgically clean, neutral EQ contour, zero sub-rumble, and crystal-clear presentation intelligibility.',
    descriptionBn: 'কোনো ধরনের রাম্বল বা ব্যাকগ্রাউন্ড নয়েজহীন, আধুনিক ও ক্রিস্টাল ক্লিয়ার আর্টিকুলেশন।',
    badge: 'Ultra Clean (-14 LUFS)',
    gradient: 'linear-gradient(135deg, #3b82f6, #6366f1)',
    icon: <Briefcase size={16} />,
    defaultSettings: { denoise: 65, dereverb: 55, crispAir: 75, warmth: 40, deesser: 65, targetLufs: -14.0 }
  }
];

export const AudioStudioView: React.FC = () => {
  const { 
    sequenceManifest, 
    transcriptWords, 
    transcriptSentences, 
    language,
    showToast,
    activeAudioProfileId,
    setActiveAudioProfileId,
    audioSettings,
    setAudioSettings,
    detectedSfxCues,
    setDetectedSfxCues,
    soundDesignTips,
    setSoundDesignTips,
    recommendedBgmData,
    setRecommendedBgmData
  } = usePrismexStore();

  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  const [isAnalyzingSfx, setIsAnalyzingSfx] = useState(false);
  const [isAnalyzingBgm, setIsAnalyzingBgm] = useState(false);
  const [sfxProgressMsg, setSfxProgressMsg] = useState('');
  const [audioMasterSuccess, setAudioMasterSuccess] = useState<string | null>(null);

  const client = PrismexDaemonClient.getInstance();
  const hostBridge = PremiereHostBridge.getInstance();

  const isBn = language === 'bn';
  const currentProfile = AUDIO_PROFILES.find(p => p.id === activeAudioProfileId) || AUDIO_PROFILES[0];

  const handleSelectProfile = (profile: AudioProfile) => {
    setActiveAudioProfileId(profile.id);
    setAudioSettings(profile.defaultSettings);
    showToast(isBn ? `${profile.nameBn} প্রোফাইল লোড হয়েছে` : `Loaded ${profile.name} profile`, 'info');
  };

  const handleApplyAudioMaster = async () => {
    if (!sequenceManifest || !sequenceManifest.sourceClips || sequenceManifest.sourceClips.length === 0) {
      showToast(isBn ? 'টাইমলাইনে কোনো অডিও/ভিডিও ক্লিপ নেই' : 'No clips on timeline', 'error');
      return;
    }

    setIsProcessingAudio(true);
    setAudioMasterSuccess(null);

    try {
      showToast(isBn ? 'অডিও স্টেম এক্সট্র্যাক্ট ও স্টুডিও ডিএসপি প্রসেসিং হচ্ছে...' : 'Extracting & processing DSP audio master...', 'info');

      // 1. Process via Python Daemon DSP
      const res = await client.enhanceAudio({
        sequenceName: sequenceManifest.cleanSequenceName || sequenceManifest.sequenceName,
        sourceClips: sequenceManifest.sourceClips,
        durationSeconds: sequenceManifest.durationSeconds,
        profileId: activeAudioProfileId,
        settings: audioSettings
      });

      if (!res.success || !res.outputPath) {
        throw new Error(res.error || 'Audio processing failed');
      }

      // 2. Import into Premiere Pro and overwrite onto Track A2 / synchronized
      const importRes = await hostBridge.applyEnhancedAudioTrack(res.outputPath, 1, true);

      if (!importRes.success) {
        throw new Error(importRes.error || 'Failed to place audio track in Premiere Pro');
      }

      setAudioMasterSuccess(res.outputPath);
      showToast(
        isBn 
          ? 'স্টুডিও মাস্টার অডিও সফলভাবে টাইমলাইনে যুক্ত করা হয়েছে!' 
          : 'Studio master audio successfully laid onto timeline!', 
        'success'
      );
    } catch (err: any) {
      showToast(err.message || 'Error mastering audio', 'error');
    } finally {
      setIsProcessingAudio(false);
    }
  };

  const handleAnalyzeSoundDesign = async () => {
    if (!transcriptSentences || transcriptSentences.length === 0) {
      showToast(isBn ? 'আগে ট্রান্সক্রিপশন সম্পন্ন করুন' : 'Please transcribe sequence first', 'error');
      return;
    }

    setIsAnalyzingSfx(true);
    setSfxProgressMsg(isBn ? 'এআই ড্রামা, মুড ও সাউন্ড ডিজাইন অ্যানালাইসিস করছে...' : 'AI analyzing narrative mood and SFX placement...');

    try {
      const res = await client.analyzeSoundDesign({
        words: transcriptWords,
        sentences: transcriptSentences,
        genre: activeAudioProfileId
      });

      if (res && res.sfxCues) {
        setDetectedSfxCues(res.sfxCues);
        setSoundDesignTips(res.soundDesignTips || []);
        showToast(
          isBn 
            ? `${res.sfxCues.length} টি সিনেমাটিক SFX কিউ সফলভাবে চিহ্নিত হয়েছে!` 
            : `Identified ${res.sfxCues.length} cinematic SFX cue moments!`, 
          'success'
        );
      } else {
        throw new Error('No cues returned');
      }
    } catch (e: any) {
      showToast(isBn ? 'SFX অ্যানালাইসিসে সমস্যা হয়েছে' : 'SFX analysis failed', 'error');
    } finally {
      setIsAnalyzingSfx(false);
      setSfxProgressMsg('');
    }
  };

  const handleSendAllCuesToTimeline = async () => {
    if (!detectedSfxCues || detectedSfxCues.length === 0) {
      showToast(isBn ? 'কোনো SFX কিউ নেই' : 'No SFX cues available', 'error');
      return;
    }

    try {
      const markers = detectedSfxCues.map((c) => ({
        name: `[SFX: ${c.category}] ${c.sfxName}`,
        comment: isBn ? (c.explanationBn || c.reason) : c.reason,
        startSeconds: c.startSeconds,
        durationSeconds: c.durationSeconds || 1.2,
        color: c.color || 'CYAN'
      }));

      const res = await hostBridge.addTimelineMarkers(markers);
      if (res.success) {
        showToast(
          isBn 
            ? `${markers.length} টি SFX মার্কার প্রিমিয়ার প্রো টাইমলাইনে ড্রপ করা হয়েছে!` 
            : `Dropped ${markers.length} SFX markers directly onto timeline!`, 
          'success'
        );
      } else {
        throw new Error(res.error || 'Failed to place markers');
      }
    } catch (e: any) {
      showToast(e.message || 'Error placing timeline markers', 'error');
    }
  };

  const handleJumpToTime = async (seconds: number) => {
    try {
      await hostBridge.setPlayheadPosition(seconds);
    } catch {}
  };

  const handleAnalyzeBgm = async () => {
    if (!transcriptSentences || transcriptSentences.length === 0) {
      showToast(isBn ? 'আগে ট্রান্সক্রিপশন সম্পন্ন করুন' : 'Please transcribe sequence first', 'error');
      return;
    }

    setIsAnalyzingBgm(true);
    try {
      showToast(isBn ? 'এআই কন্টেন্ট বিশ্লেষণ করে সেরা ব্যাকগ্রাউন্ড মিউজিক ট্র্যাক খুঁজছে...' : 'AI analyzing content for optimal BGM tracks...', 'info');

      const res = await client.recommendBackgroundMusic({
        words: transcriptWords,
        sentences: transcriptSentences,
        genre: activeAudioProfileId,
        durationSeconds: sequenceManifest?.durationSeconds || 60.0
      });

      if (res && res.musicTracks) {
        setRecommendedBgmData(res);
        showToast(
          isBn 
            ? `${res.musicTracks.length} টি কপিরাইট-মুক্ত ব্যাকগ্রাউন্ড মিউজিক ট্র্যাক সাজেস্ট করা হয়েছে!` 
            : `Curated ${res.musicTracks.length} royalty-free BGM track recommendations!`, 
          'success'
        );
      } else {
        throw new Error('No BGM suggestions returned');
      }
    } catch (e: any) {
      showToast(isBn ? 'মিউজিক অ্যানালাইসিসে সমস্যা হয়েছে' : 'Music curation analysis failed', 'error');
    } finally {
      setIsAnalyzingBgm(false);
    }
  };

  const handleOpenUrl = async (url: string) => {
    try {
      await client.openUrl(url);
    } catch {}
  };

  const handleAddBgmTimelineMarker = async (track: any) => {
    try {
      const targetVol = recommendedBgmData?.mixingGuide?.targetVolume || '-18dB';
      const marker = [{
        name: `[BGM Cue] ${track.title}`,
        comment: `Tempo: ${track.tempo} | Target Vol: ${targetVol} | Instruments: ${track.instruments}`,
        startSeconds: 0,
        durationSeconds: 5.0,
        color: 'PURPLE'
      }];

      const res = await hostBridge.addTimelineMarkers(marker);
      if (res.success) {
        showToast(
          isBn 
            ? `টাইমলাইনের শুরুতে [BGM] মার্কার ড্রপ করা হয়েছে!` 
            : `Added [BGM] timeline marker at sequence start!`, 
          'success'
        );
      }
    } catch {}
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <StudiosRibbon />
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        backgroundColor: '#09090b',
        color: '#f4f4f5',
        overflowY: 'auto',
        padding: '14px 16px',
        gap: '16px'
      }}>
      {/* Studio Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        paddingBottom: '14px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #06b6d4, #8b5cf6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 18px rgba(6, 182, 212, 0.35)'
          }}>
            <Volume2 size={20} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>{isBn ? 'এআই অডিও স্টুডিও ও ভয়েস মাস্টার' : 'AI Audio Studio & Voice Master'}</span>
              <span style={{
                fontSize: '10px',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: '12px',
                backgroundColor: 'rgba(6, 182, 212, 0.15)',
                color: '#38bdf8',
                border: '1px solid rgba(56, 189, 248, 0.3)'
              }}>
                Studio DSP
              </span>
            </div>
            <div style={{ fontSize: '11px', color: '#a1a1aa' }}>
              {isBn 
                ? 'ক্লায়েন্ট ও জনার ভিত্তিক ভয়েস ক্লিনিং, ক্রিস্পি এনহ্যান্সমেন্ট এবং এআই সাউন্ড ডিজাইন' 
                : 'Client & genre-tailored voice mastering, crispy EQ presence, and cinematic AI SFX curation'}
            </div>
          </div>
        </div>

        {sequenceManifest && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 12px',
            borderRadius: '6px',
            backgroundColor: '#18181b',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            fontSize: '11px'
          }}>
            <Clock size={12} color="#a1a1aa" />
            <span style={{ color: '#e4e4e7', fontWeight: 600 }}>
              {sequenceManifest.cleanSequenceName || sequenceManifest.sequenceName}
            </span>
            <span style={{ color: '#71717a' }}>({Math.round(sequenceManifest.durationSeconds || 0)}s)</span>
          </div>
        )}
      </div>

      {/* HERO BANNER: 1-Click Auto-Harmonize & Balance Timeline */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(168, 85, 247, 0.15) 100%)',
        border: '1px solid rgba(129, 140, 248, 0.35)',
        borderRadius: '12px',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #6366f1, #a855f7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 2px 10px rgba(99, 102, 241, 0.4)'
            }}>
              <Sparkles size={20} />
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>{isBn ? '১-ক্লিক অটো-হারমোনাইজ ও টাইমলাইন ব্যালেন্স' : '1-Click Auto-Harmonize & Balance Timeline'}</span>
                <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', background: '#4f46e5', color: '#fff', fontWeight: 600 }}>PRO</span>
              </div>
              <div style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '2px' }}>
                {isBn 
                  ? 'ভয়েসের ওঠানামা ফিক্স (Vocal Rider), পিক সর্বোচ্চ -৬ dB তে লক, নয়েজ ক্লিন ও -১৪ LUFS এ পুরো টাইমলাইন ব্যালেন্স।'
                  : 'Automatic sliding-window speech leveler, strict -6dB True Peak limit, denoise & -14 LUFS broadcast master.'}
              </div>
            </div>
          </div>
          <button
            onClick={() => {
              const harmonizeProf = AUDIO_PROFILES[0];
              setActiveAudioProfileId('auto-harmonize');
              setAudioSettings(harmonizeProf.defaultSettings);
              handleApplyAudioMaster();
            }}
            disabled={isProcessingAudio}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              border: 'none',
              color: '#ffffff',
              fontSize: '12px',
              fontWeight: 700,
              cursor: isProcessingAudio ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.35)',
              transition: 'all 0.15s ease'
            }}
          >
            {isProcessingAudio ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                <span>{isBn ? 'টাইমলাইন প্রসেস হচ্ছে...' : 'Processing Timeline...'}</span>
              </>
            ) : (
              <>
                <Wand2 size={14} />
                <span>{isBn ? 'সব ক্লিপ ব্যালেন্স করুন (-6dB Peak)' : 'Auto-Harmonize All Clips (-6dB)'}</span>
              </>
            )}
          </button>
        </div>

        {/* Feature Pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', fontSize: '10.5px' }}>
          <span style={{ padding: '2px 8px', borderRadius: '5px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#a5b4fc' }}>
            ✓ {isBn ? 'ভোকাল রাইডার (শুরু-শেষের গেইন সমান)' : 'Vocal Rider (Uniform Gain)'}
          </span>
          <span style={{ padding: '2px 8px', borderRadius: '5px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#34d399' }}>
            ✓ {isBn ? 'পিক সিলিং: -৬.০ dB (জিরো ক্লিপিং)' : 'True Peak Ceiling: -6.0 dB'}
          </span>
          <span style={{ padding: '2px 8px', borderRadius: '5px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fbbf24' }}>
            ✓ {isBn ? 'ফ্যান/এসি নয়েজ ক্লিন' : 'AC / Fan Denoise'}
          </span>
          <span style={{ padding: '2px 8px', borderRadius: '5px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#f472b6' }}>
            ✓ {isBn ? 'মোবাইল মাইক ডেপথ বুস্ট' : 'Vocal Depth & Warmth'}
          </span>
          <span style={{ padding: '2px 8px', borderRadius: '5px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#38bdf8' }}>
            ✓ {isBn ? 'BGM ব্যালেন্স: -২৬ dB' : 'BGM: -26 dB Bed'}
          </span>
        </div>
      </div>

      {/* SECTION 1: Studio Voice Profiles */}
      <div>
        <div style={{ fontSize: '13px', fontWeight: 700, color: '#f4f4f5', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Radio size={14} color="#06b6d4" />
          <span>{isBn ? '১. ক্লায়েন্ট ও জনার ভয়েস প্রোফাইল (Genre Voice Profiles)' : '1. Studio Client & Genre Voice Profiles'}</span>
        </div>
        <div style={{ fontSize: '11px', color: '#a1a1aa', marginBottom: '12px' }}>
          {isBn 
            ? 'আপনার ক্লায়েন্টের কাজের ধরন সিলেক্ট করুন—সিস্টেম স্বয়ংক্রিয়ভাবে পারফেক্ট সাউন্ড ইঞ্জিন লোড করবে।' 
            : 'Select your client workflow to instantly tune EQ curve, dynamics, and loudness.'}
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '10px'
        }}>
          {AUDIO_PROFILES.map((profile) => {
            const isSelected = activeAudioProfileId === profile.id;
            return (
              <div
                key={profile.id}
                onClick={() => handleSelectProfile(profile)}
                style={{
                  padding: '12px 14px',
                  borderRadius: '10px',
                  backgroundColor: isSelected ? '#1e1b4b' : '#18181b',
                  border: isSelected ? '1.5px solid #818cf8' : '1px solid rgba(255, 255, 255, 0.08)',
                  cursor: 'pointer',
                  transition: 'all 0.18s ease',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: '6px',
                      background: profile.gradient,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff'
                    }}>
                      {profile.icon}
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#fff' }}>
                      {isBn ? profile.nameBn : profile.name}
                    </span>
                  </div>

                  <span style={{
                    fontSize: '9.5px',
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    color: '#cbd5e1'
                  }}>
                    {profile.badge}
                  </span>
                </div>

                <div style={{ fontSize: '10.5px', color: '#94a3b8', lineHeight: '1.4' }}>
                  {isBn ? profile.descriptionBn : profile.description}
                </div>

                {isSelected && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '10px',
                    color: '#818cf8',
                    fontWeight: 600,
                    marginTop: '2px'
                  }}>
                    <CheckCircle2 size={12} />
                    <span>{isBn ? 'সক্রিয় প্রোফাইল' : 'Active Profile'}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 2: Precision Voice Mastering Sliders & Action */}
      <div style={{
        backgroundColor: '#18181b',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '12px',
        padding: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#f4f4f5', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sliders size={14} color="#38bdf8" />
              <span>{isBn ? '২. প্রফেশনাল ভয়েস টিউনিং (Precision Vocal Controls)' : '2. Precision Vocal Mastering Sliders'}</span>
            </div>
            <div style={{ fontSize: '10.5px', color: '#a1a1aa' }}>
              {isBn ? 'প্রয়োজন অনুযায়ী স্লাইডার দিয়ে ক্লিনিং ও ক্রিস্পি এয়ার অ্যাডজাস্ট করুন।' : 'Fine-tune acoustic cleaning, vocal presence, and loudness target.'}
            </div>
          </div>

          <div style={{ fontSize: '11px', color: '#818cf8', fontWeight: 600 }}>
            {isBn ? `টার্গেট: ${audioSettings.targetLufs} LUFS` : `Target: ${audioSettings.targetLufs} LUFS`}
          </div>
        </div>

        {/* Sliders Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: '14px',
          marginBottom: '16px'
        }}>
          {/* De-Noise Slider */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
              <span style={{ color: '#d4d4d8' }}>{isBn ? 'নয়েজ রিডাকশন (De-Noise)' : 'De-Noise Intensity'}</span>
              <span style={{ color: '#38bdf8', fontWeight: 600 }}>{audioSettings.denoise}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={audioSettings.denoise}
              onChange={(e) => setAudioSettings({ denoise: Number(e.target.value) })}
              style={{ width: '100%', accentColor: '#38bdf8' }}
            />
          </div>

          {/* De-Reverb Slider */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
              <span style={{ color: '#d4d4d8' }}>{isBn ? 'রুম রিভার্ব রিমুভাল (De-Echo)' : 'Room De-Reverb'}</span>
              <span style={{ color: '#38bdf8', fontWeight: 600 }}>{audioSettings.dereverb}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={audioSettings.dereverb}
              onChange={(e) => setAudioSettings({ dereverb: Number(e.target.value) })}
              style={{ width: '100%', accentColor: '#38bdf8' }}
            />
          </div>

          {/* Crisp Vocal Air Slider */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
              <span style={{ color: '#d4d4d8' }}>{isBn ? 'ক্রিস্পি এয়ার প্রেজেন্স (Crisp 10kHz)' : 'Crisp Air Presence'}</span>
              <span style={{ color: '#06b6d4', fontWeight: 600 }}>{audioSettings.crispAir}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={audioSettings.crispAir}
              onChange={(e) => setAudioSettings({ crispAir: Number(e.target.value) })}
              style={{ width: '100%', accentColor: '#06b6d4' }}
            />
          </div>

          {/* Warmth Body Slider */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
              <span style={{ color: '#d4d4d8' }}>{isBn ? 'ওয়ার্মথ ও বডি (Warm Low-End)' : 'Warmth & Vocal Body'}</span>
              <span style={{ color: '#10b981', fontWeight: 600 }}>{audioSettings.warmth}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={audioSettings.warmth}
              onChange={(e) => setAudioSettings({ warmth: Number(e.target.value) })}
              style={{ width: '100%', accentColor: '#10b981' }}
            />
          </div>

          {/* De-Esser Slider */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
              <span style={{ color: '#d4d4d8' }}>{isBn ? 'ডি-এসার (Sibilance Tamer)' : 'Sibilance De-Esser'}</span>
              <span style={{ color: '#a855f7', fontWeight: 600 }}>{audioSettings.deesser}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={audioSettings.deesser}
              onChange={(e) => setAudioSettings({ deesser: Number(e.target.value) })}
              style={{ width: '100%', accentColor: '#a855f7' }}
            />
          </div>

          {/* Target LUFS Dropdown */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
              <span style={{ color: '#d4d4d8' }}>{isBn ? 'লাউডনেস স্ট্যান্ডার্ড' : 'Loudness Target'}</span>
            </div>
            <select
              value={audioSettings.targetLufs}
              onChange={(e) => setAudioSettings({ targetLufs: Number(e.target.value) })}
              style={{
                width: '100%',
                padding: '6px 8px',
                borderRadius: '6px',
                backgroundColor: '#27272a',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#fff',
                fontSize: '11px'
              }}
            >
              <option value={-14.0}>YouTube / Web (-14 LUFS)</option>
              <option value={-16.0}>Apple Podcast (-16 LUFS)</option>
              <option value={-13.0}>TikTok / Instagram Reels (-13 LUFS)</option>
              <option value={-23.0}>Broadcast TV / EBU R128 (-23 LUFS)</option>
            </select>
          </div>
        </div>

        {/* Master Action Button */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <button
            onClick={handleApplyAudioMaster}
            disabled={isProcessingAudio}
            style={{
              flex: 1,
              padding: '10px 16px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #0284c7, #8b5cf6)',
              color: '#fff',
              fontSize: '12.5px',
              fontWeight: 700,
              border: 'none',
              cursor: isProcessingAudio ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 2px 14px rgba(139, 92, 246, 0.35)',
              opacity: isProcessingAudio ? 0.7 : 1
            }}
          >
            {isProcessingAudio ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>{isBn ? 'স্টুডিও অডিও প্রসেসিং ও টাইমলাইনে প্লেস হচ্ছে...' : 'Processing DSP master audio...'}</span>
              </>
            ) : (
              <>
                <Wand2 size={16} />
                <span>
                  {isBn 
                    ? `টাইমলাইনে ${currentProfile.nameBn} মাস্টার প্রয়োগ করুন` 
                    : `Apply & Master Voice to Timeline (${currentProfile.name})`}
                </span>
              </>
            )}
          </button>
        </div>

        {audioMasterSuccess && (
          <div style={{
            marginTop: '10px',
            padding: '8px 12px',
            borderRadius: '6px',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '11px',
            color: '#34d399'
          }}>
            <CheckCircle2 size={14} />
            <span>{isBn ? 'স্টুডিও মাস্টার ট্র্যাক সফলভাবে যুক্ত হয়েছে! প্রজেক্ট প্লে করে সাউন্ড কোয়ালিটি চেক করুন।' : 'Studio master laid on timeline. Press play to hear the crisp enhanced audio.'}</span>
          </div>
        )}
      </div>

      {/* SECTION 3: Smart Background Music & Free Curation */}
      <div style={{
        backgroundColor: '#18181b',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '12px',
        padding: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#f4f4f5', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Disc size={14} color="#a855f7" />
              <span>{isBn ? '৩. স্মার্ট ব্যাকগ্রাউন্ড মিউজিক কিউরেশন (Free BGM Curator)' : '3. Smart Background Music & Royalty-Free Curator'}</span>
            </div>
            <div style={{ fontSize: '10.5px', color: '#a1a1aa' }}>
              {isBn 
                ? 'আপনার কন্টেন্টের মুড, টোন ও টেম্পো অনুসারে পিক্সাবে (Pixabay) সহ ফ্রি সাইট থেকে ১০০% কপিরাইট-মুক্ত মিউজিক সাজেশন।' 
                : 'AI-curated royalty-free background tracks from Pixabay, Free Music Archive & Chosic based on content analysis.'}
            </div>
          </div>

          <button
            onClick={handleAnalyzeBgm}
            disabled={isAnalyzingBgm}
            style={{
              padding: '7px 14px',
              borderRadius: '6px',
              background: 'linear-gradient(135deg, #a855f7, #6366f1)',
              color: '#fff',
              fontSize: '11px',
              fontWeight: 600,
              border: 'none',
              cursor: isAnalyzingBgm ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 10px rgba(168, 85, 247, 0.35)',
              opacity: isAnalyzingBgm ? 0.7 : 1
            }}
          >
            {isAnalyzingBgm ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            <span>{isBn ? 'মিউজিক সাজেশন বের করুন' : 'Curate BGM Suggestions'}</span>
          </button>
        </div>

        {isAnalyzingBgm && (
          <div style={{
            padding: '16px',
            textAlign: 'center',
            color: '#a1a1aa',
            fontSize: '11.5px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px'
          }}>
            <Loader2 size={20} className="animate-spin" color="#a855f7" />
            <span>{isBn ? 'এআই কন্টেন্ট বিশ্লেষণ করে সেরা ব্যাকগ্রাউন্ড মিউজিক ট্র্যাক খুঁজছে...' : 'AI analyzing content for optimal BGM tracks...'}</span>
          </div>
        )}

        {/* Music Mixing Guide */}
        {recommendedBgmData && (
          <div style={{
            marginBottom: '14px',
            padding: '10px 14px',
            borderRadius: '8px',
            backgroundColor: 'rgba(168, 85, 247, 0.08)',
            border: '1px solid rgba(168, 85, 247, 0.2)',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#c084fc', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Headphones size={13} />
                <span>{isBn ? 'মিউজিক ডিরেক্টর অডিও গাইডলাইন (Audio Mixing Guide):' : 'BGM Mixing & Pacing Guide:'}</span>
              </div>
              <span style={{ fontSize: '10px', color: '#e4e4e7', fontWeight: 600 }}>
                {isBn ? `প্রস্তাবিত টেম্পো: ${recommendedBgmData.recommendedBpm}` : `BPM: ${recommendedBgmData.recommendedBpm}`}
              </span>
            </div>

            <div style={{ fontSize: '10.5px', color: '#cbd5e1', display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
              <span>🔊 {isBn ? 'ভয়েসের নিচে ভলিউম' : 'Target Volume'}: <strong style={{ color: '#38bdf8' }}>{recommendedBgmData.mixingGuide?.targetVolume || '-18dB'}</strong></span>
              <span>📉 {isBn ? 'ডাকিং ডেপথ' : 'Ducking'}: <strong style={{ color: '#a78bfa' }}>{recommendedBgmData.mixingGuide?.duckingDepth || '-12dB'}</strong></span>
              <span>🎚️ {isBn ? 'EQ গাইড' : 'EQ Tip'}: <span style={{ color: '#94a3b8' }}>{recommendedBgmData.mixingGuide?.eqTip}</span></span>
            </div>
          </div>
        )}

        {/* BGM Track Cards */}
        {recommendedBgmData && recommendedBgmData.musicTracks && recommendedBgmData.musicTracks.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '10px' }}>
            {recommendedBgmData.musicTracks.map((tr: any, idx: number) => (
              <div
                key={tr.id || idx}
                style={{
                  padding: '12px 14px',
                  borderRadius: '10px',
                  backgroundColor: '#121215',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#f4f4f5' }}>
                      {isBn ? tr.titleBn : tr.title}
                    </div>
                    <div style={{ fontSize: '10px', color: '#94a3b8' }}>
                      {tr.title}
                    </div>
                  </div>

                  <span style={{
                    fontSize: '9.5px',
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    backgroundColor: 'rgba(168, 85, 247, 0.15)',
                    color: '#c084fc',
                    border: '1px solid rgba(168, 85, 247, 0.3)'
                  }}>
                    {isBn ? tr.moodBn : tr.mood}
                  </span>
                </div>

                <div style={{ fontSize: '10.5px', color: '#71717a', lineHeight: '1.4' }}>
                  <span style={{ color: '#a1a1aa' }}>🎹 {tr.instruments}</span> • <span style={{ color: '#818cf8' }}>{tr.tempo}</span>
                </div>

                <div style={{ fontSize: '10px', color: '#a1a1aa', fontStyle: 'italic' }}>
                  💡 {tr.bestFor}
                </div>

                {/* Direct Action Links */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => handleOpenUrl(tr.pixabayUrl)}
                    title={isBn ? 'পিক্সাবে মিউজিকে সার্চ করুন' : 'Search on Pixabay Music (Free)'}
                    style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      backgroundColor: '#059669',
                      color: '#fff',
                      fontSize: '10px',
                      fontWeight: 600,
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <span>Pixabay Music (Free)</span>
                    <ExternalLink size={10} />
                  </button>

                  <button
                    onClick={() => handleOpenUrl(tr.fmaUrl)}
                    title="Free Music Archive"
                    style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      backgroundColor: '#27272a',
                      color: '#cbd5e1',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      fontSize: '10px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <span>FMA</span>
                    <ExternalLink size={10} />
                  </button>

                  <button
                    onClick={() => handleOpenUrl(tr.chosicUrl)}
                    title="Chosic Royalty Free"
                    style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      backgroundColor: '#27272a',
                      color: '#cbd5e1',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      fontSize: '10px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <span>Chosic</span>
                    <ExternalLink size={10} />
                  </button>

                  <button
                    onClick={() => handleAddBgmTimelineMarker(tr)}
                    title={isBn ? 'টাইমলাইনে BGM মার্কার যোগ করুন' : 'Drop BGM cue marker onto timeline'}
                    style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      backgroundColor: '#1e1b4b',
                      color: '#c084fc',
                      border: '1px solid rgba(168, 85, 247, 0.4)',
                      fontSize: '10px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      marginLeft: 'auto'
                    }}
                  >
                    <BookmarkPlus size={10} />
                    <span>{isBn ? 'মার্কার দিন' : 'Mark 00:00'}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          !isAnalyzingBgm && (
            <div style={{
              padding: '16px',
              textAlign: 'center',
              color: '#71717a',
              fontSize: '11px',
              border: '1px dashed rgba(255, 255, 255, 0.08)',
              borderRadius: '8px'
            }}>
              {isBn 
                ? 'উপরের "মিউজিক সাজেশন বের করুন" বাটনে ক্লিক করলে আপনার কন্টেন্টের বিষয়বস্তু অনুযায়ী পিক্সাবে সহ বিভিন্ন সাইটের পারফেক্ট ব্যাকগ্রাউন্ড মিউজিক খুঁজে দেবে।' 
                : 'Click "Curate BGM Suggestions" above to discover royalty-free tracks matched to your content mood and tempo.'}
            </div>
          )
        )}
      </div>

      {/* SECTION 4: AI Sound Design & SFX Cue Suggester */}
      <div style={{
        backgroundColor: '#18181b',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '12px',
        padding: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#f4f4f5', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Music size={14} color="#ec4899" />
              <span>{isBn ? '৪. এআই সাউন্ড ডিজাইন ও সিনেমাটিক SFX কিউ (AI Sound Designer)' : '4. AI Sound Design & Cinematic SFX Suggester'}</span>
            </div>
            <div style={{ fontSize: '10.5px', color: '#a1a1aa' }}>
              {isBn 
                ? 'এআই পুরো সিকোয়েন্স অ্যানালাইসিস করে কোথায় থ্রিলিং ইমপ্যাক্ট, ট্রানজিশন বা সাউন্ড দেওয়া দরকার তা স্বয়ংক্রিয়ভাবে সাজেস্ট করবে।' 
                : 'AI scans emotional spikes, hook reveals, and transitions to recommend cinematic sound effects.'}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={handleAnalyzeSoundDesign}
              disabled={isAnalyzingSfx}
              style={{
                padding: '7px 14px',
                borderRadius: '6px',
                backgroundColor: '#27272a',
                border: '1px solid rgba(236, 72, 153, 0.35)',
                color: '#f472b6',
                fontSize: '11px',
                fontWeight: 600,
                cursor: isAnalyzingSfx ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {isAnalyzingSfx ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              <span>{isBn ? 'মুড ও SFX অ্যানালাইসিস করুন' : 'Analyze Mood & SFX'}</span>
            </button>

            {detectedSfxCues.length > 0 && (
              <button
                onClick={handleSendAllCuesToTimeline}
                style={{
                  padding: '7px 14px',
                  borderRadius: '6px',
                  background: 'linear-gradient(135deg, #ec4899, #8b5cf6)',
                  color: '#fff',
                  fontSize: '11px',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Zap size={13} />
                <span>{isBn ? 'সব কিউ টাইমলাইনে মার্কার হিসেবে ড্রপ করুন' : 'Send All Cues to Timeline'}</span>
              </button>
            )}
          </div>
        </div>

        {isAnalyzingSfx && (
          <div style={{
            padding: '16px',
            textAlign: 'center',
            color: '#a1a1aa',
            fontSize: '11.5px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px'
          }}>
            <Loader2 size={20} className="animate-spin" color="#ec4899" />
            <span>{sfxProgressMsg}</span>
          </div>
        )}

        {/* Sound Design Tips */}
        {soundDesignTips && soundDesignTips.length > 0 && (
          <div style={{
            marginBottom: '14px',
            padding: '10px 14px',
            borderRadius: '8px',
            backgroundColor: 'rgba(236, 72, 153, 0.08)',
            border: '1px solid rgba(236, 72, 153, 0.2)',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px'
          }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#f472b6', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Info size={12} />
              <span>{isBn ? 'সাউন্ড ডিরেক্টর পরামর্শ (Pacing & Ducking Tips):' : 'Sound Director Pacing Tips:'}</span>
            </div>
            {soundDesignTips.map((tip, idx) => (
              <div key={idx} style={{ fontSize: '10.5px', color: '#cbd5e1', paddingLeft: '18px', position: 'relative' }}>
                <span style={{ position: 'absolute', left: '6px', color: '#f472b6' }}>•</span>
                {tip}
              </div>
            ))}
          </div>
        )}

        {/* SFX Cues List */}
        {detectedSfxCues.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '360px', overflowY: 'auto' }}>
            {detectedSfxCues.map((cue, idx) => {
              const categoryBadgeColors: Record<string, { bg: string; text: string; border: string }> = {
                IMPACT: { bg: 'rgba(239, 68, 68, 0.15)', text: '#f87171', border: 'rgba(239, 68, 68, 0.35)' },
                WHOOSH: { bg: 'rgba(6, 182, 212, 0.15)', text: '#38bdf8', border: 'rgba(6, 182, 212, 0.35)' },
                SHIMMER: { bg: 'rgba(234, 179, 8, 0.15)', text: '#facc15', border: 'rgba(234, 179, 8, 0.35)' },
                TENSION: { bg: 'rgba(168, 85, 247, 0.15)', text: '#c084fc', border: 'rgba(168, 85, 247, 0.35)' },
                COMIC: { bg: 'rgba(249, 115, 22, 0.15)', text: '#fb923c', border: 'rgba(249, 115, 22, 0.35)' },
                AMBIENCE: { bg: 'rgba(34, 197, 94, 0.15)', text: '#4ade80', border: 'rgba(34, 197, 94, 0.35)' }
              };
              const badgeStyle = categoryBadgeColors[cue.category] || categoryBadgeColors.WHOOSH;

              return (
                <div
                  key={cue.id || idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    backgroundColor: '#121215',
                    border: '1px solid rgba(255, 255, 255, 0.06)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button
                      onClick={() => handleJumpToTime(cue.startSeconds)}
                      title={isBn ? 'টাইমলাইনে জাম্প করুন' : 'Jump playhead to timestamp'}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        backgroundColor: '#27272a',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        color: '#38bdf8',
                        fontSize: '10.5px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <Play size={10} fill="#38bdf8" />
                      <span>{Math.floor(cue.startSeconds / 60)}:{String(Math.floor(cue.startSeconds % 60)).padStart(2, '0')}</span>
                    </button>

                    <span style={{
                      fontSize: '9.5px',
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      backgroundColor: badgeStyle.bg,
                      color: badgeStyle.text,
                      border: `1px solid ${badgeStyle.border}`
                    }}>
                      {cue.category}
                    </span>

                    <div>
                      <div style={{ fontSize: '11.5px', fontWeight: 600, color: '#f4f4f5' }}>
                        {cue.sfxName}
                      </div>
                      <div style={{ fontSize: '10px', color: '#a1a1aa' }}>
                        {isBn ? (cue.explanationBn || cue.reason) : cue.reason}
                      </div>
                    </div>
                  </div>

                  <div style={{ fontSize: '10px', color: '#71717a', fontStyle: 'italic' }}>
                    {cue.recommendedFile}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          !isAnalyzingSfx && (
            <div style={{
              padding: '20px',
              textAlign: 'center',
              color: '#71717a',
              fontSize: '11px',
              border: '1px dashed rgba(255, 255, 255, 0.08)',
              borderRadius: '8px'
            }}>
              {isBn 
                ? 'উপরের "মুড ও SFX অ্যানালাইসিস করুন" বাটনে ক্লিক করলে এআই ট্রান্সক্রিপ্ট পড়ে সিনেমাটিক সাউন্ড ইফেক্ট কিউ তৈরি করবে।' 
                : 'Click "Analyze Mood & SFX" above to generate narrative sound design cues for this sequence.'}
            </div>
          )
        )}
      </div>
      </div>
    </div>
  );
};
