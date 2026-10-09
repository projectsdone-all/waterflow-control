# WLRMS — Water Leakage Risk Monitoring System

AI-based real-time water leak detection for apartments and hostels. Major project, B.E. Computer Science.

Leaks are normally discovered only at monthly billing. WLRMS monitors every floor's branch pipe, learns what normal use looks like, and raises an alert within minutes — and can close the floor's valve automatically.

## Run locally

1. npm install
2. npm run dev
3. Open http://localhost:5173 — any email and a 6+ character password signs in

## Deploy on Vercel

1. Push this folder to a GitHub repo
2. Vercel → Add New Project → import the repo
3. Framework is detected as Vite → Deploy

## Architecture

1. Sensing — YF-S201 hall-effect flow sensor per floor (Q = F ÷ 7.5 L/min), HC-SR04 tank level sensor
2. Edge — ESP32 counts pulses and publishes one reading per minute over MQTT; drives a solenoid valve relay per floor
3. Preprocessing — 60-minute rolling window per floor, log transforms
4. Features — 15-min average, 15-min minimum, 60-min minimum, continuous-flow duration, 60-min usage vs baseline, time of day (sin/cos)
5. Model — Isolation Forest (100 trees, sample size 256), one model per floor, implemented from scratch in TypeScript
6. Decision — auto-calibrated threshold (99th percentile of normal scores) + 3-reading debounce + 20-minute "flow never stopped" gate + burst safety rule + MQTT heartbeat
7. Action — SMS / email / in-app alert, manual or automatic valve shut-off, incident log

## Results (built-in hold-out evaluation)

1. All injected leak incidents detected (pipe burst, tap left open, running toilet, hidden slow leak)
2. Precision ≈ 99.8 %, F1 ≈ 0.91 per minute
3. Average time to detect — burst ~2 min, tap ~18 min, running toilet ~23 min, slow drip ~36 min
4. ~0.4 false alarms per floor per day

Numbers are recomputed live on the AI Model page every time the model is trained.

## Screens

1. Cover — hardware connection diagram
2. Login and building onboarding (floors, usage baselines per time slot)
3. Overview — live floor flows, AI scores, tank level, alerts feed, MQTT stream
4. Floor detail — flow and score charts, gauge, "why the AI flagged this", sensor diagnostics, incident timeline, valve controls
5. Alerts — incident log with water lost / saved, notifications sent, CSV export
6. Analytics — 30-day usage, per-floor averages, leak losses in litres and rupees, CSV export
7. AI Model — pipeline, dataset strategy, feature statistics, score histogram, confusion matrix, per-leak-type detection, retraining
8. Simulation Lab — inject burst / tap / toilet / drip / sensor-offline faults, speed up time
9. Settings — sensitivity, debounce, persistence gate, burst rule, auto shut-off, tariff, baselines, alert contacts

## Code

1. src/engine/isolationForest.ts — Isolation Forest
2. src/engine/waterModel.ts — usage model, leak types, feature engineering, dataset generator
3. src/engine/system.ts — runtime: sensors, MQTT, detection, alerts, valves, evaluation
4. src/components — screens
