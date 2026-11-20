import React from 'react';
import { usePrismexStore, ActiveTab } from '../state/usePrismexStore';
import { 
  LayoutDashboard, 
  FileText, 
  Briefcase, 
  Palette, 
  Settings,
  Mic,
  Sparkles
} from 'lucide-react';

export const BottomNavDock: React.FC = () => {
  const { 
    activeTab, 
    setActiveTab, 
    reviewItems, 
    language,
    isGlobalCopilotOpen,
    setIsGlobalCopilotOpen
  } = usePrismexStore();
  const isBn = language === 'bn';

  const pendingReviewCount = reviewItems.filter(i => i.status === 'PENDING').length;

  const isEditorActive = [
    'transcript', 
    'srt-editor', 
    'magic-cut', 
    'silence', 
    'takes', 
    'review-queue'
  ].includes(activeTab);

  const isStudiosActive = [
    'viral-shorts', 
    'color-studio', 
    'audio-studio'
  ].includes(activeTab);

  const isSettingsActive = [
    'settings', 
    'providers', 
    'profiles', 
    'history'
  ].includes(activeTab);

  const hubs = [
    {
      id: 'dashboard',
      label: isBn ? 'ড্যাশবোর্ড' : 'Dashboard',
      icon: <LayoutDashboard size={16} />,
      isActive: activeTab === 'dashboard',
      onSelect: () => setActiveTab('dashboard')
    },
    {
      id: 'editor',
      label: isBn ? 'এডিটর' : 'Editor',
      icon: <FileText size={16} />,
      isActive: isEditorActive,
      badge: pendingReviewCount > 0 ? pendingReviewCount : undefined,
      onSelect: () => {
        if (!isEditorActive) {
          setActiveTab('transcript');
        }
      }
    },
    {
      id: 'client-hub',
      label: isBn ? 'ক্লায়েন্ট' : 'Client',
      icon: <Briefcase size={16} />,
      isActive: activeTab === 'client-hub',
      onSelect: () => setActiveTab('client-hub')
    },
    {
      id: 'studios',
      label: isBn ? 'স্টুডিও' : 'Studios',
      icon: <Palette size={16} />,
      isActive: isStudiosActive,
      onSelect: () => {
        if (!isStudiosActive) {
          setActiveTab('viral-shorts');
        }
      }
    },
    {
      id: 'settings',
      label: isBn ? 'সেটিংস' : 'Settings',
      icon: <Settings size={16} />,
      isActive: isSettingsActive,
      onSelect: () => {
        if (!isSettingsActive) {
          setActiveTab('settings');
        }
      }
    },
    {
      id: 'copilot',
      label: isBn ? 'কো-পাইলট' : 'Co-Pilot',
      icon: <Mic size={16} />,
      isActive: isGlobalCopilotOpen,
      isCopilot: true,
      onSelect: () => setIsGlobalCopilotOpen(!isGlobalCopilotOpen)
    }
  ];

  return (
    <nav
      style={{
        position: 'sticky',
        bottom: 0,
        left: 0,
        right: 0,
        width: '100%',
        maxWidth: '100vw',
        height: '46px',
        backgroundColor: '#111219',
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        alignItems: 'stretch',
        justifyContent: 'space-around',
        zIndex: 90,
        boxShadow: '0 -4px 18px rgba(0, 0, 0, 0.45)',
        flexShrink: 0,
        userSelect: 'none'
      }}
    >
      {hubs.map((hub) => {
        const active = hub.isActive;
        const isCopilot = (hub as any).isCopilot;
        return (
          <button
            key={hub.id}
            onClick={hub.onSelect}
            title={hub.label}
            style={{
              flex: isCopilot ? 1.05 : 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '2px',
              padding: '4px 2px',
              background: isCopilot
                ? (active ? 'linear-gradient(180deg, rgba(147, 51, 234, 0.35) 0%, rgba(99, 102, 241, 0.2) 100%)' : 'linear-gradient(180deg, rgba(99, 102, 241, 0.15) 0%, transparent 100%)')
                : (active ? 'linear-gradient(180deg, rgba(59, 130, 246, 0.16) 0%, transparent 100%)' : 'transparent'),
              border: 'none',
              borderTop: isCopilot
                ? (active ? '2px solid #a855f7' : '2px solid rgba(139, 92, 246, 0.5)')
                : (active ? '2px solid #3b82f6' : '2px solid transparent'),
              color: isCopilot
                ? (active ? '#ffffff' : '#c084fc')
                : (active ? '#ffffff' : '#71717a'),
              cursor: 'pointer',
              position: 'relative',
              transition: 'all 0.15s ease',
              minWidth: 0,
              outline: 'none'
            }}
          >
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: isCopilot ? (active ? '#d8b4fe' : '#c084fc') : (active ? '#38bdf8' : 'inherit') }}>
                {hub.icon}
              </span>
              {Boolean(hub.badge && hub.badge > 0) && (
                <span
                  style={{
                    position: 'absolute',
                    top: '-4px',
                    right: '-7px',
                    backgroundColor: '#ef4444',
                    color: '#ffffff',
                    borderRadius: '8px',
                    padding: '0 3.5px',
                    fontSize: '8px',
                    fontWeight: 700,
                    lineHeight: '11px',
                    border: '1px solid #111219'
                  }}
                >
                  {hub.badge}
                </span>
              )}
            </div>

            <span
              style={{
                fontSize: '9.5px',
                fontWeight: active ? 700 : 500,
                letterSpacing: '0.1px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: '100%',
                lineHeight: 1.1
              }}
            >
              {hub.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
