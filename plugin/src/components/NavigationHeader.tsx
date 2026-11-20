import React from 'react';
import { usePrismexStore, ActiveTab } from '../state/usePrismexStore';
import { translations } from '../i18n/translations';
import { 
  Sparkles, 
  LayoutDashboard, 
  FileText, 
  CheckSquare, 
  Sliders, 
  Layers, 
  Cpu, 
  Bookmark, 
  Settings, 
  History, 
  RefreshCw,
  RotateCcw,
  Subtitles,
  Flame,
  Palette,
  Volume2,
  Briefcase,
  Mic
} from 'lucide-react';
import { PremiereHostBridge } from '../host/PremiereHostBridge';
import { PrismexDaemonClient } from '../api/PrismexDaemonClient';
import { UpdateTourModal } from './UpdateTourModal';

export const NavigationHeader: React.FC = () => {
  const { 
    activeTab, 
    setActiveTab, 
    sequenceManifest, 
    refreshSequence, 
    daemonOnline,
    reviewItems,
    language,
    setLanguage,
    isGlobalCopilotOpen,
    setIsGlobalCopilotOpen
  } = usePrismexStore();

  const [undoStatus, setUndoStatus] = React.useState<string | null>(null);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = React.useState<boolean>(false);
  const [updateInfo, setUpdateInfo] = React.useState<any>(null);

  // Auto-check for updates on load
  React.useEffect(() => {
    PrismexDaemonClient.getInstance().checkForUpdates().then((res) => {
      if (res) {
        setUpdateInfo(res);
        if (res.updateAvailable) {
          try {
            const seenKey = `prismex_seen_update_${res.latestVersion}`;
            if (!localStorage.getItem(seenKey)) {
              setIsUpdateModalOpen(true);
              localStorage.setItem(seenKey, 'true');
            }
          } catch {}
        }
      }
    });
  }, []);

  const t = translations[language];
  const pendingReviewCount = reviewItems.filter(i => i.status === 'PENDING').length;

  const tabs: Array<{ id: ActiveTab; label: string; icon: React.ReactNode; badge?: number }> = [
    { id: 'client-hub', label: language === 'bn' ? 'ক্লায়েন্ট হাব ও রিভিশন' : 'Client Hub & Revisions', icon: <Briefcase size={12} /> },
    { id: 'transcript', label: t.tabTranscript, icon: <FileText size={12} /> },
    { id: 'magic-cut', label: t.tabMagicCut, icon: <Sparkles size={12} /> },
    { id: 'silence', label: t.tabSilence, icon: <Sliders size={12} /> },
    { id: 'takes', label: t.tabTakes, icon: <Layers size={12} /> },
    { id: 'review-queue', label: t.tabReviewQueue, icon: <CheckSquare size={12} />, badge: pendingReviewCount },
    { id: 'srt-editor', label: t.tabSrtEditor, icon: <Subtitles size={12} /> },
    { id: 'viral-shorts', label: t.tabViralShorts, icon: <Flame size={12} /> },
    { id: 'color-studio', label: language === 'bn' ? 'এআই কালার স্টুডিও' : 'AI Color Studio', icon: <Palette size={12} /> },
    { id: 'audio-studio', label: language === 'bn' ? 'এআই অডিও স্টুডিও' : 'AI Audio Studio', icon: <Volume2 size={12} /> },
    { id: 'dashboard', label: t.tabDashboard, icon: <LayoutDashboard size={12} /> },
    { id: 'providers', label: t.tabProviders, icon: <Cpu size={12} /> },
    { id: 'settings', label: t.tabSettings, icon: <Settings size={12} /> },
    { id: 'history', label: t.tabHistory, icon: <History size={12} /> }
  ];

  return (
    <header style={{ 
      borderBottom: '1px solid var(--border-subtle)', 
      backgroundColor: 'var(--bg-secondary)', 
      display: 'flex', 
      flexDirection: 'column' 
    }}>
      {/* Top Bar (Narrow CEP Panel Resilient & Non-Overlapping) */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        padding: '5px 8px',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        gap: '6px',
        overflow: 'hidden'
      }}>
        {/* Brand Logo & Name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flexShrink: 0 }}>
          <div style={{ 
            width: '18px', 
            height: '18px', 
            borderRadius: '4px', 
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: '10px',
            color: '#fff',
            flexShrink: 0
          }}>
            P
          </div>
          <span style={{ fontWeight: 700, fontSize: '11px', letterSpacing: '0.2px', color: '#f8fafc', whiteSpace: 'nowrap' }}>
            Prismex
          </span>
        </div>

        {/* Action & Status Buttons Group (No Collisions, Clean Flow) */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '4px', 
          overflowX: 'auto', 
          scrollbarWidth: 'none',
          flexShrink: 1,
          justifyContent: 'flex-end'
        }}>
          {/* Active Sequence Indicator */}
          <div 
            onClick={refreshSequence}
            title={language === 'bn' ? 'সিকোয়েন্স মেটাডাটা রিফ্রেশ করুন' : 'Click to refresh sequence'}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '3px', 
              backgroundColor: 'var(--bg-tertiary)',
              padding: '2px 6px',
              borderRadius: '10px',
              fontSize: '9.5px',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              flexShrink: 0,
              maxWidth: '85px',
              border: '1px solid var(--border-subtle)'
            }}
          >
            <RefreshCw size={9} style={{ flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {sequenceManifest ? sequenceManifest.sequenceName : (language === 'bn' ? 'নো সিকোয়েন্স' : 'No Seq')}
            </span>
          </div>

          {/* Engine Status Dot */}
          <div 
            title={daemonOnline ? (language === 'bn' ? 'এআই ব্যাকএন্ড ইঞ্জিন অনলাইন' : 'AI Engine Online') : (language === 'bn' ? 'এআই ব্যাকএন্ড ইঞ্জিন অফলাইন' : 'AI Engine Offline')}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '3px', 
              padding: '2px 5px',
              borderRadius: '10px',
              backgroundColor: daemonOnline ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.15)',
              border: daemonOnline ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
              fontSize: '9px',
              color: daemonOnline ? '#34d399' : '#f87171',
              flexShrink: 0,
              cursor: 'help'
            }}
          >
            <span style={{ 
              width: '5px', 
              height: '5px', 
              borderRadius: '50%', 
              backgroundColor: daemonOnline ? '#34d399' : '#ef4444' 
            }} />
            <span style={{ fontWeight: 600 }}>{daemonOnline ? 'Engine' : 'Offline'}</span>
          </div>

          {/* Undo Button */}
          <button
            onClick={async () => {
              setUndoStatus('...');
              const res = await PremiereHostBridge.getInstance().undoLastCut();
              if (res.success) {
                setUndoStatus(language === 'bn' ? '✓' : '✓');
                await refreshSequence();
              } else {
                setUndoStatus(language === 'bn' ? '✕' : '✕');
              }
              setTimeout(() => setUndoStatus(null), 2000);
            }}
            title={language === 'bn' ? 'পূর্ববর্তী সিকোয়েন্সে ফিরে যান (Undo)' : 'Revert to previous un-cut sequence (Undo)'}
            style={{
              backgroundColor: undoStatus ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.12)',
              border: undoStatus ? '1px solid #10b981' : '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '10px',
              color: undoStatus ? '#34d399' : '#fca5a5',
              fontSize: '9.5px',
              fontWeight: 600,
              padding: '2px 6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '2px',
              flexShrink: 0,
              whiteSpace: 'nowrap'
            }}
          >
            <RotateCcw size={9} />
            <span>{undoStatus || 'Undo'}</span>
          </button>

          {/* What's New Updates Button */}
          <button
            onClick={() => setIsUpdateModalOpen(true)}
            title={language === 'bn' ? 'নতুন আপডেট ও ফিচার দেখুন' : "View What's New & Updates"}
            style={{
              backgroundColor: updateInfo?.updateAvailable ? 'rgba(249, 115, 22, 0.22)' : 'rgba(139, 92, 246, 0.15)',
              border: updateInfo?.updateAvailable ? '1px solid #f97316' : '1px solid rgba(139, 92, 246, 0.35)',
              color: updateInfo?.updateAvailable ? '#fb923c' : '#c084fc',
              borderRadius: '10px',
              fontSize: '9.5px',
              fontWeight: 700,
              padding: '2px 6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
              flexShrink: 0,
              whiteSpace: 'nowrap'
            }}
          >
            <Sparkles size={9} />
            <span>{updateInfo?.updateAvailable ? 'Update' : 'New'}</span>
          </button>

          {/* Language Toggle */}
          <button
            onClick={() => setLanguage(language === 'en' ? 'bn' : 'en')}
            title={language === 'en' ? 'বাংলায় পরিবর্তন করুন' : 'Switch to English'}
            style={{
              backgroundColor: 'var(--bg-tertiary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '10px',
              color: 'var(--text-primary)',
              fontSize: '9px',
              fontWeight: 700,
              padding: '2px 5px',
              cursor: 'pointer',
              flexShrink: 0,
              whiteSpace: 'nowrap'
            }}
          >
            {language === 'en' ? 'বাং' : 'EN'}
          </button>
        </div>
      </div>

      {/* Interactive What's New & 1-Click Update Tour Modal */}
      <UpdateTourModal
        isOpen={isUpdateModalOpen}
        onClose={() => setIsUpdateModalOpen(false)}
        updateData={updateInfo}
      />
    </header>
  );
};
