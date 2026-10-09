import React from 'react';
import { useSystem } from '../context/SystemContext';
import { ShieldCheck, Cpu, Brain, Activity, ArrowRight } from 'lucide-react';

export const CoverScreen: React.FC = () => {
  const { setScreen, s } = useSystem();

  return (
    <div className="cover-container">
      {/* Background ambient glowing spheres */}
      <div className="glow-sphere sphere-top-right"></div>
      <div className="glow-sphere sphere-bottom-left"></div>

      <div className="cover-content">
        <header className="cover-header">
          <div className="project-badge">
            <span className="badge-tag">B.E. Computer Science</span>
            <span className="badge-divider">|</span>
            <span className="badge-type">Major Academic Project</span>
          </div>
          
          <h1 className="cover-title">
            Water Leakage <br />
            <span className="gradient-text">Risk Monitoring</span> System
          </h1>

          <p className="cover-subtitle">
            WLRMS · AI-based real-time leak detection for apartments &amp; hostels
          </p>

          <div className="tech-tags">
            <span className="tech-tag"><Cpu size={14} /> ESP32 + Sensors</span>
            <span className="tech-tag"><Brain size={14} /> Isolation Forest ML</span>
            <span className="tech-tag"><Activity size={14} /> React Dashboard</span>
            <span className="tech-tag"><ShieldCheck size={14} /> Real-Time Alerts</span>
          </div>
        </header>

        <section className="architecture-preview">
          <h3 className="section-title text-center font-md">Hardware Connection Architecture (5-Floor Standard)</h3>
          
          {/* Interactive SVG Hardware Diagram */}
          <div className="diagram-container">
            <svg viewBox="0 0 850 500" className="hardware-svg">
              <defs>
                <linearGradient id="tankGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#0891b2" />
                  <stop offset="100%" stopColor="#0e7490" />
                </linearGradient>
                <linearGradient id="cloudGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#1e3a8a" />
                  <stop offset="100%" stopColor="#1e40af" />
                </linearGradient>
                <filter id="glow" x="-10%" y="-10%" width="120%" height="120%">
                  <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.5" />
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Water Tank */}
              <rect x="80" y="40" width="200" height="70" rx="8" fill="url(#tankGrad)" stroke="#06b6d4" strokeWidth="2" />
              <text x="180" y="70" textAnchor="middle" fill="#ffffff" fontWeight="bold" fontSize="14">WATER TANK</text>
              <text x="180" y="90" textAnchor="middle" fill="#e0f2fe" fontSize="10">Overhead Storage</text>
              
              {/* Level Sensor Box */}
              <rect x="90" y="20" width="130" height="20" rx="3" fill="#1e293b" stroke="#10b981" strokeWidth="1" />
              <text x="155" y="33" textAnchor="middle" fill="#10b981" fontSize="9" fontWeight="bold">HC-SR04 Level Sensor</text>

              {/* Main Vertical Water Pipe with flowing water effect */}
              <line x1="180" y1="110" x2="180" y2="460" stroke="#0ea5e9" strokeWidth="6" />
              <line x1="180" y1="110" x2="180" y2="460" stroke="#a5f3fc" strokeWidth="2.5" className="flowing-pipe" />
              
              {/* Floors Pipe Branches & Building Frame */}
              {[
                { y: 150, label: 'F1', sensor: 'normal', gpio: 'GPIO 25', color: '#10b981' },
                { y: 210, label: 'F2', sensor: 'normal', gpio: 'GPIO 33', color: '#10b981' },
                { y: 270, label: 'F3', sensor: 'normal', gpio: 'GPIO 32', color: '#10b981' },
                { y: 330, label: 'F4', sensor: 'normal', gpio: 'GPIO 35', color: '#10b981' },
                { y: 390, label: 'F5 (Anomaly)', sensor: 'anomaly', gpio: 'GPIO 34', color: '#ef4444', animated: true }
              ].map((floor, idx) => (
                <g key={idx}>
                  {/* Floor line / ceiling */}
                  <line x1="40" y1={floor.y + 40} x2="320" y2={floor.y + 40} stroke="#334155" strokeWidth="1" strokeDasharray="4 4" />
                  
                  {/* Building window boxes */}
                  <rect x="50" y={floor.y - 15} width="35" height="30" rx="2" fill="#1e293b" stroke="#475569" strokeWidth="1" />
                  <rect x="90" y={floor.y - 15} width="35" height="30" rx="2" fill="#1e293b" stroke="#475569" strokeWidth="1" />
                  
                  <rect x="220" y={floor.y - 15} width="35" height="30" rx="2" fill="#1e293b" stroke="#475569" strokeWidth="1" />
                  <rect x="260" y={floor.y - 15} width="35" height="30" rx="2" fill="#1e293b" stroke="#475569" strokeWidth="1" />

                  {/* Highlight floor 5 in alert red background */}
                  {floor.sensor === 'anomaly' && (
                    <rect x="40" y={floor.y - 25} width="280" height="60" fill="#ef4444" fillOpacity="0.08" stroke="#ef4444" strokeWidth="1" rx="4" />
                  )}

                  {/* Pipe branch with animation */}
                  <line x1="180" y1={floor.y} x2="340" y2={floor.y} stroke="#0ea5e9" strokeWidth="4" />
                  <line 
                    x1="180" 
                    y1={floor.y} 
                    x2="340" 
                    y2={floor.y} 
                    stroke={floor.sensor === 'anomaly' ? '#fda4af' : '#a5f3fc'} 
                    strokeWidth="1.5" 
                    className={floor.sensor === 'anomaly' ? 'flowing-pipe-alert' : 'flowing-pipe'} 
                  />

                  {/* Flow Sensor */}
                  <rect x="340" y={floor.y - 12} width="80" height="24" rx="4" fill="#1e293b" stroke={floor.color} strokeWidth="2" className={floor.animated ? 'pulse-border' : ''} />
                  <text x="380" y="4" transform={`translate(0, ${floor.y})`} textAnchor="middle" fill={floor.color} fontSize="9" fontWeight="bold">YF-S201</text>
                  
                  {/* Floor Label */}
                  <text x="310" y={floor.y - 5} fill="#94a3b8" fontSize="10" fontWeight="bold">{floor.label}</text>

                  {/* Signal Wires (running from sensor to ESP32 Control Box) */}
                  {/* Signal wires have a slight curve to the right control box */}
                  <path d={`M 420 ${floor.y} Q 460 ${floor.y}, 490 ${320 + (idx - 2) * 20}`} stroke="#fbbf24" strokeWidth="1.5" fill="none" opacity="0.8" />
                </g>
              ))}

              {/* ESP32 Control Box */}
              <rect x="480" y="240" width="220" height="150" rx="8" fill="#111827" stroke="#3b82f6" strokeWidth="2" />
              <text x="590" y="270" textAnchor="middle" fill="#ffffff" fontWeight="bold" fontSize="13">ESP32 Control Box</text>
              <text x="590" y="285" textAnchor="middle" fill="#94a3b8" fontSize="9">Ground Floor Electrical Room</text>

              {/* GPIO Mapping Labels */}
              <g fontSize="8" fill="#94a3b8" fontWeight="bold">
                <rect x="495" y="305" width="90" height="18" rx="2" fill="#1f2937" />
                <text x="500" y="317" fill="#fbbf24">GPIO 34 &rarr; Floor 5</text>
                
                <rect x="495" y="330" width="90" height="18" rx="2" fill="#1f2937" />
                <text x="500" y="342" fill="#94a3b8">GPIO 32 &rarr; Floor 3</text>

                <rect x="495" y="355" width="90" height="18" rx="2" fill="#1f2937" />
                <text x="500" y="367" fill="#94a3b8">GPIO 25 &rarr; Floor 1</text>

                <rect x="600" y="305" width="90" height="18" rx="2" fill="#1f2937" />
                <text x="605" y="317" fill="#94a3b8">GPIO 35 &rarr; Floor 4</text>

                <rect x="600" y="330" width="90" height="18" rx="2" fill="#1f2937" />
                <text x="605" y="342" fill="#94a3b8">GPIO 33 &rarr; Floor 2</text>
              </g>

              {/* WiFi connection arrow */}
              <line x1="700" y1="315" x2="740" y2="315" stroke="#06b6d4" strokeWidth="2" strokeDasharray="3 3" />
              <polygon points="740,311 748,315 740,319" fill="#06b6d4" />

              {/* Cloud Server Box */}
              <rect x="740" y="250" width="100" height="130" rx="8" fill="url(#cloudGrad)" stroke="#1d4ed8" strokeWidth="1.5" />
              <text x="790" y="275" textAnchor="middle" fill="#ffffff" fontWeight="bold" fontSize="10">Cloud Server</text>
              <text x="790" y="295" textAnchor="middle" fill="#67e8f9" fontSize="8" fontWeight="bold">MQTT + AI Engine</text>
              <text x="790" y="315" textAnchor="middle" fill="#e2e8f0" fontSize="7">Isolation Forest ML</text>
              <text x="790" y="330" textAnchor="middle" fill="#e2e8f0" fontSize="7">Dashboard + Alerts</text>
              <text x="790" y="355" textAnchor="middle" fill="#f8fafc" fontSize="7" fontWeight="bold">WiFi / MQTT</text>
            </svg>
          </div>

          <div className="diagram-legend">
            <span className="legend-item"><span className="legend-color water-pipe"></span> Water pipe</span>
            <span className="legend-item"><span className="legend-color vcc"></span> Power VCC (5V)</span>
            <span className="legend-item"><span className="legend-color signal"></span> Signal (GPIO)</span>
            <span className="legend-item"><span className="legend-color normal-sensor"></span> Flow Sensor (Normal)</span>
            <span className="legend-item"><span className="legend-color alert-sensor"></span> Flow Sensor (Anomaly)</span>
          </div>
        </section>

        <footer className="cover-actions">
          <button onClick={() => setScreen(s.loggedIn ? (s.onboarded ? 'dashboard' : 'onboarding') : 'login')} className="btn-primary btn-large">
            <span>Enter Monitoring Portal</span>
            <ArrowRight size={18} />
          </button>
          <p className="cover-note">Leaks are usually found only at monthly billing. WLRMS finds them in minutes — and can shut the valve automatically.</p>
        </footer>
      </div>
    </div>
  );
};
