import React from 'react';
import { useSystem } from '../context/SystemContext';
import { Layout, Panel, Stat } from './ui';
import { litres, rupees, downloadCSV } from '../lib/helpers';
import { BarChart3, TrendingUp, Calendar, AlertOctagon, Download, Leaf } from 'lucide-react';
import { LEAKS, fmtT } from '../engine/system';
import { expectedLph } from '../engine/waterModel';

export const AnalyticsScreen: React.FC = () => {
  const { s, openFloor } = useSystem();
  const today = s.floors.reduce((a, f) => a + f.todayLitres, 0);
  const days = [...s.days.slice(-29), { date: 'Today', total: today, perFloor: s.floors.map(f => f.todayLitres), leakLitres: s.alerts.filter(a => s.minute - a.startedAt < 1440).reduce((a, x) => a + x.litresLost, 0) }];
  const past = s.days.slice(-29);
  const month = days.reduce((a, d) => a + d.total, 0);
  const avg = past.length ? past.reduce((a, d) => a + d.total, 0) / past.length : 0;
  const maxDay = Math.max(...days.map(d => d.total), 1);
  const floorAvg = s.floors.map((f, i) => ({ id: f.id, avg: past.length ? past.reduce((a, d) => a + (d.perFloor[i] ?? 0), 0) / past.length : f.todayLitres, alert: f.status === 'alert' })).sort((a, b) => b.avg - a.avg);
  const maxFloor = Math.max(...floorAvg.map(f => f.avg), 1);
  const least = [...floorAvg].sort((a, b) => a.avg - b.avg)[0];
  const leakMonth = days.reduce((a, d) => a + d.leakLitres, 0);
  // share of daily demand per slot, from the baseline profile
  const slotShare = (() => {
    const t = { morning: 0, afternoon: 0, evening: 0, night: 0 };
    for (let m = 0; m < 1440; m += 5) {
      const v = expectedLph(s.building.baselines, m);
      const h = m / 60;
      if (h >= 6 && h < 10) t.morning += v; else if (h >= 10 && h < 18) t.afternoon += v; else if (h >= 18 && h < 23) t.evening += v; else t.night += v;
    }
    const sum = t.morning + t.afternoon + t.evening + t.night;
    return [
      { label: 'Morning 6–10 AM', v: t.morning / sum, color: 'blue' }, { label: 'Afternoon 10 AM–6 PM', v: t.afternoon / sum, color: 'yellow' },
      { label: 'Evening 6–11 PM', v: t.evening / sum, color: 'blue' }, { label: 'Night 11 PM–6 AM', v: t.night / sum, color: 'yellow' },
    ];
  })();
  const name = (k: string) => k === 'offline' ? 'Sensor offline' : LEAKS[k as keyof typeof LEAKS].label;
  return (
    <Layout>
      <header className="dashboard-header">
        <div className="header-title-area"><h2>Analytics</h2><p>Consumption trends, per-floor profiles, leak losses and anomaly history</p></div>
        <div className="header-actions"><button className="btn-secondary" onClick={() => downloadCSV('wlrms-daily-usage.csv', days.map(d => ({ date: d.date, total_litres: Math.round(d.total), leak_litres: Math.round(d.leakLitres), ...Object.fromEntries(d.perFloor.map((v, i) => [`floor_${i + 1}`, Math.round(v)])) })))}><Download size={14} /> Export CSV</button></div>
      </header>
      <section className="stats-grid">
        <Stat label="Last 30 days" value={litres(month)} desc={`${rupees(month / 1000 * s.settings.tariffPerKL)} water bill estimate`} />
        <Stat label="Daily average" value={litres(avg)} desc={`${litres(avg / Math.max(1, s.floors.length))} per floor`} />
        <Stat label="Least usage floor" value={least ? `F${least.id} · ${litres(least.avg)}` : '—'} tone="success" desc="Average per day" />
        <Stat label="Lost to leaks (30 d)" value={litres(leakMonth)} tone="danger" desc={`${(leakMonth / Math.max(1, month) * 100).toFixed(1)}% of all water · ${rupees(leakMonth / 1000 * s.settings.tariffPerKL)}`} />
      </section>
      <div className="analytics-grid-top">
        <Panel title="Daily usage — last 30 days (litres)" icon={<Calendar size={18} className="aqua-icon" />}>
          <div className="monthly-chart-container">
            <div className="baseline-line-indicator" style={{ bottom: `${(avg / maxDay) * 150 + 8}px` }}></div>
            <span className="baseline-line-text" style={{ bottom: `${(avg / maxDay) * 150 + 8}px` }}>avg {litres(avg)}</span>
            {days.map((d, i) => (
              <div key={i} className="monthly-chart-bar-wrapper" title={`${d.date}: ${litres(d.total)}${d.leakLitres ? ` (${litres(d.leakLitres)} leak)` : ''}`}>
                <div className={`monthly-chart-bar ${d.leakLitres > 0 ? 'anomaly-day' : ''}`} style={{ height: `${Math.max(2, (d.total / maxDay) * 150)}px` }}></div>
              </div>
            ))}
          </div>
          <div className="monthly-chart-days"><span>{days[0]?.date.slice(5)}</span><span>red = day with a leak</span><span>Today</span></div>
        </Panel>
        <Panel title="Average use per floor (L/day)" icon={<TrendingUp size={18} className="aqua-icon" />}>
          <div className="floor-ranking-list">
            {floorAvg.map(f => (
              <div key={f.id} className="floor-ranking-item" onClick={() => openFloor(f.id)} style={{ cursor: 'pointer' }}>
                <span className="ranking-label">Floor {f.id}</span>
                <div className="ranking-bar-outer">
                  <div className={`ranking-bar-inner ${f.alert ? 'danger' : ''}`} style={{ width: `${(f.avg / maxFloor) * 100}%` }}></div>
                  <span className="ranking-val">{litres(f.avg)}</span>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
      <div className="analytics-grid-bottom">
        <Panel title="Expected demand by time slot" icon={<BarChart3 size={18} className="aqua-icon" />}>
          <div className="time-slots-list">
            {slotShare.map((x, i) => (
              <div key={i} className="slot-progress-item">
                <div className="slot-progress-header"><span>{x.label}</span><span className="gradient-text" style={{ fontWeight: 'bold' }}>{(x.v * 100).toFixed(0)}%</span></div>
                <div className="slot-progress-bar-outer"><div className={`slot-progress-bar-inner ${x.color}`} style={{ width: `${x.v * 100}%` }}></div></div>
              </div>
            ))}
          </div>
          <div className="explain-box" style={{ marginTop: 14 }}><Leaf size={14} style={{ display: 'inline', verticalAlign: -2 }} /> Night flow should be close to zero. Any steady flow between 1–5 AM is the clearest sign of a hidden leak.</div>
        </Panel>
        <Panel title="Anomaly history" icon={<AlertOctagon size={18} className="aqua-icon" />}>
          <div className="anomaly-table-container">
            <table className="anomaly-table">
              <thead><tr><th>Time</th><th>Floor</th><th>Type</th><th>AI score</th><th>Lost</th><th>Status</th></tr></thead>
              <tbody>
                {s.alerts.slice(0, 8).map(a => (
                  <tr key={a.id} onClick={() => openFloor(a.floorId)} style={{ cursor: 'pointer' }}>
                    <td>{fmtT(a.startedAt)}</td><td>Floor {a.floorId}</td><td>{name(a.kind)}</td>
                    <td className={`table-score ${a.peakScore >= 0.7 ? 'danger' : 'warning'}`}>{a.kind === 'offline' ? '—' : a.peakScore.toFixed(2)}</td>
                    <td>{litres(a.litresLost)}</td>
                    <td><span className={`badge-status ${a.status === 'resolved' ? 'normal' : 'alert'}`}>{a.status}</span></td>
                  </tr>
                ))}
                {!s.alerts.length && <tr><td colSpan={6} className="text-secondary">No anomalies recorded.</td></tr>}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </Layout>
  );
};
