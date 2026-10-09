import React, { useEffect } from 'react';
import { SystemProvider, useSystem } from './context/SystemContext';
import { CoverScreen } from './components/CoverScreen';
import { LoginScreen } from './components/LoginScreen';
import { OnboardingScreen } from './components/OnboardingScreen';
import { DashboardScreen } from './components/DashboardScreen';
import { AnalyticsScreen } from './components/AnalyticsScreen';
import { AnomalyDetailScreen } from './components/AnomalyDetailScreen';
import { AlertsScreen } from './components/AlertsScreen';
import { ModelScreen } from './components/ModelScreen';
import { LabScreen } from './components/LabScreen';
import { SettingsScreen } from './components/SettingsScreen';
import { Toasts } from './components/ui';

const AppContent: React.FC = () => {
  const { currentScreen, s, setScreen } = useSystem();
  // guard: inner screens need a session + onboarding
  useEffect(() => {
    const inner = !['cover', 'login', 'onboarding'].includes(currentScreen);
    if (inner && !s.loggedIn) setScreen('login');
    else if (inner && !s.onboarded) setScreen('onboarding');
  }, [currentScreen, s.loggedIn, s.onboarded, setScreen]);
  const active = s.alerts.filter(a => a.status === 'active').length;
  useEffect(() => { document.title = active ? `(${active}) Leak alert — WLRMS` : 'WLRMS — Water Leakage Risk Monitoring System'; }, [active]);

  switch (currentScreen) {
    case 'login': return <LoginScreen />;
    case 'onboarding': return <OnboardingScreen />;
    case 'dashboard': return <DashboardScreen />;
    case 'analytics': return <AnalyticsScreen />;
    case 'anomaly-detail': return <AnomalyDetailScreen />;
    case 'alerts': return <AlertsScreen />;
    case 'model': return <ModelScreen />;
    case 'lab': return <LabScreen />;
    case 'settings': return <SettingsScreen />;
    default: return <CoverScreen />;
  }
};

function App() {
  return (
    <SystemProvider>
      <AppContent />
      <Toasts />
    </SystemProvider>
  );
}

export default App;
