import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Activity,
  AlertTriangle,
  Battery,
  BatteryCharging,
  CheckCircle,
  Clock,
  Cpu,
  Database,
  Download,
  Droplets,
  Filter,
  Flame,
  Globe,
  HardDrive,
  Layers,
  Lock,
  Play,
  Power,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  ShieldAlert,
  Sliders,
  Sun,
  Trash2,
  Unlock,
  Zap
} from 'lucide-react';

export default function App() {
  // ---------------------------------------------------------------------------
  // System State & Telemetry
  // ---------------------------------------------------------------------------
  const [isOnline, setIsOnline] = useState(true);
  const [pingMs, setPingMs] = useState(24);
  const [eStopActive, setEStopActive] = useState(false);
  const [showEStopModal, setShowEStopModal] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  // Tank Telemetry
  const [waterLevelPct, setWaterLevelPct] = useState(68); // 0 - 100%
  const [valveState, setValveState] = useState(false); // false = OFF, true = ON
  const [manualOverride, setManualOverride] = useState(false);

  // Tank Physical Parameters (Settings)
  const [tankHeightCm, setTankHeightCm] = useState(200);
  const [tankRadiusCm, setTankRadiusCm] = useState(75);
  const [sensorOffsetCm, setSensorOffsetCm] = useState(15);
  const [overfillSafetyCm, setOverfillSafetyCm] = useState(10);

  // Auto Control & Hysteresis Settings
  const [autoFillEnabled, setAutoFillEnabled] = useState(true);
  const [hysteresisLow, setHysteresisLow] = useState(25); // Start fill if <= 25%
  const [hysteresisHigh, setHysteresisHigh] = useState(90); // Stop fill if >= 90%

  // Scheduled Filling Settings
  const [schedEnabled, setSchedEnabled] = useState(true);
  const [schedTime, setSchedTime] = useState('08:00');
  const [schedThresholdPct, setSchedThresholdPct] = useState(50);

  // Battery & Power System
  const [batteryVoltage, setBatteryVoltage] = useState(12.6); // 12V SLA Battery
  const [powerSource, setPowerSource] = useState('SOLAR'); // 'SOLAR', 'MAINS', 'DISCHARGING'

  // Hardware RTC
  const [hardwareTime, setHardwareTime] = useState(new Date().toISOString());

  // Event Logs State
  const [eventLogs, setEventLogs] = useState([
    { id: 1, timestamp: new Date(Date.now() - 3600000).toISOString(), code: 'LOG_EVT_BOOT', level: 'info', desc: 'System initialized successfully. ESP32-S3 firmware v2.1.4 online.' },
    { id: 2, timestamp: new Date(Date.now() - 2400000).toISOString(), code: 'LOG_EVT_SCHED_FILL_ON', level: 'action', desc: 'Scheduled fill triggered at 08:00. Tank level was 34%.' },
    { id: 3, timestamp: new Date(Date.now() - 1200000).toISOString(), code: 'LOG_EVT_FILL_STOP', level: 'action', desc: 'Solenoid valve closed. Upper target reached (90%).' }
  ]);
  const [logFilter, setLogFilter] = useState('ALL');
  const [logSearch, setLogSearch] = useState('');

  // Voltage & Level History for Canvas Charts
  const [history, setHistory] = useState(() => {
    const initial = [];
    const now = Date.now();
    for (let i = 20; i >= 0; i--) {
      initial.push({
        time: new Date(now - i * 15000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        level: Math.min(100, Math.max(10, 68 + Math.sin(i * 0.5) * 5)),
        voltage: Math.min(13.8, Math.max(10.5, 12.6 + Math.cos(i * 0.3) * 0.3))
      });
    }
    return initial;
  });

  // Simulator Drawer State
  const [simDrawerOpen, setSimDrawerOpen] = useState(false);
  const [simDrainSpeed, setSimDrainSpeed] = useState(0); // Drain % per tick
  const [simFillSpeed, setSimFillSpeed] = useState(0); // Fill % per tick

  // ---------------------------------------------------------------------------
  // Mathematical Calculations
  // ---------------------------------------------------------------------------

  // Calculated Volume in Litres
  // Cylinder Volume = PI * r^2 * h
  const calculatedVolumeLitres = useMemo(() => {
    const radiusM = tankRadiusCm / 100;
    const waterHeightM = (tankHeightCm * (waterLevelPct / 100)) / 100;
    const volumeM3 = Math.PI * Math.pow(radiusM, 2) * waterHeightM;
    return Math.round(volumeM3 * 1000); // 1 m3 = 1000 L
  }, [waterLevelPct, tankHeightCm, tankRadiusCm]);

  const maxVolumeLitres = useMemo(() => {
    const radiusM = tankRadiusCm / 100;
    const heightM = tankHeightCm / 100;
    return Math.round(Math.PI * Math.pow(radiusM, 2) * heightM * 1000);
  }, [tankHeightCm, tankRadiusCm]);

  // Battery percentage estimate for 12V Lead Acid Battery
  // 12.8V = 100%, 12.0V = 25%, 10.5V = 0%
  const batteryPct = useMemo(() => {
    if (batteryVoltage >= 12.8) return 100;
    if (batteryVoltage <= 10.5) return 0;
    return Math.round(((batteryVoltage - 10.5) / (12.8 - 10.5)) * 100);
  }, [batteryVoltage]);

  // Voltage Divider calculation helper (R1=27k, R2=12k)
  const rawAdcVoltage = useMemo(() => {
    const R1 = 27000;
    const R2 = 12000;
    return (batteryVoltage * (R2 / (R1 + R2))).toFixed(2);
  }, [batteryVoltage]);

  // Health Statuses
  const tankStatus = useMemo(() => {
    if (eStopActive) return { text: 'EMERGENCY STOP', color: 'bg-red-500/20 text-red-400 border-red-500' };
    if (waterLevelPct >= 95) return { text: 'OVERFLOW ALARM', color: 'bg-red-500/20 text-red-400 border-red-500 animate-pulse' };
    if (waterLevelPct <= hysteresisLow) return { text: 'LOW REFILL NEEDED', color: 'bg-amber-500/20 text-amber-400 border-amber-500' };
    return { text: 'SYSTEM OK', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500' };
  }, [waterLevelPct, eStopActive, hysteresisLow]);

  const batteryStatus = useMemo(() => {
    if (batteryVoltage < 11.2) return { text: 'CRITICAL', color: 'bg-red-500/20 text-red-400 border-red-500 animate-pulse' };
    if (batteryVoltage < 12.0) return { text: 'WARNING', color: 'bg-amber-500/20 text-amber-400 border-amber-500' };
    return { text: 'NORMAL', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500' };
  }, [batteryVoltage]);

  // Helper to append logs
  const logEvent = (code, level, desc) => {
    const newLog = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      code,
      level,
      desc
    };
    setEventLogs(prev => [newLog, ...prev.slice(0, 99)]); // Keep last 100
  };

  // ---------------------------------------------------------------------------
  // Master Control Loop Simulation
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const timer = setInterval(() => {
      if (!isOnline) return;

      // Random ping fluctuation
      setPingMs(Math.floor(18 + Math.random() * 15));

      // Hardware Time increment
      setHardwareTime(new Date().toISOString());

      // Adjust water level based on active valve or simulation speeds
      setWaterLevelPct(prev => {
        let delta = 0;

        // If Valve is ON and E-STOP is OFF, tank fills
        if (valveState && !eStopActive) {
          delta += 0.8;
        }

        // Apply simulator adjustments
        if (simFillSpeed > 0 && !eStopActive) delta += simFillSpeed;
        if (simDrainSpeed > 0) delta -= simDrainSpeed;

        let nextLevel = Math.min(100, Math.max(0, prev + delta));

        // Auto Overflow logic
        if (nextLevel >= 98 && prev < 98) {
          logEvent('LOG_EVT_OVERFILL', 'warning', `High water limit reached (${nextLevel.toFixed(1)}%). Safety override triggered.`);
        }

        // Hysteresis Logic (if auto fill enabled and not in manual override or E-Stop)
        if (autoFillEnabled && !manualOverride && !eStopActive) {
          if (nextLevel <= hysteresisLow && !valveState) {
            setValveState(true);
            logEvent('LOG_EVT_AUTO_FILL_ON', 'action', `Auto refill started: Water level reached lower threshold (≤${hysteresisLow}%).`);
          } else if (nextLevel >= hysteresisHigh && valveState) {
            setValveState(false);
            logEvent('LOG_EVT_FILL_STOP', 'action', `Auto refill stopped: Water level reached upper threshold (≥${hysteresisHigh}%).`);
          }
        }

        return parseFloat(nextLevel.toFixed(1));
      });

      // Update chart history periodically
      setHistory(prev => {
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const updated = [...prev.slice(1), { time: timeStr, level: waterLevelPct, voltage: batteryVoltage }];
        return updated;
      });

    }, 2000);

    return () => clearInterval(timer);
  }, [isOnline, valveState, eStopActive, simFillSpeed, simDrainSpeed, autoFillEnabled, manualOverride, hysteresisLow, hysteresisHigh, waterLevelPct, batteryVoltage]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------
  const toggleEStop = () => {
    if (!eStopActive) {
      setEStopActive(true);
      setValveState(false);
      logEvent('LOG_EVT_ESTOP_ACTIVE', 'warning', 'EMERGENCY STOP ENGAGED. Solenoid valve force-locked CLOSED.');
    } else {
      setEStopActive(false);
      logEvent('LOG_EVT_BOOT', 'info', 'EMERGENCY STOP CLEARED. System resuming normal monitoring.');
    }
    setShowEStopModal(false);
  };

  const handleManualValveToggle = () => {
    if (eStopActive) return;
    const newState = !valveState;
    setValveState(newState);
    setManualOverride(true);
    logEvent(
      newState ? 'LOG_EVT_AUTO_FILL_ON' : 'LOG_EVT_FILL_STOP',
      'action',
      `Manual command issued: Solenoid Valve turned ${newState ? 'ON' : 'OFF'}.`
    );
  };

  const syncHardwareRtc = () => {
    const nowIso = new Date().toISOString();
    setHardwareTime(nowIso);
    logEvent('LOG_EVT_BOOT', 'info', `Hardware RTC clock synced with browser host: ${nowIso}`);
  };

  const clearAllLogs = () => {
    setEventLogs([]);
  };

  const exportLogsCSV = () => {
    const headers = "Timestamp,Event Code,Level,Description\n";
    const rows = eventLogs.map(l => `"${l.timestamp}","${l.code}","${l.level}","${l.desc.replace(/"/g, '""')}"`).join("\n");
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `water_tank_logs_${Date.now()}.csv`;
    a.click();
  };

  const exportLogsJSON = () => {
    const blob = new Blob([JSON.stringify(eventLogs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `water_tank_logs_${Date.now()}.json`;
    a.click();
  };

  // ---------------------------------------------------------------------------
  // Canvas Chart Renderer
  // ---------------------------------------------------------------------------
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvas.width = width * window.devicePixelRatio || width;
    canvas.height = height * window.devicePixelRatio || height;
    ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);

    ctx.clearRect(0, 0, width, height);

    // Draw Grid
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for (let i = 0; i < width; i += 40) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, height);
      ctx.stroke();
    }
    for (let j = 0; j < height; j += 30) {
      ctx.beginPath();
      ctx.moveTo(0, j);
      ctx.lineTo(width, j);
      ctx.stroke();
    }

    if (history.length < 2) return;

    // Draw Water Level Line (Cyan)
    ctx.beginPath();
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 2.5;
    history.forEach((pt, idx) => {
      const x = (idx / (history.length - 1)) * (width - 40) + 20;
      const y = height - 20 - (pt.level / 100) * (height - 40);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Fill under cyan curve
    ctx.lineTo((history.length - 1) / (history.length - 1) * (width - 40) + 20, height - 20);
    ctx.lineTo(20, height - 20);
    ctx.fillStyle = 'rgba(6, 182, 212, 0.08)';
    ctx.fill();

    // Draw Voltage Line (Amber)
    ctx.beginPath();
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    history.forEach((pt, idx) => {
      const x = (idx / (history.length - 1)) * (width - 40) + 20;
      // Map 10V - 15V range to height
      const normalizedVolt = Math.max(0, Math.min(1, (pt.voltage - 10) / 5));
      const y = height - 20 - normalizedVolt * (height - 40);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.setLineDash([]);
  }, [history, activeTab]);

  // Filtered Event Logs
  const filteredLogs = eventLogs.filter(log => {
    const matchesFilter =
      logFilter === 'ALL' ||
      (logFilter === 'WARNING' && log.level === 'warning') ||
      (logFilter === 'ACTION' && log.level === 'action') ||
      (logFilter === 'BOOT' && log.code === 'LOG_EVT_BOOT');

    const matchesSearch =
      log.code.toLowerCase().includes(logSearch.toLowerCase()) ||
      log.desc.toLowerCase().includes(logSearch.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col selection:bg-cyan-500 selection:text-slate-950">

      {/* =================================================================== */}
      {/* 1. HEADER BAR                                                       */}
      {/* =================================================================== */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-40 px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-lg">
        {/* Left Title & Hardware Specs */}
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <Cpu className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight tracking-wide text-slate-100 flex items-center gap-2">
              DPE316D Water-Tank Hub
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs px-2 py-0.5 rounded font-mono bg-slate-800 text-cyan-400 border border-slate-700">
                ESP32-S3 / ATmega328P
              </span>
              <span className="text-xs text-slate-400 font-mono flex items-center gap-1">
                <Globe className="w-3 h-3 text-emerald-400" /> MQTT API Gateway
              </span>
            </div>
          </div>
        </div>

        {/* Right Status & E-STOP */}
        <div className="flex items-center gap-3">
          {/* Online Simulation Toggle & Ping */}
          <button
            onClick={() => setIsOnline(!isOnline)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-mono transition-all ${
              isOnline
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-400 hover:bg-emerald-900/40'
                : 'bg-red-950/40 border-red-500/40 text-red-400 hover:bg-red-900/40'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400 animate-ping' : 'bg-red-500'}`}></span>
            {isOnline ? `ONLINE (${pingMs}ms)` : 'DISCONNECTED'}
          </button>

          {/* E-STOP Button */}
          <button
            onClick={() => setShowEStopModal(true)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm tracking-wider uppercase transition-all shadow-md ${
              eStopActive
                ? 'bg-red-600 text-white animate-bounce ring-4 ring-red-500/50'
                : 'bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white border border-red-400/30'
            }`}
          >
            <ShieldAlert className="w-5 h-5" />
            {eStopActive ? 'E-STOP LOCKED' : 'E-STOP OVERRIDE'}
          </button>
        </div>
      </header>

      {/* Emergency Stop Lockout Modal */}
      {showEStopModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-red-500/50 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <AlertTriangle className="w-8 h-8 flex-shrink-0" />
              <div>
                <h3 className="text-xl font-bold">Hardware Safety Lockout</h3>
                <p className="text-xs text-slate-400 font-mono">EMERGENCY OVERRIDE INTERLOCK</p>
              </div>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              {eStopActive
                ? 'Are you sure you want to DISENGAGE the Emergency Lockout? The system will return to automated hysteresis control.'
                : 'ENGAGING the Emergency Stop will instantly force-close the 12V Solenoid Valve and suspend all scheduled refill events.'}
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowEStopModal(false)}
                className="px-4 py-2 rounded-lg text-sm bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
              >
                Cancel
              </button>
              <button
                onClick={toggleEStop}
                className={`px-5 py-2 rounded-lg text-sm font-bold flex items-center gap-2 ${
                  eStopActive
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    : 'bg-red-600 hover:bg-red-500 text-white'
                }`}
              >
                {eStopActive ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                {eStopActive ? 'Disengage E-STOP' : 'Confirm E-STOP Lock'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 2. NAVIGATION TABS                                                  */}
      {/* =================================================================== */}
      <nav className="bg-slate-900/60 border-b border-slate-800 px-4 flex overflow-x-auto space-x-1">
        {[
          { id: 'overview', label: 'Tank Overview & Level', icon: Droplets },
          { id: 'power', label: 'Power & 12V SLA Battery', icon: BatteryCharging },
          { id: 'settings', label: 'Schedules & Calibration', icon: Sliders },
          { id: 'logs', label: 'Audit & Event History', icon: Database }
        ].map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                active
                  ? 'border-cyan-400 text-cyan-400 bg-cyan-950/20'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </nav>

      {/* =================================================================== */}
      {/* MAIN CONTENT CONTAINER                                              */}
      {/* =================================================================== */}
      <main className="flex-1 p-4 md:p-6 max-w-7xl w-full mx-auto space-y-6">

        {/* Global E-STOP Warning Banner if Active */}
        {eStopActive && (
          <div className="bg-red-950/60 border border-red-500/50 rounded-xl p-4 flex items-center justify-between text-red-300 animate-pulse">
            <div className="flex items-center gap-3">
              <ShieldAlert className="w-6 h-6 text-red-400" />
              <div>
                <p className="font-bold">SYSTEM IN EMERGENCY LOCKOUT</p>
                <p className="text-xs text-red-400 font-mono">Solenoid valve is locked OFF. Automatic refill scripts suspended.</p>
              </div>
            </div>
            <button
              onClick={() => setShowEStopModal(true)}
              className="px-3 py-1 bg-red-600 text-white rounded text-xs font-bold hover:bg-red-500"
            >
              UNLOCK SYSTEM
            </button>
          </div>
        )}

        {/* ----------------------------------------------------------------- */}
        {/* TAB 1: WATER TANK OVERVIEW & TELEMETRY                           */}
        {/* ----------------------------------------------------------------- */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Left Card: Liquid Level Tank Visualizer */}
            <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col items-center justify-between shadow-xl relative overflow-hidden">
              <div className="w-full flex items-center justify-between mb-4">
                <h2 className="font-semibold text-slate-200 flex items-center gap-2">
                  <Droplets className="w-5 h-5 text-cyan-400" /> Ultrasonic Tank Gauge
                </h2>
                <span className={`text-xs px-2.5 py-1 rounded-full font-bold border ${tankStatus.color}`}>
                  {tankStatus.text}
                </span>
              </div>

              {/* Animated Animated SVG Tank */}
              <div className="relative w-48 h-64 bg-slate-950 border-4 border-slate-700 rounded-3xl p-1 overflow-hidden shadow-inner my-2">
                {/* Calibration Ruler Grid */}
                <div className="absolute right-2 top-2 bottom-2 flex flex-col justify-between text-[10px] font-mono text-slate-500 z-10 pointer-events-none">
                  <span>100%</span>
                  <span>75%</span>
                  <span>50%</span>
                  <span>25%</span>
                  <span>0%</span>
                </div>

                {/* Overfill Warning Line */}
                <div className="absolute left-0 right-0 top-[10%] border-b border-dashed border-red-500/60 z-10"></div>

                {/* Hysteresis Threshold Lines */}
                <div
                  className="absolute left-0 right-0 border-b border-dotted border-amber-400/60 z-10"
                  style={{ bottom: `${hysteresisLow}%` }}
                >
                  <span className="text-[9px] text-amber-400 bg-slate-950/80 px-1 rounded absolute left-1 -top-2.5">
                    Low Trigger ({hysteresisLow}%)
                  </span>
                </div>
                <div
                  className="absolute left-0 right-0 border-b border-dotted border-emerald-400/60 z-10"
                  style={{ bottom: `${hysteresisHigh}%` }}
                >
                  <span className="text-[9px] text-emerald-400 bg-slate-950/80 px-1 rounded absolute left-1 -top-2.5">
                    High Stop ({hysteresisHigh}%)
                  </span>
                </div>

                {/* Water Liquid Fill Layer */}
                <div
                  className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-cyan-600 via-cyan-500 to-sky-400 transition-all duration-700 ease-out flex items-center justify-center"
                  style={{ height: `${waterLevelPct}%` }}
                >
                  {/* Subtle Wave Animation Effect */}
                  <div className="absolute top-0 left-0 right-0 h-2 bg-white/30 animate-pulse"></div>
                  <span className="text-xl font-black text-slate-950 font-mono drop-shadow z-20">
                    {waterLevelPct}%
                  </span>
                </div>
              </div>

              {/* Sensor Raw Info */}
              <div className="w-full text-xs font-mono text-slate-400 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 flex justify-between mt-4">
                <div>
                  <p className="text-slate-500">Echo Distance:</p>
                  <p className="text-slate-200 font-bold">
                    {(((100 - waterLevelPct) / 100) * tankHeightCm + sensorOffsetCm).toFixed(1)} cm
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-slate-500">Water Height:</p>
                  <p className="text-cyan-400 font-bold">
                    {((waterLevelPct / 100) * tankHeightCm).toFixed(1)} cm
                  </p>
                </div>
              </div>
            </div>

            {/* Right Side: Metrics & Valve Control Panel */}
            <div className="lg:col-span-2 space-y-6">

              {/* Telemetry Metrics Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                {/* Volume Card */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-md flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Calculated Volume</p>
                    <h3 className="text-3xl font-extrabold text-slate-100 font-mono mt-1">
                      {calculatedVolumeLitres.toLocaleString()} <span className="text-lg font-normal text-cyan-400">L</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Capacity: {maxVolumeLitres.toLocaleString()} Litres
                    </p>
                  </div>
                  <div className="p-3 bg-cyan-500/10 rounded-xl border border-cyan-500/20 text-cyan-400">
                    <Droplets className="w-8 h-8" />
                  </div>
                </div>

                {/* Valve Status Card */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-md flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Solenoid Valve Actuator</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-2xl font-black font-mono ${valveState ? 'text-emerald-400' : 'text-slate-500'}`}>
                        FILL: {valveState ? 'ON' : 'OFF'}
                      </span>
                      {manualOverride && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 font-mono">
                          OVERRIDE
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      5V Relay / 12V Solenoid Interlock
                    </p>
                  </div>
                  <div className={`p-3 rounded-xl border ${valveState ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 animate-pulse' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>
                    <Power className="w-8 h-8" />
                  </div>
                </div>
              </div>

              {/* Manual Actuator & Quick Control Deck */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="font-semibold text-slate-200 flex items-center gap-2">
                    <Power className="w-5 h-5 text-cyan-400" /> Actuator Override & Modes
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">Auto Hysteresis:</span>
                    <button
                      onClick={() => setAutoFillEnabled(!autoFillEnabled)}
                      className={`px-3 py-1 rounded-full text-xs font-mono font-bold transition ${
                        autoFillEnabled ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {autoFillEnabled ? 'ENABLED' : 'DISABLED'}
                    </button>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <button
                    onClick={handleManualValveToggle}
                    disabled={eStopActive}
                    className={`w-full sm:w-1/2 py-4 rounded-xl font-bold font-mono text-base tracking-wide flex items-center justify-center gap-3 shadow-lg transition-all ${
                      eStopActive
                        ? 'bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700'
                        : valveState
                        ? 'bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white'
                        : 'bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white'
                    }`}
                  >
                    <Power className="w-5 h-5" />
                    {valveState ? 'FORCE CLOSE VALVE (OFF)' : 'FORCE OPEN VALVE (ON)'}
                  </button>

                  <button
                    onClick={() => setManualOverride(false)}
                    disabled={!manualOverride}
                    className="w-full sm:w-1/2 py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-medium text-xs font-mono flex items-center justify-center gap-2 border border-slate-700 transition"
                  >
                    <RotateCcw className="w-4 h-4" /> Reset to Auto Hysteresis Mode
                  </button>
                </div>

                {/* Hysteresis Trigger Quick Summary */}
                <div className="grid grid-cols-2 gap-3 pt-2 text-xs font-mono text-slate-400 bg-slate-950/50 p-3 rounded-xl border border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                    <span>Start Fill Threshold: <strong className="text-slate-200">≤ {hysteresisLow}%</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    <span>Stop Fill Threshold: <strong className="text-slate-200">≥ {hysteresisHigh}%</strong></span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ----------------------------------------------------------------- */}
        {/* TAB 2: POWER & BATTERY HEALTH MONITOR                            */}
        {/* ----------------------------------------------------------------- */}
        {activeTab === 'power' && (
          <div className="space-y-6">

            {/* Battery Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

              {/* Real-time Battery Voltage */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">12V SLA Battery Voltage</p>
                  <h3 className="text-3xl font-extrabold text-slate-100 font-mono mt-1">
                    {batteryVoltage.toFixed(2)} <span className="text-lg font-normal text-amber-400">V</span>
                  </h3>
                  <p className="text-xs text-slate-500 font-mono mt-1">
                    Divider ADC: {rawAdcVoltage}V (27k/12k)
                  </p>
                </div>
                <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/20 text-amber-400">
                  <Zap className="w-8 h-8" />
                </div>
              </div>

              {/* State of Charge % */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">State of Charge (SoC)</p>
                  <div className="flex items-center gap-3 mt-1">
                    <h3 className="text-3xl font-extrabold text-slate-100 font-mono">
                      {batteryPct}%
                    </h3>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-bold border ${batteryStatus.color}`}>
                      {batteryStatus.text}
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full mt-3 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        batteryPct < 20 ? 'bg-red-500' : batteryPct < 50 ? 'bg-amber-400' : 'bg-emerald-400'
                      }`}
                      style={{ width: `${batteryPct}%` }}
                    ></div>
                  </div>
                </div>
                <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-emerald-400">
                  <Battery className="w-8 h-8" />
                </div>
              </div>

              {/* Power Source & Charge Mode */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Power Source Input</p>
                  <h3 className="text-2xl font-bold text-cyan-400 font-mono mt-1">
                    {powerSource}
                  </h3>
                  <div className="flex items-center gap-2 mt-2">
                    {['SOLAR', 'MAINS', 'DISCHARGING'].map(src => (
                      <button
                        key={src}
                        onClick={() => setPowerSource(src)}
                        className={`text-[10px] px-2 py-0.5 rounded font-mono border ${
                          powerSource === src
                            ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                            : 'bg-slate-800 border-slate-700 text-slate-400'
                        }`}
                      >
                        {src}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="p-3 bg-sky-500/10 rounded-xl border border-sky-500/20 text-sky-400">
                  <Sun className="w-8 h-8" />
                </div>
              </div>
            </div>

            {/* Voltage & Water Trend Chart */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div>
                  <h3 className="font-semibold text-slate-200 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-amber-400" /> Real-time Telemetry Graph
                  </h3>
                  <p className="text-xs text-slate-400">Monitoring Water Depth (%) & Battery Voltage (V) over time</p>
                </div>
                <div className="flex items-center gap-4 text-xs font-mono">
                  <span className="flex items-center gap-1.5 text-cyan-400">
                    <span className="w-3 h-3 bg-cyan-500 rounded-full inline-block"></span> Water Level (%)
                  </span>
                  <span className="flex items-center gap-1.5 text-amber-400">
                    <span className="w-3 h-3 border border-dashed border-amber-400 rounded-full inline-block"></span> Battery Voltage (V)
                  </span>
                </div>
              </div>

              {/* HTML5 Canvas Chart */}
              <div className="w-full h-64 bg-slate-950 rounded-xl border border-slate-800 p-2 overflow-hidden relative">
                <canvas ref={canvasRef} className="w-full h-full block" />
              </div>
            </div>

          </div>
        )}

        {/* ----------------------------------------------------------------- */}
        {/* TAB 3: SCHEDULES & SYSTEM SETTINGS                                */}
        {/* ----------------------------------------------------------------- */}
        {activeTab === 'settings' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Column 1: Hysteresis & Scheduling */}
            <div className="space-y-6">

              {/* Hysteresis Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                <h3 className="font-semibold text-slate-200 flex items-center gap-2 border-b border-slate-800 pb-3">
                  <Sliders className="w-5 h-5 text-cyan-400" /> Hysteresis Auto-Filling Configurator
                </h3>

                <div className="space-y-4 text-sm">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-slate-300">Lower Threshold (Start Valve ON):</span>
                      <span className="font-mono text-amber-400 font-bold">≤ {hysteresisLow}%</span>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="50"
                      value={hysteresisLow}
                      onChange={e => setHysteresisLow(Number(e.target.value))}
                      className="w-full accent-amber-400 bg-slate-950 rounded-lg cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-slate-300">Upper Threshold (Stop Valve OFF):</span>
                      <span className="font-mono text-emerald-400 font-bold">≥ {hysteresisHigh}%</span>
                    </div>
                    <input
                      type="range"
                      min="60"
                      max="98"
                      value={hysteresisHigh}
                      onChange={e => setHysteresisHigh(Number(e.target.value))}
                      className="w-full accent-emerald-400 bg-slate-950 rounded-lg cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* RTC Schedule Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="font-semibold text-slate-200 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-sky-400" /> Daily RTC Scheduled Fill
                  </h3>
                  <button
                    onClick={() => setSchedEnabled(!schedEnabled)}
                    className={`px-3 py-1 rounded-full text-xs font-mono font-bold transition ${
                      schedEnabled ? 'bg-sky-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {schedEnabled ? 'SCHEDULE ACTIVE' : 'SCHEDULE OFF'}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Trigger Time (24H RTC)</label>
                    <input
                      type="time"
                      value={schedTime}
                      onChange={e => setSchedTime(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Condition Trigger Level (%)</label>
                    <input
                      type="number"
                      min="10"
                      max="80"
                      value={schedThresholdPct}
                      onChange={e => setSchedThresholdPct(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>
                <p className="text-xs text-slate-500">
                  If system time hits <strong className="text-slate-300 font-mono">{schedTime}</strong> and tank level is below <strong className="text-slate-300 font-mono">{schedThresholdPct}%</strong>, auto-fill will engage.
                </p>
              </div>

            </div>

            {/* Column 2: Tank Dimensions & Hardware RTC Sync */}
            <div className="space-y-6">

              {/* Tank Physical Calibration */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                <h3 className="font-semibold text-slate-200 flex items-center gap-2 border-b border-slate-800 pb-3">
                  <Settings className="w-5 h-5 text-cyan-400" /> Tank Geometry & Calibration
                </h3>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Max Tank Height (cm)</label>
                    <input
                      type="number"
                      value={tankHeightCm}
                      onChange={e => setTankHeightCm(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 font-mono text-slate-200"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Tank Radius (cm)</label>
                    <input
                      type="number"
                      value={tankRadiusCm}
                      onChange={e => setTankRadiusCm(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 font-mono text-slate-200"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Sensor Offset (cm)</label>
                    <input
                      type="number"
                      value={sensorOffsetCm}
                      onChange={e => setSensorOffsetCm(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 font-mono text-slate-200"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Overfill Margin (cm)</label>
                    <input
                      type="number"
                      value={overfillSafetyCm}
                      onChange={e => setOverfillSafetyCm(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 font-mono text-slate-200"
                    />
                  </div>
                </div>
              </div>

              {/* Hardware Clock Sync */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="font-semibold text-slate-200 flex items-center gap-2">
                    <RefreshCw className="w-5 h-5 text-emerald-400" /> Hardware RTC Sync
                  </h3>
                  <button
                    onClick={syncHardwareRtc}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Sync RTC Now
                  </button>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-xs flex justify-between items-center text-slate-400">
                  <span>Hardware Timestamp:</span>
                  <span className="text-emerald-400 font-bold">{hardwareTime}</span>
                </div>
              </div>

              {/* MQTT Payload Previewer */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-3">
                <h3 className="font-semibold text-slate-200 text-xs font-mono uppercase tracking-wider text-slate-400">
                  ESP32 Telemetry MQTT JSON Schema
                </h3>
                <pre className="bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-[11px] text-cyan-300 overflow-x-auto">
{JSON.stringify({
  device_id: "ESP32_TANK_SYS_01",
  water_level_pct: waterLevelPct,
  volume_litres: calculatedVolumeLitres,
  battery_v: batteryVoltage,
  raw_adc_v: parseFloat(rawAdcVoltage),
  valve_state: valveState ? 1 : 0,
  estop: eStopActive ? 1 : 0,
  timestamp: hardwareTime
}, null, 2)}
                </pre>
              </div>

            </div>

          </div>
        )}

        {/* ----------------------------------------------------------------- */}
        {/* TAB 4: AUDIT LOGS & EVENT HISTORY                                 */}
        {/* ----------------------------------------------------------------- */}
        {activeTab === 'logs' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">

            {/* Log Controls Header */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <h3 className="font-semibold text-slate-200 flex items-center gap-2">
                  <Database className="w-5 h-5 text-cyan-400" /> Non-Volatile Audit Trail
                </h3>
                <p className="text-xs text-slate-400">Chronological history of boot events, triggers, and emergency locks</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Search input */}
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search logs..."
                    value={logSearch}
                    onChange={e => setLogSearch(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 w-40 sm:w-56"
                  />
                </div>

                {/* Filter Selector */}
                <select
                  value={logFilter}
                  onChange={e => setLogFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none"
                >
                  <option value="ALL">All Event Types</option>
                  <option value="WARNING">Warnings & Safety</option>
                  <option value="ACTION">Actuator Actions</option>
                  <option value="BOOT">Boot Log Events</option>
                </select>

                {/* Export Actions */}
                <button
                  onClick={exportLogsCSV}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-mono flex items-center gap-1.5 border border-slate-700"
                >
                  <Download className="w-3.5 h-3.5" /> CSV
                </button>
                <button
                  onClick={exportLogsJSON}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-mono flex items-center gap-1.5 border border-slate-700"
                >
                  <Download className="w-3.5 h-3.5" /> JSON
                </button>
                <button
                  onClick={clearAllLogs}
                  className="p-1.5 bg-red-950/40 text-red-400 hover:bg-red-900/50 rounded-lg border border-red-800/40"
                  title="Clear Log Table"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Event Data Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 font-mono">
                    <th className="p-3">Timestamp</th>
                    <th className="p-3">Event Code</th>
                    <th className="p-3">Severity</th>
                    <th className="p-3">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="p-6 text-center text-slate-500">
                        No historical event records found matching your filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map(log => (
                      <tr key={log.id} className="hover:bg-slate-800/40 transition">
                        <td className="p-3 text-slate-400 whitespace-nowrap">{log.timestamp}</td>
                        <td className="p-3 font-bold text-cyan-400 whitespace-nowrap">{log.code}</td>
                        <td className="p-3 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                              log.level === 'warning'
                                ? 'bg-red-500/20 text-red-400 border-red-500/40'
                                : log.level === 'action'
                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                                : 'bg-slate-800 text-slate-400 border-slate-700'
                            }`}
                          >
                            {log.level.toUpperCase()}
                          </span>
                        </td>
                        <td className="p-3 text-slate-300">{log.desc}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </main>

      {/* =================================================================== */}
      {/* 3. SIMULATION & HARDWARE OVERRIDE FLOATING DRAWER                   */}
      {/* =================================================================== */}
      <footer className="sticky bottom-0 z-30 bg-slate-900 border-t border-slate-800 p-3 shadow-2xl">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">

          <div className="flex items-center gap-3">
            <button
              onClick={() => setSimDrawerOpen(!simDrawerOpen)}
              className="flex items-center gap-2 px-3 py-1.5 bg-cyan-950/60 text-cyan-400 border border-cyan-500/40 hover:bg-cyan-900/60 rounded-lg text-xs font-mono font-bold transition"
            >
              <Sliders className="w-4 h-4" />
              {simDrawerOpen ? 'Hide Simulation Drawer' : 'Hardware Simulator Panel'}
            </button>
            <span className="text-xs text-slate-400 hidden sm:inline font-mono">
              Simulate sensor inputs & hardware disruptions
            </span>
          </div>

          {/* Quick Simulation Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setWaterLevelPct(15)}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 rounded text-xs font-mono"
            >
              Simulate Low (15%)
            </button>
            <button
              onClick={() => setWaterLevelPct(99)}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-red-400 border border-slate-700 rounded text-xs font-mono"
            >
              Simulate Overflow (99%)
            </button>
            <button
              onClick={() => setBatteryVoltage(10.8)}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-rose-400 border border-slate-700 rounded text-xs font-mono"
            >
              Drop Battery (10.8V)
            </button>
          </div>
        </div>

        {/* Expanded Drawer Controls */}
        {simDrawerOpen && (
          <div className="max-w-7xl mx-auto mt-3 pt-3 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
            <div>
              <label className="block text-slate-400 mb-1">Water Outflow Rate (Drain %/tick)</label>
              <input
                type="range"
                min="0"
                max="5"
                step="0.5"
                value={simDrainSpeed}
                onChange={e => setSimDrainSpeed(Number(e.target.value))}
                className="w-full accent-amber-400 bg-slate-950"
              />
              <span className="text-slate-300">Rate: {simDrainSpeed} %/tick</span>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">External Inflow Rate (Fill %/tick)</label>
              <input
                type="range"
                min="0"
                max="5"
                step="0.5"
                value={simFillSpeed}
                onChange={e => setSimFillSpeed(Number(e.target.value))}
                className="w-full accent-cyan-400 bg-slate-950"
              />
              <span className="text-slate-300">Rate: {simFillSpeed} %/tick</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setBatteryVoltage(12.6)}
                className="w-full py-2 bg-emerald-950/40 border border-emerald-500/40 text-emerald-400 rounded hover:bg-emerald-900/40 text-center font-bold"
              >
                Restore 12.6V SLA Battery
              </button>
            </div>
          </div>
        )}
      </footer>

    </div>
  );
}