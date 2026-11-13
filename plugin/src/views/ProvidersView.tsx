import React, { useState } from 'react';
import { usePrismexStore } from '../state/usePrismexStore';
import { PrismexDaemonClient } from '../api/PrismexDaemonClient';
import { PremiereHostBridge } from '../host/PremiereHostBridge';
import { Cpu, ShieldCheck, Key, Trash2, CheckCircle, ExternalLink } from 'lucide-react';

const PROVIDER_KEY_URLS: Record<string, string> = {
  'google-gemini': 'https://aistudio.google.com/apikey',
  'groq': 'https://console.groq.com/keys',
  'openrouter': 'https://openrouter.ai/keys',
  'huggingface': 'https://huggingface.co/settings/tokens',
  'cerebras': 'https://cloud.cerebras.ai/',
  'elevenlabs': 'https://elevenlabs.io/app/settings/api-keys'
};

export const ProvidersView: React.FC = () => {
  const { providers, initApp } = usePrismexStore();
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [keyInput, setKeyInput] = useState('');
  const client = PrismexDaemonClient.getInstance();

  const handleSaveKey = async () => {
    if (!selectedProvider || !keyInput.trim()) return;
    await client.setProviderKey(selectedProvider, keyInput.trim());
    setKeyInput('');
    setSelectedProvider(null);
    await initApp();
  };

  const handleDeleteKey = async (providerId: string) => {
    await client.deleteProviderKey(providerId);
    await initApp();
  };

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', height: '100%', overflowY: 'auto' }}>
      <div>
        <h2 style={{ fontSize: '13px', fontWeight: 600 }}>AI Provider Ecosystem</h2>
        <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
          Manage local Apple Silicon engines and user-supplied cloud free-tier keys.
        </p>
      </div>

      {/* Free-Only Protection Banner */}
      <div className="card" style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '10px',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        borderColor: 'rgba(16, 185, 129, 0.3)'
      }}>
        <ShieldCheck color="#10b981" size={24} />
        <div>
          <div style={{ fontWeight: 600, fontSize: '11px', color: 'var(--success-color)' }}>
            Free-Only Protection Active
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
            Paid endpoints are blocked at the socket level. Guaranteed $0.00 billing.
          </div>
        </div>
      </div>

      {/* Provider List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {providers.map(p => (
          <div key={p.providerId} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <span style={{ fontWeight: 600, fontSize: '12px' }}>{p.name}</span>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                  Model: {p.modelId} {p.isLocal ? '• Runs 100% Offline' : '• Cloud Free Tier'}
                </div>
              </div>

              <span style={{ 
                fontSize: '9.5px',
                padding: '2px 6px',
                borderRadius: '10px',
                backgroundColor: p.isConfigured ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                color: p.isConfigured ? 'var(--success-color)' : 'var(--warning-color)',
                fontWeight: 600
              }}>
                {p.isConfigured ? 'Ready' : 'Needs Key'}
              </span>
            </div>

            {/* Key Actions */}
            {!p.isLocal && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '6px', marginTop: '2px' }}>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                  {p.maskedKey ? `Keychain: ${p.maskedKey}` : 'No API key configured'}
                </span>

                <div style={{ display: 'flex', gap: '6px' }}>
                  {PROVIDER_KEY_URLS[p.providerId] && (
                    <button
                      className="btn-secondary"
                      style={{ padding: '2px 7px', fontSize: '10px', color: '#60a5fa', borderColor: 'rgba(59, 130, 246, 0.35)' }}
                      onClick={() => PremiereHostBridge.getInstance().openExternalUrl(PROVIDER_KEY_URLS[p.providerId])}
                      title={`Open ${p.name} API key page in browser`}
                    >
                      <ExternalLink size={10} />
                      <span>Get Key</span>
                    </button>
                  )}

                  <button 
                    className="btn-secondary"
                    style={{ padding: '2px 8px', fontSize: '10px' }}
                    onClick={() => {
                      setSelectedProvider(p.providerId);
                      setKeyInput('');
                    }}
                  >
                    <Key size={10} />
                    <span>{p.maskedKey ? 'Update' : 'Add Key'}</span>
                  </button>

                  {p.maskedKey && (
                    <button 
                      className="btn-danger"
                      style={{ padding: '2px 6px' }}
                      onClick={() => handleDeleteKey(p.providerId)}
                      title="Delete key from macOS Keychain"
                    >
                      <Trash2 size={10} />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

            {/* Key Input Modal */}
      {selectedProvider && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          zIndex: 999
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '340px', display: 'flex', flexDirection: 'column', gap: '10px', backgroundColor: 'var(--bg-secondary)', border: '1px solid rgba(255,255,255,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: '12px', fontWeight: 600 }}>
                {selectedProvider === 'openrouter' ? '⚡ OpenRouter API Key' : `Configure ${selectedProvider}`}
              </h3>
              {PROVIDER_KEY_URLS[selectedProvider] && (
                <button
                  className="btn-secondary"
                  style={{ padding: '2px 7px', fontSize: '9.5px', color: '#60a5fa' }}
                  onClick={() => PremiereHostBridge.getInstance().openExternalUrl(PROVIDER_KEY_URLS[selectedProvider])}
                >
                  <ExternalLink size={9} />
                  <span>Get Key</span>
                </button>
              )}
            </div>

            <p style={{ fontSize: '10.5px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              {selectedProvider === 'openrouter'
                ? 'OpenRouter API key (sk-or-v1-...) provides unified access to Google Gemini, DeepSeek V3, Claude 3.5, and Llama models.'
                : 'Keys are encrypted securely in your local macOS Keychain. Never stored in plain-text.'}
            </p>

            <input 
              type="password"
              placeholder={selectedProvider === 'openrouter' ? 'sk-or-v1-...' : 'Paste your API key here...'}
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              style={{ padding: '7px 9px', background: 'var(--bg-tertiary)', color: '#fff', border: '1px solid #3b82f6', borderRadius: '4px', fontSize: '11px', outline: 'none' }}
              autoFocus
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', marginTop: '2px' }}>
              <button className="btn-secondary" onClick={() => setSelectedProvider(null)}>Cancel</button>
              <button className="btn-primary" onClick={handleSaveKey}>Save to Keychain</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
