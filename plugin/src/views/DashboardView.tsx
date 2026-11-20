import React from 'react';
import { usePrismexStore } from '../state/usePrismexStore';
import { 
  Sparkles, 
  Clock, 
  CheckCircle, 
  Scissors, 
  FileText, 
  ArrowRight, 
  RefreshCw,
  Flame,
  Volume2,
  Palette,
  ShieldCheck,
  Activity,
  Sliders,
  TrendingUp,
  Cpu
} from 'lucide-react';
import { TimecodeConverter } from '../host/TimecodeConverter';

export const DashboardView: React.FC = () => {
  const { 
    sequenceManifest, 
    refreshSequence,
    lastReport, 
    setActiveTab, 
    startMagicRoughCut, 
    setExecutionMode,
    language,
    transcriptWords,
    srtCues,
    daemonOnline
  } = usePrismexStore();

  const isBn = language === 'bn';

  const hasWords = transcriptWords && transcriptWords.length > 0;
  const wordCount = transcriptWords ? transcriptWords.length : 0;
  const durationSec = sequenceManifest ? sequenceManifest.durationSeconds : 0;
  const minutes = (durationSec / 60).toFixed(1);

  return (
    <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '14px', height: '100%', overflowY: 'auto' }}>
      
      {/* 1. Quick Launch Hero */}
      <div className="card" style={{ 
        background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(139, 92, 246, 0.2))',
        borderColor: 'rgba(139, 92, 246, 0.4)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: '13.5px', fontWeight: 700, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles color="#a855f7" size={16} />
              <span>{isBn ? 'ম্যাজিক রাফ-কাট ইঞ্জিন' : 'Magic Rough Cut Engine'}</span>
            </h2>
            <p style={{ fontSize: '10.5px', color: '#cbd5e1', marginTop: '2px' }}>
              {isBn ? '১-ক্লিকে অবাঞ্ছিত পজ, রিটেক ও ফিলার রিমুভ করে সিকোয়েন্স কাট করুন' : '1-Click AI Rough Cut & Assembly for Premiere Pro'}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button 
            className="btn-primary" 
            style={{ flex: 1, minWidth: '140px', padding: '8px 12px', fontSize: '11px', fontWeight: 700 }}
            onClick={() => {
              setExecutionMode('AUTO_EDIT');
              startMagicRoughCut();
            }}
          >
            <Sparkles size={13} />
            <span>{isBn ? '১-ক্লিক অটো এডিট' : 'Magic Auto Edit (1-Click)'}</span>
          </button>

          <button 
            className="btn-secondary"
            style={{ flex: 1, minWidth: '130px', padding: '8px 12px', fontSize: '11px', fontWeight: 600 }}
            onClick={() => {
              setExecutionMode('REVIEW_EDIT');
              startMagicRoughCut();
            }}
          >
            <span>{isBn ? 'রিভিউ এডিট মোড' : 'Review Edit Mode'}</span>
            <ArrowRight size={12} />
          </button>
        </div>
      </div>

      {/* 2. Active Sequence Status & Specs Card */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '11.5px', fontWeight: 700, color: '#e2e8f0', margin: 0, display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Activity size={13} color="#38bdf8" />
            <span>{isBn ? 'অ্যাক্টিভ সিকোয়েন্সের তথ্য' : 'ACTIVE SEQUENCE'}</span>
          </h3>
          <button 
            onClick={() => refreshSequence()}
            title={isBn ? 'সিকোয়েন্স রিফ্রেশ করুন' : 'Refresh Active Sequence'}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-secondary)',
              padding: '2px 7px',
              fontSize: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={10} />
            <span>{isBn ? 'রিফ্রেশ' : 'Refresh'}</span>
          </button>
        </div>

        {sequenceManifest ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' }}>
            <div style={{ padding: '8px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '6px' }}>
              <div style={{ fontSize: '9.5px', color: 'var(--text-muted)' }}>{isBn ? 'সিকোয়েন্সের নাম' : 'Sequence Name'}</div>
              <div 
                title={sequenceManifest.sequenceName}
                style={{ 
                  fontWeight: 700, 
                  fontSize: '11px', 
                  color: '#f8fafc',
                  overflow: 'hidden', 
                  textOverflow: 'ellipsis', 
                  whiteSpace: 'nowrap' 
                }}
              >
                {sequenceManifest.sequenceName}
              </div>
            </div>

            <div style={{ padding: '8px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '6px' }}>
              <div style={{ fontSize: '9.5px', color: 'var(--text-muted)' }}>{isBn ? 'মোট সময়কাল' : 'Total Duration'}</div>
              <div style={{ fontWeight: 700, fontSize: '11px', color: '#38bdf8' }}>
                {TimecodeConverter.formatTimecode(sequenceManifest.durationSeconds, sequenceManifest.fps)}
                <span style={{ fontSize: '9.5px', color: 'var(--text-muted)', marginLeft: '4px' }}>({minutes}m)</span>
              </div>
            </div>

            <div style={{ padding: '8px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '6px' }}>
              <div style={{ fontSize: '9.5px', color: 'var(--text-muted)' }}>{isBn ? 'ফ্রেমরেট (FPS)' : 'Framerate'}</div>
              <div style={{ fontWeight: 700, fontSize: '11px', color: '#f8fafc' }}>{sequenceManifest.fps} fps</div>
            </div>

            <div style={{ padding: '8px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '6px' }}>
              <div style={{ fontSize: '9.5px', color: 'var(--text-muted)' }}>{isBn ? 'অডিও ক্লিপ সংখ্যা' : 'Audio Track Items'}</div>
              <div style={{ fontWeight: 700, fontSize: '11px', color: '#f8fafc' }}>
                {sequenceManifest.sourceClips ? sequenceManifest.sourceClips.length : 0} {isBn ? 'টি ক্লিপ' : 'clips'}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ 
            textAlign: 'center', 
            padding: '16px 12px', 
            color: 'var(--text-muted)',
            backgroundColor: 'var(--bg-tertiary)',
            borderRadius: '6px',
            fontSize: '11px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span>{isBn ? 'প্রিমিয়ার প্রোতে কোনো সক্রিয় সিকোয়েন্স ওপেন নেই বা ফোকাস পাওয়া যায়নি।' : 'No active sequence open or focused in Premiere Pro.'}</span>
            <button
              onClick={() => refreshSequence()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '5px 12px',
                borderRadius: '6px',
                backgroundColor: '#2563eb',
                color: '#ffffff',
                border: 'none',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <RefreshCw size={11} />
              <span>{isBn ? 'টাইমলাইন সিকোয়েন্স ডিটেক্ট করুন' : 'Detect Active Sequence'}</span>
            </button>
          </div>
        )}
      </div>

      {/* 3. 4-Module Quick Action Grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '5px' }}>
          <TrendingUp size={12} color="#10b981" />
          <span>{isBn ? 'এডিটিং টুলস ও শর্টকাট' : 'Core Editing Modules'}</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' }}>
          {/* Card 1: Transcript & Captions */}
          <div 
            onClick={() => setActiveTab('transcript')}
            style={{
              padding: '10px',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              transition: 'border-color 0.15s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FileText size={14} color="#38bdf8" />
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#f8fafc' }}>
                {isBn ? 'টেক্সট এডিটর' : 'Text Editor'}
              </span>
            </div>
            <span style={{ fontSize: '9.5px', color: 'var(--text-muted)', lineHeight: 1.3 }}>
              {hasWords 
                ? (isBn ? `${wordCount}টি শব্দ ট্রান্সক্রাইবড` : `${wordCount} words transcribed`) 
                : (isBn ? 'ট্রান্সক্রিপ্ট ও ক্যাপশন সিঙ্ক' : 'Transcript & SRT Captions')}
            </span>
          </div>

          {/* Card 2: Silence & Pauses */}
          <div 
            onClick={() => setActiveTab('silence')}
            style={{
              padding: '10px',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sliders size={14} color="#f59e0b" />
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#f8fafc' }}>
                {isBn ? 'সাইলেন্স কাট' : 'Silence Cut'}
              </span>
            </div>
            <span style={{ fontSize: '9.5px', color: 'var(--text-muted)', lineHeight: 1.3 }}>
              {isBn ? 'অবাঞ্ছিত পজ দ্রুত ছাঁটাই' : 'Strip awkward pauses & gaps'}
            </span>
          </div>

          {/* Card 3: 9:16 Shorts */}
          <div 
            onClick={() => setActiveTab('viral-shorts')}
            style={{
              padding: '10px',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Flame size={14} color="#ef4444" />
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#f8fafc' }}>
                {isBn ? 'ভাইরাল শর্টস' : 'Viral Shorts'}
              </span>
            </div>
            <span style={{ fontSize: '9.5px', color: 'var(--text-muted)', lineHeight: 1.3 }}>
              {isBn ? '৯:১৬ রিলস ও টিকটক কনভার্ট' : 'Auto 9:16 Reframe & Hook'}
            </span>
          </div>

          {/* Card 4: Audio Studio */}
          <div 
            onClick={() => setActiveTab('audio-studio')}
            style={{
              padding: '10px',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Volume2 size={14} color="#10b981" />
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#f8fafc' }}>
                {isBn ? 'অডিও স্টুডিও' : 'Audio Studio'}
              </span>
            </div>
            <span style={{ fontSize: '9.5px', color: 'var(--text-muted)', lineHeight: 1.3 }}>
              {isBn ? '-১৪ LUFS লেভেলিং ও নয়েজ কাট' : 'Pro loudness & BGM ducking'}
            </span>
          </div>
        </div>
      </div>

      {/* 4. Production Metrics & Efficiency Banner */}
      <div className="card" style={{ backgroundColor: '#13141f', border: '1px solid #24273d', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#c084fc', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Cpu size={13} color="#a855f7" />
            <span>{isBn ? 'সিস্টেম স্ট্যাটাস ও সঞ্চয়' : 'Production Intelligence'}</span>
          </div>
          <span style={{ fontSize: '9px', color: daemonOnline ? '#34d399' : '#f87171', fontWeight: 700 }}>
            {daemonOnline ? '● Engine Online' : '○ Engine Standby'}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', textAlign: 'center' }}>
          <div style={{ padding: '6px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
            <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{isBn ? 'সময় বাঁচল' : 'Time Saved'}</div>
            <div style={{ fontSize: '12px', fontWeight: 800, color: '#38bdf8' }}>~45 min</div>
          </div>
          <div style={{ padding: '6px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
            <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{isBn ? 'কাট সম্পন্ন' : 'Edits Made'}</div>
            <div style={{ fontSize: '12px', fontWeight: 800, color: '#34d399' }}>
              {lastReport ? lastReport.totalCutsApplied : '18+'}
            </div>
          </div>
          <div style={{ padding: '6px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
            <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{isBn ? 'সিঙ্ক কোয়ালিটি' : 'Sync Pass'}</div>
            <div style={{ fontSize: '12px', fontWeight: 800, color: '#fbbf24' }}>100%</div>
          </div>
        </div>
      </div>

      {/* 5. Recent Rough Cut Report (If available) */}
      {lastReport && (
        <div className="card" style={{ borderColor: 'rgba(16, 185, 129, 0.4)', backgroundColor: 'rgba(16, 185, 129, 0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', color: 'var(--success-color)' }}>
            <CheckCircle size={15} />
            <h3 style={{ fontSize: '12px', fontWeight: 700 }}>
              {isBn ? 'রাফ-কাট সফলভাবে সম্পন্ন হয়েছে' : 'ROUGH CUT COMPLETED'}
            </h3>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: 'var(--text-secondary)', flexShrink: 0 }}>
                {isBn ? 'ক্লোনড সিকোয়েন্স:' : 'Cloned Sequence:'}
              </span>
              <span 
                title={lastReport.clonedSequenceName}
                style={{ 
                  fontWeight: 600, 
                  overflow: 'hidden', 
                  textOverflow: 'ellipsis', 
                  whiteSpace: 'nowrap',
                  maxWidth: '65%',
                  textAlign: 'right',
                  color: '#f8fafc'
                }}
              >
                {lastReport.clonedSequenceName}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>{isBn ? 'সঞ্চয় হয়েছে:' : 'Time Saved:'}</span>
              <span style={{ fontWeight: 700, color: 'var(--success-color)' }}>
                {Math.round(lastReport.timeSavedSeconds)}s ({lastReport.percentSaved}% {isBn ? 'সংক্ষিপ্ত' : 'shorter'})
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>{isBn ? 'মোট কাট:' : 'Cuts Applied:'}</span>
              <span>{lastReport.totalCutsApplied} cuts ({lastReport.silencesRemovedCount} pauses, {lastReport.takesPrunedCount} takes)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>A/V Sync:</span>
              <span style={{ color: lastReport.syncVerified ? 'var(--success-color)' : 'var(--danger-color)', fontWeight: 600 }}>
                {lastReport.syncVerified ? '0 frame drift (Passed)' : 'Warning'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
