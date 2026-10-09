import React from 'react';
import { useSystem } from '../context/SystemContext';
import { Layout, Panel, Stat, LineChart } from './ui';
import { litres, rupees } from '../lib/helpers';
import { Activity, Bell, Droplets, Radio, Gauge as GaugeIcon } from 'lucide-react';
import { LEAKS, fmtT } from '../engine/system';

export const DashboardScreen: React.FC = () => {
  const { s, openFloor, setScreen } = useSystem();
  const active = s.alerts.filter(a => a.status === 'active');
  const open = s.alerts.filter(a => a.status !== 'resolved');
  const today = s.floors.reduce((a, f) => a + f.todayLitres, 0);
  const lostToday = s.alerts.filter(a => s.minute - a.startedAt < 1440).reduce((a, x) => a + x.litresLost, 0);
  const totalFlow = s.floors.reduce((a, f) => a + f.flowLpm, 0);
  const maxFlow = Math.max(12, ...s.floors.map(f => f.flowLpm));
  const week = [...s.days.slice(-6).map(d => ({ label: new Date(d.date).toLocaleDateString([], { weekday: 'narrow' }), value: d.total, alert: d.leakLitres > 0 })), { label: 'Today', value: today, alert: open.length > 0 }];
  const maxWeek = Math.max(...week.map(w => w.value), 1);
  const buildingFlow = s.floors[0]?.history.map((_, i) => s.floors.reduce((a, f) => a + (f.history[i]?.flow ?? 0), 0)) ?? [];
  const expectedFlow = s.floors[0]?.history.map((_, i) => s.floors.reduce((a, f) => a + (f.history[i]?.expected ?? 0), 0)) ?? [];
  const tankPct = s.tank.level / s.tank.capacity * 100;

  return (
    <Layout>
      <header className="dashboard-header">
        <div className="header-title-area">
          <h2>{s.building.name} — Floor Monitor</h2>
          <p>Live per-floor flow from YF-S201 sensors · Isolation Forest anomaly detection</p>
        </div>
        <div className="header-actions">
          <span className="panel-status-indicator">
            <span className={`status-dot ${active.length ? 'danger' : 'pulse'}`}></span>
            <span style={{ color: active.length ? 'var(--color-danger)' : 'var(--color-success)' }}>{active.length ? 'Leak Risk Detected' : 'All Channels Normal'}</span>
          </span>
          {active.length > 0 && <button onClick={() => openFloor(active[0].floorId)} className="btn-header-alert">{active.length} Active Alert{active.length > 1 ? 's' : ''}</button>}
        </div>
      </header>

      <section className="stats-grid">
        <Stat label="Building Flow Now" value={`${totalFlow.toFixed(1)} L/min`} desc={`${s.floors.length} sensors · ${s.floors.filter(f => f.status !== 'offline').length} online`} />
        <Stat label="Active Alerts" value={active.length} tone={active.length ? 'danger' : 'success'} desc={`${open.length - active.length} valve(s) shut, awaiting repair`} />
        <Stat label="Today's Usage" value={litres(today)} desc={`≈ ${rupees(today / 1000 * s.settings.tariffPerKL)} at ₹${s.settings.tariffPerKL}/kL`} />
        <Stat label="Leak Loss Today" value={litres(lostToday)} tone={lostToday > 0 ? 'danger' : 'success'} desc={`${litres(s.savedLitres)} saved by valve shut-off`} />
      </section>

      <div className="dashboard-grid">
        <Panel title="Building Floor Status — Real-Time" icon={<Activity size={18} className="aqua-icon" />} right={<span className="panel-status-indicator font-xs"><span className="status-dot pulse"></span> MQTT · 1 reading/min</span>}>
          <div className="floor-status-layout">
            <div className="building-isometric-view">
              <div className="overhead-tank-mini tank-live" title={`Tank ${tankPct.toFixed(0)}%`}>
                <div className="tank-fill" style={{ height: `${tankPct}%` }} />
                <span>{tankPct.toFixed(0)}%</span>
              </div>
              <div className="building-spine-line"></div>
              <div className="building-floors-stack">
                {s.floors.map(f => (
                  <div key={f.id} onClick={() => openFloor(f.id)} className={`building-floor-mini-box ${f.status === 'alert' ? 'alert' : ''} st-${f.status}`} style={{ height: s.floors.length > 6 ? 30 : 56, cursor: 'pointer' }}>
                    <span className="mini-floor-name">F{f.id}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="floors-bars-list">
              {s.floors.map(f => {
                const cls = f.status === 'alert' ? 'danger' : f.status;
                return (
                  <div key={f.id} onClick={() => openFloor(f.id)} className={`floor-row-item ${f.status === 'alert' ? 'alert' : ''}`} style={{ height: s.floors.length > 6 ? 42 : 56 }}>
                    <span className="floor-row-name">Floor {f.id}</span>
                    <div className="floor-bar-container" title={`Expected now ≈ ${(f.baselineLph / 60).toFixed(1)} L/min`}>
                      <div className={`floor-bar-fill ${cls}`} style={{ width: `${Math.min(100, (f.flowLpm / maxFlow) * 100)}%` }}></div>
                      <div className="floor-bar-expected" style={{ left: `${Math.min(100, (f.baselineLph / 60 / maxFlow) * 100)}%` }} />
                    </div>
                    <span className={`floor-flow-rate ${f.status}`}>{f.status === 'shutoff' ? 'VALVE SHUT' : f.status === 'offline' ? 'NO DATA' : `${f.flowLpm.toFixed(1)} L/min`}</span>
                    <span className={`floor-score ${f.score >= f.threshold ? 'danger' : f.score >= f.watch ? 'warning' : ''}`} title="Isolation Forest score">{f.status === 'offline' || f.status === 'shutoff' ? '—' : f.score.toFixed(2)}</span>
                    <div className="floor-badge-status"><span className={`badge-status ${f.status}`}>{f.status}</span></div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="font-xs text-secondary" style={{ marginTop: 10 }}>Bar = live flow · white tick = expected flow for this time slot · number = AI anomaly score</div>
        </Panel>

        <div className="dashboard-sidebar-panels">
          <Panel title="Alerts Feed" icon={<Bell size={16} />} right={<button className="link-btn" onClick={() => setScreen('alerts')}>View all</button>}>
            <div className="alert-feed-list">
              {s.alerts.slice(0, 4).map(a => (
                <div key={a.id} className={`alert-feed-item ${a.status === 'resolved' ? 'resolved' : 'danger'}`} style={{ cursor: 'pointer' }} onClick={() => openFloor(a.floorId)}>
                  <div className={`alert-feed-title ${a.status === 'resolved' ? 'resolved' : 'danger'}`}>
                    <span>Floor {a.floorId} · {a.kind === 'offline' ? 'Sensor offline' : LEAKS[a.kind].label}</span>
                    <span className="alert-feed-time">{fmtT(a.startedAt)}</span>
                  </div>
                  <div className="alert-feed-details">
                    {a.status === 'resolved' ? <span>Resolved · {litres(a.litresLost)} lost</span>
                      : a.status === 'shutoff' ? <span>Valve shut{a.auto ? ' automatically' : ''} · {litres(a.litresSaved)} saved so far</span>
                      : <span>Peak {a.peakFlow.toFixed(1)} L/min · score {a.peakScore.toFixed(2)} · {litres(a.litresLost)} lost</span>}
                  </div>
                </div>
              ))}
              {!s.alerts.length && <div className="text-secondary font-sm">No alerts yet — inject a leak from the Simulation Lab to see detection live.</div>}
            </div>
          </Panel>
          <Panel title="Weekly Usage" icon={<Droplets size={16} />}>
            <div className="weekly-chart-container">
              {week.map((w, i) => (
                <div key={i} className="weekly-chart-bar-wrapper" title={`${w.label}: ${litres(w.value)}`}>
                  <div className={`weekly-chart-bar ${w.alert ? 'alert' : ''}`} style={{ height: `${(w.value / maxWeek) * 90}px` }}></div>
                  <span className="weekly-chart-label">{w.label}</span>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>

      <div className="dashboard-grid" style={{ marginTop: '1.5rem' }}>
        <Panel title="Total Building Flow — Last 4 Hours" icon={<GaugeIcon size={18} className="aqua-icon" />}>
          <LineChart unit="" height={190} series={[
            { label: 'Expected', values: expectedFlow, color: 'rgba(148,163,184,.6)', dash: '4 4', width: 1.5 },
            { label: 'Measured', values: buildingFlow, color: '#06b6d4', fill: 'rgba(6,182,212,.12)', width: 1.6 },
          ]} xLabels={buildingFlow.map((_, i, arr) => (i % 40 === 0 || i === arr.length - 1) ? fmtT(s.floors[0].history[i].t) : '')} />
          <div className="font-xs text-secondary">L/min · solid = measured · dashed = expected from baseline</div>
        </Panel>
        <Panel title="Live MQTT Stream" icon={<Radio size={16} />} right={<span className="font-xs text-secondary">ESP32 → broker</span>}>
          <div className="mqtt-log">
            {[...s.mqtt].reverse().slice(0, 12).map((m, i) => (
              <div key={i} className="mqtt-line"><span className="mqtt-topic">{m.topic.split('/').slice(-2).join('/')}</span> <span className="mqtt-payload">{m.payload}</span></div>
            ))}
          </div>
        </Panel>
      </div>
    </Layout>
  );
};
