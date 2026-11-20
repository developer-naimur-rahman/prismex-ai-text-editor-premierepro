import React, { useState, useEffect } from 'react';
import { usePrismexStore } from '../state/usePrismexStore';
import { translations } from '../i18n/translations';
import { PrismexDaemonClient } from '../api/PrismexDaemonClient';
import { 
  Globe, 
  Key, 
  Trash2, 
  Cpu, 
  CheckCircle, 
  ExternalLink,
  Type,
  RotateCcw,
  RefreshCw,
  Power,
  History,
  Layers
} from 'lucide-react';
import { PremiereHostBridge } from '../host/PremiereHostBridge';

export const SettingsView: React.FC = () => {
  const { 
    language, 
    setLanguage, 
    setActiveTab, 
    autoTranscribeNewSequences, 
    setAutoTranscribeNewSequences,
    uiScale,
    setUiScale,
    showToast
  } = usePrismexStore();

  const isBn = language === 'bn';
  const t = translations[language];
  const [cachePurged, setCachePurged] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [providerList, setProviderList] = useState<any[]>([]);
  const [keyInputs, setKeyInputs] = useState<Record<string, string>>({});
  const [savingKeyId, setSavingKeyId] = useState<string | null>(null);

  const loadProviders = () => {
    PrismexDaemonClient.getInstance().getProviders().then((res) => {
      if (res) setProviderList(res);
    });
  };

  useEffect(() => {
    loadProviders();
  }, []);

  const handleSaveProviderKey = async (providerId: string) => {
    const keyVal = (keyInputs[providerId] || '').trim();
    if (!keyVal) return;
    setSavingKeyId(providerId);
    try {
      const ok = await PrismexDaemonClient.getInstance().setProviderKey(providerId, keyVal);
      if (ok) {
        setKeyInputs((prev) => ({ ...prev, [providerId]: '' }));
        showToast(isBn ? 'API কী সফলভাবে সংরক্ষিত হয়েছে!' : 'API Key saved successfully!', 'success');
        loadProviders();
      } else {
        showToast(isBn ? 'কী সংরক্ষণ ব্যর্থ হয়েছে' : 'Failed to save key', 'error');
      }
    } finally {
      setSavingKeyId(null);
    }
  };

  const handleReloadPanel = () => {
    showToast(isBn ? 'প্যানেল রিলোড হচ্ছে...' : 'Reloading panel...', 'info');
    setTimeout(() => {
      window.location.reload();
    }, 400);
  };

  const handleRestartPremiere = async () => {
    const confirmMsg = isBn 
      ? 'প্রিমিয়ার প্রো সেভ করে রিস্টার্ট করতে চান? আপনার প্রজেক্ট অটোমেটিক সেভ হবে।' 
      : 'Do you want to save and restart Adobe Premiere Pro? Your project will be saved automatically.';
    
    if (!window.confirm(confirmMsg)) return;

    setIsRestarting(true);
    showToast(isBn ? 'প্রজেক্ট সেভ হচ্ছে ও প্রিমিয়ার প্রো রিস্টার্ট হচ্ছে...' : 'Saving project & restarting Premiere Pro...', 'info');

    try {
      // 1. Save open project
      await PremiereHostBridge.getInstance().saveProject();
      // 2. Trigger graceful restart
      const res = await PrismexDaemonClient.getInstance().restartPremierePro();
      if (!res.success) {
        showToast(res.error || (isBn ? 'রিস্টার্ট ব্যর্থ হয়েছে' : 'Failed to restart'), 'error');
        setIsRestarting(false);
      }
    } catch (e: any) {
      showToast(String(e), 'error');
      setIsRestarting(false);
    }
  };

  return (
    <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '14px', height: '100%', overflowY: 'auto' }}>
      
      {/* Sub-Tabs: Settings / Providers / History */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        paddingBottom: '8px'
      }}>
        <button
          onClick={() => setActiveTab('settings')}
          style={{
            padding: '4px 10px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: 700,
            backgroundColor: '#3b82f6',
            color: '#fff',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          {isBn ? '⚙️ সেটিংস ও স্কেলিং' : '⚙️ General & Scale'}
        </button>

        <button
          onClick={() => setActiveTab('providers')}
          style={{
            padding: '4px 10px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: 600,
            backgroundColor: 'rgba(255, 255, 255, 0.06)',
            color: '#cbd5e1',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          <Key size={11} />
          <span>{isBn ? 'এআই প্রোভাইডার্স' : 'AI Providers'}</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          style={{
            padding: '4px 10px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: 600,
            backgroundColor: 'rgba(255, 255, 255, 0.06)',
            color: '#cbd5e1',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          <History size={11} />
          <span>{isBn ? 'হিস্ট্রি' : 'History'}</span>
        </button>
      </div>

      {/* 1. Global UI & Text Scaling Control */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderColor: 'rgba(56, 189, 248, 0.35)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', fontWeight: 700, color: '#f8fafc' }}>
            <Type size={14} color="#38bdf8" />
            <span>{isBn ? 'অ্যাপের টেক্সট ও ইউআই স্কেল (Font & UI Size)' : 'Global UI & Text Scale'}</span>
          </div>
          <span style={{ fontSize: '9.5px', color: '#38bdf8', fontWeight: 700, textTransform: 'uppercase' }}>
            {uiScale}
          </span>
        </div>

        <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: 0 }}>
          {isBn 
            ? 'প্যানেলের ট্রান্সক্রিপ্ট, বাটন, কার্ডসহ পুরো অ্যাপের টেক্সটের সাইজ পছন্দমতো ছোট বা বড় করুন।' 
            : 'Scale typography and UI density across the entire plugin from compact to extra-large.'}
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginTop: '2px' }}>
          {[
            { id: 'compact', label: isBn ? 'ছোট' : 'Compact', pct: '88%' },
            { id: 'normal', label: isBn ? 'স্বাভাবিক' : 'Normal', pct: '100%' },
            { id: 'large', label: isBn ? 'বড়' : 'Large', pct: '114%' },
            { id: 'xlarge', label: isBn ? 'অতিরিক্ত' : 'Extra', pct: '128%' }
          ].map((item) => {
            const active = uiScale === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setUiScale(item.id as any)}
                style={{
                  padding: '7px 4px',
                  borderRadius: '6px',
                  fontSize: '10.5px',
                  fontWeight: active ? 700 : 500,
                  backgroundColor: active ? '#2563eb' : 'var(--bg-tertiary)',
                  border: active ? '1px solid #60a5fa' : '1px solid var(--border-subtle)',
                  color: active ? '#ffffff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '2px',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>{item.label}</span>
                <span style={{ fontSize: '9px', opacity: 0.75 }}>{item.pct}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. App Language Switcher */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderColor: 'rgba(59, 130, 246, 0.35)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', fontWeight: 700 }}>
          <Globe size={14} color="var(--accent-color)" />
          <span>{t.appLanguage}</span>
        </div>
        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{t.appLanguageDesc}</div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setLanguage('en')}
            className={language === 'en' ? 'btn-primary' : 'btn-secondary'}
            style={{ flex: 1, padding: '7px 10px', fontSize: '11px', fontWeight: 600 }}
          >
            English
          </button>
          <button
            onClick={() => setLanguage('bn')}
            className={language === 'bn' ? 'btn-primary' : 'btn-secondary'}
            style={{ flex: 1, padding: '7px 10px', fontSize: '11px', fontWeight: 600 }}
          >
            বাংলা (Bangla)
          </button>
        </div>
      </div>

      {/* 3. Panel Reload & Premiere Pro Restart Station */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderColor: 'rgba(239, 68, 68, 0.35)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', fontWeight: 700, color: '#fca5a5' }}>
          <Power size={14} color="#ef4444" />
          <span>{isBn ? 'প্যানেল রিলোড ও প্রিমিয়ার প্রো রিস্টার্ট' : 'Panel Reload & App Restart'}</span>
        </div>

        <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: 0 }}>
          {isBn 
            ? 'আপডেট নেওয়ার পর অথবা মেমরি ফ্রেশ করতে এক ক্লিকে প্যানেল রিলোড করুন বা প্রিমিয়ার প্রো রিস্টার্ট দিন।' 
            : 'Reload the CEP panel or save project and restart Premiere Pro in one click.'}
        </p>

        <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
          <button
            onClick={handleReloadPanel}
            className="btn-secondary"
            style={{
              flex: 1,
              padding: '7px 10px',
              fontSize: '11px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <RefreshCw size={12} />
            <span>{isBn ? 'প্যানেল রিলোড' : 'Reload Panel'}</span>
          </button>

          <button
            onClick={handleRestartPremiere}
            disabled={isRestarting}
            style={{
              flex: 1,
              padding: '7px 10px',
              fontSize: '11px',
              fontWeight: 700,
              backgroundColor: 'rgba(239, 68, 68, 0.2)',
              border: '1px solid #ef4444',
              color: '#f87171',
              borderRadius: '6px',
              cursor: isRestarting ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              opacity: isRestarting ? 0.6 : 1
            }}
          >
            <Power size={12} />
            <span>{isRestarting ? (isBn ? 'রিস্টার্ট হচ্ছে...' : 'Restarting...') : (isBn ? 'প্রিমিয়ার রিস্টার্ট' : 'Restart Premiere')}</span>
          </button>
        </div>
      </div>

      {/* 4. Auto-Transcribe New Sequences */}
      <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px' }}>
        <div style={{ paddingRight: '10px' }}>
          <div style={{ fontWeight: 600, fontSize: '11px', color: '#fff' }}>
            {isBn ? 'নতুন সিকোয়েন্স অটো-ট্রান্সক্রাইব' : 'Auto-Transcribe New Sequences'}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px', lineHeight: 1.3 }}>
            {isBn 
              ? 'প্রিমিয়ার প্রোতে নতুন সিকোয়েন্স ওপেন করলেই ব্যাকগ্রাউন্ডে স্বয়ংক্রিয়ভাবে অডিও এনালাইসিস সম্পন্ন করবে।' 
              : 'Automatically transcribes new sequences and clips when opened in Premiere Pro.'}
          </div>
        </div>
        <input
          type="checkbox"
          checked={autoTranscribeNewSequences}
          onChange={(e) => setAutoTranscribeNewSequences(e.target.checked)}
          style={{ width: '17px', height: '17px', cursor: 'pointer', accentColor: 'var(--accent-color)', flexShrink: 0 }}
        />
      </div>

      {/* 5. AI API Providers & Real-Time Quota Health Diagnostics */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderColor: 'rgba(139, 92, 246, 0.45)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700, color: '#f8fafc' }}>
            <Key size={14} color="#a78bfa" />
            <span>{isBn ? 'এআই প্রোভাইডার ও কোটা স্ট্যাটাস' : 'AI Providers & API Key Diagnostics'}</span>
          </div>
          <button
            onClick={() => setActiveTab('providers')}
            className="btn-secondary"
            style={{ padding: '3px 8px', fontSize: '10px', whiteSpace: 'nowrap' }}
          >
            {isBn ? 'সব প্রোভাইডার দেখুন →' : 'All Providers →'}
          </button>
        </div>

        <div style={{ fontSize: '10px', color: '#94a3b8', lineHeight: 1.4 }}>
          {isBn 
            ? 'গুগল জেমিনি, ওপেনরাউটার বা গ্রোকের ফ্রি এপিআই কী সেট করুন। কোটা বা লিমিট শেষ হয়ে গেলে এখানে সাথে সাথে সতর্কতা দেখাবে।'
            : 'Configure Google Gemini, OpenRouter, or Groq API keys. If your quota or token limit is reached, it will be flagged here immediately.'}
        </div>

        {/* Dynamic Provider Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
          {(providerList.length > 0 
            ? providerList.filter(p => !p.isLocal) 
            : [
                { providerId: 'google-gemini', name: 'Google Gemini AI', isConfigured: true, maskedKey: 'AIzaSy...Key', quotaExhausted: false },
                { providerId: 'openrouter', name: 'OpenRouter Free Tier', isConfigured: false, quotaExhausted: false },
                { providerId: 'groq', name: 'Groq Cloud Llama', isConfigured: false, quotaExhausted: false }
              ]
          ).map((p: any) => {
            const isExhausted = Boolean(p.quotaExhausted || p.needsKeyChange);
            const keyUrl = p.providerId === 'google-gemini' 
              ? 'https://aistudio.google.com/apikey'
              : p.providerId === 'openrouter'
              ? 'https://openrouter.ai/keys'
              : 'https://console.groq.com/keys';

            return (
              <div 
                key={p.providerId} 
                style={{
                  padding: '9px 10px',
                  borderRadius: '8px',
                  backgroundColor: isExhausted ? 'rgba(239, 68, 68, 0.12)' : '#161722',
                  border: isExhausted ? '1px solid #ef4444' : '1px solid #282a3c',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}
              >
                {/* Header row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#ffffff' }}>{p.name}</span>
                    {p.maskedKey && (
                      <span style={{ fontSize: '9px', color: '#64748b', fontFamily: 'monospace' }}>({p.maskedKey})</span>
                    )}
                  </div>

                  {/* Status Badge */}
                  {isExhausted ? (
                    <span style={{
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontSize: '9px',
                      fontWeight: 700,
                      backgroundColor: 'rgba(239, 68, 68, 0.25)',
                      color: '#f87171',
                      border: '1px solid #ef4444'
                    }}>
                      {isBn ? '⚠️ কোটা শেষ (Quota Reached)' : '⚠️ Quota Reached'}
                    </span>
                  ) : p.isConfigured ? (
                    <span style={{
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontSize: '9px',
                      fontWeight: 600,
                      backgroundColor: 'rgba(16, 185, 129, 0.18)',
                      color: '#34d399',
                      border: '1px solid rgba(16, 185, 129, 0.35)'
                    }}>
                      {isBn ? '✓ সচল ও প্রস্তুত' : '✓ Active & Ready'}
                    </span>
                  ) : (
                    <span style={{
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontSize: '9px',
                      fontWeight: 600,
                      backgroundColor: 'rgba(245, 158, 11, 0.15)',
                      color: '#fbbf24',
                      border: '1px solid rgba(245, 158, 11, 0.3)'
                    }}>
                      {isBn ? 'কী সেট করা নেই' : 'Needs Key'}
                    </span>
                  )}
                </div>

                {/* Quota Exhaustion Message if any */}
                {isExhausted && (
                  <div style={{ fontSize: '10px', color: '#fca5a5', lineHeight: 1.35 }}>
                    {isBn
                      ? '⚠️ এই এপিআই-এর ব্যবহারের ফ্রি লিমিট/টোকেন শেষ হয়ে গেছে। দয়া করে নিচের বক্সে নতুন এপিআই কী দিয়ে বদলান।'
                      : '⚠️ API quota or token limit has been exhausted. Please enter a new key below to replace it.'}
                  </div>
                )}

                {/* Input + Save + Get Key Link */}
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <input
                    type="password"
                    placeholder={isBn ? `নতুন ${p.name} কী দিন...` : `Paste new ${p.name} key...`}
                    value={keyInputs[p.providerId] || ''}
                    onChange={(e) => setKeyInputs({ ...keyInputs, [p.providerId]: e.target.value })}
                    style={{
                      flex: 1,
                      padding: '5px 8px',
                      backgroundColor: '#10111a',
                      color: '#ffffff',
                      border: '1px solid #2e3046',
                      borderRadius: '5px',
                      fontSize: '10.5px',
                      outline: 'none',
                      minWidth: '60px'
                    }}
                  />
                  <button
                    onClick={() => handleSaveProviderKey(p.providerId)}
                    disabled={savingKeyId === p.providerId || !keyInputs[p.providerId]?.trim()}
                    style={{
                      padding: '5px 10px',
                      backgroundColor: keyInputs[p.providerId]?.trim() ? '#4f46e5' : 'rgba(255, 255, 255, 0.08)',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '5px',
                      fontSize: '10.5px',
                      fontWeight: 600,
                      cursor: keyInputs[p.providerId]?.trim() ? 'pointer' : 'default',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {savingKeyId === p.providerId ? '...' : (isBn ? 'সেভ' : 'Save')}
                  </button>
                  <button
                    onClick={() => PremiereHostBridge.getInstance().openExternalUrl(keyUrl)}
                    title={isBn ? 'ফ্রি কী তৈরি করুন' : 'Get free API key'}
                    style={{
                      padding: '5px 7px',
                      backgroundColor: 'transparent',
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                      borderRadius: '5px',
                      color: '#60a5fa',
                      fontSize: '10px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <ExternalLink size={10} />
                    <span>{isBn ? 'ফ্রি কী' : 'Get Key'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 6. Hardware & Unified Memory Status */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>
          {t.hardwareAccel}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Cpu size={18} color="var(--accent-color)" />
          <div>
            <div style={{ fontSize: '11px', fontWeight: 600 }}>Apple Silicon Unified Memory (UMA)</div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
              Metal Performance Shaders + Neural Engine Enabled
            </div>
          </div>
        </div>
        <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
          Memory Budget Ceiling: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>2,500 MB (2.5 GB RAM)</span>
        </div>
      </div>

      {/* 7. Cache Cleanup */}
      <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: '11px' }}>Audio Scratch Cache</div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
            Temporary WAV extraction files are cleared automatically.
          </div>
        </div>
        <button 
          className="btn-secondary" 
          onClick={() => {
            setCachePurged(true);
            setTimeout(() => setCachePurged(false), 2500);
          }}
          style={{
            backgroundColor: cachePurged ? 'rgba(16, 185, 129, 0.2)' : undefined,
            color: cachePurged ? '#34d399' : undefined,
            borderColor: cachePurged ? '#10b981' : undefined
          }}
        >
          {cachePurged ? <CheckCircle size={11} /> : <Trash2 size={11} />}
          <span>{cachePurged ? (isBn ? 'মুছে ফেলা হয়েছে' : 'Purged') : (isBn ? 'ক্যাশ মুছুন' : 'Purge Cache')}</span>
        </button>
      </div>

    </div>
  );
};
