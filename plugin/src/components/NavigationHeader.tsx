import React from 'react';
import { usePrismexStore, ActiveTab } from '../state/usePrismexStore';
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
  RefreshCw 
} from 'lucide-react';

export const NavigationHeader: React.FC = () => {
  const { 
    activeTab, 
    setActiveTab, 
    sequenceManifest, 
    refreshSequence, 
    daemonOnline,
    reviewItems 
  } = usePrismexStore();

  const pendingReviewCount = reviewItems.filter(i => i.status === 'PENDING').length;

  const tabs: Array<{ id: ActiveTab; label: string; icon: React.ReactNode; badge?: number }> = [
    { id: 'transcript', label: 'Text Panel', icon: <FileText size={13} /> },
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={13} /> },
    { id: 'magic-cut', label: 'Magic Cut', icon: <Sparkles size={13} /> },
    { id: 'review-queue', label: 'Review Queue', icon: <CheckSquare size={13} />, badge: pendingReviewCount },
    { id: 'takes', label: 'Takes', icon: <Layers size={13} /> },
    { id: 'silence', label: 'Silence', icon: <Sliders size={13} /> },
    { id: 'providers', label: 'Providers', icon: <Cpu size={13} /> },
    { id: 'profiles', label: 'Profiles', icon: <Bookmark size={13} /> },
    { id: 'settings', label: 'Settings', icon: <Settings size={13} /> },
    { id: 'history', label: 'History', icon: <History size={13} /> }
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
            <span>{daemonOnline ? 'Engine Ready' : 'Offline'}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <nav style={{ 
        display: 'flex', 
        gap: '2px', 
        overflowX: 'auto', 
        padding: '2px 6px',
        backgroundColor: 'var(--bg-primary)'
      }}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                backgroundColor: isActive ? 'var(--bg-card)' : 'transparent',
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                borderBottom: isActive ? '2px solid var(--accent-color)' : '2px solid transparent',
                borderRadius: '4px 4px 0 0',
                padding: '5px 8px',
                fontSize: '10.5px',
                position: 'relative',
                whiteSpace: 'nowrap'
              }}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {Boolean(tab.badge && tab.badge > 0) && (
                <span style={{
                  backgroundColor: 'var(--accent-color)',
                  color: '#fff',
                  borderRadius: '8px',
                  padding: '1px 5px',
                  fontSize: '9px',
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
