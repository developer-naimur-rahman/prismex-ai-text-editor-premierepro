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
  RotateCcw 
} from 'lucide-react';
import { PremiereHostBridge } from '../host/PremiereHostBridge';

export const NavigationHeader: React.FC = () => {
  const { 
    activeTab, 
    setActiveTab, 
    sequenceManifest, 
    refreshSequence, 
    daemonOnline,
    reviewItems,
    language,
    setLanguage
  } = usePrismexStore();

  const t = translations[language];
  const pendingReviewCount = reviewItems.filter(i => i.status === 'PENDING').length;

  const tabs: Array<{ id: ActiveTab; label: string; icon: React.ReactNode; badge?: number }> = [
    { id: 'transcript', label: t.tabTranscript, icon: <FileText size={12} /> },
    { id: 'magic-cut', label: t.tabMagicCut, icon: <Sparkles size={12} /> },
    { id: 'silence', label: t.tabSilence, icon: <Sliders size={12} /> },
    { id: 'takes', label: t.tabTakes, icon: <Layers size={12} /> },
    { id: 'review-queue', label: t.tabReviewQueue, icon: <CheckSquare size={12} />, badge: pendingReviewCount },
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
      {/* Top Bar */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        padding: '6px 12px',
        borderBottom: '1px solid rgba(255,255,255,0.05)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
            color: '#fff'
          }}>
            P
          </div>
          <span style={{ fontWeight: 600, fontSize: '12px', letterSpacing: '0.3px' }}>Prismex AI Editor</span>
        </div>

        {/* Sequence & Status Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div 
            onClick={refreshSequence}
            title="Click to refresh sequence metadata"
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '4px', 
              backgroundColor: 'var(--bg-tertiary)',
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '10px',
              color: 'var(--text-secondary)',
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={10} />
            <span style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {sequenceManifest ? sequenceManifest.sequenceName : 'No Sequence'}
            </span>
          </div>

          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '4px', 
            fontSize: '10px',
            color: daemonOnline ? 'var(--success-color)' : 'var(--warning-color)'
          }}>
            <span style={{ 
              width: '6px', 
              height: '6px', 
              borderRadius: '50%', 
              backgroundColor: daemonOnline ? 'var(--success-color)' : 'var(--warning-color)' 
            }} />
            <span>{daemonOnline ? t.engineReady : t.engineOffline}</span>
          </div>

          <button
            onClick={async () => {
              const res = await PremiereHostBridge.getInstance().undoLastCut();
              if (res.success) {
                await refreshSequence();
              }
            }}
            title={language === 'bn' ? 'পূর্ববর্তী সিকোয়েন্সে ফিরে যান (Undo)' : 'Revert to previous un-cut sequence (Undo)'}
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              borderRadius: '10px',
              color: '#fca5a5',
              fontSize: '9.5px',
              fontWeight: 600,
              padding: '2px 7px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '3px'
            }}
          >
            <RotateCcw size={10} />
            <span>{language === 'bn' ? 'আনডু' : 'Undo'}</span>
          </button>

          <button
            onClick={() => setLanguage(language === 'en' ? 'bn' : 'en')}
            title="Switch Language (English / বাংলা)"
            style={{
              backgroundColor: 'var(--bg-tertiary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '10px',
              color: 'var(--text-primary)',
              fontSize: '9.5px',
              fontWeight: 600,
              padding: '2px 7px',
              cursor: 'pointer'
            }}
          >
            {language === 'en' ? 'বাং' : 'EN'}
          </button>
        </div>
      </div>

      {/* Workflow Ordered Tabs */}
      <nav style={{ 
        display: 'flex', 
        gap: '4px', 
        overflowX: 'auto', 
        padding: '3px 6px',
        backgroundColor: 'var(--bg-primary)',
        scrollbarWidth: 'none',
        alignItems: 'center'
      }}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                backgroundColor: isActive ? 'var(--accent-color)' : 'var(--bg-tertiary)',
                color: isActive ? '#ffffff' : 'var(--text-secondary)',
                borderRadius: '4px',
                padding: '3px 7px',
                fontSize: '9.5px',
                fontWeight: isActive ? 600 : 500,
                position: 'relative',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                border: isActive ? '1px solid var(--accent-hover)' : '1px solid var(--border-subtle)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px'
              }}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {Boolean(tab.badge && tab.badge > 0) && (
                <span style={{
                  backgroundColor: isActive ? '#ef4444' : 'var(--accent-color)',
                  color: '#fff',
                  borderRadius: '8px',
                  padding: '0 4px',
                  fontSize: '8.5px',
                  fontWeight: 700,
                  marginLeft: '2px'
                }}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </header>
  );
};
