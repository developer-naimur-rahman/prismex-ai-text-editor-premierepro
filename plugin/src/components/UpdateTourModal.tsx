import React, { useState } from 'react';
import { usePrismexStore, ActiveTab } from '../state/usePrismexStore';
import { PrismexDaemonClient } from '../api/PrismexDaemonClient';
import { PremiereHostBridge } from '../host/PremiereHostBridge';
import {
  Sparkles,
  Download,
  RotateCcw,
  CheckCircle2,
  ArrowRight,
  X,
  Flame,
  Film,
  Bookmark,
  Search,
  Shield,
  Layers,
  Cpu,
  RefreshCw,
  Power
} from 'lucide-react';

interface ReleaseNoteItem {
  id: string;
  title: string;
  description: string;
  tab: string;
  badge?: string;
}

interface UpdateTourModalProps {
  isOpen: boolean;
  onClose: () => void;
  updateData?: {
    updateAvailable: boolean;
    currentVersion: string;
    latestVersion: string;
    releaseDate: string;
    releaseNotes: ReleaseNoteItem[];
    downloadSize: string;
    downloadUrl: string;
  } | null;
}

export const UpdateTourModal: React.FC<UpdateTourModalProps> = ({
  isOpen,
  onClose,
  updateData
}) => {
  const { language, setActiveTab, showToast } = usePrismexStore();
  const client = PrismexDaemonClient.getInstance();
  const bridge = PremiereHostBridge.getInstance();

  const isBn = language === 'bn';
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [isRestarting, setIsRestarting] = useState<boolean>(false);

  if (!isOpen) return null;

  const currentVer = updateData?.currentVersion || '1.0.0';
  const latestVer = updateData?.latestVersion || '1.1.0';
  const releaseNotes = updateData?.releaseNotes || [];
  const downloadSize = updateData?.downloadSize || '3.8 MB';

  // 1-Click Download and Install Update
  const handleStartUpdate = async () => {
    setIsDownloading(true);
    setDownloadProgress(15);

    // Simulate animated download progression
    const progressInterval = setInterval(() => {
      setDownloadProgress((prev) => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + 25;
      });
    }, 200);

    try {
      const res = await client.downloadAndInstallUpdate(updateData?.downloadUrl);
      clearInterval(progressInterval);
      setDownloadProgress(100);

      if (res && res.success) {
        setIsInstalled(true);
        showToast?.(
          isBn ? '🎉 আপডেট সফলভাবে ইনস্টল হয়েছে! এবার রিস্টার্ট করুন।' : 'Update installed! Please restart.',
          'success'
        );
      } else {
        showToast?.(res?.error || 'আপডেট ইনস্টল করতে সমস্যা হয়েছে।', 'error');
      }
    } catch (err: any) {
      clearInterval(progressInterval);
      showToast?.(String(err), 'error');
    } finally {
      setIsDownloading(false);
    }
  };

  // 1-Click App / Extension Restart
  const handleRestartApp = async () => {
    setIsRestarting(true);
    try {
      // 1. Try to save active Premiere Pro project via ExtendScript
      try {
        await bridge.evalScript('if (app.project) { app.project.save(); }');
      } catch {}

      showToast?.(
        isBn ? '🔄 প্রজেক্ট সেভ করে অ্যাপ রিস্টার্ট করা হচ্ছে...' : 'Saving project & restarting app...',
        'info'
      );

      // 2. Call daemon restart endpoint
      const res = await client.restartHostApp('Adobe Premiere Pro');
      if (res && res.success) {
        setTimeout(() => {
          // Also reload CEP panel iframe
          window.location.reload();
        }, 1500);
      } else {
        // Fallback: reload panel directly
        window.location.reload();
      }
    } catch {
      window.location.reload();
    }
  };

  const handleJumpToTab = (tabId: string) => {
    setActiveTab(tabId as ActiveTab);
    onClose();
  };

  const getFeatureIcon = (id: string) => {
    switch (id) {
      case 'batch_shorts':
        return <Flame size={14} color="#f97316" />;
      case 'broll_drag_drop':
        return <Film size={14} color="#34d399" />;
      case 'client_markers':
        return <Bookmark size={14} color="#a855f7" />;
      case 'search_focus':
        return <Search size={14} color="#38bdf8" />;
      case 'safe_zone':
        return <Shield size={14} color="#fbbf24" />;
      default:
        return <Sparkles size={14} color="#60a5fa" />;
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10005,
        backgroundColor: 'rgba(0, 0, 0, 0.78)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card"
        style={{
          width: '100%',
          maxWidth: '520px',
          maxHeight: '85vh',
          backgroundColor: '#18181b',
          border: '1.5px solid rgba(139, 92, 246, 0.5)',
          borderRadius: '12px',
          padding: '18px',
          boxShadow: '0 25px 60px rgba(0,0,0,0.9), 0 0 35px rgba(139, 92, 246, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          fontFamily: isBn ? 'var(--font-family-bn)' : 'inherit',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* Header Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '7px',
              background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              boxShadow: '0 0 12px rgba(139, 92, 246, 0.4)'
            }}>
              <Sparkles size={15} />
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#f4f4f5', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>{isBn ? 'প্রিজমেক্স নতুন আপডেট ও ফিচার গাইড' : "What's New in Prismex Studio"}</span>
                <span style={{ fontSize: '10px', backgroundColor: 'rgba(139, 92, 246, 0.2)', color: '#c084fc', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                  v{latestVer}
                </span>
              </div>
              <div style={{ fontSize: '10.5px', color: '#94a3b8' }}>
                {isBn ? `বর্তমান ভার্সন: v${currentVer} • প্রকাশিত: ${updateData?.releaseDate || 'আজ'}` : `Current: v${currentVer} • Released: ${updateData?.releaseDate || 'Today'}`}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '5px',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '3px 8px',
              fontSize: '11px',
              lineHeight: 1
            }}
          >
            ✕
          </button>
        </div>

        {/* 1-Click Update / Restart Master Banner */}
        <div style={{
          padding: '12px 14px',
          borderRadius: '8px',
          backgroundColor: isInstalled ? 'rgba(16, 185, 129, 0.12)' : 'rgba(59, 130, 246, 0.12)',
          border: isInstalled ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid rgba(59, 130, 246, 0.35)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: isInstalled ? '#34d399' : '#60a5fa', display: 'flex', alignItems: 'center', gap: '5px' }}>
                {isInstalled ? <CheckCircle2 size={14} /> : <Download size={14} />}
                <span>
                  {isInstalled
                    ? (isBn ? 'আপডেট সফলভাবে ইনস্টল হয়েছে!' : 'Update Installed Successfully!')
                    : (isBn ? `নতুন ভার্সন উপলব্ধ (v${latestVer})` : `New Version Available (v${latestVer})`)}
                </span>
              </div>
              <div style={{ fontSize: '10.5px', color: '#cbd5e1', marginTop: '2px' }}>
                {isInstalled
                  ? (isBn ? 'নতুন ফিচারগুলো সক্রিয় করতে এখনই অ্যাপ রিস্টার্ট করুন।' : 'Restart app to activate all newly installed features.')
                  : (isBn ? `সাইজ: ~${downloadSize} • ১-ক্লিকে ডাউনলোড ও ইনস্টল` : `Size: ~${downloadSize} • 1-Click Download & Apply`)}
              </div>
            </div>

            {/* Action Buttons */}
            <div>
              {!isInstalled ? (
                <button
                  onClick={handleStartUpdate}
                  disabled={isDownloading}
                  className="btn-primary"
                  style={{
                    padding: '6px 14px',
                    fontSize: '11px',
                    fontWeight: 600,
                    backgroundColor: '#3b82f6',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: isDownloading ? 'default' : 'pointer'
                  }}
                >
                  <Download size={12} className={isDownloading ? 'animate-bounce' : ''} />
                  <span>
                    {isDownloading
                      ? (isBn ? `ডাউনলোড হচ্ছে (${downloadProgress}%)...` : `Downloading (${downloadProgress}%)...`)
                      : (isBn ? '⚡ ১-ক্লিকে আপডেট করুন' : '⚡ Update Now')}
                  </span>
                </button>
              ) : (
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    onClick={() => window.location.reload()}
                    className="btn-secondary"
                    style={{ padding: '6px 10px', fontSize: '10.5px', color: '#a7f3d0', borderColor: 'rgba(52, 211, 153, 0.4)' }}
                    title="প্যানেল রিফ্রেশ করুন"
                  >
                    <RefreshCw size={11} />
                    <span>{isBn ? 'প্যানেল রিলোড' : 'Reload Panel'}</span>
                  </button>
                  <button
                    onClick={handleRestartApp}
                    disabled={isRestarting}
                    className="btn-primary"
                    style={{
                      padding: '6px 14px',
                      fontSize: '11px',
                      fontWeight: 700,
                      backgroundColor: '#059669',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      cursor: isRestarting ? 'default' : 'pointer',
                      boxShadow: '0 0 14px rgba(5, 150, 105, 0.5)'
                    }}
                  >
                    <Power size={12} className={isRestarting ? 'animate-spin' : ''} />
                    <span>
                      {isRestarting
                        ? (isBn ? 'রিস্টার্ট হচ্ছে...' : 'Restarting...')
                        : (isBn ? '🔄 ১-ক্লিকে রিস্টার্ট করুন' : '🔄 Restart App Now')}
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Progress Bar when Downloading */}
          {isDownloading && (
            <div style={{ width: '100%', height: '4px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${downloadProgress}%`,
                  background: 'linear-gradient(90deg, #3b82f6, #a855f7)',
                  transition: 'width 0.25s ease'
                }}
              />
            </div>
          )}
        </div>

        {/* What's New Feature List */}
        <div style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Layers size={13} />
          <span>{isBn ? 'সাম্প্রতিক আপডেট ও নতুন ফিচারের তালিকা:' : 'Changelog & Guided Feature Tour:'}</span>
        </div>

        <div style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          paddingRight: '4px',
          minHeight: 0
        }}>
          {releaseNotes.map((item, idx) => (
            <div
              key={item.id || idx}
              style={{
                padding: '9px 12px',
                borderRadius: '7px',
                backgroundColor: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px',
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <div style={{ marginTop: '2px' }}>
                  {getFeatureIcon(item.id)}
                </div>
                <div>
                  <div style={{ fontSize: '11.5px', fontWeight: 600, color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>{item.title}</span>
                    {item.badge && (
                      <span style={{
                        fontSize: '8.5px',
                        padding: '1px 5px',
                        borderRadius: '3px',
                        fontWeight: 700,
                        backgroundColor: item.badge === 'NEW' ? 'rgba(249, 115, 22, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                        color: item.badge === 'NEW' ? '#fb923c' : '#60a5fa'
                      }}>
                        {item.badge}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px', lineHeight: 1.4 }}>
                    {item.description}
                  </div>
                </div>
              </div>

              {/* Jump to Feature Tab Button */}
              {item.tab && (
                <button
                  onClick={() => handleJumpToTab(item.tab)}
                  className="btn-secondary"
                  style={{
                    padding: '3px 8px',
                    fontSize: '9.5px',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    color: '#c084fc',
                    borderColor: 'rgba(168, 85, 247, 0.35)',
                    backgroundColor: 'rgba(168, 85, 247, 0.08)'
                  }}
                  title={isBn ? 'সরাসরি এই ট্যাবে যান' : 'Navigate to this feature tab'}
                >
                  <span>{isBn ? 'ফিচারটি দেখুন' : 'Try it'}</span>
                  <ArrowRight size={10} />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px' }}>
          <span style={{ fontSize: '10px', color: '#64748b' }}>
            💡 {isBn ? 'ভবিষ্যতে যেকোনো সময় উপরের ✨ আইকনে ক্লিক করে এটি দেখতে পারেন' : 'Click ✨ icon in header anytime to see this guide'}
          </span>
          <button
            onClick={onClose}
            className="btn-secondary"
            style={{ padding: '4px 12px', fontSize: '11px' }}
          >
            {isBn ? 'বুঝেছি / বন্ধ করুন' : 'Got it'}
          </button>
        </div>
      </div>
    </div>
  );
};
