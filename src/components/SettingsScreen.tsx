import React, { useState } from 'react';
import { useSystem } from '../context/SystemContext';
import { Layout, Panel } from './ui';
import { Bell, Shield, Users, Building2, Plus, Trash2 } from 'lucide-react';

const Switch: React.FC<{ on: boolean; set: (v: boolean) => void }> = ({ on, set }) => <button className={`switch ${on ? 'on' : ''}`} onClick={() => set(!on)} />;

export const SettingsScreen: React.FC = () => {
  const { s, sys } = useSystem();
  const st = s.settings;
  const [b, setB] = useState(s.building.baselines);
  const [contact, setContact] = useState({ name: '', phone: '', email: '' });
  const seg = (vals: number[], cur: number, on: (v: number) => void, fmt = (v: number) => String(v)) => (
    <div className="seg">{vals.map(v => <button key={v} className={cur === v ? 'on' : ''} onClick={() => on(v)}>{fmt(v)}</button>)}</div>
  );
  return (
    <Layout>
      <header className="dashboard-header"><div className="header-title-area"><h2>Settings</h2><p>Detection sensitivity, automatic protection, contacts and tariff</p></div></header>
      <div className="analytics-grid-top">
        <Panel title="Detection" icon={<Shield size={18} className="aqua-icon" />}>
          <div className="set-row"><div><div className="n">Sensitivity (contamination)</div><div className="d">Expected share of anomalous minutes. Lower = fewer false alarms, slower detection. Retrains the models.</div></div>
            {seg([0.005, 0.01, 0.02], st.contamination, v => { sys.updateSettings({ contamination: v }); sys.retrain({}); }, v => `${v * 100}%`)}</div>
          <div className="set-row"><div><div className="n">Debounce</div><div className="d">Consecutive anomalous readings before an alert is raised</div></div>{seg([1, 3, 5], st.debounce, v => sys.updateSettings({ debounce: v }), v => `${v} min`)}</div>
          <div className="set-row"><div><div className="n">Persistence gate</div><div className="d">Only alert if flow has not stopped for this long — removes false alarms from busy periods</div></div>{seg([0, 10, 20, 30], st.gateMin, v => sys.updateSettings({ gateMin: v }), v => v ? `${v} min` : 'off')}</div>
          <div className="set-row"><div><div className="n">Burst safety rule</div><div className="d">Instant alert when flow stays ≥ {st.burstLpm} L/min for 3 readings</div></div><Switch on={st.burstRule} set={v => sys.updateSettings({ burstRule: v })} /></div>
          <div className="set-row"><div><div className="n">Automatic shut-off</div><div className="d">Close the floor valve if an alert is not handled in time</div></div><Switch on={st.autoShutoff} set={v => sys.updateSettings({ autoShutoff: v })} /></div>
          {st.autoShutoff && <div className="set-row"><div><div className="n">Shut-off after</div></div>{seg([10, 20, 30, 60], st.autoShutoffMin, v => sys.updateSettings({ autoShutoffMin: v }), v => `${v} min`)}</div>}
        </Panel>
        <Panel title="Building & tariff" icon={<Building2 size={18} className="aqua-icon" />}>
          <div className="set-row"><div><div className="n">Water tariff</div><div className="d">Used for all ₹ cost figures</div></div>{seg([25, 40, 55, 75], st.tariffPerKL, v => sys.updateSettings({ tariffPerKL: v }), v => `₹${v}/kL`)}</div>
          <label className="form-label" style={{ marginTop: 12 }}>Usage baselines per floor (L/hr) — changing these retrains the AI</label>
          <div className="baseline-edit">
            {(['morning', 'afternoon', 'evening'] as const).map(k => (
              <div key={k}><span className="font-xs text-secondary" style={{ textTransform: 'capitalize' }}>{k}</span><input type="number" className="form-input" value={b[k]} onChange={e => setB({ ...b, [k]: Math.max(5, +e.target.value || 0) })} /></div>
            ))}
          </div>
          <button className="btn-secondary" style={{ marginTop: 10 }} disabled={JSON.stringify(b) === JSON.stringify(s.building.baselines)} onClick={() => sys.updateBaselines(b)}>Save & retrain</button>
          <div className="set-row" style={{ marginTop: 14 }}><div><div className="n">Browser notifications</div><div className="d">Pop-up alerts even when this tab is in the background</div></div>
            <Switch on={st.browserNotify} set={v => { if (v && 'Notification' in window) Notification.requestPermission(); sys.updateSettings({ browserNotify: v }); }} /></div>
        </Panel>
      </div>
      <Panel title="Alert contacts (SMS + email)" icon={<Users size={18} className="aqua-icon" />} style={{ marginTop: '1.5rem' }}>
        <table className="anomaly-table">
          <thead><tr><th>Name</th><th>Phone</th><th>Email</th><th /></tr></thead>
          <tbody>
            {st.contacts.map((c, i) => <tr key={i}><td>{c.name}</td><td>{c.phone}</td><td>{c.email}</td><td><button className="icon-btn sm" onClick={() => sys.updateSettings({ contacts: st.contacts.filter((_, j) => j !== i) })}><Trash2 size={14} /></button></td></tr>)}
            <tr>
              <td><input className="form-input sm" placeholder="Name" value={contact.name} onChange={e => setContact({ ...contact, name: e.target.value })} /></td>
              <td><input className="form-input sm" placeholder="+91…" value={contact.phone} onChange={e => setContact({ ...contact, phone: e.target.value })} /></td>
              <td><input className="form-input sm" placeholder="name@mail.com" value={contact.email} onChange={e => setContact({ ...contact, email: e.target.value })} /></td>
              <td><button className="icon-btn sm" disabled={!contact.name || (!contact.phone && !contact.email)} onClick={() => { sys.updateSettings({ contacts: [...st.contacts, contact] }); setContact({ name: '', phone: '', email: '' }); }}><Plus size={14} /></button></td>
            </tr>
          </tbody>
        </table>
        <div className="font-xs text-secondary" style={{ marginTop: 8 }}><Bell size={12} style={{ display: 'inline', verticalAlign: -2 }} /> In this demo messages are logged under Alerts → Notifications sent. In production they go through an SMS gateway (e.g. Twilio / MSG91) and SMTP.</div>
      </Panel>
    </Layout>
  );
};
