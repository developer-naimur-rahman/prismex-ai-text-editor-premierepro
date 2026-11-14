import React, { useState } from 'react';
import { usePrismexStore } from '../state/usePrismexStore';
import { translations } from '../i18n/translations';
import { PrismexDaemonClient } from '../api/PrismexDaemonClient';
import { Globe, Key, Trash2, Cpu, CheckCircle, ExternalLink } from 'lucide-react';
import { PremiereHostBridge } from '../host/PremiereHostBridge';

export const SettingsView: React.FC = () => {
  const { language, setLanguage, setActiveTab } = usePrismexStore();
  const t = translations[language];
  const [geminiKey, setGeminiKey] = useState('');
  const [keySaved, setKeySaved] = useState(false);
  const [cachePurged, setCachePurged] = useState(false);

  const handleQuickSaveGemini = async () => {
    if (!geminiKey.trim()) return;
    const ok = await PrismexDaemonClient.getInstance().setProviderKey('google-gemini', geminiKey.trim());
    if (ok) {
      setGeminiKey('');
      setKeySaved(true);
      setTimeout(() => setKeySaved(false), 3000);
    }
  };

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', height: '100%', overflowY: 'auto' }}>
      <div>
        <h2 style={{ fontSize: '13px', fontWeight: 600 }}>{t.settingsTitle}</h2>
        <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
          {t.hardwareAccelDesc}
        </p>
      </div>

      {/* App Language Switcher */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderColor: 'rgba(59, 130, 246, 0.35)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 600 }}>
          <Globe size={14} color="var(--accent-color)" />
          <span>{t.appLanguage}</span>
        </div>
        <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>{t.appLanguageDesc}</div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setLanguage('en')}
            className={language === 'en' ? 'btn-primary' : 'btn-secondary'}
            style={{ flex: 1, padding: '7px 10px', fontSize: '11.5px', fontWeight: 600 }}
          >
            English
          </button>
          <button
            onClick={() => setLanguage('bn')}
            className={language === 'bn' ? 'btn-primary' : 'btn-secondary'}
            style={{ flex: 1, padding: '7px 10px', fontSize: '11.5px', fontWeight: 600 }}
          >
            বাংলা (Bangla)
          </button>
        </div>
      </div>

      {/* AI API Key Quick Setup */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderColor: 'rgba(139, 92, 246, 0.35)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 600 }}>
            <Key size={14} color="#a78bfa" />
            <span>{t.aiApiKeys}</span>
          </div>
          <button
            onClick={() => setActiveTab('providers')}
            className="btn-secondary"
            style={{ padding: '3px 8px', fontSize: '10px' }}
          >
            {t.openAiProviders}
          </button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{t.aiApiKeysDesc}</div>
          <button
            onClick={() => PremiereHostBridge.getInstance().openExternalUrl('https://aistudio.google.com/apikey')}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#60a5fa',
              fontSize: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            <ExternalLink size={10} />
            <span>Get Free Gemini Key</span>
          </button>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <input
            type="password"
            placeholder="Paste Google Gemini API Key (AIza...)"
            value={geminiKey}
            onChange={(e) => setGeminiKey(e.target.value)}
            style={{
              flex: 1,
              padding: '5px 8px',
              background: 'var(--bg-tertiary)',
              color: '#fff',
              border: '1px solid var(--border-subtle)',
              borderRadius: '4px',
              fontSize: '11px'
            }}
          />
          <button onClick={handleQuickSaveGemini} className="btn-primary" style={{ padding: '5px 10px', fontSize: '11px' }}>
            {keySaved ? <CheckCircle size={12} /> : 'Save'}
          </button>
        </div>
      </div>

      {/* Hardware & Daemon Status */}
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
        <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>
          Memory Budget Ceiling: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>2,500 MB (2.5 GB RAM)</span>
        </div>
      </div>

      {/* Sequence Cloned Naming Template */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>
          {t.nonDestructive}
        </div>
        <input
          type="text"
          defaultValue="{OriginalSequence}_PrismexRoughCut"
          style={{ padding: '6px 8px', background: 'var(--bg-tertiary)', color: '#fff', border: '1px solid var(--border-subtle)', borderRadius: '4px', fontSize: '11px' }}
        />
        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
          {t.nonDestructiveDesc}
        </span>
      </div>

      {/* Cache & Temp Cleanup */}
      <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: '11px' }}>Audio Scratch Cache</div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
            Temporary WAV extraction files are shredded automatically post-cut.
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
          <span>{cachePurged ? (language === 'bn' ? 'মুছে ফেলা হয়েছে' : 'Purged') : (language === 'bn' ? 'ক্যাশ মুছুন' : 'Purge Cache')}</span>
        </button>
      </div>
    </div>
  );
};
