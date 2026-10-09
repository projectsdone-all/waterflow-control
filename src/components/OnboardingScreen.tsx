import React, { useState } from 'react';
import { useSystem } from '../context/SystemContext';
import { ArrowLeft, ArrowRight, Info } from 'lucide-react';

export const OnboardingScreen: React.FC = () => {
  const { sys, setScreen } = useSystem();
  
  const [buildingName, setBuildingName] = useState('Sunrise Apartments');
  const [numFloors, setNumFloors] = useState(5);
  const [buildingType, setBuildingType] = useState('Residential Apartment');
  const [location, setLocation] = useState('Mangaluru, Karnataka');
  
  const [morningBaseline, setMorningBaseline] = useState(150);
  const [afternoonBaseline, setAfternoonBaseline] = useState(60);
  const [eveningBaseline, setEveningBaseline] = useState(120);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setScreen('dashboard');
    sys.completeOnboarding({
      name: buildingName,
      numFloors,
      type: buildingType,
      location,
      baselines: {
        morning: morningBaseline,
        afternoon: afternoonBaseline,
        evening: eveningBaseline
      }
    });
  };

  return (
    <div className="login-container"> {/* Reuses login backdrop centering */}
      <div className="glow-sphere sphere-top-right"></div>
      <div className="glow-sphere sphere-bottom-left"></div>

      <div className="onboarding-container">
        <div className="onboarding-card">
          <header className="progress-header">
            <span className="font-xs font-bold text-secondary text-uppercase tracking-wider">Step 2 of 3 — Building Configuration</span>
            <div className="progress-steps">
              <span className="progress-step-indicator active"></span>
              <span className="progress-step-indicator active"></span>
              <span className="progress-step-indicator"></span>
            </div>
          </header>

          <h2 className="onboarding-title">Tell us about your building</h2>
          <p className="onboarding-subtitle">
            This helps us learn your water usage patterns and detect anomalies accurately.
          </p>

          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="bname">Building Name</label>
                <input
                  type="text"
                  id="bname"
                  className="form-input"
                  value={buildingName}
                  onChange={(e) => setBuildingName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="floors">Number of Floors</label>
                <select
                  id="floors"
                  className="form-input"
                  value={numFloors}
                  onChange={(e) => setNumFloors(Number(e.target.value))}
                  required
                >
                  <option value={3}>3 Floors</option>
                  <option value={5}>5 Floors</option>
                  <option value={8}>8 Floors</option>
                  <option value={10}>10 Floors</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="btype">Building Type</label>
                <input
                  type="text"
                  id="btype"
                  className="form-input"
                  value={buildingType}
                  onChange={(e) => setBuildingType(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="loc">City / Location</label>
                <input
                  type="text"
                  id="loc"
                  className="form-input"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="baseline-section-title">
              <label className="form-label">Expected Water Usage Baselines (Per Time Slot)</label>
            </div>

            <div className="baseline-slots">
              <div className="baseline-slot-card">
                <p className="slot-name">Morning</p>
                <p className="slot-time">6 – 10 AM</p>
                <div className="slot-input-wrapper">
                  <input
                    type="number"
                    className="slot-input"
                    value={morningBaseline}
                    onChange={(e) => setMorningBaseline(Number(e.target.value))}
                    min="1"
                    required
                  />
                  <span className="slot-unit">L/hr</span>
                </div>
              </div>

              <div className="baseline-slot-card">
                <p className="slot-name">Afternoon</p>
                <p className="slot-time">10 AM – 6 PM</p>
                <div className="slot-input-wrapper">
                  <input
                    type="number"
                    className="slot-input"
                    value={afternoonBaseline}
                    onChange={(e) => setAfternoonBaseline(Number(e.target.value))}
                    min="1"
                    required
                  />
                  <span className="slot-unit">L/hr</span>
                </div>
              </div>

              <div className="baseline-slot-card">
                <p className="slot-name">Evening</p>
                <p className="slot-time">6 – 11 PM</p>
                <div className="slot-input-wrapper">
                  <input
                    type="number"
                    className="slot-input"
                    value={eveningBaseline}
                    onChange={(e) => setEveningBaseline(Number(e.target.value))}
                    min="1"
                    required
                  />
                  <span className="slot-unit">L/hr</span>
                </div>
              </div>
            </div>

            <div className="ai-learning-banner">
              <Info size={16} />
              <span>AI Learning Mode: Isolation Forest model refines baselines automatically over the first 2 weeks.</span>
            </div>

            <div className="onboarding-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setScreen('login')}
              >
                <ArrowLeft size={16} />
                <span>Back</span>
              </button>

              <button type="submit" className="btn-primary">
                <span>Save &amp; Open Dashboard</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
