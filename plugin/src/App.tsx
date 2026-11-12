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

export const App: React.FC = () => {
  const { activeTab, initApp } = usePrismexStore();

  useEffect(() => {
    initApp();
  }, [initApp]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', backgroundColor: 'var(--bg-primary)' }}>
      <NavigationHeader />
      <main style={{ flex: 1, overflow: 'hidden' }}>
        {activeTab === 'dashboard' && <DashboardView />}
        {activeTab === 'magic-cut' && <MagicRoughCutView />}
        {activeTab === 'review-queue' && <ReviewQueueView />}
        {activeTab === 'transcript' && <TranscriptView />}
        {activeTab === 'silence' && <SilenceView />}
        {activeTab === 'takes' && <TakesView />}
        {activeTab === 'providers' && <ProvidersView />}
        {activeTab === 'profiles' && <ProfilesView />}
        {activeTab === 'settings' && <SettingsView />}
        {activeTab === 'history' && <HistoryView />}
      </main>
    </div>
  );
};
