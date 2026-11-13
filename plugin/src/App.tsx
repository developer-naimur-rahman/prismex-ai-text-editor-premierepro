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

export const App: React.FC = () => {
  const { activeTab, initApp } = usePrismexStore();

  useEffect(() => {
    initApp();
  }, [initApp]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', backgroundColor: 'var(--bg-primary)' }}>
      <NavigationHeader />
      <main style={{ flex: 1, overflow: 'hidden' }}>
        {activeTab === 'transcript' && <TranscriptView />}
        {activeTab === 'magic-cut' && <MagicRoughCutView />}
        {activeTab === 'silence' && <SilenceView />}
        {activeTab === 'takes' && <TakesView />}
        {activeTab === 'review-queue' && <ReviewQueueView />}
        {activeTab === 'srt-editor' && <SrtEditorView />}
        {activeTab === 'dashboard' && <DashboardView />}
        {activeTab === 'providers' && <ProvidersView />}
        {activeTab === 'profiles' && <ProfilesView />}
        {activeTab === 'settings' && <SettingsView />}
        {activeTab === 'history' && <HistoryView />}
      </main>
    </div>
  );
};
