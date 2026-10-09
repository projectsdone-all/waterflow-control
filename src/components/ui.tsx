import React, { useState } from 'react';
import { useSystem } from '../context/SystemContext';
import { Sidebar } from './Sidebar';
import { Menu, X, Brain } from 'lucide-react';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [open, setOpen] = useState(false);
  const { s } = useSystem();
  return (
    <div className="app-container">
      <div className={`sidebar-wrap ${open ? 'open' : ''}`} onClick={() => setOpen(false)}>
        <div onClick={e => e.stopPropagation()}><Sidebar onNavigate={() => setOpen(false)} /></div>
      </div>
      <main className="main-content">
        <div className="mobile-topbar">
          <button className="icon-btn" onClick={() => setOpen(!open)} aria-label="Menu">{open ? <X size={20} /> : <Menu size={20} />}</button>
          <span className="mobile-brand">WLRMS</span>
          <span className="mobile-bname">{s.building.name}</span>
        </div>
        <div className="glow-sphere sphere-top-right"></div>
        <div className="screen-container">
          {s.model.status === 'training' ? <TrainingCard /> : children}
        </div>
      </main>
    </div>
  );
};

const TrainingCard: React.FC = () => {
  const { s } = useSystem();
  const pct = Math.round(s.model.progress * 100);
  return (
    <div className="dashboard-panel training-card">
      <div className="training-icon"><Brain size={34} /></div>
      <h2>AI is learning your building's normal water use…</h2>
      <p className="text-secondary">Generating {s.model.trainDays} days of sensor data per floor and training one Isolation Forest ({s.model.nTrees} trees, {s.model.sampleSize} samples each) for every floor branch.</p>
      <div className="slot-progress-bar-outer" style={{ height: 10, marginTop: 18 }}><div className="slot-progress-bar-inner blue" style={{ width: `${pct}%`, transition: 'width .3s' }} /></div>
      <div className="training-floors">
        {Array.from({ length: s.building.numFloors }, (_, i) => {
          const m = s.model.floors.find(f => f.id === i + 1);
          return <span key={i} className={`badge-status ${m ? 'normal' : 'shutoff'}`}>F{i + 1} {m ? `✓ ${m.n.toLocaleString()} samples` : 'training…'}</span>;
        })}
      </div>
    </div>
  );
};

export const Toasts: React.FC = () => {
  const { toasts, dismiss } = useSystem();
  return (
    <div className="toast-stack">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.tone}`} onClick={() => dismiss(t.id)}>
          <b>{t.title}</b><span>{t.text}</span>
        </div>
      ))}
    </div>
  );
};

export interface Series { values: (number | null)[]; color: string; width?: number; fill?: string; dash?: string; label: string }
export const LineChart: React.FC<{ series: Series[]; height?: number; min?: number; max?: number; hLines?: { y: number; color: string; label: string }[]; xLabels?: string[]; unit?: string }> = ({ series, height = 220, min, max, hLines = [], xLabels = [], unit = '' }) => {
  const W = 800, H = height, PL = 44, PR = 10, PT = 10, PB = 22;
  const all = series.flatMap(s => s.values.filter((v): v is number => v !== null)).concat(hLines.map(h => h.y));
  const lo = min ?? Math.min(0, ...all);
  const hi = max ?? Math.max(1, ...all) * 1.1;
  const n = Math.max(...series.map(s => s.values.length), 2);
  const x = (i: number) => PL + (i / (n - 1)) * (W - PL - PR);
  const y = (v: number) => PT + (1 - (v - lo) / (hi - lo || 1)) * (H - PT - PB);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(t => lo + t * (hi - lo));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="line-chart" style={{ width: '100%', height }} preserveAspectRatio="none">
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={PL} x2={W - PR} y1={y(t)} y2={y(t)} stroke="rgba(148,163,184,.1)" vectorEffect="non-scaling-stroke" />
          <text x={PL - 6} y={y(t) + 3} textAnchor="end" fontSize="10" fill="#64748b">{t >= 100 ? Math.round(t) : t.toFixed(t < 1 ? 2 : 1)}{unit}</text>
        </g>
      ))}
      {series.map((s, si) => {
        const pts = s.values.map((v, i) => (v === null ? null : `${x(i).toFixed(1)},${y(v).toFixed(1)}`));
        const d: string = pts.reduce<string>((acc, p, i) => (p ? acc + (acc && pts[i - 1] ? 'L' : 'M') + p : acc), '');
        return (
          <g key={si}>
            {s.fill && d && <path d={`${d} L${x(s.values.length - 1)},${y(lo)} L${x(0)},${y(lo)} Z`} fill={s.fill} />}
            <path d={d} fill="none" stroke={s.color} strokeWidth={s.width ?? 2} strokeDasharray={s.dash} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
          </g>
        );
      })}
      {hLines.map((h, i) => (
        <g key={i}>
          <line x1={PL} x2={W - PR} y1={y(h.y)} y2={y(h.y)} stroke={h.color} strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
          <text x={W - PR - 4} y={y(h.y) - 4} textAnchor="end" fontSize="10" fill={h.color}>{h.label}</text>
        </g>
      ))}
      {xLabels.map((l, i) => l && <text key={i} x={x(i)} y={H - 6} textAnchor="middle" fontSize="10" fill="#64748b">{l}</text>)}
    </svg>
  );
};

export const Gauge: React.FC<{ value: number; threshold: number; watch: number }> = ({ value, threshold, watch }) => {
  // value 0.3–0.9 mapped onto a semicircle; scores rarely leave that band
  const lo = 0.3, hi = 0.9;
  const t = Math.max(0, Math.min(1, (value - lo) / (hi - lo)));
  const ang = Math.PI * (1 - t);
  const cls = value >= threshold ? 'danger' : value >= watch ? 'warning' : 'normal';
  const arc = (from: number, to: number) => {
    const a0 = Math.PI * (1 - (from - lo) / (hi - lo)), a1 = Math.PI * (1 - (to - lo) / (hi - lo));
    return `M ${60 + 50 * Math.cos(a0)} ${60 - 50 * Math.sin(a0)} A 50 50 0 0 1 ${60 + 50 * Math.cos(a1)} ${60 - 50 * Math.sin(a1)}`;
  };
  return (
    <div className="radial-gauge-container">
      <svg viewBox="0 0 120 72" className="gauge-svg">
        <path d={arc(lo, watch)} stroke="#10b981" strokeWidth="9" fill="none" opacity=".35" />
        <path d={arc(watch, threshold)} stroke="#f59e0b" strokeWidth="9" fill="none" opacity=".35" />
        <path d={arc(threshold, hi)} stroke="#f43f5e" strokeWidth="9" fill="none" opacity=".35" />
        <line x1="60" y1="60" x2={60 + 42 * Math.cos(ang)} y2={60 - 42 * Math.sin(ang)} stroke="#f8fafc" strokeWidth="2.5" strokeLinecap="round" style={{ transition: 'all .6s ease' }} />
        <circle cx="60" cy="60" r="4.5" fill="#f8fafc" />
      </svg>
      <div className="gauge-score-value">{value.toFixed(3)}</div>
      <div className={`gauge-score-status ${cls}`}>{cls === 'danger' ? 'Anomaly' : cls === 'warning' ? 'Watch' : 'Normal'}</div>
      <div className="gauge-legend-info gauge-legend-grid">
        <span style={{ color: 'var(--color-success)' }}>&lt; {watch.toFixed(2)} normal</span>
        <span style={{ color: 'var(--color-warning)' }}>{watch.toFixed(2)}–{threshold.toFixed(2)} watch</span>
        <span style={{ color: 'var(--color-danger)' }}>≥ {threshold.toFixed(2)} alert</span>
      </div>
    </div>
  );
};

export const Stat: React.FC<{ label: string; value: React.ReactNode; desc?: React.ReactNode; tone?: 'accent' | 'danger' | 'success' | 'warning' | 'muted'; style?: React.CSSProperties }> = ({ label, value, desc, tone = 'accent', style }) => (
  <div className="stat-card" style={style}>
    <div className="stat-label">{label}</div>
    <div className={`stat-value ${tone}`}>{value}</div>
    {desc && <div className="stat-desc">{desc}</div>}
  </div>
);

export const Panel: React.FC<{ title: React.ReactNode; icon?: React.ReactNode; right?: React.ReactNode; children: React.ReactNode; className?: string; style?: React.CSSProperties }> = ({ title, icon, right, children, className = '', style }) => (
  <div className={`dashboard-panel ${className}`} style={style}>
    <header className="panel-header">
      <h3 className="panel-title">{icon}<span>{title}</span></h3>
      {right}
    </header>
    {children}
  </div>
);

