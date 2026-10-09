import React, { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import { system, type SystemState, type UiEvent } from '../engine/system';

export type Screen = 'cover' | 'login' | 'onboarding' | 'dashboard' | 'analytics' | 'anomaly-detail' | 'alerts' | 'model' | 'lab' | 'settings';

interface Toast extends UiEvent { id: number }
interface Ctx {
  s: SystemState;
  sys: typeof system;
  currentScreen: Screen;
  setScreen: (s: Screen) => void;
  selectedFloorId: number;
  setSelectedFloorId: (id: number) => void;
  openFloor: (id: number) => void;
  toasts: Toast[];
  dismiss: (id: number) => void;
}

const SystemContext = createContext<Ctx | undefined>(undefined);

export const SystemProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const s = useSyncExternalStore(system.subscribe, system.getState);
  const [currentScreen, setScreenState] = useState<Screen>(() => {
    const st = system.getState();
    if (st.loggedIn && st.onboarded) return (localStorage.getItem('wlrms_screen') as Screen) || 'dashboard';
    if (st.loggedIn) return 'onboarding';
    return 'cover';
  });
  const [selectedFloorId, setSelectedFloorId] = useState(() => system.getState().building.numFloors);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const setScreen = (sc: Screen) => { setScreenState(sc); localStorage.setItem('wlrms_screen', sc); window.scrollTo(0, 0); };
  useEffect(() => system.onUi(e => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t.slice(-3), { ...e, id }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4500);
  }), []);

  const value: Ctx = {
    s, sys: system, currentScreen, setScreen, selectedFloorId, setSelectedFloorId,
    openFloor: id => { setSelectedFloorId(id); setScreen('anomaly-detail'); },
    toasts, dismiss: id => setToasts(t => t.filter(x => x.id !== id)),
  };
  return <SystemContext.Provider value={value}>{children}</SystemContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useSystem = () => {
  const c = useContext(SystemContext);
  if (!c) throw new Error('useSystem must be used within a SystemProvider');
  return c;
};
