/*
=============================================================================
FILE: Dashboard.js  —  Kitchen Dashboard v6  (Purchases + Waste + Fixed Plates)
=============================================================================
New in v6:
  • PurchasesTab: log bills with amount, description, optional receipt photo
  • WasteLogTab:  log food waste per meal type in kg
  • 8-tab navigation (+ Store, Staff from v5)
=============================================================================
*/

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';

const API_BASE   = 'http://localhost:3001';
const SOCKET_URL = 'http://localhost:3001';

<<<<<<< HEAD
const HOSTELS = ['Chitrakot', 'Mainpat', 'Sirpur', 'Mahanadi', 'Indravati', 'Malhar', 'Kotumsar', 'Seonath'];

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const countToTrafficLevel = (count) => {
  if (count >= 8) return 'High';
  if (count >= 3) return 'Medium';
  return 'Low';
};

const TRAFFIC_COLORS = {
  Low:    { bg: 'bg-green-900/40',  text: 'text-green-300',  dot: 'bg-green-400'  },
  Medium: { bg: 'bg-amber-900/40',  text: 'text-amber-300',  dot: 'bg-amber-400'  },
  High:   { bg: 'bg-red-900/40',    text: 'text-red-300',    dot: 'bg-red-400'    },
};

=======
const HOSTELS      = ['Chitrakot', 'Mainpat', 'Sirpur', 'Mahanadi', 'Indravati', 'Malhar', 'Kotumsar', 'Seonath'];
>>>>>>> 00bde25fc7fd19a0eddd476e4b6149a3801bf83a
const MEAL_TYPES   = ['Breakfast', 'Lunch', 'Snacks', 'Dinner'];
const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const MEAL_CONFIG = {
<<<<<<< HEAD
  Breakfast: { icon: '🌅', badge: 'bg-amber-900/60 text-amber-300 border-amber-700',   text: 'text-amber-300'   },
  Lunch:     { icon: '☀️', badge: 'bg-emerald-900/60 text-emerald-300 border-emerald-700', text: 'text-emerald-300' },
  Snacks:    { icon: '🫖', badge: 'bg-violet-900/60 text-violet-300 border-violet-700',  text: 'text-violet-300'  },
  Dinner:    { icon: '🌙', badge: 'bg-indigo-900/60 text-indigo-300 border-indigo-700',  text: 'text-indigo-300'  },
};

// ─────────────────────────────────────────────────────────────────────────────
// SHARED UI PRIMITIVES
=======
  Breakfast: { icon: '🌅', label: 'Breakfast' },
  Lunch:     { icon: '☀️', label: 'Lunch'     },
  Snacks:    { icon: '🫖', label: 'Snacks'    },
  Dinner:    { icon: '🌙', label: 'Dinner'    },
};

// ─────────────────────────────────────────────────────────────────────────────
// UI HELPERS
>>>>>>> 00bde25fc7fd19a0eddd476e4b6149a3801bf83a
// ─────────────────────────────────────────────────────────────────────────────

// Glassmorphism dark card — the base container used throughout the dashboard
const GlassCard = ({ children, className = '' }) => (
  <div className={`bg-gray-800/60 backdrop-blur-sm border border-gray-700/60 rounded-2xl p-5 shadow-xl ${className}`}>
    {children}
  </div>
);

const Spinner = ({ small = false }) => (
<<<<<<< HEAD
  <div className={`inline-block border-4 border-gray-600 border-t-indigo-400 rounded-full animate-spin ${small ? 'w-5 h-5' : 'w-10 h-10'}`} />
);

const PageLoader = () => (
  <div className="flex flex-col items-center justify-center py-20 gap-4">
    <Spinner /><p className="text-gray-500 text-sm">Loading…</p>
  </div>
);

const Toast = ({ message, type = 'success', onDismiss }) => {
  useEffect(() => { const t = setTimeout(onDismiss, 3500); return () => clearTimeout(t); }, [onDismiss]);
  const colors = {
    success: 'bg-green-800 border-green-600',
    error:   'bg-red-900 border-red-600',
    info:    'bg-indigo-900 border-indigo-600',
  };
  return (
    <div className={`fixed top-4 right-4 z-50 ${colors[type]} border text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 max-w-xs`}>
      <span>{type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
      <span className="text-sm font-medium">{message}</span>
      <button onClick={onDismiss} className="ml-2 opacity-70 hover:opacity-100 text-lg leading-none">×</button>
=======
  <div className={`inline-block border-2 border-white/20 border-t-cyan-400 rounded-full animate-spin ${small ? 'w-4 h-4' : 'w-8 h-8'}`} />
);

const PageLoader = () => (
  <div className="flex flex-col items-center justify-center py-20 gap-3">
    <Spinner /><p className="text-slate-500 text-sm">Loading…</p>
  </div>
);

const GlassCard = ({ children, className = '' }) => (
  <div className={`bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 ${className}`}>
    {children}
  </div>
);

const Toast = ({ message, type = 'success', onDismiss }) => {
  useEffect(() => { const t = setTimeout(onDismiss, 3500); return () => clearTimeout(t); }, [onDismiss]);
  const styles = {
    success: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300',
    error:   'bg-rose-500/20 border-rose-500/40 text-rose-300',
    info:    'bg-cyan-500/20 border-cyan-500/40 text-cyan-300',
  };
  return (
    <div className={`fixed top-4 right-4 z-50 ${styles[type]} border backdrop-blur-xl px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 max-w-xs`}>
      <span>{type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
      <span className="text-sm font-medium">{message}</span>
      <button onClick={onDismiss} className="ml-2 opacity-50 hover:opacity-100 text-lg leading-none">×</button>
>>>>>>> 00bde25fc7fd19a0eddd476e4b6149a3801bf83a
    </div>
  );
};

<<<<<<< HEAD
const StatCard = ({ title, value, subtitle, emoji, highlight = false }) => (
  <div className={`rounded-2xl p-4 flex flex-col gap-2 border transition-all ${
    highlight
      ? 'border-green-500/50 bg-green-900/30 shadow-lg shadow-green-900/20'
      : 'border-gray-700/60 bg-gray-800/50'
  }`}>
    <div className="text-2xl">{emoji}</div>
    <div className={`text-3xl font-black ${highlight ? 'text-green-300' : 'text-white'}`}>{value ?? '—'}</div>
    <div className="font-semibold text-gray-400 text-xs">{title}</div>
    {subtitle && <div className="text-xs text-gray-600 leading-tight">{subtitle}</div>}
=======
const Modal = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
    <div className="bg-[#0f1623] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-black text-white text-base">{title}</h2>
        <button onClick={onClose} className="text-slate-500 hover:text-white text-2xl leading-none transition-colors">×</button>
      </div>
      {children}
    </div>
>>>>>>> 00bde25fc7fd19a0eddd476e4b6149a3801bf83a
  </div>
);

const StatCard = ({ title, value, subtitle, emoji, highlight = false, accent = 'cyan' }) => {
  const colors = {
    emerald: { bg: 'bg-emerald-500/10 border-emerald-500/30', val: 'text-emerald-400', lbl: 'text-emerald-300', sub: 'text-emerald-400/60' },
    cyan:    { bg: 'bg-cyan-500/10 border-cyan-500/30',       val: 'text-cyan-400',    lbl: 'text-cyan-300',    sub: 'text-cyan-400/60'    },
    rose:    { bg: 'bg-rose-500/10 border-rose-500/30',       val: 'text-rose-400',    lbl: 'text-rose-300',    sub: 'text-rose-400/60'    },
    amber:   { bg: 'bg-amber-500/10 border-amber-500/30',     val: 'text-amber-400',   lbl: 'text-amber-300',   sub: 'text-amber-400/60'   },
    default: { bg: 'bg-white/5 border-white/10',              val: 'text-white',       lbl: 'text-slate-400',   sub: 'text-slate-500'      },
  };
  const c = highlight ? (colors[accent] || colors.cyan) : colors.default;
  return (
    <div className={`rounded-2xl border p-4 flex flex-col gap-1.5 transition-all duration-300 shadow-lg ${c.bg} ${!highlight ? 'hover:bg-white/8 hover:border-white/20 hover:-translate-y-0.5' : ''}`}>
      <div className="text-2xl">{emoji}</div>
      <div className={`text-3xl font-black leading-none ${c.val}`}>{value ?? '—'}</div>
      <div className={`font-semibold text-xs ${c.lbl}`}>{title}</div>
      {subtitle && <div className={`text-xs leading-tight ${c.sub}`}>{subtitle}</div>}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
<<<<<<< HEAD
// HOOK: useSocket — subscribes to real-time delivery count updates
=======
// SOCKET HOOK
>>>>>>> 00bde25fc7fd19a0eddd476e4b6149a3801bf83a
// ─────────────────────────────────────────────────────────────────────────────
function useSocket() {
  const [counts,    setCounts]    = useState(HOSTELS.reduce((a, h) => ({ ...a, [h]: 0 }), {}));
  const [connected, setConnected] = useState(false);
  const socketRef                 = useRef(null);

  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;
    socket.on('connect',                  () => setConnected(true));
    socket.on('disconnect',               () => setConnected(false));
    socket.on('delivery_count_updated',   (c) => setCounts(c));
    return () => socket.disconnect();
  }, []);

  return { counts, connected };
}

<<<<<<< HEAD
// ─────────────────────────────────────────────────────────────────────────────
// WEATHER CONTROL — Live Open-Meteo API + manual override
// NIT Raipur coordinates: 21.2497°N, 81.6029°E
// ─────────────────────────────────────────────────────────────────────────────
function WeatherControl({ weather, onChange }) {
  const [liveWeather, setLiveWeather] = useState(null);
  const [fetching,    setFetching]    = useState(false);
  const [fetchError,  setFetchError]  = useState(false);

  const fetchWeather = useCallback(async () => {
    setFetching(true); setFetchError(false);
    try {
      const r = await fetch(
        'https://api.open-meteo.com/v1/forecast?latitude=21.2497&longitude=81.6029&current=weathercode&timezone=Asia%2FKolkata'
      );
      const d = await r.json();
      // WMO weather code: 0-1 = Clear, 51+ = Rain/Drizzle/Snow
      const code = d?.current?.weathercode ?? 0;
      const auto = code >= 51 ? 'Rain' : 'Clear';
      setLiveWeather(auto);
      onChange(auto); // Auto-set the condition
    } catch {
      setFetchError(true);
    } finally { setFetching(false); }
  }, []); // eslint-disable-line

  useEffect(() => { fetchWeather(); }, [fetchWeather]);

  return (
    <div className="col-span-2">
      <div className="flex items-center justify-between mb-1">
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">☁️ Weather</label>
        <div className="flex items-center gap-2">
          {fetching && (
            <span className="text-xs text-indigo-400 flex items-center gap-1">
              <div className="w-3 h-3 border-2 border-indigo-600 border-t-indigo-300 rounded-full animate-spin" />Fetching live…
            </span>
          )}
          {!fetching && liveWeather && !fetchError && (
            <span className="text-xs text-green-400 font-semibold">
              🛰️ Live: {liveWeather === 'Clear' ? '☀️' : '🌧️'} {liveWeather}
            </span>
          )}
          {fetchError && <span className="text-xs text-red-400">⚠️ API failed</span>}
          <button type="button" onClick={fetchWeather} disabled={fetching}
            className="text-xs text-indigo-400 hover:text-indigo-300 font-bold disabled:opacity-50">🔄</button>
        </div>
      </div>
      <select value={weather} onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-xl border border-gray-600 bg-gray-700/60 text-gray-200 text-sm focus:outline-none focus:border-indigo-500">
        <option value="Clear">☀️ Clear</option>
        <option value="Rain">🌧️ Rain</option>
      </select>
      <p className="text-xs text-gray-600 mt-1">
        {liveWeather && !fetchError ? `Auto-detected: ${liveWeather}. Override above if needed.` : 'Select manually.'}
      </p>
    </div>
  );
}

// =============================================================================
// TAB 1: OVERVIEW — Live attendance stats + plate calculation
// Hostel selector removed (set at login). Traffic level removed.
// Math is computed locally on the frontend for exact arithmetic.
// Formula: Plates = Total − App Cancellations − MAX(0, Guard Deliveries − Online Cancels)
// =============================================================================
function OverviewTab({ counts, connected }) {
  const [mealType, setMealType] = useState('Lunch');
  const [data,     setData]     = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);

  // Total live deliveries across ALL hostels (since hostel selector is removed)
=======
// =============================================================================
// TAB 1: OVERVIEW
// =============================================================================
function OverviewTab({ counts, connected }) {
  const [selectedHostel, setSelectedHostel] = useState('Chitrakot');
  const [mealType,       setMealType]       = useState('Lunch');
  const [data,           setData]           = useState(null);
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState(null);

>>>>>>> 00bde25fc7fd19a0eddd476e4b6149a3801bf83a
  const totalDeliveries = Object.values(counts).reduce((s, c) => s + c, 0);

  // Fetch dashboard stats from the backend
  const fetchDashboard = useCallback(async () => {
    setLoading(true); setError(null);
    try {
<<<<<<< HEAD
      const params = new URLSearchParams({ meal_type: mealType });
=======
      const params = new URLSearchParams({ meal_type: mealType, hostel: selectedHostel });
>>>>>>> 00bde25fc7fd19a0eddd476e4b6149a3801bf83a
      const r = await fetch(`${API_BASE}/dashboard?${params}`);
      const d = await r.json();
      if (!d.success) throw new Error(d.error);
      setData(d);
<<<<<<< HEAD
    } catch (e) {
      setError(e.message || 'Failed to load dashboard');
    } finally { setLoading(false); }
  }, [mealType]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  // Auto-refresh when any guard logs a new delivery
  const prevCountRef = useRef(totalDeliveries);
  useEffect(() => {
    if (prevCountRef.current !== totalDeliveries) {
      prevCountRef.current = totalDeliveries;
      fetchDashboard();
    }
  }, [totalDeliveries, fetchDashboard]);

  const cfg = MEAL_CONFIG[mealType] || MEAL_CONFIG.Lunch;

  // ── LOCAL MATH (exact, frontend-computed) ──────────────────────────────────
  // We compute plates_to_cook here using pure arithmetic so the displayed
  // formula always matches exactly what the numbers say.
  // Backend may return a value influenced by ML; we ignore it for display.
  const totalEnrolled      = data?.total_enrolled      ?? 0;
  const appCancellations   = data?.manual_cancellations ?? 0;
  const onlineCancellations = data?.online_cancellations ?? 0;
  // Net new deliveries = guard deliveries that aren't already covered by "Ordered Online" cancels
  const netNewDeliveries   = Math.max(0, totalDeliveries - onlineCancellations);
  // EXACT formula: Total − App Cancels − Net New Deliveries
  const platesToCook       = Math.max(0, totalEnrolled - appCancellations - netNewDeliveries);
  const platesSaved        = totalEnrolled - platesToCook;

  return (
    <div className="space-y-4">

      {/* ── MEAL SELECTOR + STATUS BAR ────────────────────────────────────── */}
      <GlassCard>
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">🍽️ Select Meal</label>
          <select value={mealType} onChange={e => setMealType(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-600 bg-gray-700/60 text-gray-200 text-sm font-bold focus:outline-none focus:border-indigo-500">
            {MEAL_TYPES.map(m => <option key={m} value={m}>{MEAL_CONFIG[m].icon} {m}</option>)}
          </select>
        </div>

        {/* Live delivery count + socket status — compact inline row */}
        <div className="mt-3 flex items-center justify-between bg-gray-700/30 rounded-xl px-4 py-2.5 border border-gray-600/40">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-black text-white">{totalDeliveries}</span>
            <span className="text-xs text-gray-500">total deliveries today</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            <span className="text-xs text-gray-500">{connected ? 'Live' : 'Offline'}</span>
          </div>
        </div>

        <button onClick={fetchDashboard} disabled={loading}
          className="mt-3 w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold disabled:opacity-50 transition-colors">
          {loading ? <span className="flex items-center justify-center gap-2"><Spinner small />Refreshing…</span> : '🔄 Refresh Stats'}
        </button>
      </GlassCard>

      {error && <div className="bg-red-900/30 border border-red-700/50 rounded-2xl p-4 text-red-300 text-sm">⚠️ {error}</div>}
=======
    } catch (e) { setError(e.message || 'Failed to load dashboard'); }
    finally { setLoading(false); }
  }, [mealType, selectedHostel]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  return (
    <div className="space-y-4">
      <GlassCard>
        <h3 className="font-black text-white text-sm mb-3">
          📊 <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">Today's Analytics</span>
        </h3>
        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">🏠 Hostel</label>
        <select value={selectedHostel} onChange={e => setSelectedHostel(e.target.value)}
          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white font-bold text-sm focus:outline-none focus:border-cyan-500/60 transition-all mb-3">
          {HOSTELS.map(h => <option key={h} value={h}>{h} Hostel</option>)}
        </select>
        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">🍽️ Meal</label>
        <div className="grid grid-cols-4 gap-1.5">
          {MEAL_TYPES.map(m => (
            <button key={m} onClick={() => setMealType(m)}
              className={`py-2.5 rounded-xl text-xs font-bold transition-all border
                ${mealType === m ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white'}`}>
              {MEAL_CONFIG[m].icon} {m}
            </button>
          ))}
        </div>
        <button onClick={fetchDashboard} disabled={loading}
          className="mt-4 w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl text-sm font-black disabled:opacity-50 transition-all active:scale-95 flex items-center justify-center gap-2">
          {loading ? <><Spinner small /> Loading…</> : '🔄 Refresh Data'}
        </button>
      </GlassCard>

      <div className="bg-white/5 border border-white/10 rounded-2xl px-5 py-3 flex items-center justify-between">
        <div>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Total Deliveries Today</p>
          <p className="text-2xl font-black text-white">{totalDeliveries}</p>
        </div>
        <div className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold ${connected ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-white/5 border-white/10 text-slate-500'}`}>
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
          {connected ? 'Live' : 'Offline'}
        </div>
      </div>

      {error && <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 text-rose-400 text-sm">⚠️ {error}</div>}
>>>>>>> 00bde25fc7fd19a0eddd476e4b6149a3801bf83a
      {loading && !data && <PageLoader />}

      {data && (
        <>
<<<<<<< HEAD
          {/* ── PLATE CALCULATION BREAKDOWN ──────────────────────────────────
              Formula: Plates to Cook = Total Enrolled − App Cancellations − Net New Deliveries
              Net New Deliveries = MAX(0, Guard Deliveries − "Ordered Online" App Cancels)
              All arithmetic is computed on the frontend for guaranteed exactness.
          ─────────────────────────────────────────────────────────────────── */}
          <GlassCard>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
              {cfg.icon} {mealType} — Plate Calculation
            </p>
            <div className="flex flex-wrap items-center gap-2 text-sm font-mono">
              <span className="bg-blue-900/50 text-blue-300 border border-blue-700/40 px-3 py-1.5 rounded-lg font-bold">
                {totalEnrolled} Total
              </span>
              <span className="text-gray-600 font-bold">−</span>
              <span className="bg-red-900/50 text-red-300 border border-red-700/40 px-3 py-1.5 rounded-lg font-bold">
                {appCancellations} App Cancel
              </span>
              <span className="text-gray-600 font-bold">−</span>
              <span className="bg-orange-900/50 text-orange-300 border border-orange-700/40 px-3 py-1.5 rounded-lg font-bold text-xs">
                MAX(0, {totalDeliveries}G − {onlineCancellations}OL) = {netNewDeliveries}
              </span>
              <span className="text-gray-600 font-bold">=</span>
              <span className="bg-green-900/50 text-green-300 border border-green-700/40 px-3 py-1.5 rounded-lg font-bold text-base">
                🍽️ {platesToCook}
              </span>
            </div>
            <div className="mt-3 bg-orange-900/20 border border-orange-700/30 rounded-xl p-3 text-xs text-orange-300">
              🔗 <strong>Anti-Double-Count:</strong>{' '}
              {onlineCancellations} student(s) cancelled with "Ordered Online" (already in App Cancellations).
              Guard logged {totalDeliveries} delivery/deliveries. Only <strong>{netNewDeliveries} net-new</strong> deliveries additionally subtracted.
            </div>
          </GlassCard>

          {/* ── STAT CARDS ─────────────────────────────────────────────────── */}
          <div className="grid grid-cols-3 gap-3">
            <StatCard emoji="👥" title="Total Enrolled"          value={totalEnrolled}     subtitle="All mess members" />
            <StatCard emoji="❌" title={`${mealType} Cancelled`} value={appCancellations}  subtitle="App cancellations" />
            <StatCard emoji="🍽️" title="Plates to Cook"          value={platesToCook}       subtitle="Exact calculation" highlight />
          </div>

          {/* ── PLATES SAVED KPI ───────────────────────────────────────────── */}
          {/* platesSaved = totalEnrolled − platesToCook (strict arithmetic)    */}
          <div className="bg-gradient-to-br from-teal-800/40 to-emerald-800/40 border border-teal-700/40 rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-teal-400/70 uppercase tracking-widest mb-1">♻️ Plates Saved Today</p>
                <p className="text-5xl font-black leading-none text-teal-300">{platesSaved}</p>
                <p className="text-teal-400/60 text-xs mt-2">
                  {totalEnrolled} enrolled − {platesToCook} to cook
                </p>
              </div>
              <div className="text-right">
                <div className="text-6xl opacity-20">♻️</div>
                <div className="text-xs text-teal-400/50 mt-1 font-semibold">
                  ≈ {(platesSaved * 0.35).toFixed(1)} kg<br />food saved
                </div>
              </div>
            </div>
          </div>
=======
          <div className="bg-gradient-to-br from-cyan-500/15 to-blue-600/10 border border-cyan-500/30 rounded-2xl p-5 shadow-xl">
            <div className="text-xs font-black uppercase tracking-widest text-cyan-400 mb-1">🍽️ Plates to Prepare — {mealType}</div>
            <div className="text-5xl font-black text-white mt-1">{data.plates_to_prepare}</div>
            <div className="flex flex-wrap items-center gap-1.5 text-xs mt-3 text-slate-400">
              <span className="text-white font-bold">{data.total_enrolled}</span> enrolled
              <span className="text-slate-600">−</span>
              <span className="text-rose-300 font-bold">{data.meal_cancellations}</span> cancelled
              <span className="text-slate-600">−</span>
              <span className="text-amber-300 font-bold">{data.extra_deductions}</span> guard deductions
              <span className="text-slate-600">=</span>
              <span className="text-cyan-300 font-black">{data.plates_to_prepare}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <StatCard emoji="👥" title="Total Enrolled"              value={data.total_enrolled}     subtitle="All mess members" />
            <StatCard emoji="❌" title={`${mealType} Cancellations`} value={data.meal_cancellations} subtitle="Opted out"       highlight accent="rose" />
            <StatCard emoji="✅" title="Expected Attendance"          value={data.expected_attendance} subtitle={mealType}       highlight accent="emerald" />
            <StatCard emoji="🛵" title="Guard Deliveries"             value={data.guard_deliveries}   subtitle="Logged today"    highlight accent="amber" />
          </div>
          {data.reason_breakdown?.length > 0 && (
            <GlassCard>
              <h3 className="font-black text-white text-sm mb-3">📋 Cancellation Reasons ({mealType})</h3>
              <div className="space-y-2">
                {data.reason_breakdown.map((r, i) => {
                  const total = data.reason_breakdown.reduce((s, x) => s + x.count, 0);
                  const pct   = total > 0 ? Math.round((r.count / total) * 100) : 0;
                  return (
                    <div key={i}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-slate-300 font-semibold">{r.reason || 'Not specified'}</span>
                        <span className="text-slate-400">{r.count} · {pct}%</span>
                      </div>
                      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </GlassCard>
          )}
>>>>>>> 00bde25fc7fd19a0eddd476e4b6149a3801bf83a
        </>
      )}
    </div>
  );
}

// =============================================================================
// TAB 2: MENU EDITOR — 7-day × 4-meal grid
// =============================================================================
function MenuEditorTab() {
  const [weekMenu, setWeekMenu] = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [toast,    setToast]    = useState(null);

  useEffect(() => {
    (async () => {
      try { const r = await fetch(`${API_BASE}/menu-week`); const d = await r.json(); if (d.success) setWeekMenu(d.menu); }
      catch { setToast({ message: 'Failed to load menu', type: 'error' }); }
      finally { setLoading(false); }
    })();
  }, []);

  const handleChange = (day, meal, value) =>
    setWeekMenu(prev => ({ ...prev, [day]: { ...prev[day], [meal]: value } }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const r = await fetch(`${API_BASE}/menu`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(weekMenu) });
      const d = await r.json();
      setToast({ message: d.success ? 'Menu saved! 🎉' : d.error, type: d.success ? 'success' : 'error' });
    } catch { setToast({ message: 'Save failed', type: 'error' }); }
    finally { setSaving(false); }
  };

  if (loading) return <PageLoader />;

  const mealAccents = {
    Breakfast: 'border-amber-500/30 bg-amber-500/5 text-amber-300',
    Lunch:     'border-emerald-500/30 bg-emerald-500/5 text-emerald-300',
    Snacks:    'border-violet-500/30 bg-violet-500/5 text-violet-300',
    Dinner:    'border-indigo-500/30 bg-indigo-500/5 text-indigo-300',
  };

  return (
    <div className="space-y-4">
      {toast && <Toast {...toast} onDismiss={() => setToast(null)} />}
      <div className="flex items-center justify-between">
        <div>
<<<<<<< HEAD
          <h2 className="font-bold text-white">Weekly Menu Editor</h2>
          <p className="text-xs text-gray-500">Edit and press Save.</p>
        </div>
        <button onClick={handleSave} disabled={saving}
          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-sm disabled:opacity-50">
          {saving ? <span className="flex items-center gap-2"><Spinner small />Saving…</span> : '💾 Save Menu'}
=======
          <h2 className="font-black text-white text-base">Weekly Menu Editor</h2>
          <p className="text-xs text-slate-500">Edit and save.</p>
        </div>
        <button onClick={handleSave} disabled={saving}
          className="px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-bold text-sm disabled:opacity-50 transition-all active:scale-95 flex items-center gap-2">
          {saving ? <><Spinner small />Saving…</> : '💾 Save'}
>>>>>>> 00bde25fc7fd19a0eddd476e4b6149a3801bf83a
        </button>
      </div>
      {weekMenu && DAYS_OF_WEEK.map(day => (
        <GlassCard key={day} className="!p-4">
<<<<<<< HEAD
          <h3 className="font-bold text-gray-200 mb-3 pb-2 border-b border-gray-700">📅 {day}</h3>
          <div className="grid grid-cols-1 gap-2">
            {MEAL_TYPES.map(meal => {
              const c = MEAL_CONFIG[meal];
              return (
                <div key={meal} className="rounded-xl bg-gray-700/30 border border-gray-600/40 p-3">
                  <label className={`text-xs font-bold ${c.text} mb-1 block`}>{c.icon} {meal}</label>
                  <input type="text" value={weekMenu[day]?.[meal] || ''} onChange={e => handleChange(day, meal, e.target.value)}
                    placeholder={`${meal} items…`}
                    className="w-full bg-gray-800/70 border border-gray-600 rounded-lg px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-indigo-500 placeholder-gray-600" />
                </div>
              );
            })}
=======
          <h3 className="font-black text-white mb-3 pb-2 border-b border-white/10 text-sm">📅 {day}</h3>
          <div className="grid grid-cols-1 gap-2">
            {MEAL_TYPES.map(meal => (
              <div key={meal} className={`rounded-xl border p-3 ${mealAccents[meal]}`}>
                <label className="text-xs font-bold mb-1.5 block opacity-80">{MEAL_CONFIG[meal].icon} {meal}</label>
                <input type="text" value={weekMenu[day]?.[meal] || ''} onChange={e => handleChange(day, meal, e.target.value)}
                  placeholder={`${meal} items…`}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/40 transition-all" />
              </div>
            ))}
>>>>>>> 00bde25fc7fd19a0eddd476e4b6149a3801bf83a
          </div>
        </GlassCard>
      ))}
      <button onClick={handleSave} disabled={saving}
<<<<<<< HEAD
        className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-sm disabled:opacity-50">
=======
        className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-black text-sm disabled:opacity-50 hover:brightness-110 transition-all active:scale-95">
>>>>>>> 00bde25fc7fd19a0eddd476e4b6149a3801bf83a
        {saving ? 'Saving…' : '💾 Save All Changes'}
      </button>
    </div>
  );
}

// =============================================================================
<<<<<<< HEAD
// TAB 3: AUDIT LOG — Cancellation trail with spam detection
=======
// TAB 3: AUDIT LOG
>>>>>>> 00bde25fc7fd19a0eddd476e4b6149a3801bf83a
// =============================================================================
function AuditLogTab() {
  const [auditDate,  setAuditDate]  = useState(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }));
  const [data,       setData]       = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [filterMeal, setFilterMeal] = useState('All');

  const fetchAudit = useCallback(async () => {
    setLoading(true);
    try { const r = await fetch(`${API_BASE}/audit-cancellations?date=${auditDate}`); const d = await r.json(); if (d.success) setData(d); }
    catch { setData(null); }
    finally { setLoading(false); }
  }, [auditDate]);

  useEffect(() => { fetchAudit(); }, [fetchAudit]);

  const filtered    = data?.cancellations?.filter(c => filterMeal === 'All' || c.meal_type === filterMeal) || [];
<<<<<<< HEAD
  const countByMeal = MEAL_TYPES.reduce((acc, m) => ({
    ...acc, [m]: data?.cancellations?.filter(c => c.meal_type === m).length || 0
  }), {});
=======
  const countByMeal = MEAL_TYPES.reduce((acc, m) => ({ ...acc, [m]: data?.cancellations?.filter(c => c.meal_type === m).length || 0 }), {});

  const mealChipColors = {
    Breakfast: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    Lunch:     'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    Snacks:    'bg-violet-500/20 text-violet-300 border-violet-500/30',
    Dinner:    'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  };
>>>>>>> 00bde25fc7fd19a0eddd476e4b6149a3801bf83a

  return (
    <div className="space-y-4">
      <GlassCard>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
<<<<<<< HEAD
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">📅 Audit Date</label>
            <input type="date" value={auditDate} onChange={e => setAuditDate(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-600 bg-gray-700/60 text-gray-200 text-sm focus:outline-none focus:border-indigo-500" />
=======
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">📅 Date</label>
            <input type="date" value={auditDate} onChange={e => setAuditDate(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-500/60 transition-all" />
>>>>>>> 00bde25fc7fd19a0eddd476e4b6149a3801bf83a
          </div>
          <button onClick={fetchAudit} disabled={loading}
            className="px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl text-sm font-black disabled:opacity-50 flex items-center gap-2">
            {loading ? <Spinner small /> : '🔍 Load'}
          </button>
        </div>
      </GlassCard>

      {data && (
        <div className="grid grid-cols-2 gap-2">
<<<<<<< HEAD
          <div className="bg-gray-800/50 border border-gray-700/60 rounded-xl p-3 text-center">
            <div className="text-2xl font-black text-white">{data.total_cancellations}</div>
            <div className="text-xs text-gray-500">Total Cancellations</div>
          </div>
          <div className="bg-gray-800/50 border border-gray-700/60 rounded-xl p-3 text-center">
            <div className="text-2xl font-black text-white">{data.unique_students}</div>
            <div className="text-xs text-gray-500">Unique Students</div>
          </div>
          {MEAL_TYPES.map(m => {
            const c = MEAL_CONFIG[m];
            return (
              <div key={m} className="bg-gray-800/50 border border-gray-700/60 rounded-xl p-3 text-center">
                <div className={`text-xl font-black ${c.text}`}>{countByMeal[m]}</div>
                <div className={`text-xs ${c.text} opacity-70`}>{c.icon} {m}</div>
              </div>
            );
          })}
=======
          <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
            <div className="text-2xl font-black text-white">{data.total_cancellations}</div>
            <div className="text-xs text-slate-500">Total Cancellations</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
            <div className="text-2xl font-black text-white">{data.unique_students}</div>
            <div className="text-xs text-slate-500">Unique Students</div>
          </div>
          {MEAL_TYPES.map(m => (
            <div key={m} className={`rounded-xl border p-3 text-center ${mealChipColors[m]}`}>
              <div className="text-xl font-black">{countByMeal[m]}</div>
              <div className="text-xs opacity-70">{MEAL_CONFIG[m].icon} {m}</div>
            </div>
          ))}
>>>>>>> 00bde25fc7fd19a0eddd476e4b6149a3801bf83a
        </div>
      )}

      <div className="flex gap-1.5 flex-wrap">
<<<<<<< HEAD
        {['All', ...MEAL_TYPES].map(m => {
          const c = m === 'All' ? null : MEAL_CONFIG[m];
          return (
            <button key={m} onClick={() => setFilterMeal(m)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all ${
                filterMeal === m
                  ? (c ? `${c.badge}` : 'bg-gray-200 text-gray-900 border-gray-200')
                  : 'border-gray-600 text-gray-500 hover:border-gray-500 bg-gray-800/40'
              }`}>
              {c ? `${c.icon} ` : ''}{m}
            </button>
          );
        })}
=======
        {['All', ...MEAL_TYPES].map(m => (
          <button key={m} onClick={() => setFilterMeal(m)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all
              ${filterMeal === m ? (m === 'All' ? 'bg-white/15 border-white/30 text-white' : mealChipColors[m]) : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white'}`}>
            {m !== 'All' ? `${MEAL_CONFIG[m].icon} ` : ''}{m}
          </button>
        ))}
>>>>>>> 00bde25fc7fd19a0eddd476e4b6149a3801bf83a
      </div>

      {loading && <PageLoader />}

      {!loading && filtered.length === 0 && (
<<<<<<< HEAD
        <GlassCard className="text-center py-8">
          <div className="text-4xl mb-2">🎉</div>
          <p className="text-gray-400 font-semibold">No cancellations found</p>
          <p className="text-gray-600 text-xs mt-1">
            {filterMeal === 'All' ? 'No meals cancelled on this date.' : `No ${filterMeal} cancellations.`}
          </p>
        </GlassCard>
      )}

      {!loading && filtered.length > 0 && (
        <GlassCard className="!p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-700/50 border-b border-gray-600/60">
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wide">Student</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wide">Meal</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wide">Time (IST)</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wide">Flag</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/40">
                {filtered.map((c, i) => {
                  const cfg = MEAL_CONFIG[c.meal_type] || MEAL_CONFIG.Lunch;
                  // SQLite CURRENT_TIMESTAMP is UTC without 'Z' — append it for correct IST parse
                  const rawTime = c.cancelled_at;
                  const timeStr = rawTime
                    ? new Date(rawTime.replace(' ', 'T') + 'Z').toLocaleTimeString('en-IN', {
                        timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit'
                      })
                    : '—';
                  return (
                    <tr key={`${c.id}-${i}`} className={`hover:bg-gray-700/20 ${c.is_frequent ? 'bg-red-900/10' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-white text-xs">{c.name}</div>
                        <div className="text-xs text-gray-500">{c.roll_number}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full border ${cfg.badge}`}>
                          {cfg.icon} {c.meal_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400 font-mono">{timeStr}</td>
                      <td className="px-4 py-3">
                        {c.is_frequent
                          ? <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full bg-red-900/50 text-red-300 border border-red-700/40">⚠️ {c.monthly_count}/mo</span>
                          : <span className="text-xs text-gray-600">—</span>}
=======
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
          <div className="text-4xl mb-2">🎉</div>
          <p className="text-slate-400 font-semibold">No cancellations found</p>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white/5 border-b border-white/10">
                  {['Student', 'Meal', 'Reason', 'Time', 'Flag'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map((c, i) => {
                  const rawTime = c.cancelled_at;
                  const timeStr = rawTime ? new Date(rawTime.replace(' ', 'T') + 'Z').toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }) : '—';
                  return (
                    <tr key={`${c.id}-${i}`} className={`hover:bg-white/5 transition-colors ${c.is_frequent ? 'bg-rose-500/5' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-white text-sm">{c.name}</div>
                        <div className="text-xs text-slate-500 font-mono">{c.roll_number}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full border ${mealChipColors[c.meal_type] || 'bg-white/10 text-white border-white/20'}`}>
                          {MEAL_CONFIG[c.meal_type]?.icon} {c.meal_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-300 text-xs">
                        {c.reason?.trim() ? c.reason : <span className="text-slate-600 italic">Not specified</span>}
                      </td>
                      <td className="px-4 py-3 text-cyan-400 font-mono text-xs font-bold">{timeStr}</td>
                      <td className="px-4 py-3">
                        {c.is_frequent
                          ? <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">⚠️ {c.monthly_count}/mo</span>
                          : <span className="text-xs text-slate-600">—</span>}
>>>>>>> 00bde25fc7fd19a0eddd476e4b6149a3801bf83a
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
<<<<<<< HEAD
        </GlassCard>
      )}

      <div className="bg-red-900/20 border border-red-700/30 rounded-xl p-3 text-xs text-red-400">
        ⚠️ <strong>Spam Detection:</strong> Students with ≥ {data?.spam_threshold || 15} cancellations this month are flagged.
=======
        </div>
      )}
      <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 text-xs text-rose-400">
        ⚠️ <strong>Spam Detection:</strong> Students with ≥ {data?.spam_threshold || 15} cancellations/month are flagged.
>>>>>>> 00bde25fc7fd19a0eddd476e4b6149a3801bf83a
      </div>
    </div>
  );
}

// =============================================================================
<<<<<<< HEAD
// TAB 4: STORE ROOM — Inventory CRUD with quantity controllers
// =============================================================================

// Modal: Add a new inventory item
function AddItemModal({ onClose, onAdded }) {
  const [itemName,   setItemName]   = useState('');
  const [dateBought, setDateBought] = useState(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }));
  const [quantity,   setQuantity]   = useState(0);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!itemName.trim()) { setError('Item name is required.'); return; }
    setLoading(true); setError('');
    try {
      const r = await fetch(`${API_BASE}/api/inventory`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ item_name: itemName.trim(), date_bought: dateBought, quantity }),
      });
      const d = await r.json();
      if (!d.success) { setError(d.error || 'Failed to add.'); return; }
      onAdded();
    } catch { setError('Network error.'); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="bg-gradient-to-br from-teal-700 to-emerald-800 px-6 py-4 flex items-center justify-between">
          <h2 className="text-white font-black text-lg">📦 Add Inventory Item</h2>
          <button onClick={onClose} className="text-white/60 hover:text-white text-2xl leading-none">×</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">Item Name</label>
            <input type="text" value={itemName} onChange={e => setItemName(e.target.value)}
              placeholder="e.g. Rice (kg), Tomatoes (kg)…"
              autoFocus
              className="w-full px-4 py-3 rounded-xl bg-gray-800 text-white placeholder-gray-600 border border-gray-600 focus:outline-none focus:border-teal-500 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">Date Bought</label>
            <input type="date" value={dateBought} onChange={e => setDateBought(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-gray-800 text-white border border-gray-600 focus:outline-none focus:border-teal-500 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">Initial Quantity</label>
            <input type="number" value={quantity} min={0} onChange={e => setQuantity(parseInt(e.target.value, 10) || 0)}
              className="w-full px-4 py-3 rounded-xl bg-gray-800 text-white border border-gray-600 focus:outline-none focus:border-teal-500 text-sm" />
          </div>
          {error && <div className="bg-red-900/40 border border-red-700 rounded-xl px-4 py-2 text-red-300 text-xs">❌ {error}</div>}
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={onClose}
              className="py-3 rounded-xl bg-gray-700 hover:bg-gray-600 text-white font-bold text-sm">Cancel</button>
            <button type="submit" disabled={loading}
              className="py-3 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-black text-sm disabled:opacity-50 flex items-center justify-center gap-2">
              {loading ? <><Spinner small />Adding…</> : '✅ Add Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function StoreRoomTab() {
  const [items,      setItems]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [showModal,  setShowModal]  = useState(false);
  const [toast,      setToast]      = useState(null);
  // pendingQty mirrors the live state of each item's quantity input
  const [pendingQty, setPendingQty] = useState({});
  const [savingId,   setSavingId]   = useState(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/inventory`);
      const d = await r.json();
      if (d.success) {
        setItems(d.items);
        const qtyMap = {};
        d.items.forEach(item => { qtyMap[item.id] = item.quantity; });
        setPendingQty(qtyMap);
      }
    } catch { setToast({ message: 'Failed to load inventory', type: 'error' }); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  // PUT the new quantity to the backend
  const saveQty = async (id, qty) => {
    if (qty < 0) return;
    setSavingId(id);
    try {
      const r = await fetch(`${API_BASE}/api/inventory/${id}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ quantity: qty }),
      });
      const d = await r.json();
      if (d.success) {
        setItems(prev => prev.map(item => item.id === id ? { ...item, quantity: qty } : item));
      }
    } catch { setToast({ message: 'Save failed', type: 'error' }); }
    finally { setSavingId(null); }
  };

  // [+] — increment and immediately persist
  const increment = (id) => {
    const newQty = (pendingQty[id] ?? 0) + 1;
    setPendingQty(p => ({ ...p, [id]: newQty }));
    saveQty(id, newQty);
  };

  // [−] — decrement (floor 0) and immediately persist
  const decrement = (id) => {
    const newQty = Math.max(0, (pendingQty[id] ?? 0) - 1);
    setPendingQty(p => ({ ...p, [id]: newQty }));
    saveQty(id, newQty);
  };

  // Manual text input — update local state, persist on blur
  const handleQtyInput  = (id, val) => {
    const num = parseInt(val, 10);
    if (!isNaN(num) && num >= 0) setPendingQty(p => ({ ...p, [id]: num }));
  };

  const deleteItem = async (id) => {
    try {
      await fetch(`${API_BASE}/api/inventory/${id}`, { method: 'DELETE' });
      setItems(prev => prev.filter(item => item.id !== id));
      setToast({ message: 'Item removed.', type: 'info' });
    } catch { setToast({ message: 'Delete failed.', type: 'error' }); }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-4">
      {toast && <Toast {...toast} onDismiss={() => setToast(null)} />}
      {showModal && (
        <AddItemModal
          onClose={() => setShowModal(false)}
          onAdded={() => {
            setShowModal(false);
            fetchItems();
            setToast({ message: 'Item added! 📦', type: 'success' });
          }}
        />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-white text-base">📦 Store Room</h2>
          <p className="text-xs text-gray-500">{items.length} item{items.length !== 1 ? 's' : ''} in inventory</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="px-4 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl font-bold text-sm transition-colors">
          ＋ Add New Item
        </button>
      </div>

      {items.length === 0 ? (
        <GlassCard className="text-center py-12">
          <div className="text-5xl mb-3">📦</div>
          <p className="text-gray-300 font-bold">No inventory items yet.</p>
          <p className="text-gray-600 text-xs mt-1">Click "+ Add New Item" to get started.</p>
        </GlassCard>
      ) : (
        <div className="space-y-2">
          {items.map(item => {
            const qty      = pendingQty[item.id] ?? item.quantity;
            const isSaving = savingId === item.id;
            // Low stock = quantity ≤ 5; Out of stock = 0
            const isLow = qty > 0 && qty <= 5;
            const isOut = qty === 0;

            return (
              <GlassCard key={item.id} className="!p-0 overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3">

                  {/* Item info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-white text-sm">{item.item_name}</p>
                      {isLow && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-900/50 text-amber-300 border border-amber-700/40 font-bold">
                          ⚠️ Low
                        </span>
                      )}
                      {isOut && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-900/70 text-red-200 border border-red-600 font-bold">
                          🚫 Out
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Bought: {new Date(item.date_bought + 'T00:00:00').toLocaleDateString('en-IN', {
                        day: 'numeric', month: 'short', year: 'numeric'
                      })}
                    </p>
                  </div>

                  {/* Quantity controller: [−] [input] [+] */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {/* Decrement */}
                    <button onClick={() => decrement(item.id)} disabled={isSaving || qty <= 0}
                      className="w-9 h-9 rounded-xl bg-gray-700 hover:bg-gray-600 text-white font-black text-lg flex items-center justify-center disabled:opacity-40 border border-gray-600 transition-colors">
                      −
                    </button>

                    {/* Manual text input */}
                    <input
                      type="number"
                      value={qty}
                      min={0}
                      onChange={e => handleQtyInput(item.id, e.target.value)}
                      onBlur={() => saveQty(item.id, pendingQty[item.id] ?? item.quantity)}
                      className={`w-16 text-center py-2 rounded-xl border text-sm font-black focus:outline-none transition-colors ${
                        isOut ? 'bg-red-900/30 border-red-700/60 text-red-300 focus:border-red-500' :
                        isLow ? 'bg-amber-900/20 border-amber-700/50 text-amber-300 focus:border-amber-500' :
                                'bg-gray-700/60 border-gray-600 text-white focus:border-teal-500'
                      }`}
                    />

                    {/* Increment */}
                    <button onClick={() => increment(item.id)} disabled={isSaving}
                      className="w-9 h-9 rounded-xl bg-teal-700 hover:bg-teal-600 text-white font-black text-lg flex items-center justify-center disabled:opacity-40 border border-teal-600 transition-colors">
                      +
                    </button>

                    {isSaving && <div className="w-4 h-4 border-2 border-gray-600 border-t-teal-400 rounded-full animate-spin" />}
                  </div>

                  {/* Delete */}
                  <button onClick={() => deleteItem(item.id)}
                    className="text-gray-600 hover:text-red-400 transition-colors text-xl leading-none ml-1 flex-shrink-0">
                    🗑
                  </button>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// TAB 5: STAFF / WORKERS — Attendance + Long Leave management
// =============================================================================

// Modal: Add a new worker
function AddWorkerModal({ onClose, onAdded }) {
  const WORKER_ROLES = ['Chef', 'Helper', 'Cleaner', 'Manager', 'Security'];
  const [name,    setName]    = useState('');
  const [role,    setRole]    = useState('Helper');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) { setError('Name is required.'); return; }
    setLoading(true); setError('');
    try {
      const r = await fetch(`${API_BASE}/api/workers`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: name.trim(), role }),
      });
      const d = await r.json();
      if (!d.success) { setError(d.error || 'Failed.'); return; }
      onAdded();
    } catch { setError('Network error.'); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="bg-gradient-to-br from-violet-700 to-purple-800 px-6 py-4 flex items-center justify-between">
          <h2 className="text-white font-black text-lg">👤 Add Kitchen Worker</h2>
          <button onClick={onClose} className="text-white/60 hover:text-white text-2xl leading-none">×</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">Full Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="Worker's full name" autoFocus
              className="w-full px-4 py-3 rounded-xl bg-gray-800 text-white placeholder-gray-600 border border-gray-600 focus:outline-none focus:border-violet-500 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">Role</label>
            <select value={role} onChange={e => setRole(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-gray-800 text-white border border-gray-600 focus:outline-none focus:border-violet-500 text-sm">
              {WORKER_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          {error && <div className="bg-red-900/40 border border-red-700 rounded-xl px-4 py-2 text-red-300 text-xs">❌ {error}</div>}
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={onClose}
              className="py-3 rounded-xl bg-gray-700 hover:bg-gray-600 text-white font-bold text-sm">Cancel</button>
            <button type="submit" disabled={loading}
              className="py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-black text-sm disabled:opacity-50 flex items-center justify-center gap-2">
              {loading ? <><Spinner small />Adding…</> : '✅ Add Worker'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Modal: Set / Clear a long leave for a specific worker
function SetLeaveModal({ worker, onClose, onSaved }) {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const [leaveUntil, setLeaveUntil] = useState(worker.leave_until || today);
  const [loading,    setLoading]    = useState(false);
  const [clearing,   setClearing]   = useState(false);
  const [error,      setError]      = useState('');

  const submit = async (clearLeave = false) => {
    setLoading(true); setError('');
    try {
      const r = await fetch(`${API_BASE}/api/workers/${worker.id}/leave`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ leave_until: clearLeave ? null : leaveUntil }),
      });
      const d = await r.json();
      if (!d.success) { setError(d.error || 'Failed.'); return; }
      onSaved();
    } catch { setError('Network error.'); }
    finally { setLoading(false); setClearing(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="bg-gradient-to-br from-orange-700 to-red-800 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-white font-black text-lg">🏖️ Set Long Leave</h2>
            <p className="text-white/70 text-xs">{worker.name}</p>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white text-2xl leading-none">×</button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">
              Leave Until (last day of leave)
            </label>
            <input type="date" value={leaveUntil} min={today} onChange={e => setLeaveUntil(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-gray-800 text-white border border-gray-600 focus:outline-none focus:border-orange-500 text-sm" />
          </div>
          <div className="bg-orange-900/20 border border-orange-700/30 rounded-xl p-3 text-xs text-orange-300">
            📅 Worker will show as <strong>On Leave</strong> from today through <strong>{leaveUntil}</strong>.
            Attendance toggles are disabled during this period.
          </div>
          {error && <div className="bg-red-900/40 border border-red-700 rounded-xl px-4 py-2 text-red-300 text-xs">❌ {error}</div>}
          <div className="space-y-2">
            <button onClick={() => submit(false)} disabled={loading}
              className="w-full py-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-black text-sm disabled:opacity-50 flex items-center justify-center gap-2">
              {loading && !clearing ? <><Spinner small />Saving…</> : `✅ Set Leave Until ${leaveUntil}`}
            </button>
            {worker.leave_until && (
              <button onClick={() => { setClearing(true); submit(true); }} disabled={loading}
                className="w-full py-2.5 rounded-xl bg-gray-700 hover:bg-gray-600 text-gray-300 font-bold text-sm disabled:opacity-50">
                {loading && clearing ? 'Clearing…' : '🔄 Clear Leave (Mark Active)'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StaffTab() {
  const [workers,      setWorkers]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [leaveWorker,  setLeaveWorker]  = useState(null); // worker object | null
  const [toast,        setToast]        = useState(null);
  const [savingId,     setSavingId]     = useState(null);

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

  const fetchWorkers = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/workers`);
      const d = await r.json();
      if (d.success) setWorkers(d.workers);
    } catch { setToast({ message: 'Failed to load staff', type: 'error' }); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchWorkers(); }, [fetchWorkers]);

  // Mark attendance (Present / Absent) — blocked if worker is on long leave
  const markAttendance = async (worker, status) => {
    if (worker.on_leave) {
      setToast({ message: `${worker.name} is on leave until ${worker.leave_until}.`, type: 'info' });
      return;
    }
    setSavingId(worker.id);
    try {
      const r = await fetch(`${API_BASE}/api/workers/${worker.id}/attendance`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status }),
      });
      const d = await r.json();
      if (d.success) {
        // Optimistic update — update local state immediately so UI feels instant
        setWorkers(prev => prev.map(w => w.id === worker.id ? { ...w, today_status: status } : w));
      }
    } catch { setToast({ message: 'Could not save attendance', type: 'error' }); }
    finally { setSavingId(null); }
  };

  // Summary counts for the KPI bar
  const summary = {
    present:  workers.filter(w => w.today_status === 'Present').length,
    absent:   workers.filter(w => w.today_status === 'Absent').length,
    onLeave:  workers.filter(w => !!w.on_leave).length,
    unmarked: workers.filter(w => !w.today_status && !w.on_leave).length,
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-4">
      {toast && <Toast {...toast} onDismiss={() => setToast(null)} />}
      {showAddModal && (
        <AddWorkerModal
          onClose={() => setShowAddModal(false)}
          onAdded={() => {
            setShowAddModal(false);
            fetchWorkers();
            setToast({ message: 'Worker added! 👤', type: 'success' });
          }}
        />
      )}
      {leaveWorker && (
        <SetLeaveModal
          worker={leaveWorker}
          onClose={() => setLeaveWorker(null)}
          onSaved={() => {
            setLeaveWorker(null);
            fetchWorkers();
            setToast({ message: 'Leave updated! 🏖️', type: 'success' });
          }}
        />
      )}

      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-white text-base">👷 Kitchen Staff</h2>
          <p className="text-xs text-gray-500">Mark daily attendance · {today}</p>
        </div>
        <button onClick={() => setShowAddModal(true)}
          className="px-4 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-bold text-sm transition-colors">
          ＋ Add Worker
        </button>
      </div>

      {/* ── ATTENDANCE SUMMARY COUNTERS ──────────────────────────────────── */}
      {workers.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Present',  count: summary.present,  color: 'text-green-300',  bg: 'bg-green-900/30  border-green-700/40'  },
            { label: 'Absent',   count: summary.absent,   color: 'text-red-300',    bg: 'bg-red-900/30    border-red-700/40'    },
            { label: 'On Leave', count: summary.onLeave,  color: 'text-orange-300', bg: 'bg-orange-900/30 border-orange-700/40' },
            { label: 'Unmarked', count: summary.unmarked, color: 'text-gray-400',   bg: 'bg-gray-700/30   border-gray-600/40'   },
          ].map(s => (
            <div key={s.label} className={`rounded-xl border ${s.bg} p-3 text-center`}>
              <div className={`text-xl font-black ${s.color}`}>{s.count}</div>
              <div className={`text-xs ${s.color} opacity-70 leading-tight`}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── WORKER LIST ──────────────────────────────────────────────────── */}
      {workers.length === 0 ? (
        <GlassCard className="text-center py-12">
          <div className="text-5xl mb-3">👷</div>
          <p className="text-gray-300 font-bold">No staff registered yet.</p>
          <p className="text-gray-600 text-xs mt-1">Click "+ Add Worker" to register kitchen staff.</p>
        </GlassCard>
      ) : (
        <div className="space-y-3">
          {workers.map(worker => {
            // on_leave=1 from backend means leave_until >= today
            const onLeave  = !!worker.on_leave;
            const status   = onLeave ? 'On Leave' : (worker.today_status || null);
            const isSaving = savingId === worker.id;

            // Status pill style
            const statusStyle =
              status === 'Present'  ? 'bg-green-900/50 text-green-300 border-green-700/40'    :
              status === 'Absent'   ? 'bg-red-900/50 text-red-300 border-red-700/40'           :
              status === 'On Leave' ? 'bg-orange-900/50 text-orange-300 border-orange-700/40'  :
                                      'bg-gray-700/50 text-gray-500 border-gray-600/40';       // Unmarked

            return (
              <GlassCard key={worker.id} className="!p-0 overflow-hidden">
                <div className="px-4 py-4">
                  {/* ── Top row: avatar + name + status pill ────────────── */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gray-700 flex items-center justify-center font-black text-white text-base flex-shrink-0">
                        {worker.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-white text-sm">{worker.name}</p>
                        <p className="text-xs text-gray-500">{worker.role}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${statusStyle}`}>
                        {status ?? '— Unmarked'}
                      </span>
                      {isSaving && <Spinner small />}
                    </div>
                  </div>

                  {/* ── Long leave notice (if applicable) ──────────────── */}
                  {onLeave && (
                    <div className="mb-3 bg-orange-900/20 border border-orange-700/30 rounded-xl px-3 py-2 text-xs text-orange-300">
                      🏖️ On approved leave until <strong>{worker.leave_until}</strong>. Daily attendance is locked.
                    </div>
                  )}

                  {/* ── Action buttons ──────────────────────────────────── */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Present — disabled if on long leave */}
                    <button
                      onClick={() => markAttendance(worker, 'Present')}
                      disabled={onLeave || isSaving}
                      className={`px-4 py-2 rounded-xl text-xs font-black transition-all border disabled:opacity-40 disabled:cursor-not-allowed ${
                        status === 'Present'
                          ? 'bg-green-700 border-green-600 text-white shadow-lg shadow-green-900/40'
                          : 'bg-gray-700/60 border-gray-600 text-gray-400 hover:border-green-600 hover:text-green-300'
                      }`}>
                      ✅ Present
                    </button>

                    {/* Absent — disabled if on long leave */}
                    <button
                      onClick={() => markAttendance(worker, 'Absent')}
                      disabled={onLeave || isSaving}
                      className={`px-4 py-2 rounded-xl text-xs font-black transition-all border disabled:opacity-40 disabled:cursor-not-allowed ${
                        status === 'Absent'
                          ? 'bg-red-800 border-red-600 text-white shadow-lg shadow-red-900/40'
                          : 'bg-gray-700/60 border-gray-600 text-gray-400 hover:border-red-600 hover:text-red-300'
                      }`}>
                      ❌ Absent
                    </button>

                    {/* Long Leave — always available */}
                    <button
                      onClick={() => setLeaveWorker(worker)}
                      className={`ml-auto px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
                        onLeave
                          ? 'bg-orange-900/40 border-orange-700/50 text-orange-300 hover:bg-orange-900/60'
                          : 'bg-gray-700/60 border-gray-600 text-gray-400 hover:border-orange-600 hover:text-orange-300'
                      }`}>
                      🏖️ {onLeave ? 'Edit Leave' : 'Set Leave'}
                    </button>
                  </div>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// TAB 6: RATINGS — Post-meal anonymous student feedback
=======
// TAB 4: MEAL RATINGS
>>>>>>> 00bde25fc7fd19a0eddd476e4b6149a3801bf83a
// =============================================================================
function RatingsTab() {
  const [ratingDate, setRatingDate] = useState(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }));
  const [ratings,    setRatings]    = useState(null);
  const [loading,    setLoading]    = useState(false);
<<<<<<< HEAD
  const [error,      setError]      = useState('');

  const fetchRatings = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const r = await fetch(`${API_BASE}/api/ratings/all?meal_date=${ratingDate}`);
      const d = await r.json();
      if (d.success) setRatings(d.ratings);
      else setError(d.error || 'Failed to load ratings.');
    } catch { setError('Network error.'); }
=======

  const fetchRatings = useCallback(async () => {
    setLoading(true);
    try { const r = await fetch(`${API_BASE}/api/ratings/all?meal_date=${ratingDate}`); const d = await r.json(); if (d.success) setRatings(d.ratings); }
    catch { }
>>>>>>> 00bde25fc7fd19a0eddd476e4b6149a3801bf83a
    finally { setLoading(false); }
  }, [ratingDate]);

  useEffect(() => { fetchRatings(); }, [fetchRatings]);

  const mealAccents = {
<<<<<<< HEAD
    Breakfast: { bar: 'bg-amber-400',   text: 'text-amber-300',   badge: 'bg-amber-900/40 border-amber-700/40 text-amber-300'   },
    Lunch:     { bar: 'bg-emerald-400', text: 'text-emerald-300', badge: 'bg-emerald-900/40 border-emerald-700/40 text-emerald-300' },
    Snacks:    { bar: 'bg-violet-400',  text: 'text-violet-300',  badge: 'bg-violet-900/40 border-violet-700/40 text-violet-300'  },
    Dinner:    { bar: 'bg-indigo-400',  text: 'text-indigo-300',  badge: 'bg-indigo-900/40 border-indigo-700/40 text-indigo-300'  },
  };

  const starEmoji = (s) => ['⭐','⭐','⭐','⭐','⭐'].slice(0, s).join('');

  return (
    <div className="space-y-4">
      {/* Date picker */}
      <GlassCard>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">📅 Select Date</label>
            <input type="date" value={ratingDate} onChange={e => setRatingDate(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-gray-800 border border-gray-600 text-white text-sm
                         focus:outline-none focus:border-cyan-500 transition-all" />
          </div>
          <button onClick={fetchRatings} disabled={loading}
            className="px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-xl text-sm font-black disabled:opacity-50 flex items-center gap-2">
            {loading ? <Spinner small /> : '🔍 View Ratings'}
          </button>
        </div>
      </GlassCard>

      {error && <div className="bg-red-900/30 border border-red-700/40 rounded-xl p-3 text-red-300 text-xs">❌ {error}</div>}
      {loading && <PageLoader />}

      {!loading && ratings && (
        <div className="space-y-3">
          {MEAL_TYPES.map(meal => {
            const data   = ratings[meal];
            const cfg    = MEAL_CONFIG[meal];
            const accent = mealAccents[meal] || mealAccents.Lunch;
            const total  = data?.total_ratings || 0;
            const avg    = data?.avg_stars;

            return (
              <GlassCard key={meal}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{cfg.icon}</span>
                    <span className="font-bold text-white text-sm">{meal}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-bold ${accent.badge}`}>
                      {total} review{total !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {avg ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-yellow-400 text-lg">★</span>
                      <span className="font-black text-white text-lg">{avg}</span>
                      <span className="text-gray-500 text-xs">/ 5.0</span>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-500">No ratings yet</span>
                  )}
                </div>

                {total > 0 ? (
                  <div className="space-y-1.5 pt-1">
                    {data.breakdown.map(b => {
                      const pct = total > 0 ? Math.round((b.count / total) * 100) : 0;
                      return (
                        <div key={b.stars} className="flex items-center gap-2 text-xs">
                          <span className="w-14 text-right text-gray-400 font-mono flex-shrink-0">{starEmoji(b.stars)}</span>
                          <div className="flex-1 bg-gray-700/60 rounded-full h-2 overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-500 ${accent.bar}`}
                              style={{ width: `${pct}%` }} />
                          </div>
                          <span className="w-12 text-right text-gray-400 font-mono text-[10px] flex-shrink-0">
                            {b.count} ({pct}%)
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-gray-600 text-center py-2">Students haven't submitted ratings for this meal yet.</p>
                )}
              </GlassCard>
            );
          })}
        </div>
      )}

      <div className="bg-gray-800/40 border border-gray-700/40 rounded-xl p-3 text-xs text-gray-500 text-center">
        🔒 All ratings are fully anonymous — no student identities are stored or displayed.
      </div>
=======
    Breakfast: { bar: 'bg-amber-400',   text: 'text-amber-300',   badge: 'bg-amber-500/20 border-amber-500/30 text-amber-300'   },
    Lunch:     { bar: 'bg-emerald-400', text: 'text-emerald-300', badge: 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300' },
    Snacks:    { bar: 'bg-violet-400',  text: 'text-violet-300',  badge: 'bg-violet-500/20 border-violet-500/30 text-violet-300'  },
    Dinner:    { bar: 'bg-indigo-400',  text: 'text-indigo-300',  badge: 'bg-indigo-500/20 border-indigo-500/30 text-indigo-300'  },
  };

  return (
    <div className="space-y-4">
      <GlassCard>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">📅 Date</label>
            <input type="date" value={ratingDate} onChange={e => setRatingDate(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-500/60 transition-all" />
          </div>
          <button onClick={fetchRatings} disabled={loading}
            className="px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl text-sm font-black disabled:opacity-50 flex items-center gap-2">
            {loading ? <Spinner small /> : '🔍 Load'}
          </button>
        </div>
        <p className="text-xs text-slate-500 mt-2">🔒 All ratings are fully anonymous.</p>
      </GlassCard>
      {loading && <PageLoader />}
      {!loading && ratings && MEAL_TYPES.map(mealType => {
        const r   = ratings[mealType];
        const acc = mealAccents[mealType];
        const maxCount = r.total_ratings > 0 ? Math.max(...r.breakdown.map(b => b.count)) : 1;
        return (
          <GlassCard key={mealType}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span>{MEAL_CONFIG[mealType].icon}</span>
                <h3 className={`font-black text-base ${acc.text}`}>{mealType}</h3>
              </div>
              <div className="flex items-center gap-3">
                {r.avg_stars && <div className={`px-3 py-1.5 rounded-full border text-xs font-black ${acc.badge}`}>⭐ {r.avg_stars}</div>}
                <span className="text-slate-500 text-xs">{r.total_ratings} ratings</span>
              </div>
            </div>
            {r.total_ratings === 0 ? <div className="text-center py-4 text-slate-500 text-sm">No ratings yet.</div> : (
              <div className="space-y-2.5">
                {r.breakdown.map(({ stars, count }) => (
                  <div key={stars} className="flex items-center gap-3">
                    <span className="text-xs text-slate-400 w-14 font-mono shrink-0">{'⭐'.repeat(stars)}</span>
                    <div className="flex-1 h-5 bg-white/10 rounded-full overflow-hidden">
                      <div className={`h-full ${acc.bar} rounded-full transition-all duration-700`} style={{ width: maxCount > 0 ? `${(count / maxCount) * 100}%` : '0%' }} />
                    </div>
                    <span className="text-white font-black text-sm w-6 text-right">{count}</span>
                    <span className="text-slate-500 text-xs w-12">{r.total_ratings > 0 ? `${Math.round((count / r.total_ratings) * 100)}%` : '0%'}</span>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        );
      })}
>>>>>>> 00bde25fc7fd19a0eddd476e4b6149a3801bf83a
    </div>
  );
}

// =============================================================================
<<<<<<< HEAD
// TAB 7: PURCHASES (COST TRACKING) — 100% local React state
// =============================================================================
// All data lives in useState — no backend calls needed.
// Receipt photos are stored locally as object URLs (URL.createObjectURL).
// This means thumbnails appear instantly without any server upload.
function PurchasesTab() {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

  // Local state — survives as long as the tab is mounted.
  // receipt: { name: string, url: string, isImage: boolean } | null
  const [purchases, setPurchases] = useState([
    { id: 1, description: 'Rice (50 kg)',       amount: 2500, date_bought: today, receipt: null },
    { id: 2, description: 'Dal (20 kg)',         amount: 1800, date_bought: today, receipt: null },
    { id: 3, description: 'Cooking Oil (10 L)',  amount: 1200, date_bought: today, receipt: null },
  ]);

  // Form field state
  const [desc,        setDesc]        = useState('');
  const [amount,      setAmount]      = useState('');
  const [date,        setDate]        = useState(today);
  const [receiptFile, setReceiptFile] = useState(null); // { name, url, isImage }
  const [error,       setError]       = useState('');
  const [toast,       setToast]       = useState(null);

  const totalSpent = purchases.reduce((sum, p) => sum + p.amount, 0);

  // When the user picks a file, create a local object URL for preview
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) { setReceiptFile(null); return; }
    const url     = URL.createObjectURL(file);                  // in-memory URL — no upload needed
    const isImage = file.type.startsWith('image/');             // distinguish image vs PDF/doc
    setReceiptFile({ name: file.name, url, isImage });
  };

  const handleAdd = (e) => {
    e.preventDefault();
    setError('');
    if (!desc.trim())             { setError('Description is required.');   return; }
    if (!amount || isNaN(amount)) { setError('Enter a valid amount in ₹.'); return; }
    const newEntry = {
      id:          Date.now(),           // timestamp as local unique ID
      description: desc.trim(),
      amount:      parseFloat(amount),
      date_bought: date,
      receipt:     receiptFile,          // store the { name, url, isImage } object
    };
    setPurchases(prev => [newEntry, ...prev]);
    setDesc(''); setAmount(''); setReceiptFile(null);
    // Reset the actual file input element
    const fileInput = document.getElementById('purchase-receipt-input');
    if (fileInput) fileInput.value = '';
    setToast({ message: 'Bill logged! 💰', type: 'success' });
    setTimeout(() => setToast(null), 3000);
  };

  const handleDelete = (id) => {
    setPurchases(prev => prev.filter(p => p.id !== id));
    setToast({ message: 'Entry removed.', type: 'info' });
    setTimeout(() => setToast(null), 3000);
  };

=======
// TAB 5: STORE ROOM
// =============================================================================
function StoreRoomTab() {
  const [items, setItems]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [toast, setToast]         = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [qtySaving, setQtySaving] = useState({});
  const [newItem, setNewItem]     = useState({ item_name: '', date_bought: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }), quantity: 0 });

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try { const r = await fetch(`${API_BASE}/api/inventory`); const d = await r.json(); if (d.success) setItems(d.items); }
    catch { setToast({ message: 'Failed to load inventory', type: 'error' }); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleQtyDelta = (id, delta) => setItems(prev => prev.map(it => it.id === id ? { ...it, quantity: Math.max(0, it.quantity + delta) } : it));
  const handleQtyInput = (id, value) => { const qty = parseInt(value, 10); if (!isNaN(qty) && qty >= 0) setItems(prev => prev.map(it => it.id === id ? { ...it, quantity: qty } : it)); };

  const saveQty = async (id, quantity) => {
    setQtySaving(prev => ({ ...prev, [id]: true }));
    try {
      const r = await fetch(`${API_BASE}/api/inventory/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quantity }) });
      const d = await r.json();
      setToast({ message: d.success ? 'Saved!' : d.error, type: d.success ? 'success' : 'error' });
    } catch { setToast({ message: 'Network error', type: 'error' }); }
    finally { setQtySaving(prev => ({ ...prev, [id]: false })); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this item?')) return;
    try { await fetch(`${API_BASE}/api/inventory/${id}`, { method: 'DELETE' }); setItems(prev => prev.filter(it => it.id !== id)); setToast({ message: 'Deleted.', type: 'info' }); }
    catch { setToast({ message: 'Delete failed', type: 'error' }); }
  };

  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!newItem.item_name.trim()) { setToast({ message: 'Item name required', type: 'error' }); return; }
    setSaving(true);
    try {
      const r = await fetch(`${API_BASE}/api/inventory`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newItem) });
      const d = await r.json();
      if (d.success) {
        setItems(prev => [d.item, ...prev]);
        setToast({ message: 'Item added!', type: 'success' });
        setShowModal(false);
        setNewItem({ item_name: '', date_bought: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }), quantity: 0 });
      } else setToast({ message: d.error, type: 'error' });
    } catch { setToast({ message: 'Network error', type: 'error' }); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      {toast && <Toast {...toast} onDismiss={() => setToast(null)} />}
      {showModal && (
        <Modal title="➕ Add New Item" onClose={() => setShowModal(false)}>
          <form onSubmit={handleAddItem} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Item Name</label>
              <input type="text" value={newItem.item_name} onChange={e => setNewItem(p => ({ ...p, item_name: e.target.value }))} placeholder="e.g. Rice, Oil…" required
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/60 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Date Bought</label>
              <input type="date" value={newItem.date_bought} onChange={e => setNewItem(p => ({ ...p, date_bought: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/60 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Quantity</label>
              <input type="number" min="0" value={newItem.quantity} onChange={e => setNewItem(p => ({ ...p, quantity: parseInt(e.target.value, 10) || 0 }))}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/60 text-sm" />
            </div>
            <button type="submit" disabled={saving}
              className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl font-black text-sm disabled:opacity-50 active:scale-95 flex items-center justify-center gap-2">
              {saving ? <><Spinner small />Adding…</> : '✅ Add Item'}
            </button>
          </form>
        </Modal>
      )}
      <div className="flex items-center justify-between">
        <div><h2 className="font-black text-white text-base">📦 Store Room</h2><p className="text-xs text-slate-500">Kitchen inventory</p></div>
        <button onClick={() => setShowModal(true)} className="px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl font-black text-sm active:scale-95 flex items-center gap-2">➕ Add Item</button>
      </div>
      {loading && <PageLoader />}
      {!loading && items.length === 0 && <GlassCard><div className="text-center py-6"><div className="text-4xl mb-2">📦</div><p className="text-slate-400">No items yet</p></div></GlassCard>}
      {!loading && items.length > 0 && (
        <div className="space-y-3">
          {items.map(item => (
            <div key={item.id} className="bg-white/5 border border-white/10 rounded-2xl p-4 hover:bg-white/8 transition-all">
              <div className="flex items-start justify-between mb-3">
                <div><div className="font-bold text-white text-sm">{item.item_name}</div><div className="text-xs text-slate-500">📅 {item.date_bought}</div></div>
                <button onClick={() => handleDelete(item.id)} className="text-slate-600 hover:text-rose-400 transition-colors">🗑️</button>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-slate-400 font-bold uppercase tracking-widest shrink-0">Qty:</span>
                <button onClick={() => handleQtyDelta(item.id, -1)} className="w-9 h-9 rounded-xl bg-white/10 border border-white/10 text-white font-black text-xl hover:bg-rose-500/20 hover:text-rose-300 transition-all active:scale-90">−</button>
                <input type="number" min="0" value={item.quantity} onChange={e => handleQtyInput(item.id, e.target.value)}
                  className="w-20 text-center px-2 py-2 rounded-xl bg-white/5 border border-white/10 text-white font-black text-sm focus:outline-none focus:border-cyan-500/60" />
                <button onClick={() => handleQtyDelta(item.id, +1)} className="w-9 h-9 rounded-xl bg-white/10 border border-white/10 text-white font-black text-xl hover:bg-emerald-500/20 hover:text-emerald-300 transition-all active:scale-90">+</button>
                <button onClick={() => saveQty(item.id, item.quantity)} disabled={qtySaving[item.id]}
                  className="ml-1 px-3 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl text-xs font-black disabled:opacity-50 active:scale-95 flex items-center gap-1.5">
                  {qtySaving[item.id] ? <Spinner small /> : '💾 Save'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// TAB 6: WORKERS
// =============================================================================
function WorkersTab() {
  const [workers, setWorkers]               = useState([]);
  const [loading, setLoading]               = useState(true);
  const [toast, setToast]                   = useState(null);
  const [showAddModal, setShowAddModal]     = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(null);
  const [markingId, setMarkingId]           = useState(null);
  const [newWorker, setNewWorker]           = useState({ name: '', role: 'Cook' });
  const [saving, setSaving]                 = useState(false);
  const [leaveUntil, setLeaveUntil]         = useState('');

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

  const fetchWorkers = useCallback(async () => {
    setLoading(true);
    try { const r = await fetch(`${API_BASE}/api/workers`); const d = await r.json(); if (d.success) setWorkers(d.workers); }
    catch { setToast({ message: 'Failed to load workers', type: 'error' }); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchWorkers(); }, [fetchWorkers]);

  const markAttendance = async (workerId, status) => {
    setMarkingId(`${workerId}_${status}`);
    try {
      const r = await fetch(`${API_BASE}/api/workers/${workerId}/attendance`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
      const d = await r.json();
      if (d.success) { setWorkers(prev => prev.map(w => w.id === workerId ? { ...w, today_status: status } : w)); setToast({ message: `Marked ${status}`, type: 'success' }); }
      else setToast({ message: d.error, type: 'error' });
    } catch { setToast({ message: 'Network error', type: 'error' }); }
    finally { setMarkingId(null); }
  };

  const handleAddWorker = async (e) => {
    e.preventDefault();
    if (!newWorker.name.trim()) { setToast({ message: 'Name required', type: 'error' }); return; }
    setSaving(true);
    try {
      const r = await fetch(`${API_BASE}/api/workers`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newWorker) });
      const d = await r.json();
      if (d.success) { setWorkers(prev => [...prev, { ...d.worker, today_status: null, on_leave: false }]); setToast({ message: 'Worker added!', type: 'success' }); setShowAddModal(false); setNewWorker({ name: '', role: 'Cook' }); }
      else setToast({ message: d.error, type: 'error' });
    } catch { setToast({ message: 'Network error', type: 'error' }); }
    finally { setSaving(false); }
  };

  const handleSetLeave = async () => {
    if (!showLeaveModal || !leaveUntil) return;
    setSaving(true);
    try {
      const r = await fetch(`${API_BASE}/api/workers/${showLeaveModal.id}/leave`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ leave_until: leaveUntil }) });
      const d = await r.json();
      if (d.success) { await fetchWorkers(); setToast({ message: `Leave set until ${leaveUntil}`, type: 'success' }); setShowLeaveModal(null); setLeaveUntil(''); }
      else setToast({ message: d.error, type: 'error' });
    } catch { setToast({ message: 'Network error', type: 'error' }); }
    finally { setSaving(false); }
  };

  const statusColors = {
    Present:    'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    Absent:     'bg-rose-500/20    text-rose-300    border-rose-500/30',
    'On Leave': 'bg-amber-500/20  text-amber-300   border-amber-500/30',
  };

  return (
    <div className="space-y-4">
      {toast && <Toast {...toast} onDismiss={() => setToast(null)} />}
      {showAddModal && (
        <Modal title="👷 Add New Worker" onClose={() => setShowAddModal(false)}>
          <form onSubmit={handleAddWorker} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Full Name</label>
              <input type="text" value={newWorker.name} onChange={e => setNewWorker(p => ({ ...p, name: e.target.value }))} placeholder="Worker's name" required
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/60 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Role</label>
              <select value={newWorker.role} onChange={e => setNewWorker(p => ({ ...p, role: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/60 text-sm">
                {['Cook','Helper','Cleaner','Server','Manager','Other'].map(r => <option key={r} value={r} className="text-slate-800">{r}</option>)}
              </select>
            </div>
            <button type="submit" disabled={saving}
              className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-black text-sm disabled:opacity-50 active:scale-95 flex items-center justify-center gap-2">
              {saving ? <><Spinner small />Adding…</> : '✅ Add Worker'}
            </button>
          </form>
        </Modal>
      )}
      {showLeaveModal && (
        <Modal title={`🏖️ Leave for ${showLeaveModal.name}`} onClose={() => setShowLeaveModal(null)}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Leave Until (inclusive)</label>
              <input type="date" value={leaveUntil} min={today} onChange={e => setLeaveUntil(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/60 text-sm" />
              <p className="text-xs text-slate-500 mt-1.5">Worker will be auto-marked "On Leave" for all days up to this date.</p>
            </div>
            <button onClick={handleSetLeave} disabled={!leaveUntil || saving}
              className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl font-black text-sm disabled:opacity-50 active:scale-95 flex items-center justify-center gap-2">
              {saving ? <><Spinner small />Saving…</> : '🏖️ Confirm Leave'}
            </button>
          </div>
        </Modal>
      )}
      <div className="flex items-center justify-between">
        <div><h2 className="font-black text-white text-base">👷 Kitchen Staff</h2><p className="text-xs text-slate-500">Attendance & leave</p></div>
        <button onClick={() => setShowAddModal(true)} className="px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-black text-sm active:scale-95 flex items-center gap-2">➕ Add Worker</button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Present',  count: workers.filter(w => w.today_status === 'Present').length,  color: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' },
          { label: 'Absent',   count: workers.filter(w => w.today_status === 'Absent').length,   color: 'bg-rose-500/10 border-rose-500/20 text-rose-400'         },
          { label: 'On Leave', count: workers.filter(w => w.on_leave).length,                    color: 'bg-amber-500/10 border-amber-500/20 text-amber-400'      },
        ].map(({ label, count, color }) => (
          <div key={label} className={`${color} border rounded-xl p-3 text-center`}>
            <div className="text-xl font-black">{count}</div>
            <div className="text-[10px] font-bold uppercase tracking-widest opacity-80">{label}</div>
          </div>
        ))}
      </div>
      {loading && <PageLoader />}
      {!loading && workers.length === 0 && <GlassCard><div className="text-center py-6"><div className="text-4xl mb-2">👷</div><p className="text-slate-400">No workers yet</p></div></GlassCard>}
      {!loading && workers.map(worker => {
        const isOnLeave = worker.on_leave;
        const statusKey = isOnLeave ? 'On Leave' : worker.today_status;
        return (
          <div key={worker.id} className={`border rounded-2xl p-4 transition-all ${isOnLeave ? 'bg-amber-500/5 border-amber-500/20' : 'bg-white/5 border-white/10 hover:bg-white/8'}`}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-sm">{worker.name}</span>
                  <span className="text-[10px] font-bold text-slate-500 bg-white/10 px-2 py-0.5 rounded-full">{worker.role}</span>
                </div>
                {isOnLeave && worker.leave_until && <div className="text-xs text-amber-400 mt-0.5">🏖️ Until {worker.leave_until}</div>}
              </div>
              <div className="flex items-center gap-2">
                {statusKey && <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${statusColors[statusKey] || 'bg-white/10 border-white/20 text-white'}`}>{statusKey}</span>}
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {!isOnLeave && (
                <>
                  <button onClick={() => markAttendance(worker.id, 'Present')} disabled={markingId !== null || worker.today_status === 'Present'}
                    className={`px-3 py-2 rounded-xl text-xs font-black border transition-all active:scale-95 ${worker.today_status === 'Present' ? 'bg-emerald-500/30 border-emerald-500/50 text-emerald-300 cursor-default' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-emerald-500/20 hover:border-emerald-500/30 hover:text-emerald-300 disabled:opacity-40'}`}>
                    {markingId === `${worker.id}_Present` ? <Spinner small /> : '✅ Present'}
                  </button>
                  <button onClick={() => markAttendance(worker.id, 'Absent')} disabled={markingId !== null || worker.today_status === 'Absent'}
                    className={`px-3 py-2 rounded-xl text-xs font-black border transition-all active:scale-95 ${worker.today_status === 'Absent' ? 'bg-rose-500/30 border-rose-500/50 text-rose-300 cursor-default' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-rose-500/20 hover:border-rose-500/30 hover:text-rose-300 disabled:opacity-40'}`}>
                    {markingId === `${worker.id}_Absent` ? <Spinner small /> : '❌ Absent'}
                  </button>
                </>
              )}
              <button onClick={() => { setShowLeaveModal(worker); setLeaveUntil(worker.leave_until || ''); }}
                className="px-3 py-2 rounded-xl text-xs font-black border bg-white/5 border-white/10 text-slate-400 hover:bg-amber-500/20 hover:border-amber-500/30 hover:text-amber-300 transition-all active:scale-95">
                🏖️ Set Leave
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// =============================================================================
// TAB 7: PURCHASES (Financial Tracking)
// =============================================================================
function PurchasesTab() {
  const [purchases,    setPurchases]    = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [toast,        setToast]        = useState(null);
  const [saving,       setSaving]       = useState(false);
  const [form,         setForm]         = useState({ date: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }), amount: '', description: '', receipt_image: null });
  const [previewImage, setPreviewImage] = useState(null);

  const fetchPurchases = useCallback(async () => {
    setLoading(true);
    try { const r = await fetch(`${API_BASE}/api/purchases`); const d = await r.json(); if (d.success) setPurchases(d.purchases); }
    catch { setToast({ message: 'Failed to load purchases', type: 'error' }); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchPurchases(); }, [fetchPurchases]);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setToast({ message: 'Image too large (max 5MB)', type: 'error' }); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setForm(p => ({ ...p, receipt_image: ev.target.result }));
      setPreviewImage(ev.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.amount || parseFloat(form.amount) <= 0) { setToast({ message: 'Please enter a valid amount', type: 'error' }); return; }
    if (!form.description.trim()) { setToast({ message: 'Description is required', type: 'error' }); return; }
    setSaving(true);
    try {
      const r = await fetch(`${API_BASE}/api/purchases`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const d = await r.json();
      if (d.success) {
        setPurchases(prev => [d.purchase, ...prev]);
        setToast({ message: 'Bill recorded! 💰', type: 'success' });
        setForm({ date: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }), amount: '', description: '', receipt_image: null });
        setPreviewImage(null);
      } else setToast({ message: d.error, type: 'error' });
    } catch { setToast({ message: 'Network error', type: 'error' }); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this purchase record?')) return;
    try {
      await fetch(`${API_BASE}/api/purchases/${id}`, { method: 'DELETE' });
      setPurchases(prev => prev.filter(p => p.id !== id));
      setToast({ message: 'Deleted.', type: 'info' });
    } catch { setToast({ message: 'Delete failed', type: 'error' }); }
  };

  const totalSpent = purchases.reduce((sum, p) => sum + p.amount, 0);

>>>>>>> 00bde25fc7fd19a0eddd476e4b6149a3801bf83a
  return (
    <div className="space-y-4">
      {toast && <Toast {...toast} onDismiss={() => setToast(null)} />}

<<<<<<< HEAD
      {/* ── TOTAL EXPENDITURE KPI ─────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-emerald-800/40 to-teal-800/40 border border-emerald-700/40 rounded-2xl p-5 flex items-center justify-between">
        <div>
          <p className="text-xs font-bold text-emerald-400/70 uppercase tracking-widest mb-1">💰 Total Expenditure</p>
          <p className="text-4xl font-black text-emerald-300">₹{totalSpent.toLocaleString('en-IN')}</p>
          <p className="text-emerald-400/60 text-xs mt-1">{purchases.length} bill{purchases.length !== 1 ? 's' : ''} logged</p>
        </div>
        <div className="text-6xl opacity-20">🧾</div>
      </div>

      {/* ── ADD NEW BILL FORM ─────────────────────────────────────────── */}
      <GlassCard>
        <h3 className="font-bold text-white text-sm mb-3">📋 Log New Purchase</h3>
        <form onSubmit={handleAdd} className="space-y-3">

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Item / Description</label>
            <input value={desc} onChange={e => setDesc(e.target.value)}
              placeholder="e.g. Paneer (5 kg), Gas Cylinder…"
              className="w-full px-3 py-2.5 rounded-xl bg-gray-700/60 border border-gray-600 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-emerald-500 transition-all" />
          </div>

          {/* Amount + Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Amount (₹)</label>
              <input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2.5 rounded-xl bg-gray-700/60 border border-gray-600 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-emerald-500 transition-all" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-gray-700/60 border border-gray-600 text-white text-sm focus:outline-none focus:border-emerald-500 transition-all" />
            </div>
          </div>

          {/* ── RECEIPT PHOTO UPLOAD ──────────────────────────────────────
              Uses a hidden <input type="file"> triggered by a styled label.
              URL.createObjectURL gives an instant in-memory preview URL
              without any server upload — perfect for offline demos.
          ─────────────────────────────────────────────────────────────── */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">
              📸 Receipt Photo <span className="normal-case text-gray-600 font-normal">(optional — image or PDF)</span>
            </label>
            <label htmlFor="purchase-receipt-input"
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl
                         bg-gray-700/60 border border-dashed border-gray-500
                         text-gray-400 text-sm cursor-pointer
                         hover:border-emerald-500 hover:text-emerald-300 transition-all">
              {receiptFile ? (
                <>
                  {/* Show a tiny inline thumbnail for images */}
                  {receiptFile.isImage
                    ? <img src={receiptFile.url} alt="receipt preview"
                           className="w-8 h-8 rounded-lg object-cover border border-emerald-600/50 flex-shrink-0" />
                    : <span className="text-2xl flex-shrink-0">📄</span>
                  }
                  <span className="truncate text-emerald-300 font-medium">{receiptFile.name}</span>
                  {/* Clear button */}
                  <button type="button"
                    onClick={e => { e.preventDefault(); setReceiptFile(null);
                      const fi = document.getElementById('purchase-receipt-input');
                      if (fi) fi.value = ''; }}
                    className="ml-auto text-gray-500 hover:text-red-400 text-lg leading-none flex-shrink-0">
                    ×
                  </button>
                </>
              ) : (
                <>
                  <span className="text-2xl">📎</span>
                  <span>Click to attach receipt…</span>
                </>
              )}
            </label>
            {/* Hidden native file input */}
            <input id="purchase-receipt-input" type="file"
              accept="image/*,application/pdf"
              onChange={handleFileChange}
              className="hidden" />
          </div>

          {error && <div className="bg-red-900/30 border border-red-700/40 rounded-xl px-3 py-2 text-red-300 text-xs">❌ {error}</div>}
          <button type="submit"
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-sm transition-colors">
            + Add Purchase
=======
      {/* Total expenditure hero */}
      <div className="bg-gradient-to-br from-emerald-500/15 to-teal-600/10 border border-emerald-500/30 rounded-2xl p-5">
        <div className="text-xs font-black uppercase tracking-widest text-emerald-400 mb-1">💰 Total Expenditure (All Time)</div>
        <div className="text-4xl font-black text-white">₹{totalSpent.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
        <div className="text-emerald-300/60 text-xs mt-1">{purchases.length} bill{purchases.length !== 1 ? 's' : ''} recorded</div>
      </div>

      {/* Add new purchase form */}
      <GlassCard>
        <h3 className="font-black text-white text-sm mb-4">➕ Record New Purchase</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Date</label>
              <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-emerald-500/60" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Amount (₹)</label>
              <input type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                placeholder="0.00" required
                className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-emerald-500/60 placeholder-slate-600" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Description</label>
            <input type="text" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              placeholder="e.g. 50 kg rice, daily vegetables…" required
              className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-emerald-500/60 placeholder-slate-600" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Receipt Photo (optional)</label>
            <label className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/10 border-dashed cursor-pointer hover:bg-white/8 hover:border-white/20 transition-all">
              <span className="text-2xl">📷</span>
              <div>
                <div className="text-white text-xs font-bold">{previewImage ? '✅ Image selected' : 'Upload receipt'}</div>
                <div className="text-slate-500 text-[10px]">JPG, PNG (max 5MB)</div>
              </div>
              <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            </label>
            {previewImage && (
              <div className="mt-2 relative">
                <img src={previewImage} alt="Receipt preview" className="w-full max-h-36 object-contain rounded-xl border border-white/10 bg-black/20" />
                <button type="button" onClick={() => { setPreviewImage(null); setForm(p => ({ ...p, receipt_image: null })); }}
                  className="absolute top-2 right-2 w-6 h-6 bg-rose-500/80 text-white rounded-full text-xs flex items-center justify-center font-bold hover:bg-rose-500">×</button>
              </div>
            )}
          </div>
          <button type="submit" disabled={saving}
            className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl font-black text-sm disabled:opacity-50 hover:brightness-110 transition-all active:scale-95 flex items-center justify-center gap-2">
            {saving ? <><Spinner small />Saving…</> : '💰 Record Purchase'}
>>>>>>> 00bde25fc7fd19a0eddd476e4b6149a3801bf83a
          </button>
        </form>
      </GlassCard>

<<<<<<< HEAD
      {/* ── BILLS TABLE ───────────────────────────────────────────────── */}
      {purchases.length > 0 ? (
        <GlassCard className="!p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-700/60">
            <h3 className="font-bold text-white text-sm">🧾 Purchase History</h3>
          </div>
          <div className="divide-y divide-gray-700/40">
            {purchases.map(p => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-700/20 transition-colors">

                {/* Description + date */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white text-sm truncate">{p.description}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{p.date_bought}</p>
                </div>

                {/* Receipt indicator */}
                {p.receipt ? (
                  p.receipt.isImage ? (
                    // Image receipt — show clickable thumbnail
                    <a href={p.receipt.url} target="_blank" rel="noreferrer"
                      title={p.receipt.name}
                      className="flex-shrink-0">
                      <img src={p.receipt.url} alt="receipt"
                        className="w-9 h-9 rounded-lg object-cover border border-emerald-600/50
                                   hover:scale-110 transition-transform cursor-pointer" />
                    </a>
                  ) : (
                    // PDF / other file — show a "View Receipt" badge
                    <a href={p.receipt.url} target="_blank" rel="noreferrer"
                      className="flex-shrink-0 text-xs font-bold px-2.5 py-1 rounded-full
                                 bg-emerald-900/50 text-emerald-300 border border-emerald-700/40
                                 hover:bg-emerald-800/60 transition-colors whitespace-nowrap">
                      📄 View Receipt
                    </a>
                  )
                ) : (
                  // No receipt uploaded
                  <span className="flex-shrink-0 text-xs text-gray-600">No receipt</span>
                )}

                {/* Amount */}
                <span className="text-emerald-400 font-black text-sm flex-shrink-0">
                  ₹{p.amount.toLocaleString('en-IN')}
                </span>

                {/* Delete */}
                <button onClick={() => handleDelete(p.id)}
                  className="text-gray-600 hover:text-red-400 transition-colors text-lg leading-none flex-shrink-0">
                  🗑
                </button>
              </div>
            ))}
          </div>
          {/* Running total footer */}
          <div className="px-4 py-3 border-t border-gray-700/60 flex justify-between items-center bg-gray-800/40">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Total</span>
            <span className="font-black text-emerald-300 text-base">₹{totalSpent.toLocaleString('en-IN')}</span>
          </div>
        </GlassCard>
      ) : (
        <GlassCard className="text-center py-12">
          <div className="text-5xl mb-3">🧾</div>
          <p className="text-gray-300 font-bold">No purchases logged yet.</p>
          <p className="text-gray-600 text-xs mt-1">Use the form above to add your first bill.</p>
        </GlassCard>
=======
      {/* Past bills grid */}
      {loading && <PageLoader />}
      {!loading && purchases.length === 0 && (
        <GlassCard><div className="text-center py-6"><div className="text-4xl mb-2">🧾</div><p className="text-slate-400">No purchases yet</p></div></GlassCard>
      )}
      {!loading && purchases.length > 0 && (
        <>
          <h3 className="font-black text-white text-sm px-1">🧾 Past Bills ({purchases.length})</h3>
          <div className="grid grid-cols-2 gap-3">
            {purchases.map(p => (
              <div key={p.id} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden hover:bg-white/8 hover:border-white/15 transition-all group">
                {p.receipt_image ? (
                  <img src={p.receipt_image} alt="Receipt" className="w-full h-28 object-cover" />
                ) : (
                  <div className="w-full h-28 bg-emerald-500/10 flex items-center justify-center text-3xl">🧾</div>
                )}
                <div className="p-3">
                  <div className="font-black text-emerald-400 text-sm">₹{parseFloat(p.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                  <div className="text-white text-xs font-semibold mt-0.5 line-clamp-1">{p.description}</div>
                  <div className="text-slate-500 text-[10px] mt-0.5">{p.date}</div>
                  <button onClick={() => handleDelete(p.id)}
                    className="mt-2 text-[10px] text-slate-600 hover:text-rose-400 transition-colors opacity-0 group-hover:opacity-100">🗑️ Delete</button>
                </div>
              </div>
            ))}
          </div>
        </>
>>>>>>> 00bde25fc7fd19a0eddd476e4b6149a3801bf83a
      )}
    </div>
  );
}

// =============================================================================
<<<<<<< HEAD
// TAB 8: WASTE LOG (FOOD WEIGHT) — 100% local React state
// =============================================================================
// Contractor enters: which meal generated waste and how many kg were discarded.
// Stats update instantly — no backend required.
function WasteLogTab() {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

  // Seed with some demo entries so the table isn't empty on first view
  const [logs, setLogs] = useState([
    { id: 1, meal_type: 'Breakfast', weight_kg: 2.5, date: today, note: 'Idli leftover' },
    { id: 2, meal_type: 'Lunch',     weight_kg: 4.0, date: today, note: 'Dal & rice'   },
  ]);

  const [meal,   setMeal]   = useState('Lunch');
  const [weight, setWeight] = useState('');
  const [note,   setNote]   = useState('');
  const [date,   setDate]   = useState(today);
  const [error,  setError]  = useState('');
  const [toast,  setToast]  = useState(null);

  const totalWaste = logs.reduce((sum, l) => sum + l.weight_kg, 0);

  // Per-meal breakdown for the stats cards
  const wasteByMeal = MEAL_TYPES.reduce((acc, m) => ({
    ...acc,
    [m]: logs.filter(l => l.meal_type === m).reduce((s, l) => s + l.weight_kg, 0)
  }), {});

  const MEAL_COLORS = {
    Breakfast: { bg: 'bg-amber-900/30 border-amber-700/40',   text: 'text-amber-300'   },
    Lunch:     { bg: 'bg-emerald-900/30 border-emerald-700/40', text: 'text-emerald-300' },
    Snacks:    { bg: 'bg-violet-900/30 border-violet-700/40',  text: 'text-violet-300'  },
    Dinner:    { bg: 'bg-indigo-900/30 border-indigo-700/40',  text: 'text-indigo-300'  },
  };

  const handleAdd = (e) => {
    e.preventDefault();
    setError('');
    if (!weight || isNaN(weight) || parseFloat(weight) <= 0) {
      setError('Enter a valid weight in kg (must be > 0).'); return;
    }
    const newEntry = {
      id:       Date.now(),
      meal_type: meal,
      weight_kg: parseFloat(weight),
      date,
      note:     note.trim() || '—',
    };
    setLogs(prev => [newEntry, ...prev]);
    setWeight(''); setNote('');
    setToast({ message: `${meal} waste logged (${newEntry.weight_kg} kg) ♻️`, type: 'success' });
    setTimeout(() => setToast(null), 3000);
  };

  const handleDelete = (id) => {
    setLogs(prev => prev.filter(l => l.id !== id));
=======
// TAB 8: WASTE LOG
// =============================================================================
function WasteLogTab() {
  const [logs,    setLogs]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast,   setToast]   = useState(null);
  const [saving,  setSaving]  = useState(false);
  const [form,    setForm]    = useState({
    date:      new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
    meal_type: 'Lunch',
    weight_kg: '',
    notes:     '',
  });

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try { const r = await fetch(`${API_BASE}/api/waste-logs`); const d = await r.json(); if (d.success) setLogs(d.logs); }
    catch { setToast({ message: 'Failed to load waste logs', type: 'error' }); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.weight_kg || parseFloat(form.weight_kg) < 0) { setToast({ message: 'Enter a valid weight', type: 'error' }); return; }
    setSaving(true);
    try {
      const r = await fetch(`${API_BASE}/api/waste-logs`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const d = await r.json();
      if (d.success) {
        setLogs(prev => [d.log, ...prev]);
        setToast({ message: 'Waste logged! ♻️', type: 'success' });
        setForm(p => ({ ...p, weight_kg: '', notes: '' }));
      } else setToast({ message: d.error, type: 'error' });
    } catch { setToast({ message: 'Network error', type: 'error' }); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    try {
      await fetch(`${API_BASE}/api/waste-logs/${id}`, { method: 'DELETE' });
      setLogs(prev => prev.filter(l => l.id !== id));
      setToast({ message: 'Deleted.', type: 'info' });
    } catch { setToast({ message: 'Delete failed', type: 'error' }); }
  };

  const totalWaste = logs.reduce((sum, l) => sum + l.weight_kg, 0);

  const mealChipColors = {
    Breakfast: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    Lunch:     'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    Snacks:    'bg-violet-500/20 text-violet-300 border-violet-500/30',
    Dinner:    'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
>>>>>>> 00bde25fc7fd19a0eddd476e4b6149a3801bf83a
  };

  return (
    <div className="space-y-4">
      {toast && <Toast {...toast} onDismiss={() => setToast(null)} />}

<<<<<<< HEAD
      {/* ── TOTAL WASTE KPI ───────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-red-900/40 to-orange-900/30 border border-red-700/40 rounded-2xl p-5 flex items-center justify-between">
        <div>
          <p className="text-xs font-bold text-red-400/70 uppercase tracking-widest mb-1">🗑️ Total Food Waste Today</p>
          <p className="text-4xl font-black text-red-300">{totalWaste.toFixed(1)} kg</p>
          <p className="text-red-400/60 text-xs mt-1">
            ≈ ₹{(totalWaste * 120).toFixed(0)} estimated value wasted
          </p>
        </div>
        <div className="text-6xl opacity-20">⚠️</div>
      </div>

      {/* ── PER-MEAL BREAKDOWN CARDS ──────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-2">
        {MEAL_TYPES.map(m => {
          const cfg = MEAL_CONFIG[m];
          const col = MEAL_COLORS[m];
          return (
            <div key={m} className={`rounded-xl border p-3 text-center ${col.bg}`}>
              <div className="text-lg mb-0.5">{cfg.icon}</div>
              <div className={`text-lg font-black ${col.text}`}>{wasteByMeal[m].toFixed(1)}</div>
              <div className={`text-[10px] ${col.text} opacity-70`}>kg</div>
            </div>
          );
        })}
      </div>

      {/* ── LOG NEW WASTE FORM ────────────────────────────────────────── */}
      <GlassCard>
        <h3 className="font-bold text-white text-sm mb-3">🗑️ Log Food Waste</h3>
        <form onSubmit={handleAdd} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Meal</label>
              <select value={meal} onChange={e => setMeal(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-gray-700/60 border border-gray-600 text-white text-sm focus:outline-none focus:border-red-500 transition-all">
                {MEAL_TYPES.map(m => <option key={m} value={m}>{MEAL_CONFIG[m].icon} {m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Weight (kg)</label>
              <input type="number" min="0.1" step="0.1" value={weight} onChange={e => setWeight(e.target.value)}
                placeholder="0.0"
                className="w-full px-3 py-2.5 rounded-xl bg-gray-700/60 border border-gray-600 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-red-500 transition-all" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-gray-700/60 border border-gray-600 text-white text-sm focus:outline-none focus:border-red-500 transition-all" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Note (optional)</label>
              <input value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Leftover dal…"
                className="w-full px-3 py-2.5 rounded-xl bg-gray-700/60 border border-gray-600 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-red-500 transition-all" />
            </div>
          </div>
          {error && <div className="bg-red-900/30 border border-red-700/40 rounded-xl px-3 py-2 text-red-300 text-xs">❌ {error}</div>}
          <button type="submit"
            className="w-full py-2.5 bg-red-700 hover:bg-red-600 text-white rounded-xl font-black text-sm transition-colors">
            + Log Waste
=======
      {/* Total waste hero */}
      <div className="bg-gradient-to-br from-rose-500/15 to-orange-600/10 border border-rose-500/30 rounded-2xl p-5">
        <div className="text-xs font-black uppercase tracking-widest text-rose-400 mb-1">♻️ Total Waste Logged</div>
        <div className="text-4xl font-black text-white">{totalWaste.toFixed(2)} kg</div>
        <div className="text-rose-300/60 text-xs mt-1">{logs.length} entries</div>
      </div>

      {/* Log waste form */}
      <GlassCard>
        <h3 className="font-black text-white text-sm mb-4">📝 Log Food Waste</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Date</label>
              <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-rose-500/60" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Meal</label>
              <select value={form.meal_type} onChange={e => setForm(p => ({ ...p, meal_type: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-rose-500/60">
                {MEAL_TYPES.map(m => <option key={m} value={m} className="text-slate-800">{MEAL_CONFIG[m].icon} {m}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Weight (kg)</label>
            <input type="number" min="0" step="0.01" value={form.weight_kg} onChange={e => setForm(p => ({ ...p, weight_kg: e.target.value }))}
              placeholder="e.g. 3.5" required
              className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-rose-500/60 placeholder-slate-600" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Notes (optional)</label>
            <input type="text" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              placeholder="e.g. Dal uneaten, stale rice…"
              className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-rose-500/60 placeholder-slate-600" />
          </div>
          <button type="submit" disabled={saving}
            className="w-full py-3 bg-gradient-to-r from-rose-500 to-orange-600 text-white rounded-xl font-black text-sm disabled:opacity-50 hover:brightness-110 transition-all active:scale-95 flex items-center justify-center gap-2">
            {saving ? <><Spinner small />Saving…</> : '♻️ Log Waste'}
>>>>>>> 00bde25fc7fd19a0eddd476e4b6149a3801bf83a
          </button>
        </form>
      </GlassCard>

<<<<<<< HEAD
      {/* ── WASTE HISTORY TABLE ───────────────────────────────────────── */}
      {logs.length > 0 ? (
        <GlassCard className="!p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-700/60">
            <h3 className="font-bold text-white text-sm">📋 Waste Log History</h3>
          </div>
          <div className="divide-y divide-gray-700/40">
            {logs.map(l => {
              const cfg = MEAL_CONFIG[l.meal_type] || MEAL_CONFIG.Lunch;
              return (
                <div key={l.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-700/20 transition-colors">
                  <span className="text-xl flex-shrink-0">{cfg.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white text-sm">{l.meal_type}</p>
                    <p className="text-xs text-gray-500 truncate">{l.note} · {l.date}</p>
                  </div>
                  <span className="text-red-300 font-black text-sm flex-shrink-0">{l.weight_kg.toFixed(1)} kg</span>
                  <button onClick={() => handleDelete(l.id)}
                    className="text-gray-600 hover:text-red-400 transition-colors text-lg leading-none flex-shrink-0">
                    🗑
                  </button>
                </div>
              );
            })}
          </div>
          <div className="px-4 py-3 border-t border-gray-700/60 flex justify-between items-center bg-gray-800/40">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Total Waste</span>
            <span className="font-black text-red-300 text-base">{totalWaste.toFixed(1)} kg</span>
          </div>
        </GlassCard>
      ) : (
        <GlassCard className="text-center py-12">
          <div className="text-5xl mb-3">✅</div>
          <p className="text-gray-300 font-bold">No waste logged yet.</p>
          <p className="text-gray-600 text-xs mt-1">Use the form above to track food waste.</p>
        </GlassCard>
=======
      {/* Waste log list */}
      {loading && <PageLoader />}
      {!loading && logs.length === 0 && <GlassCard><div className="text-center py-6"><div className="text-4xl mb-2">♻️</div><p className="text-slate-400">No waste logged yet</p></div></GlassCard>}
      {!loading && logs.length > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
            <h3 className="font-black text-white text-sm">Recent Entries</h3>
            <span className="text-slate-400 text-xs">{logs.length} total</span>
          </div>
          <div className="divide-y divide-white/5">
            {logs.map(log => (
              <div key={log.id} className="px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors group">
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${mealChipColors[log.meal_type] || 'bg-white/10 text-white border-white/20'}`}>
                    {MEAL_CONFIG[log.meal_type]?.icon} {log.meal_type}
                  </span>
                  <div>
                    <div className="text-rose-300 font-black text-sm">{parseFloat(log.weight_kg).toFixed(2)} kg</div>
                    <div className="text-slate-500 text-[10px]">{log.date}{log.notes ? ` · ${log.notes}` : ''}</div>
                  </div>
                </div>
                <button onClick={() => handleDelete(log.id)}
                  className="text-slate-600 hover:text-rose-400 transition-colors opacity-0 group-hover:opacity-100 text-sm">🗑️</button>
              </div>
            ))}
          </div>
        </div>
>>>>>>> 00bde25fc7fd19a0eddd476e4b6149a3801bf83a
      )}
    </div>
  );
}

// =============================================================================
<<<<<<< HEAD
// ROOT: Dashboard — 8-tab shell with glassmorphism header
=======
// ROOT: Dashboard — 8-tab shell
>>>>>>> 00bde25fc7fd19a0eddd476e4b6149a3801bf83a
// =============================================================================
export default function Dashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('overview');
  const { counts, connected }     = useSocket();

  const tabs = [
<<<<<<< HEAD
    { id: 'overview',   label: 'Overview',   emoji: '📊' },
    { id: 'menu',       label: 'Menu',       emoji: '📝' },
    { id: 'audit',      label: 'Audit',      emoji: '🔍' },
    { id: 'ratings',    label: 'Ratings',    emoji: '⭐' },
    { id: 'purchases',  label: 'Purchases',  emoji: '💰' },
    { id: 'waste',      label: 'Waste Log',  emoji: '♻️' },
    { id: 'store',      label: 'Store Room', emoji: '📦' },
    { id: 'staff',      label: 'Staff',      emoji: '👷' },
=======
    { id: 'overview',   label: 'Overview',  emoji: '📊' },
    { id: 'menu',       label: 'Menu',      emoji: '📝' },
    { id: 'audit',      label: 'Audit',     emoji: '🔍' },
    { id: 'ratings',    label: 'Ratings',   emoji: '⭐' },
    { id: 'storeroom',  label: 'Store',     emoji: '📦' },
    { id: 'workers',    label: 'Staff',     emoji: '👷' },
    { id: 'purchases',  label: 'Bills',     emoji: '💰' },
    { id: 'waste',      label: 'Waste',     emoji: '♻️' },
>>>>>>> 00bde25fc7fd19a0eddd476e4b6149a3801bf83a
  ];

  const totalDeliveries = Object.values(counts).reduce((s, c) => s + c, 0);

  return (
<<<<<<< HEAD
    <div className="min-h-screen bg-gray-900 pb-24">

      {/* ── STICKY HEADER ───────────────────────────────────────────────── */}
      <header className="bg-gray-900/90 backdrop-blur-sm border-b border-gray-700/60 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-emerald-700 rounded-xl flex items-center justify-center text-lg">🍽️</div>
              <div>
                <h1 className="font-black text-white text-base leading-tight">Kitchen Dashboard</h1>
                <p className="text-xs text-gray-500">
                  {user ? `👨‍🍳 ${user.name}` : ''} · {new Date().toLocaleDateString('en-IN', {
                    weekday: 'long', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata'
                  })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${
                connected
                  ? 'bg-green-900/40 text-green-300 border-green-700/50'
                  : 'bg-gray-700/40 text-gray-500 border-gray-600/40'
              }`}>
                <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
                {Object.values(counts).reduce((s, c) => s + c, 0)} deliveries
              </div>
              {onLogout && (
                <button onClick={onLogout} className="text-xs text-gray-500 hover:text-red-400 font-semibold transition-colors">
                  Logout
                </button>
=======
    <div className="min-h-screen bg-[#0B0F19] relative overflow-hidden pb-8">
      <div className="absolute top-0 left-0 w-96 h-96 bg-cyan-500/6 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-80 h-80 bg-emerald-500/6 rounded-full blur-3xl pointer-events-none" />

      <header className="sticky top-0 z-40 bg-[#0B0F19]/80 backdrop-blur-xl border-b border-white/8">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center text-lg shadow-lg shadow-emerald-500/20">🍽️</div>
              <div>
                <h1 className="font-black text-base leading-tight bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">Kitchen Dashboard</h1>
                <p className="text-xs text-slate-500">{user ? `👨‍🍳 ${user.name}` : ''} · {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-bold border ${connected ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-white/5 border-white/10 text-slate-500'}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                {totalDeliveries}
              </div>
              {onLogout && (
                <button onClick={onLogout} className="text-xs text-slate-500 hover:text-white transition-colors border border-white/10 rounded-lg px-2.5 py-1.5 hover:border-white/20">Logout</button>
>>>>>>> 00bde25fc7fd19a0eddd476e4b6149a3801bf83a
              )}
            </div>
          </div>

<<<<<<< HEAD
          {/* ── Tab bar ────────────────────────────────────────────────── */}
          <div className="flex gap-0.5 bg-gray-800/60 border border-gray-700/40 rounded-xl p-1">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all leading-tight ${
                  activeTab === t.id
                    ? 'bg-gray-700 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-300'
                }`}>
                <div className="text-sm">{t.emoji}</div>
                <div className="text-[10px] mt-0.5">{t.label}</div>
=======
          {/* Tab bar — 8 tabs, horizontally scrollable */}
          <div className="flex gap-1 bg-white/5 rounded-xl p-1 overflow-x-auto">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`flex-shrink-0 py-2 px-2.5 rounded-lg text-xs font-black transition-all whitespace-nowrap
                  ${activeTab === t.id ? 'bg-white/10 text-white border border-white/10 shadow-inner' : 'text-slate-400 hover:text-slate-300'}`}>
                {t.emoji} {t.label}
>>>>>>> 00bde25fc7fd19a0eddd476e4b6149a3801bf83a
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ── TAB CONTENT ─────────────────────────────────────────────────── */}
      <main className="max-w-2xl mx-auto px-4 py-5">
        {activeTab === 'overview'  && <OverviewTab counts={counts} connected={connected} />}
        {activeTab === 'menu'      && <MenuEditorTab />}
        {activeTab === 'audit'     && <AuditLogTab />}
        {activeTab === 'ratings'   && <RatingsTab />}
<<<<<<< HEAD
        {activeTab === 'purchases' && <PurchasesTab />}
        {activeTab === 'waste'     && <WasteLogTab />}
        {activeTab === 'store'     && <StoreRoomTab />}
        {activeTab === 'staff'     && <StaffTab />}
=======
        {activeTab === 'storeroom' && <StoreRoomTab />}
        {activeTab === 'workers'   && <WorkersTab />}
        {activeTab === 'purchases' && <PurchasesTab />}
        {activeTab === 'waste'     && <WasteLogTab />}
>>>>>>> 00bde25fc7fd19a0eddd476e4b6149a3801bf83a
      </main>
    </div>
  );
}
