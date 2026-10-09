import React from 'react';
import { useSystem } from '../context/SystemContext';
import { Layout, Panel, Stat, LineChart, Gauge } from './ui';
import { litres, rupees } from '../lib/helpers';
import { ArrowLeft, Check, Send, Sliders, Cpu, Lightbulb, Power, History } from 'lucide-react';
import { LEAKS, FEATURES, fmtT } from '../engine/system';
import { readable } from '../lib/helpers';

export const AnomalyDetailScreen: React.FC = () => {
  const { s, sys, selectedFloorId, setScreen, setSelectedFloorId } = useSystem();
  const f = s.floors.find(x => x.id === selectedFloorId) ?? s.floors[s.floors.length - 1];
  if (!f) return <Layout><div /></Layout>;
  const alert = s.alerts.find(a => a.floorId === f.id && a.status !== 'resolved');
  const past = s.alerts.filter(a => a.floorId === f.id && a.status === 'resolved').slice(0, 5);
  const hist = f.history.slice(-120);
  const contrib = sys.contributions(f.id);
  const feats = f.features.map((v, i) => ({ i, v, pct: sys.percentile(f.id, i, v), c: contrib[i] ?? 0 })).filter(x => x.i < 5);
  const ranked = [...feats].sort((a, b) => b.pct - a.pct);
  const expNow = f.baselineLph / 60;
  const cost = (l: number) => rupees(l / 1000 * s.settings.tariffPerKL);
  const reasons = ranked.filter(x => x.pct >= 0.95).slice(0, 3);

  return (
    <Layout>
      <nav className="anomaly-header">
        <button onClick={() => setScreen('dashboard')} className="back-link"><ArrowLeft size={16} /><span>Back to Dashboard</span></button>
        <span className="badge-divider">/</span>
        <div className="floor-tabs">
          {s.floors.map(x => <button key={x.id} className={`floor-tab ${x.id === f.id ? 'on' : ''} st-${x.status}`} onClick={() => setSelectedFloorId(x.id)}>F{x.id}</button>)}
        </div>
      </nav>

      <header className="dashboard-header" style={{ marginBottom: '1.5rem' }}>
        <div className="header-title-area">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            Floor {f.id} — Node Diagnostics
            <span className={`badge-status ${f.status}`} style={{ fontSize: '0.8rem', padding: '0.25rem 0.6rem' }}>{f.status === 'alert' ? 'Live Alert' : f.status}</span>
            {alert && alert.kind !== 'offline' && <span className="leak-chip">{LEAKS[alert.kind].icon} {LEAKS[alert.kind].label}</span>}
          </h2>
          <p>YF-S201 on GPIO {f.gpio} · solenoid valve {f.valveOpen ? 'open' : 'closed'} · occupancy factor {f.occupancy}</p>
        </div>
      </header>

      <section className="stats-grid">
        <Stat label="Current Flow" value={f.status === 'offline' ? '—' : `${f.flowLpm.toFixed(2)} L/min`} tone={f.status === 'alert' ? 'danger' : f.status === 'shutoff' ? 'muted' : 'success'} desc={`${Math.round(f.flowLpm * 60)} L/hr at the sensor`} />
        <Stat label="Expected Now" value={`${expNow.toFixed(2)} L/min`} tone="success" desc={`${f.baselineLph} L/hr baseline for this slot`} />
        <Stat label="Continuous Flow" value={`${f.continuousMin} min`} tone={f.continuousMin > 30 ? 'danger' : f.continuousMin > 12 ? 'warning' : 'accent'} desc="Without a single idle minute" />
        <Stat label="Today on this floor" value={litres(f.todayLitres)} desc={cost(f.todayLitres)} />
      </section>

      <div className="anomaly-detail-grid">
        <Panel title={`Flow — Floor ${f.id} (last 2 hours, 1 reading/min)`} icon={<Sliders size={18} className="aqua-icon" />}>
          <LineChart height={210} series={[
            { label: 'Expected', values: hist.map(h => h.expected), color: 'rgba(16,185,129,.8)', dash: '5 4', width: 1.5 },
            { label: 'Flow', values: hist.map(h => h.flow), color: f.status === 'alert' ? '#f43f5e' : '#06b6d4', fill: f.status === 'alert' ? 'rgba(244,63,94,.12)' : 'rgba(6,182,212,.12)', width: 1.6 },
          ]} xLabels={hist.map((h, i) => (i % 30 === 0 || i === hist.length - 1) ? fmtT(h.t) : '')} />
          <div className="font-xs text-secondary" style={{ marginBottom: 12 }}>L/min · dashed green = expected from your onboarding baseline</div>
          <LineChart height={120} min={0.3} max={0.9} series={[{ label: 'Score', values: hist.map(h => h.score), color: '#a78bfa', width: 1.6 }]}
            hLines={[{ y: f.threshold, color: '#f43f5e', label: `alert ${f.threshold}` }, { y: f.watch, color: '#f59e0b', label: `watch ${f.watch}` }]} />
          <div className="font-xs text-secondary">Isolation Forest anomaly score per reading</div>
        </Panel>
        <Panel title="Isolation Forest Score" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Gauge value={f.score} threshold={f.threshold} watch={f.watch} />
          <p className="font-xs text-secondary text-center" style={{ marginTop: 8 }}>Threshold auto-calibrated for this floor at {(s.settings.contamination * 100).toFixed(1)}% contamination · alert after {s.settings.debounce} readings in a row while flow has not stopped for {s.settings.gateMin} min</p>
        </Panel>
      </div>

      <div className="anomaly-detail-grid" style={{ marginTop: '1.5rem' }}>
        <Panel title="Why the AI scored it this way" icon={<Lightbulb size={18} className="aqua-icon" />}>
          {reasons.length > 0 ? (
            <div className="explain-box danger">
              {reasons.map(r => <div key={r.i}>• <b>{FEATURES[r.i].label}</b> is {readable(r.i, r.v)} — higher than <b>{(r.pct * 100).toFixed(1)}%</b> of normal readings for this floor. <span className="text-secondary">{FEATURES[r.i].why}.</span></div>)}
            </div>
          ) : <div className="explain-box">All features are inside this floor's normal range — the pipe goes idle between uses as expected.</div>}
          <table className="anomaly-table feature-table">
            <thead><tr><th>Feature</th><th>Now</th><th>Normal (median)</th><th>Percentile</th><th>Split weight</th></tr></thead>
            <tbody>
              {feats.map(x => {
                const st = s.model.featureStats[x.i];
                return (
                  <tr key={x.i}>
                    <td>{FEATURES[x.i].label}</td>
                    <td className={x.pct >= 0.99 ? 'table-score danger' : x.pct >= 0.95 ? 'table-score warning' : ''}>{readable(x.i, x.v)}</td>
                    <td className="text-secondary">{st ? readable(x.i, st.p50) : '—'}</td>
                    <td><div className="pct-bar"><div style={{ width: `${x.pct * 100}%`, background: x.pct >= 0.99 ? 'var(--color-danger)' : x.pct >= 0.95 ? 'var(--color-warning)' : 'var(--accent-cyan)' }} /></div><span className="font-xs">{(x.pct * 100).toFixed(1)}%</span></td>
                    <td className="font-xs">{(x.c * 100).toFixed(0)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>
        <Panel title="Sensor Node" icon={<Cpu size={18} className="aqua-icon" />}>
          <div className="kv-list">
            <div><span>Sensor</span><b>YF-S201 hall-effect</b></div>
            <div><span>ESP32 pin</span><b>GPIO {f.gpio}</b></div>
            <div><span>Pulses / min</span><b>{f.pulsesPerMin.toLocaleString()}</b></div>
            <div><span>Pulse frequency</span><b>{(f.pulsesPerMin / 60).toFixed(1)} Hz</b></div>
            <div><span>Conversion</span><b>Q = F ÷ 7.5 L/min</b></div>
            <div><span>Last MQTT message</span><b>{fmtT(f.lastSeen)}</b></div>
            <div><span>Solenoid valve</span><b style={{ color: f.valveOpen ? 'var(--color-success)' : 'var(--color-danger)' }}>{f.valveOpen ? 'OPEN' : 'CLOSED'}</b></div>
            <div><span>Link status</span><b style={{ color: f.status === 'offline' ? 'var(--color-danger)' : 'var(--color-success)' }}>{f.status === 'offline' ? 'OFFLINE' : 'ONLINE'}</b></div>
          </div>
        </Panel>
      </div>

      {alert && (
        <Panel title={`Incident — started ${fmtT(alert.startedAt)}`} icon={<History size={18} className="aqua-icon" />} style={{ marginTop: '1.5rem' }}>
          <div className="stats-grid" style={{ marginBottom: '1rem' }}>
            <Stat label="Detected by" value={alert.source === 'ml' ? 'AI model' : alert.source === 'rule' ? 'Burst rule' : 'Heartbeat'} />
            <Stat label="Duration" value={`${s.minute - alert.startedAt} min`} tone="warning" />
            <Stat label="Water lost" value={litres(alert.litresLost)} tone="danger" desc={cost(alert.litresLost)} />
            <Stat label="Saved by valve" value={litres(alert.litresSaved)} tone="success" desc={cost(alert.litresSaved)} />
          </div>
          <ul className="incident-log">{[...alert.actions].reverse().map((a, i) => <li key={i}><span>{fmtT(a.t)}</span><b>{a.by}</b> {a.text}</li>)}</ul>
        </Panel>
      )}

      <section className="anomaly-actions-grid">
        <div className="action-card">
          <div className="action-card-header">
            <h4 className="action-card-title">{f.valveOpen ? 'Shut Off Water' : 'Open Valve'}</h4>
            <p className="action-card-desc">{f.valveOpen ? 'Energise the relay on the ESP32 to close this floor\'s solenoid valve. Flow stops immediately.' : 'Re-open the solenoid valve. Only do this once the leak is fixed.'}</p>
          </div>
          {f.valveOpen
            ? <button onClick={() => sys.shutOff(f.id)} className="action-card-btn shutoff" disabled={f.status === 'offline'}><Power size={14} style={{ display: 'inline-block', marginRight: 5, verticalAlign: 'middle' }} />SHUT OFF</button>
            : <button onClick={() => sys.openValve(f.id)} className="action-card-btn send">OPEN VALVE</button>}
        </div>
        <div className="action-card">
          <div className="action-card-header">
            <h4 className="action-card-title">Resend Alert</h4>
            <p className="action-card-desc">Send SMS + email again to {s.settings.contacts.map(c => c.name).join(', ') || 'your contacts'}.</p>
          </div>
          <button onClick={() => sys.resendAlert(f.id)} className="action-card-btn send"><Send size={14} style={{ display: 'inline-block', marginRight: 5, verticalAlign: 'middle' }} />SEND</button>
        </div>
        <div className="action-card">
          <div className="action-card-header">
            <h4 className="action-card-title">Mark Resolved</h4>
            <p className="action-card-desc">Confirm the leak was physically repaired. Re-opens the valve and restarts baseline tracking.</p>
          </div>
          <button onClick={() => sys.resolve(f.id)} className="action-card-btn resolve" disabled={!alert && f.status === 'normal'}><Check size={14} style={{ display: 'inline-block', marginRight: 5, verticalAlign: 'middle' }} />RESOLVE</button>
        </div>
      </section>

      {past.length > 0 && (
        <Panel title="Previous incidents on this floor" style={{ marginTop: '1.5rem' }}>
          <table className="anomaly-table"><thead><tr><th>Started</th><th>Type</th><th>Duration</th><th>Lost</th></tr></thead>
            <tbody>{past.map(a => <tr key={a.id}><td>{fmtT(a.startedAt)}</td><td>{a.kind === 'offline' ? 'Sensor offline' : LEAKS[a.kind].label}</td><td>{(a.resolvedAt ?? s.minute) - a.startedAt} min</td><td>{litres(a.litresLost)}</td></tr>)}</tbody>
          </table>
        </Panel>
      )}
    </Layout>
  );
};
