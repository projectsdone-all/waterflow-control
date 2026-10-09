import React, { useState } from 'react';
import { useSystem } from '../context/SystemContext';
import { Layout, Panel, Stat } from './ui';
import { litres, rupees, downloadCSV } from '../lib/helpers';
import { Bell, MessageSquare, Download } from 'lucide-react';
import { LEAKS, fmtT, SAMPLE_TS } from '../engine/system';

export const AlertsScreen: React.FC = () => {
  const { s, openFloor } = useSystem();
  const [tab, setTab] = useState<'all' | 'open' | 'resolved'>('all');
  const list = s.alerts.filter(a => tab === 'all' || (tab === 'open' ? a.status !== 'resolved' : a.status === 'resolved'));
  const lost = s.alerts.reduce((a, x) => a + x.litresLost, 0);
  const mttr = (() => { const r = s.alerts.filter(a => a.resolvedAt); return r.length ? Math.round(r.reduce((x, a) => x + (a.resolvedAt! - a.startedAt), 0) / r.length) : 0; })();
  const name = (k: string) => k === 'offline' ? 'Sensor offline' : LEAKS[k as keyof typeof LEAKS].label;
  return (
    <Layout>
      <header className="dashboard-header">
        <div className="header-title-area"><h2>Alerts & Incidents</h2><p>Every anomaly the system raised, what was done, and what it cost</p></div>
        <div className="header-actions"><button className="btn-secondary" onClick={() => downloadCSV('wlrms-alerts.csv', s.alerts.map(a => ({ started: new Date(SAMPLE_TS(a.startedAt)).toISOString(), floor: a.floorId, type: name(a.kind), detected_by: a.source, status: a.status, peak_flow_lpm: a.peakFlow.toFixed(2), peak_score: a.peakScore.toFixed(3), litres_lost: Math.round(a.litresLost), litres_saved: Math.round(a.litresSaved), minutes_to_resolve: a.resolvedAt ? a.resolvedAt - a.startedAt : '' })))}><Download size={14} /> Export CSV</button></div>
      </header>
      <section className="stats-grid">
        <Stat label="Open incidents" value={s.alerts.filter(a => a.status !== 'resolved').length} tone="danger" />
        <Stat label="Total incidents" value={s.alerts.length} />
        <Stat label="Water lost to leaks" value={litres(lost)} tone="warning" desc={rupees(lost / 1000 * s.settings.tariffPerKL)} />
        <Stat label="Mean time to resolve" value={mttr ? `${mttr} min` : '—'} tone="success" />
      </section>
      <div className="dashboard-grid">
        <Panel title="Incident log" icon={<Bell size={18} className="aqua-icon" />} right={<div className="seg">{(['all', 'open', 'resolved'] as const).map(t => <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>)}</div>}>
          <div className="anomaly-table-container">
            <table className="anomaly-table">
              <thead><tr><th>Started</th><th>Floor</th><th>Type</th><th>Detected by</th><th>Peak score</th><th>Lost</th><th>Status</th></tr></thead>
              <tbody>
                {list.map(a => (
                  <tr key={a.id} onClick={() => openFloor(a.floorId)} style={{ cursor: 'pointer' }}>
                    <td>{fmtT(a.startedAt)}</td><td>Floor {a.floorId}</td>
                    <td>{a.kind !== 'offline' && LEAKS[a.kind].icon} {name(a.kind)}</td>
                    <td className="text-secondary">{a.source === 'ml' ? 'Isolation Forest' : a.source === 'rule' ? 'Burst rule' : 'Heartbeat'}</td>
                    <td className="table-score danger">{a.kind === 'offline' ? '—' : a.peakScore.toFixed(3)}</td>
                    <td>{litres(a.litresLost)}</td>
                    <td><span className={`badge-status ${a.status === 'resolved' ? 'normal' : a.status === 'shutoff' ? 'shutoff' : 'alert'}`}>{a.status === 'shutoff' ? (a.auto ? 'auto-shut' : 'valve shut') : a.status}</span></td>
                  </tr>
                ))}
                {!list.length && <tr><td colSpan={7} className="text-secondary">Nothing here yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel title="Notifications sent" icon={<MessageSquare size={16} />}>
          <div className="notif-list">
            {s.notifications.slice(0, 30).map(n => (
              <div key={n.id} className="notif-item">
                <div><span className={`chan chan-${n.channel}`}>{n.channel}</span> <span className="font-xs text-secondary">{n.to}</span> <span className="font-xs text-secondary" style={{ float: 'right' }}>{new Date(n.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div>
                <div className="font-sm">{n.text}</div>
              </div>
            ))}
            {!s.notifications.length && <div className="text-secondary font-sm">No notifications yet.</div>}
          </div>
        </Panel>
      </div>
    </Layout>
  );
};
