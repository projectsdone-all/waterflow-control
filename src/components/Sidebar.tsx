import React from 'react';
import { useSystem, type Screen } from '../context/SystemContext';
import { LayoutDashboard, BarChart3, Bell, Settings, LogOut, Waves, Brain, FlaskConical, Pause, Play } from 'lucide-react';
import { SAMPLE_TS } from '../engine/system';

export const Sidebar: React.FC<{ onNavigate?: () => void }> = ({ onNavigate }) => {
  const { s, sys, currentScreen, setScreen } = useSystem();
  const active = s.alerts.filter(a => a.status === 'active').length;
  const go = (sc: Screen) => { setScreen(sc); onNavigate?.(); };
  const items: { id: Screen; label: string; icon: React.ElementType; badge?: number }[] = [
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
    { id: 'alerts', label: 'Alerts', icon: Bell, badge: active },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'model', label: 'AI Model', icon: Brain },
    { id: 'lab', label: 'Simulation Lab', icon: FlaskConical },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];
  const d = new Date(SAMPLE_TS(s.minute));
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="logo-container">
          <div className="logo-icon"><Waves size={20} className="aqua-icon" /></div>
          <div>
            <h1 className="logo-text">WLRMS</h1>
            <p className="logo-subtext">Leak Risk Monitoring</p>
          </div>
        </div>
      </div>
      <div className="sidebar-building">
        <p className="building-label font-xs">BUILDING</p>
        <p className="building-name font-sm">{s.building.name}</p>
        <p className="font-xs text-secondary" style={{ marginTop: 2 }}>{s.building.numFloors} floors · {s.building.location}</p>
      </div>
      <nav className="sidebar-nav">
        <ul>
          {items.map(it => {
            const Icon = it.icon;
            const isActive = currentScreen === it.id || (it.id === 'dashboard' && currentScreen === 'anomaly-detail');
            return (
              <li key={it.id}>
                <button onClick={() => go(it.id)} className={`nav-button ${isActive ? 'active' : ''}`}>
                  <Icon size={18} /><span>{it.label}</span>
                  {!!it.badge && <span className="badge-alert-count">{it.badge}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="sim-clock">
        <div className="sim-clock-top">
          <span className={`status-dot ${s.paused ? '' : 'pulse'}`} />
          <span className="sim-time">{d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          <span className="font-xs text-secondary">{d.toLocaleDateString([], { day: 'numeric', month: 'short' })}</span>
          <button className="icon-btn sm" onClick={() => sys.setPaused(!s.paused)} title={s.paused ? 'Resume' : 'Pause'}>{s.paused ? <Play size={13} /> : <Pause size={13} />}</button>
        </div>
        <div className="speed-seg">
          {[1, 10, 60].map(v => <button key={v} className={s.speed === v && !s.paused ? 'on' : ''} onClick={() => sys.setSpeed(v)}>{v === 1 ? '1 min/s' : v === 10 ? '10×' : '1 hr/s'}</button>)}
        </div>
      </div>
      <div className="sidebar-footer">
        <button onClick={() => { sys.logout(); setScreen('cover'); }} className="logout-button"><LogOut size={16} /><span>Exit Portal</span></button>
      </div>
    </aside>
  );
};
