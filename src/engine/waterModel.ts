// ─────────────────────────────────────────────────────────────────────────────
// Water usage + sensor model
//
// Each floor's branch pipe has a YF-S201 hall-effect flow sensor:
//     pulse frequency F (Hz) = 7.5 × Q (L/min)
// The ESP32 counts pulses and publishes one reading per minute over MQTT.
//
// Normal household demand is generated as discrete usage EVENTS (taps,
// flushes, showers, kitchen, washing machine) whose average volume per hour
// follows the building's onboarding baselines for each time slot. Real usage
// is intermittent — the pipe is idle most of the time. A leak breaks that
// pattern: flow never returns to zero. That is what the model learns.
// ─────────────────────────────────────────────────────────────────────────────
import { mulberry32 } from './isolationForest';

export interface Baselines { morning: number; afternoon: number; evening: number } // L/hr per floor

export type LeakType = 'burst' | 'tap' | 'toilet' | 'drip';
export const LEAKS: Record<LeakType, { label: string; desc: string; lpm: [number, number]; icon: string }> = {
  burst: { label: 'Pipe burst', desc: 'Sudden pipe rupture — very high continuous flow', lpm: [24, 34], icon: '💥' },
  tap: { label: 'Tap left open', desc: 'Medium continuous flow for hours', lpm: [4, 7], icon: '🚰' },
  toilet: { label: 'Running toilet', desc: 'Faulty flush valve, steady trickle', lpm: [1.2, 2.2], icon: '🚽' },
  drip: { label: 'Hidden slow leak', desc: 'Concealed pipe seepage, never stops', lpm: [0.35, 0.7], icon: '💧' },
};

/** Guess the leak signature from the excess continuous flow (L/min) */
export function classifyLeak(excessLpm: number): LeakType {
  if (excessLpm >= 15) return 'burst';
  if (excessLpm >= 3) return 'tap';
  if (excessLpm >= 0.9) return 'toilet';
  return 'drip';
}

interface UsageEvent { lpm: number; minutesLeft: number }
const EVENT_TYPES = [
  { name: 'tap', p: 0.46, lpm: [3, 6], dur: [1, 2] },
  { name: 'flush', p: 0.26, lpm: [5, 7], dur: [1, 1] },
  { name: 'kitchen', p: 0.14, lpm: [4, 7], dur: [1, 4] },
  { name: 'shower', p: 0.1, lpm: [7, 11], dur: [5, 10] },
  { name: 'washer', p: 0.04, lpm: [8, 12], dur: [3, 6] },
];
const MEAN_EVENT_L = EVENT_TYPES.reduce((s, e) => s + e.p * ((e.lpm[0] + e.lpm[1]) / 2) * ((e.dur[0] + e.dur[1]) / 2), 0);

/** Expected L/hr for a floor at a given minute-of-day, smoothly following the slot baselines */
export function expectedLph(b: Baselines, minuteOfDay: number, occupancy = 1): number {
  const h = minuteOfDay / 60;
  const night = Math.max(2, b.afternoon * 0.04);
  // anchor points (hour → L/hr) with linear interpolation between them
  const pts: [number, number][] = [
    [0, night], [5, night], [6.5, b.morning], [9.5, b.morning], [10.5, b.afternoon],
    [17.5, b.afternoon], [18.5, b.evening], [22.5, b.evening], [23.5, night], [24, night],
  ];
  for (let i = 1; i < pts.length; i++) {
    if (h <= pts[i][0]) {
      const [h0, v0] = pts[i - 1], [h1, v1] = pts[i];
      return (v0 + (v1 - v0) * ((h - h0) / (h1 - h0))) * occupancy;
    }
  }
  return night * occupancy;
}

export function slotOf(minuteOfDay: number): 'morning' | 'afternoon' | 'evening' | 'night' {
  const h = minuteOfDay / 60;
  if (h >= 6 && h < 10) return 'morning';
  if (h >= 10 && h < 18) return 'afternoon';
  if (h >= 18 && h < 23) return 'evening';
  return 'night';
}

/** Generates one floor's normal consumption minute by minute */
export class FloorUsage {
  private events: UsageEvent[] = [];
  private rand: () => number;
  baselines: Baselines;
  occupancy: number;
  constructor(baselines: Baselines, occupancy: number, seed: number) { this.baselines = baselines; this.occupancy = occupancy; this.rand = mulberry32(seed); }

  private poisson(lambda: number) {
    let L = Math.exp(-lambda), k = 0, p = 1;
    do { k++; p *= this.rand(); } while (p > L);
    return k - 1;
  }

  /** Normal (leak-free) flow for the next minute, L/min */
  next(minuteOfDay: number): number {
    const lph = expectedLph(this.baselines, minuteOfDay, this.occupancy);
    const lambda = lph / 60 / MEAN_EVENT_L; // events per minute
    const n = this.poisson(lambda);
    for (let i = 0; i < n; i++) {
      let r = this.rand(), t = EVENT_TYPES[0];
      for (const e of EVENT_TYPES) { if (r < e.p) { t = e; break; } r -= e.p; }
      const lpm = t.lpm[0] + this.rand() * (t.lpm[1] - t.lpm[0]);
      const dur = Math.round(t.dur[0] + this.rand() * (t.dur[1] - t.dur[0]));
      this.events.push({ lpm, minutesLeft: Math.max(1, dur) });
    }
    let flow = 0;
    for (const e of this.events) { flow += e.lpm; e.minutesLeft--; }
    this.events = this.events.filter(e => e.minutesLeft > 0);
    return flow;
  }
}

// ── feature engineering ─────────────────────────────────────────────────────
export const FEATURES = [
  { key: 'mean15', label: '15-min average flow', unit: 'log L/min', why: 'Short-term consumption level' },
  { key: 'min15', label: '15-min minimum flow', unit: 'log L/min', why: 'Normal pipes go idle between uses; a leak never drops to zero' },
  { key: 'min60', label: '60-min minimum flow', unit: 'log L/min', why: 'Even a slow hidden leak keeps a floor of flow for a whole hour' },
  { key: 'contMin', label: 'Continuous-flow duration', unit: 'log min', why: 'How long water has flowed without a single break' },
  { key: 'ratio60', label: '60-min usage vs baseline', unit: 'log ×', why: 'Last hour compared with what this time slot normally uses' },
  { key: 'hourSin', label: 'Time of day (sin)', unit: '', why: 'Usage depends on time of day' },
  { key: 'hourCos', label: 'Time of day (cos)', unit: '', why: 'Usage depends on time of day' },
] as const;

/** Rolling window that turns raw per-minute readings into model features (preprocessing) */
export class FeatureWindow {
  private buf: number[] = [];
  private cont = 0;
  push(flow: number) {
    this.buf.push(flow);
    if (this.buf.length > 60) this.buf.shift();
    this.cont = flow > 0.1 ? this.cont + 1 : 0;
  }
  reset() { this.buf = []; this.cont = 0; }
  get continuousMinutes() { return this.cont; }
  get recent() { return this.buf; }
  features(b: Baselines, minuteOfDay: number, occupancy: number): number[] {
    const last15 = this.buf.slice(-15);
    const mean15 = last15.reduce((a, c) => a + c, 0) / Math.max(1, last15.length);
    const min15 = last15.length ? Math.min(...last15) : 0;
    const min60 = this.buf.length ? Math.min(...this.buf) : 0;
    const vol60 = this.buf.reduce((a, c) => a + c, 0);
    let exp60 = 0;
    for (let i = 0; i < this.buf.length; i++) exp60 += expectedLph(b, (minuteOfDay - i + 1440) % 1440, occupancy) / 60;
    const ratio60 = vol60 / Math.max(5, exp60);
    const ang = (minuteOfDay / 1440) * Math.PI * 2;
    return [Math.log1p(mean15), Math.log1p(min15 * 4), Math.log1p(min60 * 4), Math.log1p(Math.min(this.cont, 720)), Math.log1p(Math.min(ratio60, 40)), Math.sin(ang), Math.cos(ang)];
  }
}

/** Generate a labelled dataset: normal days, optionally with injected leaks */
export function generateDataset(opts: {
  baselines: Baselines; occupancy: number; days: number; seed: number;
  leaks?: { start: number; duration: number; type: LeakType; lpm: number }[]; startMinute?: number;
}) {
  const usage = new FloorUsage(opts.baselines, opts.occupancy, opts.seed);
  const win = new FeatureWindow();
  const X: number[][] = [], y: number[] = [], flows: number[] = [], minutes: number[] = [], types: (LeakType | null)[] = [];
  const total = opts.days * 1440;
  const start = opts.startMinute ?? 0;
  for (let i = 0; i < total; i++) {
    const mod = (start + i) % 1440;
    let flow = usage.next(mod);
    const leak = opts.leaks?.find(l => i >= l.start && i < l.start + l.duration);
    if (leak) flow += leak.lpm;
    win.push(flow);
    if (i >= 60) {
      X.push(win.features(opts.baselines, mod, opts.occupancy));
      y.push(leak ? 1 : 0);
      types.push(leak ? leak.type : null);
      flows.push(flow);
      minutes.push(i);
    }
  }
  return { X, y, flows, minutes, types };
}
