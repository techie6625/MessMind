/*
=============================================================================
FILE: Dashboard.js  —  Kitchen Dashboard v4  (No-ML, Manual Analytics)
=============================================================================
Changes from v3:
  • Removed ALL ML prediction controls, weather API, Plates Saved widget
  • Removed any mention of "AI", "Model", "Prediction"
  • OverviewTab: now shows simple manual cancellation stats + reason breakdown
  • AuditLogTab: now displays the `reason` column prominently
  • New RatingsTab: aggregated anonymous star ratings per meal
=============================================================================
*/

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';

const API_BASE   = 'http://localhost:3001';
const SOCKET_URL = 'http://localhost:3001';

const HOSTELS      = ['Chitrakot', 'Mainpat', 'Sirpur', 'Mahanadi', 'Indravati', 'Malhar', 'Kotumsar', 'Seonath'];
const MEAL_TYPES   = ['Breakfast', 'Lunch', 'Snacks', 'Dinner'];
const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const MEAL_CONFIG = {
  Breakfast: { icon: '🌅', label: 'Breakfast' },
  Lunch:     { icon: '☀️', label: 'Lunch'     },
  Snacks:    { icon: '🫖', label: 'Snacks'    },
  Dinner:    { icon: '🌙', label: 'Dinner'    },
};

// ─────────────────────────────────────────────────────────────────────────────
// SMALL UI HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const Spinner = ({ small = false }) => (
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
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// STAT CARD
// ─────────────────────────────────────────────────────────────────────────────
const StatCard = ({ title, value, subtitle, emoji, highlight = false }) => (
  <div className={`rounded-2xl border p-4 flex flex-col gap-1.5 transition-all duration-300
    ${highlight
      ? 'bg-cyan-500/10 border-cyan-500/30 shadow-lg shadow-cyan-500/10'
      : 'bg-white/5 border-white/10 hover:bg-white/8 hover:border-white/20 hover:-translate-y-0.5'
    }`}>
    <div className="text-2xl">{emoji}</div>
    <div className={`text-3xl font-black leading-none ${highlight ? 'text-cyan-400' : 'text-white'}`}>
      {value ?? '—'}
    </div>
    <div className={`font-semibold text-xs ${highlight ? 'text-cyan-300' : 'text-slate-400'}`}>{title}</div>
    {subtitle && <div className={`text-xs leading-tight ${highlight ? 'text-cyan-400/60' : 'text-slate-500'}`}>{subtitle}</div>}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// SOCKET HOOK
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
// TAB 1: OVERVIEW — Manual analytics only
// =============================================================================
function OverviewTab({ counts, connected }) {
  const [selectedHostel, setSelectedHostel] = useState('Chitrakot');
  const [mealType,       setMealType]       = useState('Lunch');
  const [data,           setData]           = useState(null);
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState(null);

  const totalDeliveries = Object.values(counts).reduce((s, c) => s + c, 0);

  const fetchDashboard = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({ meal_type: mealType, hostel: selectedHostel });
      const r = await fetch(`${API_BASE}/dashboard?${params}`);
      const d = await r.json();
      if (!d.success) throw new Error(d.error);
      setData(d);
    } catch (e) { setError(e.message || 'Failed to load dashboard'); }
    finally { setLoading(false); }
  }, [mealType, selectedHostel]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  return (
    <div className="space-y-4">
      {/* Hostel + meal selector */}
      <GlassCard>
        <h3 className="font-black text-white text-sm mb-3">
          📊 <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">Today's Cancellation Analytics</span>
        </h3>
        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">🏠 Select Hostel</label>
        <select value={selectedHostel} onChange={e => setSelectedHostel(e.target.value)}
          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white font-bold text-sm
                     focus:outline-none focus:border-cyan-500/60 transition-all mb-3">
          {HOSTELS.map(h => <option key={h} value={h}>{h} Hostel</option>)}
        </select>

        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">🍽️ Analyse for Meal</label>
        <div className="grid grid-cols-4 gap-1.5">
          {MEAL_TYPES.map(m => (
            <button key={m} onClick={() => setMealType(m)}
              className={`py-2.5 rounded-xl text-xs font-bold transition-all border
                ${mealType === m
                  ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300 shadow-lg shadow-cyan-500/10'
                  : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white'}`}>
              {MEAL_CONFIG[m].icon} {m}
            </button>
          ))}
        </div>

        <button onClick={fetchDashboard} disabled={loading}
          className="mt-4 w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500
                     text-white rounded-xl text-sm font-black disabled:opacity-50 transition-all active:scale-95 flex items-center justify-center gap-2">
          {loading ? <><Spinner small /> Loading…</> : '🔄 Refresh Data'}
        </button>
      </GlassCard>

      {/* Live delivery strip */}
      <div className="bg-white/5 border border-white/10 rounded-2xl px-5 py-3 flex items-center justify-between">
        <div>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Total Deliveries Today</p>
          <p className="text-2xl font-black text-white">{totalDeliveries}</p>
        </div>
        <div className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold
          ${connected ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-white/5 border-white/10 text-slate-500'}`}>
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
          {connected ? 'Live' : 'Offline'}
        </div>
      </div>

      {error && <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 text-rose-400 text-sm">⚠️ {error}</div>}
      {loading && !data && <PageLoader />}

      {data && (
        <>
          {/* KPI grid */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard emoji="👥" title="Total Enrolled"             value={data.total_enrolled}      subtitle="All mess members" />
            <StatCard emoji="❌" title={`${mealType} Cancellations`} value={data.meal_cancellations}  subtitle="Opted out today" />
            <StatCard emoji="✅" title="Expected Attendance"         value={data.expected_attendance} subtitle={`${mealType} today`} highlight />
            <StatCard emoji="📦" title="Total Cancellations"         value={data.total_cancellations} subtitle="All meals today" />
          </div>

          {/* Reason breakdown */}
          {data.reason_breakdown && data.reason_breakdown.length > 0 && (
            <GlassCard>
              <h3 className="font-black text-white text-sm mb-3">
                📋 Why Students Cancelled <span className="text-slate-400 font-normal">({mealType})</span>
              </h3>
              <div className="space-y-2">
                {data.reason_breakdown.map((r, i) => {
                  const total = data.reason_breakdown.reduce((s, x) => s + x.count, 0);
                  const pct   = total > 0 ? Math.round((r.count / total) * 100) : 0;
                  return (
                    <div key={i}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-slate-300 font-semibold">{r.reason || 'Not specified'}</span>
                        <span className="text-slate-400">{r.count} student{r.count !== 1 ? 's' : ''} · {pct}%</span>
                      </div>
                      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </GlassCard>
          )}

          {data.meal_cancellations === 0 && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 text-center">
              <div className="text-3xl mb-1">🎉</div>
              <p className="text-emerald-300 font-bold">No cancellations for {mealType} today!</p>
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
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(weekMenu),
      });
      const d = await r.json();
      setToast({ message: d.success ? 'Weekly menu saved! 🎉' : d.error, type: d.success ? 'success' : 'error' });
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
          <h2 className="font-black text-white text-base">Weekly Menu Editor</h2>
          <p className="text-xs text-slate-500">Edit items and press Save All.</p>
        </div>
        <button onClick={handleSave} disabled={saving}
          className="px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500
                     text-white rounded-xl font-bold text-sm disabled:opacity-50 transition-all active:scale-95 flex items-center gap-2">
          {saving ? <><Spinner small />Saving…</> : '💾 Save Menu'}
        </button>
      </div>

      {weekMenu && DAYS_OF_WEEK.map(day => (
        <GlassCard key={day} className="!p-4">
          <h3 className="font-black text-white mb-3 pb-2 border-b border-white/10 text-sm">📅 {day}</h3>
          <div className="grid grid-cols-1 gap-2">
            {MEAL_TYPES.map(meal => (
              <div key={meal} className={`rounded-xl border p-3 ${mealAccents[meal]}`}>
                <label className="text-xs font-bold mb-1.5 block opacity-80">
                  {MEAL_CONFIG[meal].icon} {meal}
                </label>
                <input type="text" value={weekMenu[day]?.[meal] || ''} onChange={e => handleChange(day, meal, e.target.value)}
                  placeholder={`${meal} items…`}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white
                             placeholder-slate-600 focus:outline-none focus:border-cyan-500/40 transition-all" />
              </div>
            ))}
          </div>
        </GlassCard>
      ))}

      <button onClick={handleSave} disabled={saving}
        className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-black text-sm
                   disabled:opacity-50 hover:brightness-110 transition-all active:scale-95">
        {saving ? 'Saving…' : '💾 Save All Changes'}
      </button>
    </div>
  );
}

// =============================================================================
// TAB 3: AUDIT LOG — now shows `reason` column
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
    ...acc, [m]: data?.cancellations?.filter(c => c.meal_type === m).length || 0,
  }), {});

  const mealChipColors = {
    Breakfast: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    Lunch:     'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    Snacks:    'bg-violet-500/20 text-violet-300 border-violet-500/30',
    Dinner:    'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  };

  return (
    <div className="space-y-4">
      {/* Date picker */}
      <GlassCard>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">📅 Audit Date</label>
            <input type="date" value={auditDate} onChange={e => setAuditDate(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm
                         focus:outline-none focus:border-cyan-500/60 transition-all" />
          </div>
          <button onClick={fetchAudit} disabled={loading}
            className="px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl text-sm font-black disabled:opacity-50 flex items-center gap-2">
            {loading ? <Spinner small /> : '🔍 Load'}
          </button>
        </div>
      </GlassCard>

      {/* Summary chips */}
      {data && (
        <div className="grid grid-cols-2 gap-2">
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
        </div>
      )}

      {/* Meal filter chips */}
      <div className="flex gap-1.5 flex-wrap">
        {['All', ...MEAL_TYPES].map(m => (
          <button key={m} onClick={() => setFilterMeal(m)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all
              ${filterMeal === m
                ? m === 'All'
                  ? 'bg-white/15 border-white/30 text-white'
                  : `${mealChipColors[m]}`
                : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white'}`}>
            {m !== 'All' ? `${MEAL_CONFIG[m].icon} ` : ''}{m}
          </button>
        ))}
      </div>

      {loading && <PageLoader />}

      {!loading && filtered.length === 0 && (
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
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Student</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Meal</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Reason</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Time (IST)</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Flag</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map((c, i) => {
                  const rawTime = c.cancelled_at;
                  const timeStr = rawTime
                    ? new Date(rawTime.replace(' ', 'T') + 'Z').toLocaleTimeString('en-IN', {
                        timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit',
                      })
                    : '—';
                  const chipColor = mealChipColors[c.meal_type] || 'bg-white/10 text-white border-white/20';
                  return (
                    <tr key={`${c.id}-${i}`} className={`hover:bg-white/5 transition-colors ${c.is_frequent ? 'bg-rose-500/5' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-white text-sm">{c.name}</div>
                        <div className="text-xs text-slate-500 font-mono">{c.roll_number}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full border ${chipColor}`}>
                          {MEAL_CONFIG[c.meal_type]?.icon} {c.meal_type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-slate-300 text-xs">
                          {c.reason && c.reason.trim() ? c.reason : <span className="text-slate-600 italic">Not specified</span>}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-cyan-400 font-mono text-xs font-bold">{timeStr}</td>
                      <td className="px-4 py-3">
                        {c.is_frequent
                          ? <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">⚠️ {c.monthly_count}/mo</span>
                          : <span className="text-xs text-slate-600">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 text-xs text-rose-400">
        ⚠️ <strong>Spam Detection:</strong> Students with ≥ {data?.spam_threshold || 15} cancellations this month are flagged.
      </div>
    </div>
  );
}

// =============================================================================
// TAB 4: MEAL RATINGS — Aggregated anonymous star ratings for mess contractor
// =============================================================================
function RatingsTab() {
  const [ratingDate, setRatingDate] = useState(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }));
  const [ratings,    setRatings]    = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');

  const fetchRatings = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const r = await fetch(`${API_BASE}/api/ratings/all?meal_date=${ratingDate}`);
      const d = await r.json();
      if (d.success) setRatings(d.ratings);
      else setError(d.error || 'Failed to load ratings.');
    } catch { setError('Network error.'); }
    finally { setLoading(false); }
  }, [ratingDate]);

  useEffect(() => { fetchRatings(); }, [fetchRatings]);

  const mealAccents = {
    Breakfast: { bar: 'bg-amber-400',   text: 'text-amber-300',   badge: 'bg-amber-500/20 border-amber-500/30 text-amber-300'   },
    Lunch:     { bar: 'bg-emerald-400', text: 'text-emerald-300', badge: 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300' },
    Snacks:    { bar: 'bg-violet-400',  text: 'text-violet-300',  badge: 'bg-violet-500/20 border-violet-500/30 text-violet-300'  },
    Dinner:    { bar: 'bg-indigo-400',  text: 'text-indigo-300',  badge: 'bg-indigo-500/20 border-indigo-500/30 text-indigo-300'  },
  };

  const starEmoji = (s) => ['⭐','⭐','⭐','⭐','⭐'].slice(0, s).join('');

  return (
    <div className="space-y-4">
      {/* Date picker */}
      <GlassCard>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">📅 Select Date</label>
            <input type="date" value={ratingDate} onChange={e => setRatingDate(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm
                         focus:outline-none focus:border-cyan-500/60 transition-all" />
          </div>
          <button onClick={fetchRatings} disabled={loading}
            className="px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl text-sm font-black disabled:opacity-50 flex items-center gap-2">
            {loading ? <Spinner small /> : '🔍 Load'}
          </button>
        </div>
        <p className="text-xs text-slate-500 mt-2">
          🔒 All ratings are fully anonymous — no student names are stored or displayed.
        </p>
      </GlassCard>

      {error && <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 text-rose-400 text-sm">{error}</div>}
      {loading && <PageLoader />}

      {!loading && ratings && MEAL_TYPES.map(mealType => {
        const r    = ratings[mealType];
        const acc  = mealAccents[mealType];
        const maxCount = r.total_ratings > 0 ? Math.max(...r.breakdown.map(b => b.count)) : 1;

        return (
          <GlassCard key={mealType}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">{MEAL_CONFIG[mealType].icon}</span>
                <h3 className={`font-black text-base ${acc.text}`}>{mealType}</h3>
              </div>
              <div className="flex items-center gap-3">
                {r.avg_stars && (
                  <div className={`px-3 py-1.5 rounded-full border text-xs font-black ${acc.badge}`}>
                    ⭐ {r.avg_stars} avg
                  </div>
                )}
                <span className="text-slate-500 text-xs">{r.total_ratings} rating{r.total_ratings !== 1 ? 's' : ''}</span>
              </div>
            </div>

            {r.total_ratings === 0 ? (
              <div className="text-center py-4 text-slate-500 text-sm">No ratings yet for this meal.</div>
            ) : (
              <div className="space-y-2.5">
                {r.breakdown.map(({ stars, count }) => (
                  <div key={stars} className="flex items-center gap-3">
                    <span className="text-xs text-slate-400 w-16 font-mono shrink-0">{starEmoji(stars)}</span>
                    <div className="flex-1 h-5 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${acc.bar} rounded-full transition-all duration-700`}
                        style={{ width: maxCount > 0 ? `${(count / maxCount) * 100}%` : '0%' }}
                      />
                    </div>
                    <span className="text-white font-black text-sm w-8 text-right shrink-0">{count}</span>
                    <span className="text-slate-500 text-xs w-16 shrink-0">
                      {r.total_ratings > 0 ? `${Math.round((count / r.total_ratings) * 100)}%` : '0%'} students
                    </span>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        );
      })}
    </div>
  );
}

// =============================================================================
// ROOT: Dashboard — 4-tab shell
// =============================================================================
export default function Dashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('overview');
  const { counts, connected } = useSocket();

  const tabs = [
    { id: 'overview', label: 'Overview',   emoji: '📊' },
    { id: 'menu',     label: 'Menu',       emoji: '📝' },
    { id: 'audit',    label: 'Audit Log',  emoji: '🔍' },
    { id: 'ratings',  label: 'Ratings',    emoji: '⭐' },
  ];

  const totalDeliveries = Object.values(counts).reduce((s, c) => s + c, 0);

  return (
    <div className="min-h-screen bg-[#0B0F19] relative overflow-hidden pb-8">
      {/* Ambient glow orbs */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-cyan-500/6 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-80 h-80 bg-emerald-500/6 rounded-full blur-3xl pointer-events-none" />

      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-[#0B0F19]/80 backdrop-blur-xl border-b border-white/8">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center text-lg shadow-lg shadow-emerald-500/20">🍽️</div>
              <div>
                <h1 className="font-black text-base leading-tight bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                  Kitchen Dashboard
                </h1>
                <p className="text-xs text-slate-500">
                  {user ? `👨‍🍳 ${user.name}` : ''} · {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-bold border
                ${connected ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-white/5 border-white/10 text-slate-500'}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                {totalDeliveries} deliveries
              </div>
              {onLogout && (
                <button onClick={onLogout} className="text-xs text-slate-500 hover:text-white transition-colors border border-white/10 rounded-lg px-2.5 py-1.5 hover:border-white/20">
                  Logout
                </button>
              )}
            </div>
          </div>

          {/* Tab bar */}
          <div className="flex gap-1 bg-white/5 rounded-xl p-1">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`flex-1 py-2 rounded-lg text-xs font-black transition-all
                  ${activeTab === t.id
                    ? 'bg-white/10 text-white border border-white/10 shadow-inner'
                    : 'text-slate-400 hover:text-slate-300'}`}>
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
        {activeTab === 'ratings'  && <RatingsTab />}
      </main>
    </div>
  );
}
