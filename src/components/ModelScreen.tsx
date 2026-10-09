import React from 'react';
import { useSystem } from '../context/SystemContext';
import { Layout, Panel, Stat } from './ui';
import { downloadCSV } from '../lib/helpers';
import { Brain, Database, Workflow, BarChart3, Target, RefreshCw, Download, FlaskConical } from 'lucide-react';
import { LEAKS, FEATURES } from '../engine/system';
import { readable } from '../lib/helpers';

const STEPS = [
  ['1', 'Sensing', 'YF-S201 counts pulses; Q = F ÷ 7.5 L/min'],
  ['2', 'Transmit', 'ESP32 publishes 1 reading/min over MQTT'],
  ['3', 'Preprocess', '60-min rolling window, log transform'],
  ['4', 'Features', '5 flow features + time of day'],
  ['5', 'Isolation Forest', '100 trees · ψ = 256 · one model per floor'],
  ['6', 'Decision', 'threshold + debounce + no-idle gate + burst rule'],
  ['7', 'Action', 'SMS / email, valve shut-off, log'],
];

export const ModelScreen: React.FC = () => {
  const { s, sys } = useSystem();
  const m = s.model, e = m.evaluation;
  const hist = m.hist;
  const maxH = hist ? Math.max(...hist.normal.map(v => v / Math.max(1, hist.normal.reduce((a, c) => a + c, 0))), ...hist.leak.map(v => v / Math.max(1, hist.leak.reduce((a, c) => a + c, 0)))) : 1;
  const nSum = hist ? hist.normal.reduce((a, c) => a + c, 0) : 1, lSum = hist ? hist.leak.reduce((a, c) => a + c, 0) : 1;
  const avgThr = m.floors.length ? m.floors.reduce((a, f) => a + f.threshold, 0) / m.floors.length : 0.66;
  const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
  const trainTotal = m.floors.reduce((a, f) => a + f.n, 0);

  return (
    <Layout>
      <header className="dashboard-header">
        <div className="header-title-area"><h2>AI Model — Isolation Forest</h2><p>Dataset strategy, preprocessing, training and evaluation — all running live in this browser</p></div>
        <div className="header-actions">
          <span className={`badge-status ${m.status === 'ready' ? 'normal' : 'warning'}`}>{m.status === 'ready' ? `Trained ${m.trainedAt ? new Date(m.trainedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}` : 'Training…'}</span>
        </div>
      </header>

      <Panel title="Detection pipeline" icon={<Workflow size={18} className="aqua-icon" />}>
        <div className="pipeline">{STEPS.map(([n, t, d]) => <div key={n} className="pipe-step"><span className="pipe-n">{n}</span><b>{t}</b><span>{d}</span></div>)}</div>
        <div className="formula">s(x, n) = 2<sup>−E[h(x)] / c(n)</sup> &nbsp;·&nbsp; c(n) = 2H(n−1) − 2(n−1)/n &nbsp;·&nbsp; s → 1 anomaly, s ≲ 0.5 normal</div>
      </Panel>

      <section className="stats-grid" style={{ marginTop: '1.5rem' }}>
        <Stat label="Training samples" value={trainTotal.toLocaleString()} desc={`${m.trainDays} days × 1,440 min × ${m.floors.length} floors`} />
        <Stat label="Trees × sample size" value={`${m.nTrees} × ${m.sampleSize}`} desc="Same defaults as scikit-learn" />
        <Stat label="Alert threshold (avg)" value={avgThr.toFixed(3)} tone="warning" desc={`${pct(1 - s.settings.contamination)} quantile of normal scores`} />
        <Stat label="F1 score" value={e ? e.f1.toFixed(3) : '…'} tone="success" desc={e ? `precision ${pct(e.precision)} · recall ${pct(e.recall)}` : 'evaluating'} />
      </section>

      <div className="analytics-grid-top">
        <Panel title="Dataset strategy" icon={<Database size={18} className="aqua-icon" />}>
          <div className="prose">
            <p><b>Training data (unsupervised, normal only).</b> For every floor the system generates {m.trainDays} days of minute-level flow from an event model — taps, flushes, kitchen, showers and washing machines — scheduled so average volume follows the morning / afternoon / evening baselines you entered at onboarding, with a near-zero night period. Each floor gets its own occupancy factor and its own model.</p>
            <p><b>Test data (labelled).</b> Fresh days with a different random seed, with leaks injected at random times: pipe burst (24–34 L/min), tap left open (4–7), running toilet (1.2–2.2) and hidden slow leak (0.35–0.7). Every minute is labelled leak / normal.</p>
            <p><b>Real deployment.</b> Replace the generator with 2–4 weeks of logged ESP32 readings per floor; retrain weekly. Incidents confirmed by maintenance become labelled test data.</p>
          </div>
          <button className="btn-secondary" onClick={() => downloadCSV(`wlrms-training-floor1.csv`, sys.trainingCsv(1))}><Download size={14} /> Download 1 day of training data (CSV)</button>
        </Panel>
        <Panel title="Features after preprocessing (Floor 1)" icon={<FlaskConical size={18} className="aqua-icon" />}>
          <table className="anomaly-table feature-table">
            <thead><tr><th>Feature</th><th>Why it matters</th><th>p50</th><th>p99</th></tr></thead>
            <tbody>{FEATURES.map((f, i) => {
              const st = m.featureStats[i];
              return <tr key={f.key}><td><b>{f.label}</b></td><td className="text-secondary font-xs">{f.why}</td><td className="font-xs">{st ? readable(i, st.p50) : '—'}</td><td className="font-xs">{st ? readable(i, st.p99) : '—'}</td></tr>;
            })}</tbody>
          </table>
        </Panel>
      </div>

      <div className="analytics-grid-top">
        <Panel title="Score distribution — normal vs leak minutes" icon={<BarChart3 size={18} className="aqua-icon" />}>
          {hist ? (
            <>
              <div className="histo">
                {hist.bins.map((b, i) => (
                  <div key={i} className="histo-col" title={`score ${b.toFixed(2)}–${(b + 0.02).toFixed(2)}`}>
                    <div className="histo-bar n" style={{ height: `${(hist.normal[i] / nSum) / maxH * 100}%` }} />
                    <div className="histo-bar l" style={{ height: `${(hist.leak[i] / lSum) / maxH * 100}%` }} />
                    {Math.abs(b - avgThr) < 0.01 && <div className="histo-thr" />}
                  </div>
                ))}
              </div>
              <div className="histo-axis"><span>0.30</span><span>0.50</span><span>0.70</span><span>0.90</span></div>
              <div className="font-xs text-secondary" style={{ marginTop: 6 }}><span className="dot-n" /> normal minutes &nbsp; <span className="dot-l" /> leak minutes &nbsp; | red line = alert threshold</div>
            </>
          ) : <div className="text-secondary">Running evaluation…</div>}
        </Panel>
        <Panel title="Evaluation on held-out labelled data" icon={<Target size={18} className="aqua-icon" />}>
          {e ? (
            <>
              <div className="confusion">
                <div />
                <div className="cm-h">Predicted leak</div><div className="cm-h">Predicted normal</div>
                <div className="cm-h">Actual leak</div><div className="cm tp">{e.tp.toLocaleString()}<span>TP</span></div><div className="cm fn">{e.fn.toLocaleString()}<span>FN</span></div>
                <div className="cm-h">Actual normal</div><div className="cm fp">{e.fp.toLocaleString()}<span>FP</span></div><div className="cm tn">{e.tn.toLocaleString()}<span>TN</span></div>
              </div>
              <div className="kv-list" style={{ marginTop: 12 }}>
                <div><span>Precision / Recall (per minute)</span><b>{pct(e.precision)} / {pct(e.recall)}</b></div>
                <div><span>Accuracy</span><b>{pct(e.accuracy)}</b></div>
                <div><span>Leak incidents caught</span><b>{e.detected} / {e.events}</b></div>
                <div><span>False alarms per floor-day</span><b>{e.falseAlarmsPerDay.toFixed(2)}</b></div>
              </div>
              <table className="anomaly-table" style={{ marginTop: 12 }}>
                <thead><tr><th>Leak type</th><th>Caught</th><th>Avg time to detect</th></tr></thead>
                <tbody>{(Object.keys(e.perType) as (keyof typeof LEAKS)[]).map(k => <tr key={k}><td>{LEAKS[k].icon} {LEAKS[k].label}</td><td>{e.perType[k].detected}/{e.perType[k].total}</td><td>{e.perType[k].detected ? `${e.perType[k].latency} min` : '—'}</td></tr>)}</tbody>
              </table>
              <div className="font-xs text-secondary" style={{ marginTop: 6 }}>Recall per minute is below 100% because the first minutes of every leak (before the debounce confirms it) count as misses. Incident-level detection is what matters operationally.</div>
            </>
          ) : <div className="text-secondary">Running evaluation…</div>}
        </Panel>
      </div>

      <Panel title="Per-floor models" icon={<Brain size={18} className="aqua-icon" />} style={{ marginTop: '1.5rem' }}
        right={<div className="retrain">
          <select className="form-input sm" value={m.nTrees} onChange={ev => sys.retrain({ nTrees: +ev.target.value })}>{[50, 100, 200].map(v => <option key={v} value={v}>{v} trees</option>)}</select>
          <select className="form-input sm" value={m.sampleSize} onChange={ev => sys.retrain({ sampleSize: +ev.target.value })}>{[128, 256, 512].map(v => <option key={v} value={v}>ψ {v}</option>)}</select>
          <select className="form-input sm" value={m.trainDays} onChange={ev => sys.retrain({ trainDays: +ev.target.value })}>{[2, 4, 7].map(v => <option key={v} value={v}>{v} days</option>)}</select>
          <button className="btn-secondary" onClick={() => sys.retrain({})}><RefreshCw size={14} /> Retrain</button>
          <button className="btn-secondary" onClick={() => sys.evaluate()}><Target size={14} /> Re-evaluate</button>
        </div>}>
        <div className="anomaly-table-container">
          <table className="anomaly-table">
            <thead><tr><th>Floor</th><th>Samples</th><th>Median score</th><th>Watch</th><th>Alert threshold</th><th>Train time</th></tr></thead>
            <tbody>{m.floors.map(f => <tr key={f.id}><td>Floor {f.id}</td><td>{f.n.toLocaleString()}</td><td>{f.q50.toFixed(3)}</td><td className="table-score warning">{f.watch.toFixed(3)}</td><td className="table-score danger">{f.threshold.toFixed(3)}</td><td>{f.ms} ms</td></tr>)}</tbody>
          </table>
        </div>
      </Panel>
    </Layout>
  );
};
