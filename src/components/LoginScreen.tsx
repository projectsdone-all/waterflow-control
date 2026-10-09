import React, { useState } from 'react';
import { useSystem } from '../context/SystemContext';
import { LogIn, HelpCircle } from 'lucide-react';

export const LoginScreen: React.FC = () => {
  const { sys, s, setScreen } = useSystem();
  const [err, setErr] = useState('');
  const [email, setEmail] = useState('ramesh@sunriseapts.in');
  const [password, setPassword] = useState('password123');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) return setErr('Enter a valid email address.');
    if (password.length < 6) return setErr('Password must be at least 6 characters.');
    sys.login(email);
    setScreen(s.onboarded ? 'dashboard' : 'onboarding');
  };

  return (
    <div className="login-container">
      {/* Background ambient glowing spheres */}
      <div className="glow-sphere sphere-top-right"></div>
      <div className="glow-sphere sphere-bottom-left"></div>

      <div className="login-card">
        <div className="login-logo">WL</div>
        <h2 className="login-title">WLRMS</h2>
        <p className="login-subtitle text-center">Water Leakage Risk Monitoring System</p>
        
        <form onSubmit={handleSubmit} className="text-left">
          <div className="form-group">
            <label className="form-label" htmlFor="email-address">Email Address</label>
            <input
              type="email"
              id="email-address"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@building.com"
              required
            />
          </div>
          
          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              required
            />
          </div>
          
          {err && <div className="form-error">{err}</div>}
          <button type="submit" className="btn-primary w-full btn-large" style={{ width: '100%', justifyContent: 'center' }}>
            <span>Sign in to Dashboard</span>
            <LogIn size={16} />
          </button>
        </form>

        <p className="login-footer-text">
          New building? <a href="#register" onClick={(e) => { e.preventDefault(); setErr('Demo mode: any email and a 6+ character password will sign you in.'); }} className="login-link">Register here</a>
        </p>

        {/* Informational tech badge mirroring the design spec annotations */}
        <div className="tech-tag" style={{ marginTop: '2rem', justifyContent: 'center', borderColor: 'rgba(6,182,212,0.3)', color: 'var(--accent-cyan)' }}>
          <HelpCircle size={12} />
          <span>Demo login · any email + 6-char password</span>
        </div>
      </div>
    </div>
  );
};
