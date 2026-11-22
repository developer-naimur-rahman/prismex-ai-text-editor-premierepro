import React, { useEffect } from 'react';
import { usePrismexStore } from './state/usePrismexStore';
import { NavigationHeader } from './components/NavigationHeader';
import { DashboardView } from './views/DashboardView';
import { MagicRoughCutView } from './views/MagicRoughCutView';
import { ReviewQueueView } from './views/ReviewQueueView';
import { TranscriptView } from './views/TranscriptView';
import { SilenceView } from './views/SilenceView';
import { TakesView } from './views/TakesView';
import { ProvidersView } from './views/ProvidersView';
import { ProfilesView } from './views/ProfilesView';
import { SettingsView } from './views/SettingsView';
import { HistoryView } from './views/HistoryView';
import { SrtEditorView } from './views/SrtEditorView';
import { ViralShortsView } from './views/ViralShortsView';
import { ColorStudioView } from './views/ColorStudioView';
import { AudioStudioView } from './views/AudioStudioView';
import { ClientHubView } from './views/ClientHubView';
import { SmartProductionGuideBar } from './components/SmartProductionGuideBar';
import { GlobalCopilotDrawer } from './components/GlobalCopilotDrawer';
import { BottomNavDock } from './components/BottomNavDock';
import { ActionGuidelineBanner } from './components/ActionGuidelineBanner';
import { Loader2, CheckCircle2, AlertCircle, Sparkles, Mic } from 'lucide-react';

export const App: React.FC = () => {
  const { 
    activeTab, 
    language, 
    initApp, 
    isAppInitializing,
    initStepMessage,
    initStepProgress,
    isSwitchingSequence,
    sequenceSwitchMessage,
    sequenceSwitchProgress,
    jobProgress,
    jobMessage,
    jobStatus,
    globalBusyAction,
    globalToast,
    isGlobalCopilotOpen,
    setIsGlobalCopilotOpen
  } = usePrismexStore();

  useEffect(() => {
    initApp();

    const handleFocusOrHover = () => {
      usePrismexStore.getState().checkSequenceChange();
    };

    // Auto-detect sequence changes when editing in Premiere
    const seqInterval = setInterval(() => {
      usePrismexStore.getState().checkSequenceChange();
    }, 800);

    // Reliable Ctrl+V / Cmd+V Paste anywhere in inputs & textareas
    const handlePaste = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'v' || e.key === 'V')) {
        const activeEl = document.activeElement as HTMLElement | null;
        const isEditable = activeEl && (
          activeEl.tagName === 'INPUT' || 
          activeEl.tagName === 'TEXTAREA' || 
          activeEl.isContentEditable
        );
        if (isEditable && navigator.clipboard && navigator.clipboard.readText) {
          navigator.clipboard.readText().then((clipText) => {
            if (clipText) {
              document.execCommand('insertText', false, clipText);
            }
          }).catch(() => {});
        }
      }
    };

    window.addEventListener('keydown', handlePaste);
    window.addEventListener('focus', handleFocusOrHover);
    window.addEventListener('mouseenter', handleFocusOrHover);
    const handleVisibility = () => {
      if (!document.hidden) {
        handleFocusOrHover();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(seqInterval);
      window.removeEventListener('keydown', handlePaste);
      window.removeEventListener('focus', handleFocusOrHover);
      window.removeEventListener('mouseenter', handleFocusOrHover);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [initApp]);

  const isBusy = (jobProgress > 0 && jobProgress < 100) || 
    jobStatus === 'TRANSCRIBING' || 
    jobStatus === 'EXTRACTING' || 
    jobStatus === 'ANALYZING' || 
    Boolean(globalBusyAction);

  return (
    <div
      data-lang={language}
      className={language === 'bn' ? 'lang-bn' : 'lang-en'}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100vw',
        backgroundColor: 'var(--bg-primary)',
        fontFamily: language === 'bn' ? 'var(--font-family-bn)' : 'var(--font-family-en)',
        position: 'relative'
      }}
    >
      {/* Layer 1: Studio Boot & Sync Screen (Startup Overlay) */}
      {isAppInitializing && (
        <div 
          onClick={() => usePrismexStore.setState({ isAppInitializing: false })}
          title="Click to enter editor immediately"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: '#09090b',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            cursor: 'pointer'
          }}
        >
          {/* Skip Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              usePrismexStore.setState({ isAppInitializing: false });
            }}
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#a1a1aa',
              fontSize: '11px',
              padding: '4px 10px',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            {language === 'bn' ? 'স্কিপ করুন ✕' : 'Skip ✕'}
          </button>

          {/* Animated Glowing Logo */}
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '22px',
            fontWeight: 800,
            color: '#fff',
            boxShadow: '0 0 28px rgba(139, 92, 246, 0.45)',
            marginBottom: '14px'
          }}>
            P
          </div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff', letterSpacing: '0.4px', marginBottom: '4px' }}>
            Prismex Studio Editor
          </div>
          <div style={{ fontSize: '11px', color: '#a1a1aa', marginBottom: '18px' }}>
            {language === 'bn' ? 'অ্যাডোবি প্রিমিয়ার প্রো এআই এডিটর স্যুট' : 'Next-Gen AI Video Editing Suite for Adobe Premiere Pro'}
          </div>

          {/* Progress Bar */}
          <div style={{ 
            width: '210px', 
            height: '4px', 
            backgroundColor: 'rgba(255,255,255,0.1)', 
            borderRadius: '4px', 
            overflow: 'hidden', 
            marginBottom: '10px' 
          }}>
            <div style={{
              height: '100%',
              width: `${initStepProgress}%`,
              background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
              transition: 'width 0.3s ease'
            }} />
          </div>
          <div style={{ fontSize: '11px', color: '#38bdf8', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Loader2 size={12} className="animate-spin" />
            <span>{initStepMessage}</span>
          </div>
        </div>
      )}

      {/* Layer 1.5: Sequence Switch Transition Overlay with Real-time Progress */}
      {isSwitchingSequence && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9995,
          backgroundColor: 'rgba(9, 9, 11, 0.78)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#18181b',
            border: '1px solid rgba(139, 92, 246, 0.45)',
            borderRadius: '14px',
            padding: '20px 28px',
            boxShadow: '0 10px 35px rgba(0, 0, 0, 0.6), 0 0 24px rgba(139, 92, 246, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            minWidth: '280px',
            maxWidth: '92%'
          }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '12px',
              boxShadow: '0 0 16px rgba(139, 92, 246, 0.4)'
            }}>
              <Loader2 size={18} className="animate-spin" color="#fff" />
            </div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#f4f4f5', marginBottom: '6px', textAlign: 'center' }}>
              {language === 'bn' ? 'সিকোয়েন্স পরিবর্তন হচ্ছে' : 'Switching Sequence'}
            </div>
            <div style={{ fontSize: '11px', color: '#a1a1aa', marginBottom: '14px', textAlign: 'center', minHeight: '16px' }}>
              {sequenceSwitchMessage}
            </div>
            {/* Progress Bar */}
            <div style={{ width: '100%', height: '5px', backgroundColor: 'rgba(255, 255, 255, 0.1)', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${sequenceSwitchProgress}%`,
                background: 'linear-gradient(90deg, #3b82f6, #a855f7)',
                transition: 'width 0.25s ease'
              }} />
            </div>
            <div style={{ fontSize: '10.5px', fontWeight: 600, color: '#c084fc', marginTop: '6px' }}>
              {sequenceSwitchProgress}%
            </div>
          </div>
        </div>
      )}

      {/* Sleek, Non-Intrusive Floating Toast Alert */}
      {globalToast && (
        <div style={{
          position: 'fixed',
          top: '6px',
          right: '8px',
          zIndex: 9998,
          backgroundColor: globalToast.type === 'error' ? '#dc2626' : (globalToast.type === 'info' ? '#2563eb' : '#059669'),
          color: '#fff',
          padding: '4px 10px',
          borderRadius: '5px',
          fontSize: '10.5px',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          boxShadow: '0 4px 14px rgba(0,0,0,0.5)',
          border: '1px solid rgba(255,255,255,0.2)',
          maxWidth: 'calc(100vw - 16px)'
        }}>
          {globalToast.type === 'error' ? <AlertCircle size={12} /> : <CheckCircle2 size={12} />}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{globalToast.message}</span>
          <button
            onClick={() => usePrismexStore.setState({ globalToast: null })}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(255,255,255,0.7)',
              cursor: 'pointer',
              padding: '0 2px',
              fontSize: '11px',
              marginLeft: '4px',
              lineHeight: 1
            }}
          >
            ✕
          </button>
        </div>
      )}

      <NavigationHeader />

      {/* Universal Action Guideline & Success Feedback Banner */}
      <ActionGuidelineBanner />

      {/* Layer 1.5: Smart Post-Production Workflow Guide & Milestones */}
      <SmartProductionGuideBar />

      {/* Layer 2: Always-Visible Global Activity & Progress Strip */}
      {isBusy && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#0f172a',
          borderBottom: '1px solid rgba(56, 189, 248, 0.35)',
          padding: '5px 12px',
          fontSize: '11px',
          color: '#fff',
          boxShadow: '0 2px 8px rgba(0,0,0,0.25)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Loader2 size={13} className="animate-spin" color="#38bdf8" />
            <span style={{ fontWeight: 600, color: '#e2e8f0', letterSpacing: '0.2px' }}>
              {jobMessage || (globalBusyAction ? (language === 'bn' ? 'প্রসেসিং হচ্ছে...' : 'Processing operation...') : (language === 'bn' ? 'কাজ চলছে...' : 'Working...'))}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '85px', height: '4px', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${Math.max(jobProgress, 8)}%`,
                background: 'linear-gradient(90deg, #38bdf8, #818cf8)',
                transition: 'width 0.35s ease'
              }} />
            </div>
            <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#38bdf8' }}>
              {Math.round(jobProgress)}%
            </span>
          </div>
        </div>
      )}

      <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {activeTab === 'client-hub' && <ClientHubView />}
        {activeTab === 'transcript' && <TranscriptView />}
        {activeTab === 'magic-cut' && <MagicRoughCutView />}
        {activeTab === 'silence' && <SilenceView />}
        {activeTab === 'takes' && <TakesView />}
        {activeTab === 'review-queue' && <ReviewQueueView />}
        {activeTab === 'srt-editor' && <SrtEditorView />}
        {activeTab === 'viral-shorts' && <ViralShortsView />}
        {activeTab === 'color-studio' && <ColorStudioView />}
        {activeTab === 'audio-studio' && <AudioStudioView />}
        {activeTab === 'dashboard' && <DashboardView />}
        {activeTab === 'providers' && <ProvidersView />}
        {activeTab === 'profiles' && <ProfilesView />}
        {activeTab === 'settings' && <SettingsView />}
        {activeTab === 'history' && <HistoryView />}
      </main>

      {/* Modern 5-Hub Persistent Bottom Dock */}
      <BottomNavDock />

      {/* Universal Co-Pilot Modal with Click-Outside Auto-Dismiss */}
      <GlobalCopilotDrawer />
    </div>
  );
};
