import React, { useState } from 'react';
import { usePrismexStore } from '../state/usePrismexStore';
import { PremiereHostBridge } from '../host/PremiereHostBridge';
import {
  Film,
  Eye,
  Sliders,
  Palette,
  Layers,
  Music,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  FileCheck2,
  Clock,
  Sparkles,
  Scissors
} from 'lucide-react';

export const SmartProductionGuideBar: React.FC = () => {
  const {
    language,
    activeTab,
    setActiveTab,
    sequenceManifest,
    transcriptWords,
    clientScriptText,
    clientRevisions,
    showToast
  } = usePrismexStore();

  const isBn = language === 'bn';
  const bridge = PremiereHostBridge.getInstance();
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [isBarHidden, setIsBarHidden] = useState<boolean>(false);
  const [completedSteps, setCompletedSteps] = useState<Record<number, boolean>>({
    1: false,
    2: false,
    3: false,
    4: false,
    5: false,
    6: false,
    7: false
  });

  const seqName = sequenceManifest?.sequenceName || '';
  const isRoughCutDone = completedSteps[1] || seqName.includes('_AI_Script_RoughCut') || seqName.includes('_PrismexRoughCut');
  const isAudioDone = completedSteps[3] || false;
  const isColorDone = completedSteps[4] || false;
  const isCaptionsDone = completedSteps[7] || (transcriptWords && transcriptWords.length > 0);

  // Compute Current Active Step (1 to 7) based on logical dependencies
  let currentStep = 1;
  if (isRoughCutDone) currentStep = 2;
  if (isRoughCutDone && completedSteps[2]) currentStep = 3;
  if (isRoughCutDone && completedSteps[2] && isAudioDone) currentStep = 4;
  if (isRoughCutDone && completedSteps[2] && isAudioDone && isColorDone) currentStep = 5;
  if (isRoughCutDone && completedSteps[2] && isAudioDone && isColorDone && completedSteps[5]) currentStep = 6;
  if (isRoughCutDone && completedSteps[2] && isAudioDone && isColorDone && completedSteps[5] && completedSteps[6]) currentStep = 7;

  // Toggle step completion manually or automatically
  const toggleStep = (stepNum: number) => {
    setCompletedSteps(prev => ({ ...prev, [stepNum]: !prev[stepNum] }));
  };

  // Pipeline Milestones Definition (Concise for Narrow CEP Panels)
  const milestones = [
    {
      num: 1,
      title: isBn ? '১. স্ক্রিপ্ট রাফ-কাট' : '1. Script Rough-Cut',
      desc: isBn ? 'ক্লায়েন্ট স্ক্রিপ্টের সাথে ডায়ালগ মিলিয়ে ভুল টেক বাদ দেওয়া' : 'Align script with raw footage & eliminate bad takes',
      icon: <Film size={14} />,
      tab: 'client-hub' as const,
      section: 'rough-cut',
      actionText: isBn ? 'রাফ-কাট' : 'Rough-Cut',
      isComplete: isRoughCutDone
    },
    {
      num: 2,
      title: isBn ? '২. ফ্রেমিং ও আই-লাইন' : '2. Framing & Eyeline',
      desc: isBn ? 'রুল-অব-থার্ডস আই-লাইন অনুসারে ১১২% জুম ও ফ্রেম ফিক্স' : 'Rule-of-thirds eyeline punch-in (112%) & reframe',
      icon: <Eye size={14} />,
      tab: 'client-hub' as const,
      section: 'rough-cut',
      actionText: isBn ? 'পাঞ্চ-ইন' : 'Punch-In',
      isComplete: completedSteps[2]
    },
    {
      num: 3,
      title: isBn ? '৩. অডিও ক্লিনআপ' : '3. Audio Cleanup',
      desc: isBn ? 'ভোকাল রাইডার দিয়ে সব ভলিউম সমান ও -৬dB পীকে হার্ড-লক' : 'Vocal rider, noise reduction & lock True Peak at -6dB',
      icon: <Sliders size={14} />,
      tab: 'audio-studio' as const,
      actionText: isBn ? 'অডিও' : 'Audio',
      isComplete: isAudioDone
    },
    {
      num: 4,
      title: isBn ? '৪. বেস কালার' : '4. Base Color',
      desc: isBn ? 'AE-তে যাওয়ার আগেই র-ফুটেজে এক্সপোজার ও স্কিনটোন লক' : 'Correct exposure & skin tones before AE Dynamic Link',
      icon: <Palette size={14} />,
      tab: 'color-studio' as const,
      actionText: isBn ? 'কালার' : 'Color',
      isComplete: isColorDone
    },
    {
      num: 5,
      title: isBn ? '৫. বি-রোল ও সেফটি' : '5. B-Roll & Safety',
      desc: isBn ? 'মূল ক্লিপ ব্যাকআপ রেখে AE কম্পোজিশনে পাঠানো ও বি-রোল' : 'Pre-AE safety duplicate on V2 and place B-Roll cutaways',
      icon: <Layers size={14} />,
      tab: 'transcript' as const,
      actionText: isBn ? '🛡️ ব্যাকআপ' : '🛡️ Backup',
      isComplete: completedSteps[5]
    },
    {
      num: 6,
      title: isBn ? '৬. SFX ও ডাকিং' : '6. SFX & Ducking',
      desc: isBn ? 'গ্রাফিক্সের SFX এবং কথার নিচে মিউজিক -২৬dB ডাকিং' : 'Place transition SFX & auto-duck music bed to -26dB',
      icon: <Music size={14} />,
      tab: 'audio-studio' as const,
      actionText: isBn ? 'ডাকিং' : 'Ducking',
      isComplete: completedSteps[6]
    },
    {
      num: 7,
      title: isBn ? '৭. সাবটাইটেল ও অডিট' : '7. Captions & Audit',
      desc: isBn ? 'ক্যাপশন সিঙ্ক ও ক্লায়েন্টের জন্য ভেরিফায়েড PDF রিপোর্ট' : 'Sync captions & export verified client PDF audit report',
      icon: <FileCheck2 size={14} />,
      tab: 'srt-editor' as const,
      actionText: isBn ? 'রিপোর্ট' : 'Report',
      isComplete: isCaptionsDone && completedSteps[7]
    }
  ];

  const activeMilestone = milestones.find(m => m.num === currentStep) || milestones[0];
  const completedCount = milestones.filter(m => m.isComplete).length;

  // Handle Quick Milestone Action
  const handleMilestoneAction = async (m: typeof milestones[0]) => {
    if (m.num === 2) {
      const res = await bridge.applySmartEyelinePunch(112);
      if (res.success) {
        setCompletedSteps(p => ({ ...p, 2: true }));
        showToast?.(res.message || (isBn ? '✓ ১১২% আই-লাইন পাঞ্চ-ইন প্রয়োগ হয়েছে!' : '✓ Eyeline punch applied!'), 'success');
      } else {
        showToast?.(res.error || (isBn ? 'পাঞ্চ-ইন প্রয়োগ করা যায়নি' : 'Could not apply punch-in'), 'info');
      }
    } else if (m.num === 5 && activeTab === 'transcript') {
      const res = await bridge.preAeSafetyDuplicate();
      if (res.success) {
        setCompletedSteps(p => ({ ...p, 5: true }));
        showToast?.(res.message || (isBn ? '✓ ক্লিপ ব্যাকআপ Track V2-তে কপি হয়েছে!' : '✓ Pre-AE Safety clip duplicated!'), 'success');
      } else {
        showToast?.(res.error || (isBn ? 'ক্লিপ ব্যাকআপ করা যায়নি' : 'Could not backup clip'), 'info');
      }
    } else {
      setActiveTab(m.tab);
    }
  };

  // Dependency Warning: Check if user is working out of logical order
  let dependencyNotice: string | null = null;
  if ((activeTab === 'transcript' || activeTab === 'srt-editor') && !isRoughCutDone) {
    dependencyNotice = isBn
      ? '💡 টিপস: টাইপোগ্রাফি বা সাবটাইটেলের আগে ধাপ ১ (স্ক্রিপ্ট রাফ-কাট) সম্পন্ন করুন, নইলে কাটের সময় টেক্সট মিসম্যাচ হবে।'
      : '💡 Recommendation: Complete Step 1 (Script Rough-Cut) before subtitles to avoid timing desync.';
  } else if (activeTab === 'color-studio' && !isRoughCutDone) {
    dependencyNotice = isBn
      ? '💡 টিপস: কালার গ্রেডের আগে রাফ-কাট ও অবাঞ্ছিত টেক ফেলে নিলে কম ক্লিপে দ্রুত কালার করা যায়।'
      : '💡 Tip: Lock your rough cut first to avoid wasting time grading discarded clips.';
  }

  if (isBarHidden) {
    return (
      <div style={{
        backgroundColor: '#0c0d15',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '2px 10px',
        fontSize: '9.5px',
        color: '#94a3b8'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Sparkles size={10} color="#a78bfa" />
          <span>{isBn ? `পাইপলাইন: ধাপ ${currentStep}/৭ (${activeMilestone.title})` : `Pipeline: Step ${currentStep}/7`}</span>
        </div>
        <button
          onClick={() => setIsBarHidden(false)}
          style={{
            background: 'none',
            border: 'none',
            color: '#a5b4fc',
            cursor: 'pointer',
            fontSize: '9.5px',
            padding: '2px 4px',
            textDecoration: 'underline'
          }}
        >
          {isBn ? 'গাইডবার দেখান ▾' : 'Show Guide ▾'}
        </button>
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: '#11121c',
      borderBottom: '1px solid rgba(139, 92, 246, 0.25)',
      boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
      position: 'relative',
      zIndex: 40
    }}>
      {/* 1. Slim Active Guide Strip (Responsive & Narrow-Panel Friendly) */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '4px 10px',
        gap: '6px',
        overflow: 'hidden'
      }}>
        {/* Left: Current Step Pill & Short Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', minWidth: 0, flex: 1 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
            padding: '2px 6px',
            borderRadius: '10px',
            backgroundColor: 'rgba(124, 58, 237, 0.25)',
            border: '1px solid rgba(139, 92, 246, 0.45)',
            color: '#c4b5fd',
            fontSize: '9.5px',
            fontWeight: 700,
            flexShrink: 0
          }}>
            <Sparkles size={10} color="#a78bfa" />
            <span>{isBn ? `${currentStep}/৭` : `${currentStep}/7`}</span>
          </div>

          <div style={{
            fontSize: '10.5px',
            color: '#e2e8f0',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            minWidth: 0
          }}>
            <span style={{ fontWeight: 600, color: '#a5b4fc' }}>{activeMilestone.title}</span>
          </div>
        </div>

        {/* Right: Quick Action, Roadmap Toggle & Minimize Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
          <button
            onClick={() => handleMilestoneAction(activeMilestone)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 7px',
              borderRadius: '5px',
              fontSize: '10px',
              fontWeight: 700,
              cursor: 'pointer',
              background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
              color: '#ffffff',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              whiteSpace: 'nowrap'
            }}
          >
            <span>{activeMilestone.actionText}</span>
            <ArrowRight size={10} />
          </button>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            title={isBn ? 'রোডম্যাপ টগল' : 'Toggle Roadmap'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '2px',
              padding: '2px 6px',
              borderRadius: '5px',
              fontSize: '9.5px',
              fontWeight: 600,
              cursor: 'pointer',
              backgroundColor: isExpanded ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255, 255, 255, 0.06)',
              color: isExpanded ? '#c7d2fe' : '#94a3b8',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              whiteSpace: 'nowrap'
            }}
          >
            <span>{isBn ? `ম্যাপ (${completedCount})` : `Map (${completedCount})`}</span>
            {isExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </button>

          <button
            onClick={() => setIsBarHidden(true)}
            title={isBn ? 'হাইড করুন (জায়গা বাড়ান)' : 'Hide guide bar'}
            style={{
              background: 'none',
              border: 'none',
              color: '#64748b',
              cursor: 'pointer',
              padding: '2px 4px',
              fontSize: '10px'
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* 2. Dependency Warning Banner (if user skipped logical order) */}
      {dependencyNotice && (
        <div style={{
          backgroundColor: 'rgba(245, 158, 11, 0.12)',
          borderTop: '1px solid rgba(245, 158, 11, 0.25)',
          padding: '3px 10px',
          fontSize: '9.5px',
          color: '#fef08a',
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          <AlertTriangle size={11} color="#fbbf24" style={{ flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{dependencyNotice}</span>
        </div>
      )}

      {/* 3. Expandable Full 7-Step Interactive Production Roadmap (Horizontally Scrollable in Narrow Panels) */}
      {isExpanded && (
        <div style={{
          padding: '10px',
          backgroundColor: '#0c0d15',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: 'inset 0 4px 12px rgba(0,0,0,0.4)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldCheck size={14} color="#34d399" />
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#ffffff' }}>
                {isBn ? 'লজিক্যাল পাইপলাইন' : 'Logical Pipeline'}
              </span>
              <span style={{ fontSize: '9.5px', color: '#94a3b8' }}>
                ({completedCount}/৭)
              </span>
            </div>

            <button
              onClick={() => {
                setActiveTab('client-hub');
                setIsExpanded(false);
              }}
              style={{
                fontSize: '9.5px',
                color: '#a5b4fc',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
            >
              {isBn ? 'রিপোর্ট →' : 'Audit →'}
            </button>
          </div>

          {/* 7 Interactive Step Cards - Horizontal Scrollable so never crushed */}
          <div style={{
            display: 'flex',
            alignItems: 'stretch',
            gap: '8px',
            overflowX: 'auto',
            paddingBottom: '4px',
            scrollbarWidth: 'thin'
          }}>
            {milestones.map((m) => {
              const isActive = m.num === currentStep;
              return (
                <div
                  key={m.num}
                  style={{
                    minWidth: '135px',
                    maxWidth: '145px',
                    flexShrink: 0,
                    padding: '8px',
                    borderRadius: '7px',
                    backgroundColor: m.isComplete
                      ? 'rgba(16, 185, 129, 0.08)'
                      : (isActive ? 'rgba(124, 58, 237, 0.16)' : '#151622'),
                    border: m.isComplete
                      ? '1px solid rgba(16, 185, 129, 0.35)'
                      : (isActive ? '1px solid rgba(139, 92, 246, 0.55)' : '1px solid rgba(255, 255, 255, 0.06)'),
                    boxShadow: isActive ? '0 0 10px rgba(124, 58, 237, 0.2)' : 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                  }}
                >
                  <div>
                    {/* Header: Icon & Status */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ color: m.isComplete ? '#34d399' : (isActive ? '#c4b5fd' : '#94a3b8') }}>
                        {m.icon}
                      </span>
                      <button
                        onClick={() => toggleStep(m.num)}
                        title={m.isComplete ? "Mark incomplete" : "Mark completed"}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      >
                        {m.isComplete ? (
                          <CheckCircle2 size={13} color="#34d399" />
                        ) : (
                          <div style={{ width: '11px', height: '11px', borderRadius: '50%', border: '1.5px solid #64748b' }} />
                        )}
                      </button>
                    </div>

                    <div style={{ fontSize: '10px', fontWeight: 700, color: m.isComplete ? '#6ee7b7' : (isActive ? '#ffffff' : '#cbd5e1'), lineHeight: 1.25 }}>
                      {m.title}
                    </div>

                    <p style={{ fontSize: '8.5px', color: '#94a3b8', margin: '3px 0 0 0', lineHeight: 1.25 }}>
                      {m.desc}
                    </p>
                  </div>

                  {/* Action Button */}
                  <button
                    onClick={() => handleMilestoneAction(m)}
                    style={{
                      marginTop: '6px',
                      padding: '3px 5px',
                      borderRadius: '4px',
                      fontSize: '8.5px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: 'none',
                      backgroundColor: m.isComplete
                        ? 'rgba(16, 185, 129, 0.2)'
                        : (isActive ? '#6366f1' : 'rgba(255, 255, 255, 0.08)'),
                      color: m.isComplete ? '#a7f3d0' : '#ffffff',
                      textAlign: 'center',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    {m.isComplete ? (isBn ? 'পুনরায় দেখুন' : 'Review') : m.actionText}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
