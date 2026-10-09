import React, { useState } from 'react';
import { useSystem } from '../context/SystemContext';
import { Layout, Panel } from './ui';
import { FlaskConical, Zap, WifiOff, Wifi, Eraser, Timer } from 'lucide-react';
import { LEAKS, type LeakType } from '../engine/system';

export const LabScreen: React.FC = () => {
  const { s, sys, openFloor } = useSystem();
  const [floor, setFloor] = useState(1);
  return (
    <Layout>
      <header className="dashboard-header">
        <div className="header-title-area"><h2>Simulation Lab</h2><p>Inject faults into the virtual building and watch the AI detect them — made for demos and reviews</p></div>
      </header>
      <div className="analytics-grid-top">
        <Panel title="Inject a fault" icon={<FlaskConical size={18} className="aqua-icon" />}>
          <label className="form-label">Floor</label>
          <div className="floor-tabs" style={{ marginBottom: 14 }}>{s.floors.map(f => <button key={f.id} className={`floor-tab ${floor === f.id ? 'on' : ''} st-${f.status}`} onClick={() => setFloor(f.id)}>F{f.id}</button>)}</div>
          <div className="lab-grid">
            {(Object.keys(LEAKS) as LeakType[]).map(k => (
              <button key={k} className="lab-card" onClick={() => sys.inject(floor, k)}>
                <span className="lab-icon">{LEAKS[k].icon}</span>
                <b>{LEAKS[k].label}</b>
                <span>{LEAKS[k].desc}</span>
                <span className="font-xs text-secondary">{LEAKS[k].lpm[0]}–{LEAKS[k].lpm[1]} L/min extra</span>
              </button>
            ))}
            <button className="lab-card" onClick={() => sys.setOffline(floor, !s.floors[floor - 1]?.offline)}>
              <span className="lab-icon">{s.floors[floor - 1]?.offline ? <Wifi size={22} /> : <WifiOff size={22} />}</span>
              <b>{s.floors[floor - 1]?.offline ? 'Bring sensor online' : 'Sensor goes offline'}</b>
              <span>ESP32 stops publishing — heartbeat alert after 3 min</span>
            </button>
            <button className="lab-card" onClick={() => sys.clearLeak(floor)}>
              <span className="lab-icon"><Eraser size={22} /></span>
              <b>Fix silently</b>
              <span>Remove the fault without resolving the alert</span>
            </button>
          </div>
          <div className="explain-box" style={{ marginTop: 14 }}><Timer size={14} style={{ display: 'inline', verticalAlign: -2 }} /> Tip: set the clock to <b>10×</b> or <b>1 hr/s</b> in the sidebar to see slow leaks get caught in seconds.</div>
        </Panel>
        <Panel title="Live fault map" icon={<Zap size={18} className="aqua-icon" />}>
          <table className="anomaly-table">
            <thead><tr><th>Floor</th><th>Injected fault</th><th>Flow</th><th>Score</th><th>Status</th></tr></thead>
            <tbody>
              {[...s.floors].reverse().map(f => (
                <tr key={f.id} onClick={() => openFloor(f.id)} style={{ cursor: 'pointer' }}>
                  <td>Floor {f.id}</td>
                  <td>{f.offline ? '📡 offline' : f.leak ? `${LEAKS[f.leak.type].icon} ${LEAKS[f.leak.type].label} (${f.leak.lpm} L/min)` : <span className="text-secondary">none</span>}</td>
                  <td>{f.flowLpm.toFixed(2)}</td>
                  <td className={`table-score ${f.score >= f.threshold ? 'danger' : f.score >= f.watch ? 'warning' : ''}`}>{f.score.toFixed(3)}</td>
                  <td><span className={`badge-status ${f.status}`}>{f.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="set-row" style={{ marginTop: 14 }}>
            <div><div className="n">Random faults</div><div className="d">Occasionally inject a random leak somewhere in the building</div></div>
            <button className={`switch ${s.settings.randomFaults ? 'on' : ''}`} onClick={() => sys.updateSettings({ randomFaults: !s.settings.randomFaults })} />
          </div>
        </Panel>
      </div>
    </Layout>
  );
};
