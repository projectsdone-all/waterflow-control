import { FEATURES } from '../engine/system';

export const rupees = (v: number) => `₹${Math.round(v).toLocaleString('en-IN')}`;
export const litres = (v: number) => `${Math.round(v).toLocaleString('en-IN')} L`;

export function downloadCSV(name: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const blob = new Blob([[cols.join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\n')], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
}

// undo the log transforms from preprocessing so values read in real units
export const readable = (i: number, v: number) => {
  switch (FEATURES[i].key) {
    case 'mean15': return `${Math.expm1(v).toFixed(2)} L/min`;
    case 'min15': case 'min60': return `${(Math.expm1(v) / 4).toFixed(2)} L/min`;
    case 'contMin': return `${Math.round(Math.expm1(v))} min`;
    case 'ratio60': return `${Math.expm1(v).toFixed(2)}×`;
    default: return v.toFixed(2);
  }
};

