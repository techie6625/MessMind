/*
=============================================================================
FILE: Dashboard.js  —  Kitchen Dashboard with Hostel-aware Socket.io (React)
=============================================================================
PURPOSE:
  The Kitchen Dashboard now includes a hostel selector.
  When a hostel is selected, the dashboard:
    1. Shows that hostel's live delivery count (via Socket.io)
    2. Auto-maps the count → delivery_traffic level (Low / Medium / High)
    3. Feeds that traffic level directly into the ML prediction call
    4. This means: guard taps live-update the AI prediction in real time!

TABS:
  1. Overview   — Stats cards + hostel-aware ML prediction
  2. Menu Editor — 7-day × 4-meal editable grid
  3. Audit Log  — Cancellation trail with spam detection
=============================================================================
*/

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────
const API_BASE   = 'http://localhost:3001';
const SOCKET_URL = 'http://localhost:3001';

const HOSTELS = ['Chitrakot', 'Mainpat', 'Sirpur', 'Mahanadi', 'Indravati', 'Malhar', 'Kotumsar', 'Seonath'];

// Delivery count thresholds for the traffic level mapping
// (Must match countToTrafficLevel() in server.js)
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
// Manages the Socket.io connection for the dashboard.
// Returns: { counts, connected }
// ─────────────────────────────────────────────────────────────────────────────
function useSocket() {
  const [counts, setCounts]       = useState(HOSTELS.reduce((a, h) => ({ ...a, [h]: 0 }), {}));
  const [connected, setConnected] = useState(false);
  const socketRef                 = useRef(null);

  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect',    ()        => setConnected(true));
    socket.on('disconnect', ()        => setConnected(false));

    // The KEY real-time event: whenever ANY guard taps a button,
    // this fires and we update our count display
    socket.on('delivery_count_updated', (updatedCounts) => {
      setCounts(updatedCounts);
    });

    return () => socket.disconnect();
  }, []);

  return { counts, connected };
}

// =============================================================================
// TAB 1: OVERVIEW
// =============================================================================
function OverviewTab({ counts, connected }) {
  // Selected hostel for filtering the dashboard
  const [selectedHostel,  setSelectedHostel]  = useState('Chitrakot');
  const [mealType,        setMealType]        = useState('Lunch');
  const [conditions,      setConditions]      = useState({ weather: 'Clear', menu_item: 'Paneer' });
  const [data,            setData]            = useState(null);
  const [loading,         setLoading]         = useState(false);
  const [error,           setError]           = useState(null);

  // Compute live traffic level from the selected hostel's current count
  const liveCount    = counts[selectedHostel] || 0;
  const trafficLevel = countToTrafficLevel(liveCount);
  const trafficStyle = TRAFFIC_COLORS[trafficLevel];

  // Fetch dashboard data whenever hostel, meal, or conditions change
  const fetchDashboard = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({
        weather:          conditions.weather,
        menu_item:        conditions.menu_item,
        meal_type:        mealType,
        hostel:           selectedHostel, // Backend will auto-derive traffic from live count
      });
      const r = await fetch(`${API_BASE}/dashboard?${params}`);
      const d = await r.json();
      if (!d.success) throw new Error(d.error);
      setData(d);
    } catch (e) {
      setError(e.message || 'Failed to load dashboard');
    } finally { setLoading(false); }
  }, [conditions, mealType, selectedHostel]);

  // Initial fetch + re-fetch when hostel/meal changes
  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  // Auto-refresh when the delivery count for the SELECTED hostel changes.
  // This is the live feedback loop:
  //   guard taps → count changes → this useEffect fires → new ML prediction fetched
  const prevCountRef = useRef(liveCount);
  useEffect(() => {
    if (prevCountRef.current !== liveCount) {
      prevCountRef.current = liveCount;
      fetchDashboard(); // Trigger new ML prediction with updated traffic level
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

        {/* Live delivery count + traffic badge for selected hostel */}
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
          {/* Connection status */}
          <div className={`flex flex-col items-center gap-1 px-3`}>
            <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-400'}`} />
            <span className="text-xs text-gray-400">{connected ? 'Live' : 'Offline'}</span>
          </div>
        </div>

        {/* Explain the live integration to judges */}
        <div className="mt-3 bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-xs text-indigo-700">
          🔌 <strong>Live ML Integration:</strong> Guard taps on the Gate Security screen
          automatically update this traffic level, which is fed directly into the AI prediction.
          <strong> No manual input needed.</strong>
        </div>
      </Card>

      {/* ── CONDITION CONTROLS ───────────────────────────────────────── */}
      <Card>
        <h3 className="font-bold text-gray-700 text-sm mb-3">⚙️ Prediction Controls</h3>
        <div className="grid grid-cols-2 gap-3">

          {/* Meal selector */}
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

          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wide">☁️ Weather</label>
            <select value={conditions.weather} onChange={e => setConditions(p => ({ ...p, weather: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border-2 border-gray-200 text-sm focus:outline-none focus:border-indigo-400">
              <option value="Clear">☀️ Clear</option>
              <option value="Rain">🌧️ Rain</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wide">🍛 Menu Type</label>
            <select value={conditions.menu_item} onChange={e => setConditions(p => ({ ...p, menu_item: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border-2 border-gray-200 text-sm focus:outline-none focus:border-indigo-400">
              <option value="Paneer">🧀 Paneer (Popular)</option>
              <option value="Tori">🥒 Tori (Unpopular)</option>
            </select>
          </div>

          {/* Traffic level: read-only, driven by live Socket.io data */}
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
          {/* Calculation formula */}
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
            <StatCard emoji="👥" title="Total Enrolled"       value={data.total_enrolled}       subtitle="All mess members" />
            <StatCard emoji="❌" title={`${mealType} Cancellations`} value={data.manual_cancellations} subtitle="App cancellations" />
            <StatCard emoji="🤖" title="AI Predicted Skips"   value={data.unreported_absences}  subtitle="Won't show, didn't cancel" />
            <StatCard emoji="🍽️" title="Plates to Cook"       value={data.final_plates_to_cook} subtitle="Final recommendation" highlight />
          </div>

          {/* Safety buffer explainer */}
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
      } catch (e) { setToast({ message: 'Failed to load menu', type: 'error' }); }
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
// TAB 3: AUDIT LOG
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
  const countByMeal = MEAL_TYPES.reduce((acc, m) => ({ ...acc, [m]: data?.cancellations?.filter(c => c.meal_type === m).length || 0 }), {});

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
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Student</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Meal</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Time</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Flag</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((c, i) => {
                  const cfg = MEAL_CONFIG[c.meal_type] || MEAL_CONFIG.Lunch;
                  const timeStr = c.cancelled_at ? new Date(c.cancelled_at).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }) : '—';
                  return (
                    <tr key={`${c.id}-${i}`} className={`hover:bg-gray-50 ${c.is_frequent ? 'bg-red-50/40' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-gray-800 text-xs">{c.roll_number}</div>
                        <div className="text-xs text-gray-400">{c.name}</div>
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
// ROOT: Dashboard — tab shell with shared Socket.io state
// =============================================================================
export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  // useSocket is called at the Dashboard level so the connection is shared
  // across all tabs — we don't reconnect when switching tabs
  const { counts, connected } = useSocket();

  const tabs = [
    { id: 'overview', label: 'Overview',    emoji: '📊' },
    { id: 'menu',     label: 'Menu Editor', emoji: '📝' },
    { id: 'audit',    label: 'Audit Log',   emoji: '🔍' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white text-lg">🍽️</div>
              <div>
                <h1 className="font-black text-gray-800 text-base leading-tight">Kitchen Dashboard</h1>
                <p className="text-xs text-gray-400">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })}</p>
              </div>
            </div>
            {/* Live total deliveries chip */}
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${connected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
              {Object.values(counts).reduce((s, c) => s + c, 0)} deliveries
            </div>
          </div>
          {/* Tab bar */}
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
