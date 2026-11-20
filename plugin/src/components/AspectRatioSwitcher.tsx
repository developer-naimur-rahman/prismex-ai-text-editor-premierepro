import React, { useState } from 'react';
import { usePrismexStore } from '../state/usePrismexStore';
import {
  Square,
  Smartphone,
  Tv,
  Maximize2,
  Copy,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Crop,
  Layers,
  ArrowRight,
  ShieldCheck,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

export interface AspectPreset {
  id: string;
  label: string;
  width: number;
  height: number;
  ratio: string;
  descBn: string;
  descEn: string;
  icon: React.ReactNode;
}

export const AspectRatioSwitcher: React.FC = () => {
  const {
    changeSequenceAspectRatio,
    sequenceManifest,
    language,
    globalBusyAction
  } = usePrismexStore();

  const isBn = language === 'bn';

  const presets: AspectPreset[] = [
    {
      id: 'square',
      label: isBn ? '১:১ স্কয়ার' : '1:1 Square',
      width: 1080,
      height: 1080,
      ratio: '1:1',
      descBn: 'ইনস্টাগ্রাম ও ফেসবুক ফিড পোস্ট',
      descEn: 'Instagram & Facebook Post',
      icon: <Square size={14} />
    },
    {
      id: 'vertical',
      label: isBn ? '৯:১৬ রিলস/শর্টস' : '9:16 Reels/Shorts',
      width: 1080,
      height: 1920,
      ratio: '9:16',
      descBn: 'TikTok, Reels, YouTube Shorts',
      descEn: 'TikTok, Reels & Shorts',
      icon: <Smartphone size={14} />
    },
    {
      id: 'landscape',
      label: isBn ? '১৬:৯ ল্যান্ডস্কেপ' : '16:9 Landscape',
      width: 1920,
      height: 1080,
      ratio: '16:9',
      descBn: 'YouTube ভিডিও ও ব্রডকাস্ট',
      descEn: 'YouTube & Standard Broadcast',
      icon: <Tv size={14} />
    },
    {
      id: 'portrait',
      label: isBn ? '৪:৫ পোর্ট্রেট' : '4:5 Portrait',
      width: 1080,
      height: 1350,
      ratio: '4:5',
      descBn: 'ইনস্টাগ্রাম হাই-এনগেজমেন্ট ফিড',
      descEn: 'Instagram Vertical Feed',
      icon: <Maximize2 size={14} />
    },
    {
      id: 'classic',
      label: isBn ? '৪:৩ ক্লাসিক' : '4:3 Classic',
      width: 1440,
      height: 1080,
      ratio: '4:3',
      descBn: 'ভিন্টেজ ও প্রেজেন্টেশন',
      descEn: 'Classic Presentation',
      icon: <Tv size={14} />
    }
  ];

  const [selectedPresetId, setSelectedPresetId] = useState<string>('square');
  const [fitMode, setFitMode] = useState<'fill' | 'fit'>('fill');
  const [cloneFirst, setCloneFirst] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  const selectedPreset = presets.find((p) => p.id === selectedPresetId) || presets[0];
  const isBusy = Boolean(globalBusyAction) || isProcessing;

  const handleApply = async () => {
    setIsProcessing(true);
    try {
      await changeSequenceAspectRatio({
        width: selectedPreset.width,
        height: selectedPreset.height,
        label: selectedPreset.label,
        ratioKey: selectedPreset.id,
        fitMode,
        clone: cloneFirst
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      style={{
        backgroundColor: '#161722',
        border: '1px solid rgba(139, 92, 246, 0.35)',
        borderRadius: '10px',
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        boxShadow: '0 4px 18px rgba(0, 0, 0, 0.25)'
      }}
    >
      {/* Header with Expand/Collapse Toggle */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          cursor: 'pointer',
          userSelect: 'none'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '26px',
              height: '26px',
              borderRadius: '7px',
              background: 'linear-gradient(135deg, #6366f1, #a855f7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <Crop size={14} color="#ffffff" />
          </div>
          <div>
            <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>{isBn ? 'সিকোয়েন্স রেশিও ও অটো-ফিট' : 'Sequence Aspect Ratio & Auto-Fit'}</span>
              <span
                style={{
                  fontSize: '9.5px',
                  padding: '1px 6px',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(139, 92, 246, 0.25)',
                  color: '#c4b5fd',
                  fontWeight: 600
                }}
              >
                {selectedPreset.label}
              </span>
            </div>
            <div style={{ fontSize: '9.5px', color: '#94a3b8', marginTop: '1px' }}>
              {isBn
                ? (isExpanded ? '১ ক্লিকে ১:১, ৯:১৬ বা ১৬:৯ এ রূপান্তর করুন' : 'ক্লিক করে রেশিও অপশনগুলো খুলুন')
                : (isExpanded ? 'Instantly format sequence with automatic scaling' : 'Click to expand ratio options')}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
          style={{
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '5px',
            color: '#c4b5fd',
            padding: '3px 8px',
            fontSize: '10px',
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
            cursor: 'pointer'
          }}
        >
          <span>{isExpanded ? (isBn ? 'গুটিয়ে রাখুন' : 'Fold') : (isBn ? 'বদলান' : 'Change')}</span>
          {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      </div>

      {isExpanded && (
        <>
          {/* Preset Buttons Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(105px, 1fr))',
              gap: '6px'
            }}
          >
            {presets.map((p) => {
              const isSelected = p.id === selectedPresetId;
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedPresetId(p.id)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '8px 6px',
                    borderRadius: '8px',
                    border: isSelected ? '1px solid #8b5cf6' : '1px solid #282a3c',
                    backgroundColor: isSelected ? 'rgba(139, 92, 246, 0.22)' : '#1a1b28',
                    color: isSelected ? '#ffffff' : '#94a3b8',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    boxShadow: isSelected ? '0 0 10px rgba(139, 92, 246, 0.35)' : 'none',
                    textAlign: 'center',
                    gap: '4px'
                  }}
                >
                  <div style={{ color: isSelected ? '#c4b5fd' : '#818cf8' }}>
                    {p.icon}
                  </div>
                  <span style={{ fontSize: '10.5px', fontWeight: isSelected ? 700 : 500 }}>
                    {p.label}
                  </span>
                  <span style={{ fontSize: '9px', color: isSelected ? '#ddd6fe' : '#64748b' }}>
                    {p.width}x{p.height}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Options Row: Auto-Fit Mode & Safe Clone Toggle */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '8px',
              padding: '6px 8px',
              backgroundColor: '#12131d',
              borderRadius: '7px',
              border: '1px solid #222434',
              fontSize: '10.5px'
            }}
          >
            {/* Fit Mode */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ color: '#94a3b8' }}>{isBn ? 'ভিডিও ফিট মোড:' : 'Video Fit:'}</span>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  onClick={() => setFitMode('fill')}
                  style={{
                    padding: '2px 7px',
                    borderRadius: '4px',
                    border: 'none',
                    fontSize: '10px',
                    fontWeight: fitMode === 'fill' ? 700 : 500,
                    backgroundColor: fitMode === 'fill' ? '#4f46e5' : '#1f2130',
                    color: fitMode === 'fill' ? '#ffffff' : '#94a3b8',
                    cursor: 'pointer'
                  }}
                  title={isBn ? 'কালো দাগ ছাড়া পুরো ফ্রেম ভর্তি করবে' : 'Fills entire frame without black bars'}
                >
                  {isBn ? 'অটো-ফিল (No Black Bars)' : 'Auto-Fill (No Black Bars)'}
                </button>
                <button
                  onClick={() => setFitMode('fit')}
                  style={{
                    padding: '2px 7px',
                    borderRadius: '4px',
                    border: 'none',
                    fontSize: '10px',
                    fontWeight: fitMode === 'fit' ? 700 : 500,
                    backgroundColor: fitMode === 'fit' ? '#4f46e5' : '#1f2130',
                    color: fitMode === 'fit' ? '#ffffff' : '#94a3b8',
                    cursor: 'pointer'
                  }}
                  title={isBn ? 'ক্লিপের মূল রেশিও বজায় রাখবে' : 'Maintains aspect ratio with letterbox'}
                >
                  {isBn ? 'অটো-ফিট (Letterbox)' : 'Auto-Fit (Letterbox)'}
                </button>
              </div>
            </div>

            {/* Clone Toggle */}
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                color: '#cbd5e1',
                cursor: 'pointer',
                userSelect: 'none'
              }}
            >
              <input
                type="checkbox"
                checked={cloneFirst}
                onChange={(e) => setCloneFirst(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              <span style={{ fontSize: '10px' }}>
                {isBn ? 'নতুন সিকোয়েন্সে কপি (সেফ মোড)' : 'Duplicate to new sequence (Safe)'}
              </span>
            </label>
          </div>

          {/* 1-Click Action Button */}
          <button
            onClick={handleApply}
            disabled={isBusy}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: '7px',
              background: isBusy
                ? 'rgba(255, 255, 255, 0.1)'
                : 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
              color: '#ffffff',
              border: 'none',
              fontSize: '11.5px',
              fontWeight: 700,
              cursor: isBusy ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: isBusy ? 'none' : '0 3px 12px rgba(124, 58, 237, 0.4)',
              transition: 'all 0.15s ease'
            }}
          >
            <Sparkles size={14} />
            <span>
              {isBusy
                ? (isBn ? 'সিকোয়েন্স পরিবর্তন ও অটো-ফিট হচ্ছে...' : 'Formatting sequence & clips...')
                : (isBn 
                    ? `১-ক্লিকে ${selectedPreset.label}-এ সিকোয়েন্স রূপান্তর করুন` 
                    : `1-Click Convert Sequence to ${selectedPreset.label}`)}
            </span>
            <ArrowRight size={13} />
          </button>
        </>
      )}
    </div>
  );
};
