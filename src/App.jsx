import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  AlertTriangle, 
  Battery, 
  BatteryCharging, 
  CheckCircle2, 
  Clock, 
  Cpu, 
  Database, 
  Download, 
  Droplet, 
  Power, 
  RefreshCw, 
  Settings, 
  ShieldAlert, 
  Sliders, 
  Trash2, 
  Wifi, 
  WifiOff, 
  Zap,
  Server,
  Play,
  Pause,
  AlertOctagon
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [isConnected, setIsConnected] = useState(true);
  const [eStopActive, setEStopActive] = useState(false);
  const [valveState, setValveState] = useState(false); // false: OFF, true: ON

  // System Parameters
  const [tankHeightCm, setTankHeightCm] = useState(200);
  const [maxWaterHeightCm, setMaxWaterHeightCm] = useState(180);
  const [overfillThresholdPercent, setOverfillThresholdPercent] = useState(95);
  const [tankRadiusCm, setTankRadiusCm] = useState(75); // Cylinder tank

  // Hysteresis Settings
  const [lowerThreshold, setLowerThreshold] = useState(20);
  const [upperThreshold, setUpperThreshold] = useState(90);

  // Schedule Settings
  const [schedTime, setSchedTime] = useState('08:00');
  const [schedThreshold, setSchedThreshold] = useState(30);
  const [schedEnabled, setSchedEnabled] = useState(true);

  // Live Telemetry
  const [waterLevelPercent, setWaterLevelPercent] = useState(48);
  const [batteryVoltage, setBatteryVoltage] = useState(12.4);
  const [isCharging, setIsCharging] = useState(true);

  // Event Logs State
  const [logs, setLogs] = useState([
    { id: 1, timestamp: '2026-11-09 14:30:12', code: 'LOG_EVT_BOOT', desc: 'ATmega328P/ESP32-S3 edge node boot successful', type: 'info' },
    { id: 2, timestamp: '2026-11-09 13:15:00', code: 'LOG_EVT_AUTO_FILL_ON', desc: 'Water level reached 20%. Hysteresis auto-fill initiated', type: 'system' },
    { id: 3, timestamp: '2026-11-09 13:42:10', code: 'LOG_EVT_FILL_STOP', desc: 'Water level reached 90%. Solenoid valve deactivated', type: 'system' },
  ]);

  // Derived calculations
  const waterDepthCm = (waterLevelPercent / 100) * maxWaterHeightCm;
  const currentVolumeLitres = Math.round((Math.PI * Math.pow(tankRadiusCm, 2) * waterDepthCm) / 1000);
  const totalVolumeCapacityLitres = Math.round((Math.PI * Math.pow(tankRadiusCm, 2) * maxWaterHeightCm) / 1000);

  // Battery percentage estimate (12V SLA Battery: 10.5V empty, 12.8V full)
  const batteryPercent = Math.min(100, Math.max(0, Math.round(((batteryVoltage - 10.5) / 2.3) * 100)));
  
  const getBatteryHealth = () => {
    if (batteryVoltage < 11.2) return { text: 'Critical', color: 'bg-red-500/20 text-red-400 border-red-500/40', animate: true };
    if (batteryVoltage < 11.8) return { text: 'Warning', color: 'bg-amber-500/20 text-amber-400 border-amber-500/40', animate: false };
    return { text: 'Normal', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40', animate: false };
  };

  const getSystemStatus = () => {
    if (eStopActive) return { text: 'ESTOP LOCKOUT', badge: 'bg-red-600 text-white animate-pulse' };
    if (waterLevelPercent >= overfillThresholdPercent) return { text: 'OVERFLOW ALARM', badge: 'bg-red-500/20 text-red-400 border-red-500/40' };
    if (waterLevelPercent <= lowerThreshold) return { text: 'LOW REFILL NEEDED', badge: 'bg-amber-500/20 text-amber-400 border-amber-500/40' };
    return { text: 'OK', badge: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' };
  };

  // Auto-Fill Hysteresis Logic simulation
  useEffect(() => {
    if (eStopActive) {
      if (valveState) setValveState(false);
      return;
    }

    if (waterLevelPercent <= lowerThreshold && !valveState) {
      setValveState(true);
      addLog('LOG_EVT_AUTO_FILL_ON', `Auto fill triggered (Level <= ${lowerThreshold}%)`, 'system');
    } else if (waterLevelPercent >= upperThreshold && valveState) {
      setValveState(false);
      addLog('LOG_EVT_FILL_STOP', `Auto fill stopped (Level >= ${upperThreshold}%)`, 'system');
    }
  }, [waterLevelPercent, lowerThreshold, upperThreshold, eStopActive, valveState]);

  const addLog = (code, desc, type = 'info') => {
    const newEntry = {
      id: Date.now(),
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      code,
      desc,
      type
    };
    setLogs(prev => [newEntry, ...prev]);
  };

  const toggleEStop = () => {
    if (!eStopActive) {
      setEStopActive(true);
      setValveState(false);
      addLog('LOG_EVT_ESTOP_ACTIVE', 'Global Emergency Stop manually engaged! Solenoid locked.', 'warning');
    } else {
      setEStopActive(false);
      addLog('LOG_EVT_BOOT', 'Emergency Stop cleared. System returned to standby.', 'info');
    }
  };

  const syncRTC = () => {
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0] + ' ' + now.toLocaleDateString();
    addLog('LOG_EVT_BOOT', `Hardware RTC synchronized with host client: ${timeStr}`, 'info');
    alert(`RTC hardware clock synchronized to client time: ${timeStr}`);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navigation Bar */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center space-x-4">
          <div className="bg-blue-600/20 p-2.5 rounded-xl border border-blue-500/30 text-blue-400">
            <Droplet className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-100 tracking-wide">
              Embedded Intelligence <span className="text-blue-400 font-normal">| Water-Tank Dashboard</span>
            </h1>
            <p className="text-xs text-slate-400 flex items-center gap-2">
              <span>Node: ESP32-S3 / ATmega328P</span>
              <span>•</span>
              <span className="flex items-center gap-1 text-emerald-400">
                <Cpu className="w-3.5 h-3.5" /> Edge Online
              </span>
            </p>
          </div>
        </div>

        {/* Controls Header */}
        <div className="flex items-center space-x-4">
          {/* Connection Status Badge */}
          <button 
            onClick={() => setIsConnected(!isConnected)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-2 border transition ${
              isConnected 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
            }`}
          >
            {isConnected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            {isConnected ? 'MQTT Connected' : 'Offline'}
          </button>

          {/* Quick E-Stop Hazard Button */}
          <button
            onClick={toggleEStop}
            className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 border shadow-lg transition-all active:scale-95 ${
              eStopActive
                ? 'bg-red-600 text-white border-red-500 shadow-red-900/50 animate-bounce'
                : 'bg-red-950/40 border-red-800/60 text-red-400 hover:bg-red-600 hover:text-white'
            }`}
          >
            <AlertOctagon className="w-4 h-4" />
            {eStopActive ? 'E-STOP LOCKED' : 'EMERGENCY STOP'}
          </button>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="border-b border-slate-800 bg-slate-900/40 px-6 flex space-x-8">
        {[
          { id: 'overview', label: 'Water Tank Overview', icon: Droplet },
          { id: 'power', label: 'Power & Battery', icon: Zap },
          { id: 'settings', label: 'Schedules & Settings', icon: Sliders },
          { id: 'logs', label: 'Audit Logs', icon: Database },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-4 px-2 text-sm font-medium flex items-center gap-2.5 border-b-2 transition ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
        
        {/* Tab 1: Water Tank Overview */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Visual Tank Gauge */}
            <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-400 tracking-wider uppercase self-start mb-4">
                Tank Level Visualization
              </h2>
              
              {/* Graphic Tank Gauge */}
              <div className="relative w-44 h-72 border-4 border-slate-700 rounded-3xl overflow-hidden bg-slate-950/60 shadow-inner flex flex-col justify-end p-1">
                {/* Water Liquid */}
                <div 
                  className={`w-full rounded-2xl transition-all duration-700 relative flex items-center justify-center ${
                    waterLevelPercent >= overfillThresholdPercent ? 'bg-red-500' : 'bg-gradient-to-t from-blue-700 to-cyan-500'
                  }`}
                  style={{ height: `${waterLevelPercent}%` }}
                >
                  <span className="text-xl font-black text-white drop-shadow-md">
                    {waterLevelPercent}%
                  </span>
                </div>
              </div>

              <div className="w-full mt-6 space-y-2">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Capacity: {totalVolumeCapacityLitres} L</span>
                  <span>Height: {maxWaterHeightCm} cm</span>
                </div>
              </div>
            </div>

            {/* Live Metrics & Valve Actuator */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Status Header Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                  <p className="text-xs text-slate-400">System Health Status</p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${getSystemStatus().badge}`}>
                      {getSystemStatus().text}
                    </span>
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                  <p className="text-xs text-slate-400">Calculated Volume</p>
                  <p className="mt-1 text-2xl font-bold text-slate-100">
                    {currentVolumeLitres} <span className="text-sm text-slate-400 font-normal">Litres</span>
                  </p>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                  <p className="text-xs text-slate-400">Solenoid Actuator (12V Relay)</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      valveState ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {valveState ? 'FILL: ON' : 'FILL: OFF'}
                    </span>
                    <button
                      disabled={eStopActive}
                      onClick={() => {
                        const newState = !valveState;
                        setValveState(newState);
                        addLog(newState ? 'LOG_EVT_AUTO_FILL_ON' : 'LOG_EVT_FILL_STOP', `Manual override set valve to ${newState ? 'ON' : 'OFF'}`, 'user');
                      }}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white rounded-lg text-xs font-medium transition"
                    >
                      Override Toggle
                    </button>
                  </div>
                </div>
              </div>

              {/* Hardware Sensor Simulator */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-blue-400" />
                  Live Sensor Simulator Controls
                </h3>
                <p className="text-xs text-slate-400">
                  Adjust simulated ultrasonic distance reading (ATmega328P ADC / ESP32 sensor ingestion)
                </p>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-medium text-slate-300">
                    <span>Simulated Level Threshold</span>
                    <span>{waterLevelPercent}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={waterLevelPercent}
                    onChange={(e) => setWaterLevelPercent(Number(e.target.value))}
                    className="w-full accent-blue-500 bg-slate-800 h-2 rounded-lg cursor-pointer"
                  />
                </div>
              </div>

            </div>
          </div>
        )}

        {/* Tab 2: Power & Battery */}
        {activeTab === 'power' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-6">
              <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                <Battery className="w-5 h-5 text-amber-400" /> 
                12V SLA Battery Monitor (27kΩ/12kΩ Divider)
              </h2>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800">
                  <p className="text-xs text-slate-400">Measured Voltage</p>
                  <p className="text-3xl font-extrabold text-amber-400 mt-1">{batteryVoltage} V</p>
                </div>
                <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800">
                  <p className="text-xs text-slate-400">Estimated State of Charge</p>
                  <p className="text-3xl font-extrabold text-emerald-400 mt-1">{batteryPercent}%</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Battery Voltage Simulator</span>
                  <span>{batteryVoltage}V</span>
                </div>
                <input 
                  type="range" 
                  min="10.0" 
                  max="14.0" 
                  step="0.1"
                  value={batteryVoltage}
                  onChange={(e) => setBatteryVoltage(Number(e.target.value))}
                  className="w-full accent-amber-500 bg-slate-800 h-2 rounded-lg cursor-pointer"
                />
              </div>

              <div className="p-4 rounded-xl border bg-slate-950/40 flex items-center justify-between">
                <span className="text-xs text-slate-400">Health Warning Status</span>
                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getBatteryHealth().color} ${getBatteryHealth().animate ? 'animate-pulse' : ''}`}>
                  {getBatteryHealth().text}
                </span>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
              <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                <Zap className="w-5 h-5 text-emerald-400" /> Solar & Power Bus Status
              </h2>

              <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-200">Solar PV Charge Input</p>
                  <p className="text-xs text-slate-400">Regulated 13.8V Float</p>
                </div>
                <button 
                  onClick={() => setIsCharging(!isCharging)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                    isCharging ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {isCharging ? 'CHARGING' : 'DISCHARGING'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: System Settings & Configurations */}
        {activeTab === 'settings' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Tank Setup Form */}
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
              <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                <Sliders className="w-5 h-5 text-blue-400" /> Tank Geometry & Calibration
              </h2>
              
              <div className="space-y-4 text-xs">
                <div>
                  <label className="text-slate-400 block mb-1">Tank Height (cm)</label>
                  <input 
                    type="number" 
                    value={tankHeightCm} 
                    onChange={(e) => setTankHeightCm(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-100" 
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Max Water Depth (cm)</label>
                  <input 
                    type="number" 
                    value={maxWaterHeightCm} 
                    onChange={(e) => setMaxWaterHeightCm(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-100" 
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Overfill Warning Threshold (%)</label>
                  <input 
                    type="number" 
                    value={overfillThresholdPercent} 
                    onChange={(e) => setOverfillThresholdPercent(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-100" 
                  />
                </div>
              </div>
            </div>

            {/* Hysteresis & RTC Sync */}
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-6">
              <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                <Clock className="w-5 h-5 text-cyan-400" /> RTC Sync & Automation Controls
              </h2>

              <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-200">Hardware RTC Synchronization</p>
                  <p className="text-xs text-slate-400">Sync DS1307 RTC with Web Host Time</p>
                </div>
                <button 
                  onClick={syncRTC}
                  className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold transition flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Sync Time
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <h3 className="font-semibold text-slate-300">Hysteresis Thresholds</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-slate-400 block mb-1">Refill Start (≤ %)</label>
                    <input 
                      type="number" 
                      value={lowerThreshold} 
                      onChange={(e) => setLowerThreshold(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-100" 
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Refill Stop (≥ %)</label>
                    <input 
                      type="number" 
                      value={upperThreshold} 
                      onChange={(e) => setUpperThreshold(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-100" 
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Audit Logs */}
        {activeTab === 'logs' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                <Database className="w-5 h-5 text-emerald-400" /> Non-Volatile Telemetry Event Log
              </h2>
              <button 
                onClick={() => setLogs([])}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" /> Clear History
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Event Code</th>
                    <th className="py-3 px-4">Description</th>
                    <th className="py-3 px-4">Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="py-6 text-center text-slate-500">No telemetry events logged</td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-850/50">
                        <td className="py-3 px-4 text-slate-400 font-mono">{log.timestamp}</td>
                        <td className="py-3 px-4 font-mono text-cyan-400 font-semibold">{log.code}</td>
                        <td className="py-3 px-4 text-slate-200">{log.desc}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            log.type === 'warning' ? 'bg-red-500/20 text-red-400' :
                            log.type === 'system' ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-800 text-slate-300'
                          }`}>
                            {log.type}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
