/*
=============================================================================
FILE: Dashboard.js  —  Kitchen Dashboard v2 (Mess Contractor)
=============================================================================
WHAT'S NEW:
  • WeatherControl: fetches live weather from Open-Meteo (NIT Raipur coords)
    with a manual override dropdown right next to it
  • AuditLogTab: Name is now the PRIMARY column (roll_number is secondary)
  • Dashboard header: shows logged-in contractor name + Logout button
=============================================================================
*/

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';

const API_BASE   = 'http://localhost:3001';
const SOCKET_URL = 'http://localhost:3001';

const HOSTELS = ['Chitrakot', 'Mainpat', 'Sirpur', 'Mahanadi', 'Indravati', 'Malhar', 'Kotumsar', 'Seonath'];

const countToTrafficLevel = (count) => {
  if (count >= 8) return 'High';
  if (count >= 3) return 'Medium';
  return 'Low';
};

const TRAFFIC_COLORS = {
  Low:    { bg: 'bg-green-100',  text: 'text-green-700',  dot: 'bg-green-500'  },
  Medium: { bg: 'bg-amber-100',  text: 'text-amber-700',  dot: 'bg-amber-500'  },
  High:   { bg: 'bg-red-100',    text: 'text-red-700',    dot: 'bg-red-500'    },
};

const MEAL_TYPES   = ['Breakfast', 'Lunch', 'Snacks', 'Dinner'];
const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const MEAL_CONFIG = {
  Breakfast: { icon: '🌅', colorBg: 'from-amber-50 to-orange-50',   colorBorder: 'border-amber-200',   colorBadge: 'bg-amber-100 text-amber-700',     colorText: 'text-amber-700'   },
  Lunch:     { icon: '☀️', colorBg: 'from-emerald-50 to-green-50', colorBorder: 'border-emerald-200', colorBadge: 'bg-emerald-100 text-emerald-700', colorText: 'text-emerald-700' },
  Snacks:    { icon: '🫖', colorBg: 'from-violet-50 to-purple-50', colorBorder: 'border-violet-200',  colorBadge: 'bg-violet-100 text-violet-700',  colorText: 'text-violet-700'  },
  Dinner:    { icon: '🌙', colorBg: 'from-indigo-50 to-blue-50',   colorBorder: 'border-indigo-200',  colorBadge: 'bg-indigo-100 text-indigo-700',  colorText: 'text-indigo-700'  },
};

// ─────────────────────────────────────────────────────────────────────────────
// SMALL UI HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const Spinner = ({ small = false }) => (
  <div className={`inline-block border-4 border-gray-200 border-t-indigo-500 rounded-full animate-spin ${small ? 'w-5 h-5' : 'w-10 h-10'}`} />
);

const PageLoader = () => (
  <div className="flex flex-col items-center justify-center py-20 gap-4">
    <Spinner /><p className="text-gray-400 text-sm">Loading…</p>
  </div>
);

const Card = ({ children, className = '' }) => (
  <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-5 ${className}`}>{children}</div>
);

const Toast = ({ message, type = 'success', onDismiss }) => {
  useEffect(() => { const t = setTimeout(onDismiss, 3500); return () => clearTimeout(t); }, [onDismiss]);
  const colors = { success: 'bg-green-600', error: 'bg-red-600', info: 'bg-indigo-600' };
  return (
    <div className={`fixed top-4 right-4 z-50 ${colors[type]} text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 max-w-xs`}>
      <span>{type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
      <span className="text-sm font-medium">{message}</span>
      <button onClick={onDismiss} className="ml-2 opacity-70 hover:opacity-100">×</button>
    </div>
  );
};

const StatCard = ({ title, value, subtitle, emoji, highlight = false }) => (
  <div className={`rounded-2xl border-2 p-4 flex flex-col gap-2 transition-all ${highlight ? 'border-green-400 bg-green-50 shadow-lg shadow-green-100 scale-105' : 'border-gray-100 bg-white shadow-sm'}`}>
    <div className="text-2xl">{emoji}</div>
    <div className={`text-3xl font-black ${highlight ? 'text-green-600' : 'text-gray-800'}`}>{value ?? '—'}</div>
    <div className="font-semibold text-gray-600 text-xs">{title}</div>
    {subtitle && <div className="text-xs text-gray-400 leading-tight">{subtitle}</div>}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// HOOK: useSocket
// ─────────────────────────────────────────────────────────────────────────────
function useSocket() {
  const [counts, setCounts]       = useState(HOSTELS.reduce((a, h) => ({ ...a, [h]: 0 }), {}));
  const [connected, setConnected] = useState(false);
  const socketRef                 = useRef(null);

  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;
    socket.on('connect',    () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('delivery_count_updated', (updatedCounts) => setCounts(updatedCounts));
    return () => socket.disconnect();
  }, []);

  return { counts, connected };
}

// =============================================================================
// WEATHER CONTROL — Live Open-Meteo API + manual override dropdown
// NIT Raipur coords: 21.2497°N, 81.6029°E
// =============================================================================
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
      // WMO code: 0-1 = Clear, 2-3 = Partly cloudy → Clear; 51+ = rain/drizzle/snow → Rain
      const code = d?.current?.weathercode ?? 0;
      const auto = code >= 51 ? 'Rain' : 'Clear';
      setLiveWeather(auto);
      onChange(auto); // Auto-set weather condition
    } catch {
      setFetchError(true);
    } finally { setFetching(false); }
  }, []); // eslint-disable-line

  useEffect(() => { fetchWeather(); }, [fetchWeather]);

  return (
    <div className="col-span-2">
      <div className="flex items-center justify-between mb-1">
        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide">☁️ Weather</label>
        <div className="flex items-center gap-2">
          {fetching && (
            <span className="text-xs text-indigo-500 flex items-center gap-1">
              <div className="w-3 h-3 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
              Fetching live…
            </span>
          )}
          {!fetching && liveWeather && !fetchError && (
            <span className="text-xs text-green-600 font-semibold flex items-center gap-1">
              🛰️ Live: {liveWeather === 'Clear' ? '☀️' : '🌧️'} {liveWeather}
            </span>
          )}
          {fetchError && <span className="text-xs text-red-500">⚠️ API failed</span>}
          <button
            type="button"
            onClick={fetchWeather}
            disabled={fetching}
            className="text-xs text-indigo-500 hover:text-indigo-700 font-bold transition-colors disabled:opacity-50"
          >
            🔄
          </button>
        </div>
      </div>
      {/* Manual override dropdown — always visible */}
      <select
        value={weather}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-xl border-2 border-gray-200 text-sm focus:outline-none focus:border-indigo-400"
      >
        <option value="Clear">☀️ Clear</option>
        <option value="Rain">🌧️ Rain</option>
      </select>
      <p className="text-xs text-gray-400 mt-1">
        {liveWeather && !fetchError
          ? `Auto-detected: ${liveWeather}. You can override manually above.`
          : 'Select manually (live weather fetch unavailable).'}
      </p>
    </div>
  );
}

// =============================================================================
// TAB 1: OVERVIEW
// =============================================================================
function OverviewTab({ counts, connected }) {
  const [selectedHostel, setSelectedHostel] = useState('Chitrakot');
  const [mealType,       setMealType]       = useState('Lunch');
  const [conditions,     setConditions]     = useState({ weather: 'Clear', menu_item: 'Paneer' });
  const [data,           setData]           = useState(null);
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState(null);

  const liveCount    = counts[selectedHostel] || 0;
  const trafficLevel = countToTrafficLevel(liveCount);
  const trafficStyle = TRAFFIC_COLORS[trafficLevel];

  const fetchDashboard = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({
        weather:   conditions.weather,
        menu_item: conditions.menu_item,
        meal_type: mealType,
        hostel:    selectedHostel,
      });
      const r = await fetch(`${API_BASE}/dashboard?${params}`);
      const d = await r.json();
      if (!d.success) throw new Error(d.error);
      setData(d);
    } catch (e) {
      setError(e.message || 'Failed to load dashboard');
    } finally { setLoading(false); }
  }, [conditions, mealType, selectedHostel]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  const prevCountRef = useRef(liveCount);
  useEffect(() => {
    if (prevCountRef.current !== liveCount) {
      prevCountRef.current = liveCount;
      fetchDashboard();
    }
  }, [liveCount, fetchDashboard]);

  const cfg = MEAL_CONFIG[mealType] || MEAL_CONFIG.Lunch;

  return (
    <div className="space-y-4">

      {/* ── HOSTEL SELECTOR ──────────────────────────────────────────── */}
      <Card>
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
          🏠 Select Hostel
        </label>
        <select
          value={selectedHostel}
          onChange={e => setSelectedHostel(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border-2 border-indigo-200 bg-indigo-50 text-indigo-800
                     font-bold text-sm focus:outline-none focus:border-indigo-500"
        >
          {HOSTELS.map(h => <option key={h} value={h}>{h} Hostel</option>)}
        </select>

        <div className="mt-3 flex items-center gap-3">
          <div className="flex-1 bg-gray-50 rounded-xl p-3 text-center border border-gray-100">
            <div className="text-2xl font-black text-gray-800">{liveCount}</div>
            <div className="text-xs text-gray-400 mt-0.5">Deliveries today</div>
          </div>
          <div className={`flex-1 ${trafficStyle.bg} rounded-xl p-3 text-center border`}>
            <div className="flex items-center justify-center gap-1.5 mb-0.5">
              <div className={`w-2.5 h-2.5 rounded-full ${trafficStyle.dot}`} />
              <div className={`text-lg font-black ${trafficStyle.text}`}>{trafficLevel}</div>
            </div>
            <div className={`text-xs ${trafficStyle.text} opacity-70`}>Traffic level</div>
          </div>
          <div className="flex flex-col items-center gap-1 px-3">
            <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-400'}`} />
            <span className="text-xs text-gray-400">{connected ? 'Live' : 'Offline'}</span>
          </div>
        </div>

        <div className="mt-3 bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-xs text-indigo-700">
          🔌 <strong>Live ML Integration:</strong> Guard taps on the Gate Security screen
          automatically update this traffic level, fed directly into the AI prediction.
          <strong> No manual input needed.</strong>
        </div>
      </Card>

      {/* ── CONDITION CONTROLS ───────────────────────────────────────── */}
      <Card>
        <h3 className="font-bold text-gray-700 text-sm mb-3">⚙️ Prediction Controls</h3>
        <div className="grid grid-cols-2 gap-3">

          <div className="col-span-2">
            <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">Predict for meal:</label>
            <div className="grid grid-cols-4 gap-1.5">
              {MEAL_TYPES.map(m => {
                const c = MEAL_CONFIG[m];
                return (
                  <button key={m} onClick={() => setMealType(m)}
                    className={`py-2 rounded-xl text-xs font-bold transition-all border-2 ${mealType === m ? `${c.colorBadge} ${c.colorBorder} scale-105` : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                    {c.icon} {m}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Live weather fetch + manual override */}
          <WeatherControl
            weather={conditions.weather}
            onChange={w => setConditions(p => ({ ...p, weather: w }))}
          />

          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wide">🍛 Menu Type</label>
            <select value={conditions.menu_item} onChange={e => setConditions(p => ({ ...p, menu_item: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border-2 border-gray-200 text-sm focus:outline-none focus:border-indigo-400">
              <option value="Paneer">🧀 Paneer (Popular)</option>
              <option value="Tori">🥒 Tori (Unpopular)</option>
            </select>
          </div>

          <div className="col-span-2">
            <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wide">
              🛵 Delivery Traffic <span className="text-indigo-500 normal-case">(auto from {selectedHostel} live count)</span>
            </label>
            <div className={`w-full px-4 py-2.5 rounded-xl border-2 font-bold text-sm flex items-center gap-2 ${trafficStyle.bg} ${trafficStyle.text} border-current/20`}>
              <div className={`w-2.5 h-2.5 rounded-full ${trafficStyle.dot}`} />
              {trafficLevel} ({liveCount} deliveries → auto-mapped)
            </div>
          </div>
        </div>

        <button onClick={fetchDashboard} disabled={loading}
          className="mt-4 w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold disabled:opacity-50 transition-colors">
          {loading ? <span className="flex items-center justify-center gap-2"><Spinner small />Refreshing…</span> : '🔄 Refresh Prediction'}
        </button>
      </Card>

      {error && <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-700 text-sm">⚠️ {error}</div>}
      {loading && !data && <PageLoader />}

      {data && (
        <>
          <Card>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">
              {cfg.icon} {mealType} Calculation for {selectedHostel} Hostel
            </p>
            <div className="flex flex-wrap items-center gap-2 text-sm font-mono">
              <span className="bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg font-bold">{data.total_enrolled} Total</span>
              <span className="text-gray-400 font-bold">−</span>
              <span className="bg-red-100 text-red-700 px-3 py-1.5 rounded-lg font-bold">{data.manual_cancellations} Cancelled</span>
              <span className="text-gray-400 font-bold">−</span>
              <span className="bg-purple-100 text-purple-700 px-3 py-1.5 rounded-lg font-bold">{data.unreported_absences} AI Skip</span>
              <span className="text-gray-400 font-bold">=</span>
              <span className="bg-green-100 text-green-700 px-3 py-1.5 rounded-lg font-bold text-base">🍽️ {data.final_plates_to_cook}</span>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Traffic: <strong>{data.derived_traffic_level}</strong> (from {liveCount} live {selectedHostel} deliveries)
              {data.meal_scale_factor !== 1 && ` · ML scaled by ${(data.meal_scale_factor * 100).toFixed(0)}% for ${mealType}`}
            </p>
          </Card>

          <div className="grid grid-cols-2 gap-3">
            <StatCard emoji="👥" title="Total Enrolled"             value={data.total_enrolled}       subtitle="All mess members" />
            <StatCard emoji="❌" title={`${mealType} Cancellations`} value={data.manual_cancellations} subtitle="App cancellations" />
            <StatCard emoji="🤖" title="AI Predicted Skips"          value={data.unreported_absences}  subtitle="Won't show, didn't cancel" />
            <StatCard emoji="🍽️" title="Plates to Cook"              value={data.final_plates_to_cook} subtitle="Final recommendation" highlight />
          </div>

          {/* ── PLATES SAVED KPI ─────────────────────────────────────────── */}
          <div className="bg-gradient-to-br from-teal-500 to-emerald-600 rounded-2xl p-5 shadow-lg text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-white/70 uppercase tracking-widest mb-1">
                  ♻️ Plates Saved Today
                </p>
                <p className="text-5xl font-black leading-none">
                  {data.total_enrolled - data.final_plates_to_cook}
                </p>
                <p className="text-white/70 text-xs mt-2 leading-snug">
                  {data.total_enrolled} enrolled − {data.final_plates_to_cook} to cook
                </p>
              </div>
              <div className="text-right">
                <div className="text-6xl opacity-30">♻️</div>
                <div className="text-xs text-white/60 mt-1 font-semibold">
                  ≈ {((data.total_enrolled - data.final_plates_to_cook) * 0.35).toFixed(1)} kg<br />food saved
                </div>
              </div>
            </div>
            <div className="mt-3 bg-white/10 rounded-xl px-4 py-2 text-xs text-white/80">
              Formula: <strong>Saved = Total Enrolled − Plates to Cook</strong><br />
              Cancellations ({data.manual_cancellations}) + AI no-shows ({data.unreported_absences}) = {data.manual_cancellations + data.unreported_absences} plates not cooked
            </div>
          </div>

          <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4">
            <h3 className="font-bold text-amber-900 text-sm flex items-center gap-2 mb-2">
              🧮 90th Percentile Safety Buffer (α = 0.90)
            </h3>
            <div className="text-xs text-amber-800 space-y-1">
              <p>Under-prediction penalty = <strong className="text-red-600">0.90 × error</strong> (students go hungry)</p>
              <p>Over-prediction penalty  = <strong className="text-green-600">0.10 × error</strong> (some waste, acceptable)</p>
              <p className="pt-1 border-t border-amber-200">Model targets the <strong>90th percentile</strong> — safe on 9 out of 10 days.</p>
            </div>
          </div>

          {data.ml_error && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-xs text-yellow-700">
              ⚠️ ML service unavailable. Start FastAPI on port 8000.
            </div>
          )}
        </>
      )}
    </div>
  );
}

// =============================================================================
// TAB 2: MENU EDITOR
// =============================================================================
function MenuEditorTab() {
  const [weekMenu, setWeekMenu] = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [toast,    setToast]    = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/menu-week`);
        const d = await r.json();
        if (d.success) setWeekMenu(d.menu);
      } catch { setToast({ message: 'Failed to load menu', type: 'error' }); }
      finally { setLoading(false); }
    })();
  }, []);

  const handleChange = (day, meal, value) =>
    setWeekMenu(prev => ({ ...prev, [day]: { ...prev[day], [meal]: value } }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const r = await fetch(`${API_BASE}/menu`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(weekMenu)
      });
      const d = await r.json();
      setToast({ message: d.success ? 'Weekly menu saved! 🎉' : d.error, type: d.success ? 'success' : 'error' });
    } catch { setToast({ message: 'Save failed', type: 'error' }); }
    finally { setSaving(false); }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-4">
      {toast && <Toast {...toast} onDismiss={() => setToast(null)} />}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-gray-800">Weekly Menu Editor</h2>
          <p className="text-xs text-gray-400">Edit and press Save.</p>
        </div>
        <button onClick={handleSave} disabled={saving}
          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm disabled:opacity-50">
          {saving ? <span className="flex items-center gap-2"><Spinner small />Saving…</span> : '💾 Save Menu'}
        </button>
      </div>

      {weekMenu && DAYS_OF_WEEK.map(day => (
        <Card key={day} className="!p-4">
          <h3 className="font-bold text-gray-700 mb-3 pb-2 border-b border-gray-100">📅 {day}</h3>
          <div className="grid grid-cols-1 gap-2">
            {MEAL_TYPES.map(meal => {
              const c = MEAL_CONFIG[meal];
              return (
                <div key={meal} className={`rounded-xl bg-gradient-to-r ${c.colorBg} border ${c.colorBorder} p-3`}>
                  <label className={`text-xs font-bold ${c.colorText} mb-1 block`}>{c.icon} {meal}</label>
                  <input type="text" value={weekMenu[day]?.[meal] || ''} onChange={e => handleChange(day, meal, e.target.value)}
                    placeholder={`${meal} items…`}
                    className="w-full bg-white/70 border border-white rounded-lg px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-white/80" />
                </div>
              );
            })}
          </div>
        </Card>
      ))}

      <button onClick={handleSave} disabled={saving}
        className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm disabled:opacity-50">
        {saving ? 'Saving…' : '💾 Save All Changes'}
      </button>
    </div>
  );
}

// =============================================================================
// TAB 3: AUDIT LOG  — Name is now PRIMARY column
// =============================================================================
function AuditLogTab() {
  const [auditDate,  setAuditDate]  = useState(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }));
  const [data,       setData]       = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [filterMeal, setFilterMeal] = useState('All');

  const fetchAudit = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/audit-cancellations?date=${auditDate}`);
      const d = await r.json();
      if (d.success) setData(d);
    } catch { setData(null); }
    finally { setLoading(false); }
  }, [auditDate]);

  useEffect(() => { fetchAudit(); }, [fetchAudit]);

  const filtered = data?.cancellations?.filter(c => filterMeal === 'All' || c.meal_type === filterMeal) || [];
  const countByMeal = MEAL_TYPES.reduce((acc, m) => ({
    ...acc, [m]: data?.cancellations?.filter(c => c.meal_type === m).length || 0
  }), {});

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">📅 Audit Date</label>
            <input type="date" value={auditDate} onChange={e => setAuditDate(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border-2 border-gray-200 text-sm focus:outline-none focus:border-indigo-400" />
          </div>
          <button onClick={fetchAudit} disabled={loading}
            className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold disabled:opacity-50">
            {loading ? <Spinner small /> : '🔍 Load'}
          </button>
        </div>
      </Card>

      {data && (
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white rounded-xl border border-gray-100 p-3 text-center shadow-sm">
            <div className="text-2xl font-black text-gray-800">{data.total_cancellations}</div>
            <div className="text-xs text-gray-400">Total Cancellations</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-3 text-center shadow-sm">
            <div className="text-2xl font-black text-gray-800">{data.unique_students}</div>
            <div className="text-xs text-gray-400">Unique Students</div>
          </div>
          {MEAL_TYPES.map(m => {
            const c = MEAL_CONFIG[m];
            return (
              <div key={m} className={`rounded-xl border p-3 text-center bg-gradient-to-br ${c.colorBg} ${c.colorBorder}`}>
                <div className={`text-xl font-black ${c.colorText}`}>{countByMeal[m]}</div>
                <div className={`text-xs ${c.colorText} opacity-70`}>{c.icon} {m}</div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex gap-1.5 flex-wrap">
        {['All', ...MEAL_TYPES].map(m => {
          const c = m === 'All' ? null : MEAL_CONFIG[m];
          return (
            <button key={m} onClick={() => setFilterMeal(m)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all ${filterMeal === m ? (c ? `${c.colorBadge} ${c.colorBorder}` : 'bg-gray-800 text-white border-gray-800') : 'border-gray-200 text-gray-500 bg-white'}`}>
              {c ? `${c.icon} ` : ''}{m}
            </button>
          );
        })}
      </div>

      {loading && <PageLoader />}

      {!loading && filtered.length === 0 && (
        <Card className="text-center py-8">
          <div className="text-4xl mb-2">🎉</div>
          <p className="text-gray-500 font-semibold">No cancellations found</p>
          <p className="text-gray-400 text-xs mt-1">{filterMeal === 'All' ? 'No meals cancelled on this date.' : `No ${filterMeal} cancellations.`}</p>
        </Card>
      )}

      {!loading && filtered.length > 0 && (
        <Card className="!p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {/* Name is now the PRIMARY column header */}
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Student Name</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Meal</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Time</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Flag</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((c, i) => {
                  const cfg = MEAL_CONFIG[c.meal_type] || MEAL_CONFIG.Lunch;
                  const rawTime = c.cancelled_at;
                  // SQLite CURRENT_TIMESTAMP is UTC without 'Z'. Append it for correct JS parsing.
                  const timeStr = rawTime
                    ? new Date(rawTime.replace(' ', 'T') + 'Z').toLocaleTimeString('en-IN', {
                        timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit'
                      })
                    : '—';
                  return (
                    <tr key={`${c.id}-${i}`} className={`hover:bg-gray-50 ${c.is_frequent ? 'bg-red-50/40' : ''}`}>
                      <td className="px-4 py-3">
                        {/* Name is PRIMARY — roll_number is just a secondary note */}
                        <div className="font-semibold text-gray-800 text-xs">{c.name}</div>
                        <div className="text-xs text-gray-400">{c.roll_number}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${cfg.colorBadge}`}>{cfg.icon} {c.meal_type}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 font-mono">{timeStr}</td>
                      <td className="px-4 py-3">
                        {c.is_frequent
                          ? <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full bg-red-100 text-red-700">⚠️ {c.monthly_count}/mo</span>
                          : <span className="text-xs text-gray-300">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700">
        ⚠️ <strong>Spam Detection:</strong> Students with ≥ {data?.spam_threshold || 15} cancellations this month are flagged.
      </div>
    </div>
  );
}

// =============================================================================
// ROOT: Dashboard — tab shell
// =============================================================================
export default function Dashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('overview');
  const { counts, connected } = useSocket();

  const tabs = [
    { id: 'overview', label: 'Overview',    emoji: '📊' },
    { id: 'menu',     label: 'Menu Editor', emoji: '📝' },
    { id: 'audit',    label: 'Audit Log',   emoji: '🔍' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-emerald-600 rounded-xl flex items-center justify-center text-white text-lg">🍽️</div>
              <div>
                <h1 className="font-black text-gray-800 text-base leading-tight">Kitchen Dashboard</h1>
                <p className="text-xs text-gray-400">
                  {user ? `👨‍🍳 ${user.name}` : ''} · {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${connected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                {Object.values(counts).reduce((s, c) => s + c, 0)} deliveries
              </div>
              {onLogout && (
                <button onClick={onLogout}
                  className="text-xs text-gray-400 hover:text-red-500 font-semibold transition-colors">
                  Logout
                </button>
              )}
            </div>
          </div>
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === t.id ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                {t.emoji} {t.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5">
        {activeTab === 'overview' && <OverviewTab counts={counts} connected={connected} />}
        {activeTab === 'menu'     && <MenuEditorTab />}
        {activeTab === 'audit'    && <AuditLogTab />}
      </main>
    </div>
  );
}
