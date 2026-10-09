// ─────────────────────────────────────────────────────────────────────────────
// WLRMS runtime: ESP32 nodes → MQTT → feature pipeline → Isolation Forest →
// debounce + rule layer → alerts, valve control, notifications.
// Lives outside React so the simulation never double-runs.
// ─────────────────────────────────────────────────────────────────────────────
import { IsolationForest, mulberry32 } from './isolationForest';
import { FloorUsage, FeatureWindow, expectedLph, generateDataset, classifyLeak, LEAKS, slotOf, FEATURES, type Baselines, type LeakType } from './waterModel';

export type FloorStatus = 'normal' | 'warning' | 'alert' | 'shutoff' | 'offline';
export const GPIO = [25, 33, 32, 35, 34, 26, 27, 14, 12, 13];
export const SAMPLE_TS = (m: number) => m * 60_000;

export interface Building { name: string; numFloors: number; type: string; location: string; baselines: Baselines }
export interface Contact { name: string; phone: string; email: string }
export interface Settings {
  tariffPerKL: number; debounce: number; contamination: number; gateMin: number; autoShutoff: boolean; autoShutoffMin: number;
  burstRule: boolean; burstLpm: number; randomFaults: boolean; browserNotify: boolean; contacts: Contact[];
}
export const DEFAULT_SETTINGS: Settings = {
  tariffPerKL: 55, debounce: 3, contamination: 0.01, gateMin: 20, autoShutoff: true, autoShutoffMin: 30,
  burstRule: true, burstLpm: 22, randomFaults: true, browserNotify: false,
  contacts: [{ name: 'Building Supervisor', phone: '+91 98450 00000', email: 'supervisor@building.in' }],
};

export interface Reading { t: number; flow: number; score: number; expected: number }
export interface FloorState {
  id: number; gpio: number; occupancy: number; valveOpen: boolean; offline: boolean;
  flowLpm: number; score: number; status: FloorStatus; threshold: number; watch: number;
  baselineLph: number; todayLitres: number; continuousMin: number; features: number[];
  history: Reading[]; leak?: { type: LeakType; lpm: number; since: number }; lastSeen: number; pulsesPerMin: number;
}
export interface AlertAction { t: number; text: string; by: string }
export interface AlertItem {
  id: string; floorId: number; kind: LeakType | 'offline'; source: 'ml' | 'rule' | 'heartbeat';
  startedAt: number; status: 'active' | 'shutoff' | 'resolved'; peakScore: number; peakFlow: number; baselineLph: number;
  litresLost: number; litresSaved: number; resolvedAt?: number; actions: AlertAction[]; auto?: boolean; liveFrom?: number;
}
export interface Notification { id: string; t: number; channel: 'SMS' | 'Email' | 'App'; to: string; text: string }
export interface MqttMsg { t: number; topic: string; payload: string }
export interface DayUsage { date: string; total: number; perFloor: number[]; leakLitres: number }

export interface ModelInfo {
  status: 'idle' | 'training' | 'ready';
  progress: number;
  trainedAt?: number;
  nTrees: number; sampleSize: number; trainDays: number;
  floors: { id: number; n: number; threshold: number; watch: number; q50: number; ms: number }[];
  featureStats: { key: string; label: string; p50: number; p95: number; p99: number }[];
  hist?: { bins: number[]; normal: number[]; leak: number[] };
  evaluation?: {
    tp: number; fp: number; fn: number; tn: number; precision: number; recall: number; f1: number; accuracy: number;
    falseAlarmsPerDay: number; testDays: number; events: number; detected: number;
    perType: Record<LeakType, { total: number; detected: number; latency: number }>;
  };
}

export interface SystemState {
  loggedIn: boolean; onboarded: boolean; user: string;
  building: Building; settings: Settings;
  minute: number; speed: number; paused: boolean;
  floors: FloorState[]; alerts: AlertItem[]; notifications: Notification[]; mqtt: MqttMsg[];
  tank: { level: number; capacity: number; pumpOn: boolean };
  days: DayUsage[]; model: ModelInfo; savedLitres: number;
}

const KEY = 'wlrms_state_v2';
const uid = () => Math.random().toString(36).slice(2, 10);
const fmtT = (m: number) => new Date(SAMPLE_TS(m)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

interface FloorRuntime { usage: FloorUsage; win: FeatureWindow; model: IsolationForest; sortedCols: number[][]; run: number; burstRun: number; offlineSince?: number }

export type UiEvent = { tone: 'danger' | 'success' | 'info' | 'warning'; title: string; text: string };

class WlrmsSystem {
  state: SystemState;
  private rt: FloorRuntime[] = [];
  private listeners: (() => void)[] = [];
  private uiListeners: ((e: UiEvent) => void)[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private rand = mulberry32(Date.now() % 100000);

  constructor() {
    const saved = this.load();
    this.state = {
      loggedIn: false, onboarded: false, user: '',
      building: { name: 'Sunrise Apartments', numFloors: 5, type: 'Residential Apartment', location: 'Mangaluru, Karnataka', baselines: { morning: 150, afternoon: 60, evening: 120 } },
      settings: { ...DEFAULT_SETTINGS }, minute: Math.floor(Date.now() / 60_000), speed: 1, paused: false,
      floors: [], alerts: [], notifications: [], mqtt: [], tank: { level: 7200, capacity: 10000, pumpOn: false },
      days: [], model: { status: 'idle', progress: 0, nTrees: 100, sampleSize: 256, trainDays: 4, floors: [], featureStats: [] }, savedLitres: 0,
      ...saved,
    };
    if (saved?.onboarded) setTimeout(() => this.bootstrap(false), 0);
    if (typeof window !== 'undefined' && window.addEventListener) window.addEventListener('beforeunload', () => this.save(true));
  }

  // ── persistence ──────────────────────────────────────────────────────────
  private load(): Partial<SystemState> | null {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      return { loggedIn: s.loggedIn, onboarded: s.onboarded, user: s.user, building: s.building, settings: { ...DEFAULT_SETTINGS, ...s.settings }, alerts: s.alerts ?? [], notifications: s.notifications ?? [], savedLitres: s.savedLitres ?? 0 };
    } catch { return null; }
  }
  private lastSave = 0;
  private save(force = false) {
    if (!force && Date.now() - this.lastSave < 3000) return;
    this.lastSave = Date.now();
    const s = this.state;
    try { localStorage.setItem(KEY, JSON.stringify({ loggedIn: s.loggedIn, onboarded: s.onboarded, user: s.user, building: s.building, settings: s.settings, alerts: s.alerts.slice(0, 200), notifications: s.notifications.slice(0, 200), savedLitres: s.savedLitres })); } catch { /* full */ }
  }
  private set(patch: Partial<SystemState>) { this.state = { ...this.state, ...patch }; this.save(); this.listeners.forEach(l => l()); }
  subscribe = (l: () => void) => { this.listeners.push(l); return () => { this.listeners = this.listeners.filter(x => x !== l); }; };
  onUi = (l: (e: UiEvent) => void) => { this.uiListeners.push(l); return () => { this.uiListeners = this.uiListeners.filter(x => x !== l); }; };
  getState = () => this.state;
  private ui(e: UiEvent) { this.uiListeners.forEach(l => l(e)); }

  // ── session ──────────────────────────────────────────────────────────────
  login(email: string) { this.set({ loggedIn: true, user: email }); this.save(true); }
  logout() { this.stop(); this.set({ loggedIn: false, onboarded: false, floors: [], model: { ...this.state.model, status: 'idle' } }); this.save(true); }

  completeOnboarding(b: Building) {
    this.set({ building: b, onboarded: true, alerts: [], notifications: [], savedLitres: 0 });
    this.save(true);
    this.bootstrap(true);
  }

  // ── training + warm-up ───────────────────────────────────────────────────
  private async bootstrap(seedDemoLeak: boolean) {
    this.stop();
    const b = this.state.building;
    const floors: FloorState[] = [];
    this.rt = [];
    this.set({ model: { ...this.state.model, status: 'training', progress: 0, floors: [] } });
    const modelFloors: ModelInfo['floors'] = [];
    const nowMin = Math.floor(Date.now() / 60_000);
    for (let i = 0; i < b.numFloors; i++) {
      await new Promise(r => setTimeout(r, 0));
      const t0 = performance.now();
      const occupancy = +(0.75 + mulberry32(i + 11)() * 0.5).toFixed(2);
      const data = generateDataset({ baselines: b.baselines, occupancy, days: this.state.model.trainDays, seed: 1000 + i });
      const model = new IsolationForest({ nTrees: this.state.model.nTrees, sampleSize: this.state.model.sampleSize, seed: 7 + i }).fit(data.X);
      const scores = data.X.map(x => model.score(x)).sort((a, c) => a - c);
      const q = (p: number) => scores[Math.min(scores.length - 1, Math.floor(p * (scores.length - 1)))];
      const threshold = Math.max(0.6, +q(1 - this.state.settings.contamination).toFixed(3));
      const watch = +Math.max(0.55, q(0.97)).toFixed(3);
      const sortedCols = FEATURES.map((_, f) => data.X.map(r => r[f]).sort((a, c) => a - c));
      this.rt.push({ usage: new FloorUsage(b.baselines, occupancy, Date.now() + i * 97), win: new FeatureWindow(), model, sortedCols, run: 0, burstRun: 0 });
      floors.push({
        id: i + 1, gpio: GPIO[i] ?? 0, occupancy, valveOpen: true, offline: false, flowLpm: 0, score: 0.4, status: 'normal',
        threshold, watch, baselineLph: Math.round(expectedLph(b.baselines, nowMin % 1440, occupancy)), todayLitres: 0, continuousMin: 0,
        features: [], history: [], lastSeen: nowMin, pulsesPerMin: 0,
      });
      modelFloors.push({ id: i + 1, n: data.X.length, threshold, watch, q50: +q(0.5).toFixed(3), ms: Math.round(performance.now() - t0) });
      this.set({ model: { ...this.state.model, progress: (i + 1) / b.numFloors, floors: [...modelFloors] } });
    }
    const fs = this.rt[0].sortedCols.map((col, f) => ({ key: FEATURES[f].key, label: FEATURES[f].label, p50: col[Math.floor(col.length * 0.5)], p95: col[Math.floor(col.length * 0.95)], p99: col[Math.floor(col.length * 0.99)] }));

    // warm up from local midnight so "today" totals are real; score the last 2 hours
    const tzOffset = new Date().getTimezoneOffset();
    const localNow = nowMin - tzOffset;
    const midnight = nowMin - (localNow % 1440);
    const leakFloor = b.numFloors;
    let tankLevel = 7200;
    this.state = { ...this.state, floors, minute: midnight };
    if (seedDemoLeak) floors[leakFloor - 1].leak = { type: 'tap', lpm: 5.2, since: nowMin - 45 };
    for (let m = midnight; m < nowMin; m++) {
      const scoreIt = nowMin - m <= 120;
      this.state.minute = m;
      tankLevel = this.stepMinute(scoreIt, tankLevel, true);
    }
    this.state.tank = { ...this.state.tank, level: tankLevel };
    this.state.alerts.forEach(a => { if (a.status === 'active') a.liveFrom = nowMin; });
    this.set({ minute: nowMin, floors: [...this.state.floors], days: this.makeHistory(), model: { ...this.state.model, status: 'ready', progress: 1, trainedAt: Date.now(), featureStats: fs } });
    this.save(true);
    this.start();
    setTimeout(() => this.evaluate(), 300);
  }

  retrain(patch: Partial<Pick<ModelInfo, 'nTrees' | 'sampleSize' | 'trainDays'>>) {
    this.set({ model: { ...this.state.model, ...patch, evaluation: undefined, hist: undefined } });
    this.bootstrap(false);
  }

  /** Hold-out evaluation on fresh synthetic days with labelled injected leaks */
  async evaluate() {
    const b = this.state.building;
    const types: LeakType[] = ['burst', 'tap', 'toilet', 'drip'];
    let tp = 0, fp = 0, fn = 0, tn = 0, events = 0, detected = 0, faEpisodes = 0;
    const perType = Object.fromEntries(types.map(t => [t, { total: 0, detected: 0, latency: 0 }])) as NonNullable<ModelInfo['evaluation']>['perType'];
    const bins = Array.from({ length: 30 }, (_, i) => 0.3 + i * 0.02);
    const hN = new Array(bins.length).fill(0), hL = new Array(bins.length).fill(0);
    const nEval = Math.min(3, this.rt.length);
    const testDays = 4;
    for (let f = 0; f < nEval; f++) {
      await new Promise(r => setTimeout(r, 0));
      const r = this.rt[f], fl = this.state.floors[f];
      const rnd = mulberry32(500 + f);
      const leaks: { start: number; duration: number; type: LeakType; lpm: number }[] = [];
      let s = 200 + Math.floor(rnd() * 200);
      while (s < testDays * 1440 - 300) {
        const type = types[leaks.length % 4];
        const [a, c] = LEAKS[type].lpm;
        leaks.push({ start: s, duration: 150 + Math.floor(rnd() * 90), type, lpm: a + rnd() * (c - a) });
        s += 500 + Math.floor(rnd() * 400);
      }
      const d = generateDataset({ baselines: b.baselines, occupancy: fl.occupancy, days: testDays, seed: 9000 + f, leaks });
      let run = 0, brun = 0, prevFa = false;
      const pred = d.X.map((x, i) => {
        const sc = r.model.score(x);
        const bi = Math.min(bins.length - 1, Math.max(0, Math.floor((sc - 0.3) / 0.02)));
        (d.y[i] ? hL : hN)[bi]++;
        run = sc >= fl.threshold ? run + 1 : 0;
        brun = this.state.settings.burstRule && d.flows[i] >= this.state.settings.burstLpm ? brun + 1 : 0;
        const gm = this.state.settings.gateMin;
        const gate = gm === 0 || (i >= gm && Math.min(...d.flows.slice(i - gm + 1, i + 1)) >= 0.25);
        return (run >= this.state.settings.debounce && gate) || brun >= 3 ? 1 : 0;
      });
      pred.forEach((p, i) => {
        const y = d.y[i];
        if (p && y) tp++; else if (p && !y) fp++; else if (!p && y) fn++; else tn++;
        const fa = !!p && !y;
        if (fa && !prevFa) faEpisodes++;
        prevFa = fa;
      });
      leaks.forEach(l => {
        events++; perType[l.type].total++;
        const idx = d.minutes.findIndex((m, i) => m >= l.start && m < l.start + l.duration && pred[i]);
        if (idx >= 0) { detected++; perType[l.type].detected++; perType[l.type].latency += d.minutes[idx] - l.start; }
      });
    }
    types.forEach(t => { if (perType[t].detected) perType[t].latency = Math.round(perType[t].latency / perType[t].detected); });
    const precision = tp / Math.max(1, tp + fp), recall = tp / Math.max(1, tp + fn);
    this.set({
      model: {
        ...this.state.model,
        hist: { bins, normal: hN, leak: hL },
        evaluation: { tp, fp, fn, tn, precision, recall, f1: (2 * precision * recall) / Math.max(1e-9, precision + recall), accuracy: (tp + tn) / Math.max(1, tp + tn + fp + fn), falseAlarmsPerDay: faEpisodes / (testDays * nEval), testDays: testDays * nEval, events, detected, perType },
      },
    });
  }

  private makeHistory(): DayUsage[] {
    const b = this.state.building;
    const rnd = mulberry32(77);
    const out: DayUsage[] = [];
    const today = new Date();
    const dailyExpected = (occ: number) => { let s = 0; for (let m = 0; m < 1440; m += 10) s += expectedLph(b.baselines, m, occ) / 6; return s; };
    for (let d = 29; d >= 1; d--) {
      const date = new Date(today.getTime() - d * 86400_000);
      const weekend = date.getDay() === 0 || date.getDay() === 6;
      const perFloor = this.state.floors.map(f => Math.round(dailyExpected(f.occupancy) * (weekend ? 1.12 : 1) * (0.88 + rnd() * 0.24)));
      let leakLitres = 0;
      if (d === 17 || d === 9 || d === 4) { const fi = Math.floor(rnd() * perFloor.length); leakLitres = Math.round(180 + rnd() * 900); perFloor[fi] += leakLitres; }
      out.push({ date: date.toISOString().slice(0, 10), total: perFloor.reduce((a, c) => a + c, 0), perFloor, leakLitres });
    }
    return out;
  }

  // ── live loop ────────────────────────────────────────────────────────────
  start() { if (!this.timer) this.timer = setInterval(() => this.tick(), 1000); }
  stop() { if (this.timer) { clearInterval(this.timer); this.timer = null; } }
  setSpeed(speed: number) { this.set({ speed, paused: false }); }
  setPaused(paused: boolean) { this.set({ paused }); }

  private tick() {
    if (this.state.paused || !this.rt.length || this.state.model.status !== 'ready') return;
    let tank = this.state.tank.level;
    for (let i = 0; i < this.state.speed; i++) {
      this.state.minute++;
      // a new day starts: roll today's totals into history
      const local = this.state.minute - new Date().getTimezoneOffset();
      if (local % 1440 === 0) this.rollDay();
      tank = this.stepMinute(true, tank, false);
      if (this.state.settings.randomFaults && this.rand() < 0.0007) this.injectRandom();
    }
    this.set({ floors: [...this.state.floors], tank: { ...this.state.tank, level: tank }, alerts: [...this.state.alerts], mqtt: [...this.state.mqtt] });
  }

  private rollDay() {
    const s = this.state;
    const d = new Date(SAMPLE_TS(s.minute - 1));
    const perFloor = s.floors.map(f => Math.round(f.todayLitres));
    const leakLitres = Math.round(s.alerts.filter(a => a.startedAt > s.minute - 1440).reduce((x, a) => x + a.litresLost, 0));
    s.days = [...s.days.slice(-29), { date: d.toISOString().slice(0, 10), total: perFloor.reduce((a, c) => a + c, 0), perFloor, leakLitres }];
    s.floors = s.floors.map(f => ({ ...f, todayLitres: 0 }));
  }

  private stepMinute(score: boolean, tankLevel: number, warmup: boolean): number {
    const s = this.state, b = s.building, set = s.settings;
    const mod = ((s.minute - new Date().getTimezoneOffset()) % 1440 + 1440) % 1440;
    let total = 0;
    s.floors = s.floors.map((f0, i) => {
      const r = this.rt[i];
      let f = f0;
      const exp = expectedLph(b.baselines, mod, f.occupancy);
      if (f.offline) {
        r.offlineSince ??= s.minute;
        if (!warmup && s.minute - r.offlineSince === 3) this.raise(f, 'offline', 'heartbeat', 0, 0);
        return { ...f, status: 'offline' as FloorStatus };
      }
      r.offlineSince = undefined;
      let flow = r.usage.next(mod);
      if (f.leak && s.minute >= f.leak.since) flow += f.leak.lpm * (0.95 + this.rand() * 0.1);
      if (!f.valveOpen) flow = 0;
      flow = Math.round(flow * 100) / 100;
      total += flow;
      r.win.push(flow);
      const feats = r.win.features(b.baselines, mod, f.occupancy);
      let sc = f.score;
      if (score) sc = r.model.score(feats);
      const history = f.history.length >= 240 ? f.history.slice(1) : f.history.slice();
      history.push({ t: s.minute, flow, score: sc, expected: exp / 60 });
      f = { ...f, flowLpm: flow, score: sc, features: feats, history, todayLitres: f.todayLitres + flow, continuousMin: r.win.continuousMinutes, baselineLph: Math.round(exp), lastSeen: s.minute, pulsesPerMin: Math.round(flow * 7.5 * 60) };

      if (!warmup) {
        s.mqtt.push({ t: s.minute, topic: `wlrms/${b.name.toLowerCase().replace(/\s+/g, '-')}/floor${f.id}/flow`, payload: JSON.stringify({ node: 'esp32-01', gpio: f.gpio, pulses: f.pulsesPerMin, flow_lpm: flow, valve: f.valveOpen ? 'open' : 'closed', ts: new Date(SAMPLE_TS(s.minute)).toISOString().slice(11, 19) }) });
        if (s.mqtt.length > 40) s.mqtt.splice(0, s.mqtt.length - 40);
      }
      if (!f.valveOpen) return { ...f, status: 'shutoff' as FloorStatus };
      if (!score) return { ...f, status: 'normal' as FloorStatus };

      // decision layer: ML (debounced) + hard burst rule
      r.run = sc >= f.threshold ? r.run + 1 : 0;
      r.burstRun = set.burstRule && flow >= set.burstLpm ? r.burstRun + 1 : 0;
      // persistence gate: a leak never lets the pipe go idle
      const recent = r.win.recent;
      const gate = set.gateMin === 0 || (recent.length >= set.gateMin && Math.min(...recent.slice(-set.gateMin)) >= 0.25);
      const mlHit = r.run >= set.debounce && gate;
      const active = s.alerts.find(a => a.floorId === f.id && a.status === 'active' && a.kind !== 'offline');
      let status: FloorStatus = sc >= f.watch || r.run >= set.debounce ? 'warning' : 'normal';
      if (mlHit || r.burstRun >= 3 || active) status = 'alert';
      if (!active && (mlHit || r.burstRun >= 3)) {
        const excess = Math.max(0, Math.min(...r.win.recent.slice(-10)));
        this.raise(f, classifyLeak(r.burstRun >= 3 ? Math.max(excess, flow * 0.7) : excess), r.burstRun >= 3 && !mlHit ? 'rule' : 'ml', sc, flow, warmup);
      }
      if (active) {
        const excess = Math.max(0, Math.min(...r.win.recent.slice(-15)));
        active.litresLost += excess;
        active.peakScore = Math.max(active.peakScore, sc);
        active.peakFlow = Math.max(active.peakFlow, flow);
        if (!warmup && set.autoShutoff && s.minute - Math.max(active.startedAt, active.liveFrom ?? 0) >= set.autoShutoffMin) {
          f = { ...f, valveOpen: false, status: 'shutoff' };
          active.status = 'shutoff'; active.auto = true;
          active.actions.push({ t: s.minute, text: `Auto-shutoff: solenoid valve on GPIO ${f.gpio} closed after ${set.autoShutoffMin} min`, by: 'System' });
          this.notify(`AUTO-SHUTOFF ${b.name} Floor ${f.id}: valve closed to stop a suspected ${LEAKS[active.kind as LeakType]?.label.toLowerCase() ?? 'leak'}.`);
          this.ui({ tone: 'warning', title: `Floor ${f.id} valve closed automatically`, text: `Leak ran ${set.autoShutoffMin} min without action` });
          return f;
        }
      }
      return { ...f, status };
    });

    // shut-off valves save water that would have leaked
    s.floors.forEach(f => {
      const a = s.alerts.find(x => x.floorId === f.id && x.status === 'shutoff');
      if (a && f.leak) { a.litresSaved += f.leak.lpm; s.savedLitres += f.leak.lpm; }
    });

    // overhead tank (HC-SR04): drains with use, pump refills below 30 %
    let level = tankLevel - total;
    let pumpOn = s.tank.pumpOn;
    if (level < s.tank.capacity * 0.3) pumpOn = true;
    if (pumpOn) level += 120;
    if (level >= s.tank.capacity * 0.95) pumpOn = false;
    s.tank = { ...s.tank, pumpOn };
    return Math.max(0, Math.min(s.tank.capacity, level));
  }

  private raise(f: FloorState, kind: AlertItem['kind'], source: AlertItem['source'], score: number, flow: number, warmup = false) {
    const s = this.state;
    const a: AlertItem = {
      id: uid(), floorId: f.id, kind, source, startedAt: s.minute, status: 'active', peakScore: score, peakFlow: flow,
      baselineLph: f.baselineLph, litresLost: 0, litresSaved: 0,
      actions: [{ t: s.minute, text: source === 'heartbeat' ? `No MQTT heartbeat from GPIO ${f.gpio} for 3 min` : source === 'rule' ? `Burst rule: flow ${flow.toFixed(1)} L/min ≥ ${s.settings.burstLpm} L/min for 3 readings` : `Isolation Forest score ${score.toFixed(3)} ≥ ${f.threshold} for ${s.settings.debounce} readings, and flow has not stopped for ${s.settings.gateMin} min`, by: 'AI engine' }],
    };
    s.alerts = [a, ...s.alerts];
    const label = kind === 'offline' ? 'Sensor offline' : LEAKS[kind].label;
    const msg = `WLRMS ALERT ${s.building.name} Floor ${f.id}: ${label}. Flow ${flow.toFixed(1)} L/min (normal ${(f.baselineLph / 60).toFixed(1)}). Score ${score.toFixed(2)}.`;
    this.notify(msg, warmup);
    if (!warmup) {
      this.ui({ tone: 'danger', title: `🚨 Floor ${f.id}: ${label}`, text: kind === 'offline' ? 'ESP32 stopped reporting' : `${flow.toFixed(1)} L/min · score ${score.toFixed(2)}` });
      if (s.settings.browserNotify && 'Notification' in window && Notification.permission === 'granted') {
        try { new Notification(`WLRMS: Floor ${f.id} ${label}`, { body: msg }); } catch { /* ignore */ }
      }
    }
  }

  private notify(text: string, warmup = false) {
    const s = this.state;
    const now = warmup ? SAMPLE_TS(s.minute) : Date.now();
    const out: Notification[] = [];
    s.settings.contacts.forEach(c => {
      if (c.phone) out.push({ id: uid(), t: now, channel: 'SMS', to: c.phone, text });
      if (c.email) out.push({ id: uid(), t: now, channel: 'Email', to: c.email, text });
    });
    out.push({ id: uid(), t: now, channel: 'App', to: 'Dashboard', text });
    s.notifications = [...out, ...s.notifications].slice(0, 200);
  }

  // ── operator actions ─────────────────────────────────────────────────────
  shutOff(floorId: number) {
    const s = this.state;
    const floors = s.floors.map(f => f.id === floorId ? { ...f, valveOpen: false, status: 'shutoff' as FloorStatus, flowLpm: 0 } : f);
    const alerts = s.alerts.map(a => a.floorId === floorId && a.status === 'active' ? { ...a, status: 'shutoff' as const, actions: [...a.actions, { t: s.minute, text: `Solenoid valve on GPIO ${floors[floorId - 1].gpio} closed`, by: s.user || 'Operator' }] } : a);
    this.set({ floors, alerts });
    this.ui({ tone: 'warning', title: `Floor ${floorId} valve closed`, text: 'Relay signal sent — water supply to this branch is isolated' });
  }
  openValve(floorId: number) {
    const s = this.state;
    this.set({ floors: s.floors.map(f => f.id === floorId ? { ...f, valveOpen: true } : f) });
    this.ui({ tone: 'info', title: `Floor ${floorId} valve opened`, text: 'Water supply restored' });
  }
  resolve(floorId: number) {
    const s = this.state;
    this.rt[floorId - 1]?.win.reset();
    if (this.rt[floorId - 1]) { this.rt[floorId - 1].run = 0; this.rt[floorId - 1].burstRun = 0; }
    const floors = s.floors.map(f => f.id === floorId ? { ...f, valveOpen: true, leak: undefined, offline: false, status: 'normal' as FloorStatus } : f);
    const alerts = s.alerts.map(a => a.floorId === floorId && a.status !== 'resolved' ? { ...a, status: 'resolved' as const, resolvedAt: s.minute, actions: [...a.actions, { t: s.minute, text: 'Physically inspected and repaired — marked resolved, valve reopened', by: s.user || 'Operator' }] } : a);
    this.set({ floors, alerts });
    this.ui({ tone: 'success', title: `Floor ${floorId} resolved`, text: 'Baseline tracking restarted' });
  }
  resendAlert(floorId: number) {
    const a = this.state.alerts.find(x => x.floorId === floorId && x.status !== 'resolved');
    this.notify(`REMINDER ${this.state.building.name} Floor ${floorId}: ${a ? (a.kind === 'offline' ? 'sensor offline' : LEAKS[a.kind].label) : 'check flow'} still needs attention.`);
    if (a) a.actions.push({ t: this.state.minute, text: `Alert re-sent to ${this.state.settings.contacts.length} contact(s) via SMS + email`, by: this.state.user || 'Operator' });
    this.set({ alerts: [...this.state.alerts], notifications: [...this.state.notifications] });
    this.ui({ tone: 'info', title: 'Alert re-sent', text: `SMS + email to ${this.state.settings.contacts.map(c => c.name).join(', ')}` });
  }

  // ── simulation lab ───────────────────────────────────────────────────────
  inject(floorId: number, type: LeakType) {
    const [a, c] = LEAKS[type].lpm;
    const lpm = +(a + this.rand() * (c - a)).toFixed(2);
    this.set({ floors: this.state.floors.map(f => f.id === floorId ? { ...f, leak: { type, lpm, since: this.state.minute } } : f) });
    this.ui({ tone: 'info', title: `Injected: ${LEAKS[type].label} on Floor ${floorId}`, text: `${lpm} L/min extra — watch the AI pick it up` });
  }
  private injectRandom() {
    const candidates = this.state.floors.filter(f => !f.leak && f.valveOpen && !f.offline);
    if (!candidates.length) return;
    const f = candidates[Math.floor(this.rand() * candidates.length)];
    const types: LeakType[] = ['drip', 'toilet', 'tap', 'burst'];
    const type = types[Math.floor(this.rand() * (this.rand() < 0.7 ? 3 : 4))];
    const [a, c] = LEAKS[type].lpm;
    f.leak = { type, lpm: +(a + this.rand() * (c - a)).toFixed(2), since: this.state.minute };
  }
  clearLeak(floorId: number) { this.set({ floors: this.state.floors.map(f => f.id === floorId ? { ...f, leak: undefined } : f) }); }
  setOffline(floorId: number, offline: boolean) {
    this.set({ floors: this.state.floors.map(f => f.id === floorId ? { ...f, offline, status: offline ? 'offline' : 'normal' } : f) });
    if (!offline) {
      const alerts = this.state.alerts.map(a => a.floorId === floorId && a.kind === 'offline' && a.status !== 'resolved' ? { ...a, status: 'resolved' as const, resolvedAt: this.state.minute, actions: [...a.actions, { t: this.state.minute, text: 'Heartbeat restored', by: 'System' }] } : a);
      this.set({ alerts });
    }
  }
  updateSettings(p: Partial<Settings>) { this.set({ settings: { ...this.state.settings, ...p } }); this.save(true); }
  updateBaselines(b: Baselines) { this.set({ building: { ...this.state.building, baselines: b } }); this.save(true); this.bootstrap(false); }

  /** percentile of a feature value within this floor's normal training data */
  percentile(floorId: number, feature: number, value: number) {
    const col = this.rt[floorId - 1]?.sortedCols[feature];
    if (!col) return 0;
    let lo = 0, hi = col.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (col[m] <= value) lo = m + 1; else hi = m; }
    return lo / col.length;
  }
  contributions(floorId: number): number[] {
    const r = this.rt[floorId - 1], f = this.state.floors[floorId - 1];
    return r && f?.features.length ? r.model.featureContributions(f.features) : [];
  }
  /** export the training dataset (one floor) as CSV rows */
  trainingCsv(floorId: number) {
    const f = this.state.floors[floorId - 1];
    const d = generateDataset({ baselines: this.state.building.baselines, occupancy: f?.occupancy ?? 1, days: 1, seed: 1000 + floorId - 1 });
    return d.X.map((x, i) => ({ minute: d.minutes[i], flow_lpm: d.flows[i].toFixed(2), ...Object.fromEntries(FEATURES.map((ft, j) => [ft.key, x[j].toFixed(4)])), label: d.y[i] }));
  }
}

export const system = new WlrmsSystem();
export { fmtT, slotOf, LEAKS, FEATURES };
export type { LeakType, Baselines };
