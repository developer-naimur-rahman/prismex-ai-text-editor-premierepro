import React, { useState } from 'react';
import { usePrismexStore } from '../state/usePrismexStore';
import { PrismexDaemonClient } from '../api/PrismexDaemonClient';
import { Cpu, ShieldCheck, Key, Trash2, CheckCircle } from 'lucide-react';

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
          <div className="card" style={{ width: '100%', maxWidth: '320px', display: 'flex', flexDirection: 'column', gap: '10px', backgroundColor: 'var(--bg-secondary)' }}>
            <h3 style={{ fontSize: '12px', fontWeight: 600 }}>Configure API Key</h3>
            <p style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>
              Keys are encrypted in your macOS Keychain. Never written to plain-text files.
            </p>
            <input 
              type="password"
              placeholder="Paste your free-tier API key..."
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              style={{ padding: '6px 8px', background: 'var(--bg-tertiary)', color: '#fff', border: '1px solid var(--border-subtle)', borderRadius: '4px', fontSize: '11px' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
              <button className="btn-secondary" onClick={() => setSelectedProvider(null)}>Cancel</button>
              <button className="btn-primary" onClick={handleSaveKey}>Save to Keychain</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
