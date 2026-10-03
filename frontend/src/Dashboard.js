/*
=============================================================================
FILE: Dashboard.js  —  Kitchen Dashboard v5  (Inventory + Staff + Fixed Plates)
=============================================================================
New in v5:
  • OverviewTab: shows "Plates to Prepare" with fixed double-count formula
  • StoreRoomTab: inventory management with +/- quantity controls & modal
  • WorkersTab: mess staff attendance + big leave management + modal
  • 6-tab navigation
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
// UI HELPERS
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

const Modal = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
    <div className="bg-[#0f1623] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-black text-white text-base">{title}</h2>
        <button onClick={onClose} className="text-slate-500 hover:text-white text-2xl leading-none transition-colors">×</button>
      </div>
      {children}
    </div>
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
// TAB 1: OVERVIEW — Fixed "Plates to Prepare"
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
      <GlassCard>
        <h3 className="font-black text-white text-sm mb-3">
          📊 <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">Today's Analytics</span>
        </h3>
        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">🏠 Hostel</label>
        <select value={selectedHostel} onChange={e => setSelectedHostel(e.target.value)}
          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white font-bold text-sm
                     focus:outline-none focus:border-cyan-500/60 transition-all mb-3">
          {HOSTELS.map(h => <option key={h} value={h}>{h} Hostel</option>)}
        </select>
        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">🍽️ Meal</label>
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
          {/* PLATES TO PREPARE — hero card */}
          <div className="bg-gradient-to-br from-cyan-500/15 to-blue-600/10 border border-cyan-500/30 rounded-2xl p-5 shadow-xl shadow-cyan-500/10">
            <div className="text-xs font-black uppercase tracking-widest text-cyan-400 mb-1">
              🍽️ Plates to Prepare — {mealType}
            </div>
            <div className="text-5xl font-black text-white mt-1">{data.plates_to_prepare}</div>
            <div className="flex flex-wrap items-center gap-1.5 text-xs mt-3 leading-relaxed text-slate-400">
              <span className="text-white font-bold">{data.total_enrolled}</span> enrolled
              <span className="text-slate-600">−</span>
              <span className="text-rose-300 font-bold">{data.meal_cancellations}</span> cancelled
              <span className="text-slate-600">−</span>
              <span className="text-amber-300 font-bold">{data.extra_deductions}</span> extra guard deductions
              <span className="text-slate-600">=</span>
              <span className="text-cyan-300 font-black">{data.plates_to_prepare}</span>
            </div>
            {data.ordered_online_count > 0 && (
              <div className="text-[10px] text-cyan-400/50 mt-2 border-t border-white/5 pt-2">
                ℹ️ {data.ordered_online_count} "Ordered online" already counted in cancellations — not double-deducted from guard deliveries.
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <StatCard emoji="👥" title="Total Enrolled"              value={data.total_enrolled}     subtitle="All mess members" />
            <StatCard emoji="❌" title={`${mealType} Cancellations`} value={data.meal_cancellations} subtitle="Opted out"       highlight accent="rose" />
            <StatCard emoji="✅" title="Expected Attendance"          value={data.expected_attendance} subtitle={`${mealType}`}  highlight accent="emerald" />
            <StatCard emoji="🛵" title="Guard Deliveries"             value={data.guard_deliveries}   subtitle="Logged today"    highlight accent="amber" />
          </div>

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
                        <span className="text-slate-400">{r.count} · {pct}%</span>
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
          <h2 className="font-black text-white text-base">Weekly Menu Editor</h2>
          <p className="text-xs text-slate-500">Edit items and press Save.</p>
        </div>
        <button onClick={handleSave} disabled={saving}
          className="px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:brightness-110
                     text-white rounded-xl font-bold text-sm disabled:opacity-50 transition-all active:scale-95 flex items-center gap-2">
          {saving ? <><Spinner small />Saving…</> : '💾 Save'}
        </button>
      </div>

      {weekMenu && DAYS_OF_WEEK.map(day => (
        <GlassCard key={day} className="!p-4">
          <h3 className="font-black text-white mb-3 pb-2 border-b border-white/10 text-sm">📅 {day}</h3>
          <div className="grid grid-cols-1 gap-2">
            {MEAL_TYPES.map(meal => (
              <div key={meal} className={`rounded-xl border p-3 ${mealAccents[meal]}`}>
                <label className="text-xs font-bold mb-1.5 block opacity-80">{MEAL_CONFIG[meal].icon} {meal}</label>
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
// TAB 3: AUDIT LOG — shows reason column
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
      <GlassCard>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">📅 Date</label>
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

      <div className="flex gap-1.5 flex-wrap">
        {['All', ...MEAL_TYPES].map(m => (
          <button key={m} onClick={() => setFilterMeal(m)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all
              ${filterMeal === m
                ? m === 'All' ? 'bg-white/15 border-white/30 text-white' : mealChipColors[m]
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
                  {['Student', 'Meal', 'Reason', 'Time', 'Flag'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map((c, i) => {
                  const rawTime = c.cancelled_at;
                  const timeStr = rawTime
                    ? new Date(rawTime.replace(' ', 'T') + 'Z').toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })
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
                          {c.reason?.trim() ? c.reason : <span className="text-slate-600 italic">Not specified</span>}
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
// TAB 4: MEAL RATINGS
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

  return (
    <div className="space-y-4">
      <GlassCard>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">📅 Date</label>
            <input type="date" value={ratingDate} onChange={e => setRatingDate(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm
                         focus:outline-none focus:border-cyan-500/60 transition-all" />
          </div>
          <button onClick={fetchRatings} disabled={loading}
            className="px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl text-sm font-black disabled:opacity-50 flex items-center gap-2">
            {loading ? <Spinner small /> : '🔍 Load'}
          </button>
        </div>
        <p className="text-xs text-slate-500 mt-2">🔒 All ratings are fully anonymous.</p>
      </GlassCard>

      {error && <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 text-rose-400 text-sm">{error}</div>}
      {loading && <PageLoader />}

      {!loading && ratings && MEAL_TYPES.map(mealType => {
        const r   = ratings[mealType];
        const acc = mealAccents[mealType];
        const maxCount = r.total_ratings > 0 ? Math.max(...r.breakdown.map(b => b.count)) : 1;
        return (
          <GlassCard key={mealType}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">{MEAL_CONFIG[mealType].icon}</span>
                <h3 className={`font-black text-base ${acc.text}`}>{mealType}</h3>
              </div>
              <div className="flex items-center gap-3">
                {r.avg_stars && <div className={`px-3 py-1.5 rounded-full border text-xs font-black ${acc.badge}`}>⭐ {r.avg_stars}</div>}
                <span className="text-slate-500 text-xs">{r.total_ratings} ratings</span>
              </div>
            </div>
            {r.total_ratings === 0 ? (
              <div className="text-center py-4 text-slate-500 text-sm">No ratings yet.</div>
            ) : (
              <div className="space-y-2.5">
                {r.breakdown.map(({ stars, count }) => (
                  <div key={stars} className="flex items-center gap-3">
                    <span className="text-xs text-slate-400 w-14 font-mono shrink-0">{'⭐'.repeat(stars)}</span>
                    <div className="flex-1 h-5 bg-white/10 rounded-full overflow-hidden">
                      <div className={`h-full ${acc.bar} rounded-full transition-all duration-700`}
                        style={{ width: maxCount > 0 ? `${(count / maxCount) * 100}%` : '0%' }} />
                    </div>
                    <span className="text-white font-black text-sm w-6 text-right shrink-0">{count}</span>
                    <span className="text-slate-500 text-xs w-14 shrink-0">
                      {r.total_ratings > 0 ? `${Math.round((count / r.total_ratings) * 100)}%` : '0%'}
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
// TAB 5: STORE ROOM (INVENTORY)
// =============================================================================
function StoreRoomTab() {
  const [items,     setItems]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [toast,     setToast]     = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [qtySaving, setQtySaving] = useState({});
  const [newItem,   setNewItem]   = useState({
    item_name:   '',
    date_bought: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
    quantity:    0,
  });

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/inventory`);
      const d = await r.json();
      if (d.success) setItems(d.items);
    } catch { setToast({ message: 'Failed to load inventory', type: 'error' }); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleQtyDelta = (id, delta) =>
    setItems(prev => prev.map(it => it.id === id ? { ...it, quantity: Math.max(0, it.quantity + delta) } : it));

  const handleQtyInput = (id, value) => {
    const qty = parseInt(value, 10);
    if (!isNaN(qty) && qty >= 0)
      setItems(prev => prev.map(it => it.id === id ? { ...it, quantity: qty } : it));
  };

  const saveQty = async (id, quantity) => {
    setQtySaving(prev => ({ ...prev, [id]: true }));
    try {
      const r = await fetch(`${API_BASE}/api/inventory/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity }),
      });
      const d = await r.json();
      setToast({ message: d.success ? 'Saved!' : d.error, type: d.success ? 'success' : 'error' });
    } catch { setToast({ message: 'Network error', type: 'error' }); }
    finally { setQtySaving(prev => ({ ...prev, [id]: false })); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this item?')) return;
    try {
      await fetch(`${API_BASE}/api/inventory/${id}`, { method: 'DELETE' });
      setItems(prev => prev.filter(it => it.id !== id));
      setToast({ message: 'Deleted.', type: 'info' });
    } catch { setToast({ message: 'Delete failed', type: 'error' }); }
  };

  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!newItem.item_name.trim()) { setToast({ message: 'Item name required', type: 'error' }); return; }
    setSaving(true);
    try {
      const r = await fetch(`${API_BASE}/api/inventory`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newItem),
      });
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
              <input type="text" value={newItem.item_name} onChange={e => setNewItem(p => ({ ...p, item_name: e.target.value }))}
                placeholder="e.g. Rice, Onions, Oil…" required
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-600
                           focus:outline-none focus:border-cyan-500/60 text-sm transition-all" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Date Bought</label>
              <input type="date" value={newItem.date_bought} onChange={e => setNewItem(p => ({ ...p, date_bought: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white
                           focus:outline-none focus:border-cyan-500/60 text-sm transition-all" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Quantity</label>
              <input type="number" min="0" value={newItem.quantity}
                onChange={e => setNewItem(p => ({ ...p, quantity: parseInt(e.target.value, 10) || 0 }))}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white
                           focus:outline-none focus:border-cyan-500/60 text-sm transition-all" />
            </div>
            <button type="submit" disabled={saving}
              className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl font-black text-sm
                         disabled:opacity-50 hover:brightness-110 transition-all active:scale-95 flex items-center justify-center gap-2">
              {saving ? <><Spinner small />Adding…</> : '✅ Add Item'}
            </button>
          </form>
        </Modal>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-black text-white text-base">📦 Store Room</h2>
          <p className="text-xs text-slate-500">Kitchen inventory management</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:brightness-110
                     text-white rounded-xl font-black text-sm transition-all active:scale-95 flex items-center gap-2">
          ➕ Add Item
        </button>
      </div>

      {loading && <PageLoader />}

      {!loading && items.length === 0 && (
        <GlassCard>
          <div className="text-center py-8">
            <div className="text-4xl mb-2">📦</div>
            <p className="text-slate-400 font-semibold">No items yet</p>
            <p className="text-slate-600 text-xs mt-1">Click "Add Item" to add your first stock entry.</p>
          </div>
        </GlassCard>
      )}

      {!loading && items.length > 0 && (
        <div className="space-y-3">
          {items.map(item => (
            <div key={item.id}
              className="bg-white/5 border border-white/10 rounded-2xl p-4 hover:bg-white/8 hover:border-white/15 transition-all">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="font-bold text-white text-sm">{item.item_name}</div>
                  <div className="text-xs text-slate-500 mt-0.5">📅 Bought: {item.date_bought}</div>
                </div>
                <button onClick={() => handleDelete(item.id)}
                  className="text-slate-600 hover:text-rose-400 transition-colors text-lg">🗑️</button>
              </div>

              {/* Quantity controller */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-slate-400 font-bold uppercase tracking-widest shrink-0">Qty:</span>
                <button onClick={() => handleQtyDelta(item.id, -1)}
                  className="w-9 h-9 rounded-xl bg-white/10 border border-white/10 text-white font-black text-xl
                             hover:bg-rose-500/20 hover:border-rose-500/30 hover:text-rose-300 transition-all active:scale-90">−</button>
                <input
                  type="number" min="0" value={item.quantity}
                  onChange={e => handleQtyInput(item.id, e.target.value)}
                  className="w-20 text-center px-2 py-2 rounded-xl bg-white/5 border border-white/10 text-white font-black text-sm
                             focus:outline-none focus:border-cyan-500/60 transition-all"
                />
                <button onClick={() => handleQtyDelta(item.id, +1)}
                  className="w-9 h-9 rounded-xl bg-white/10 border border-white/10 text-white font-black text-xl
                             hover:bg-emerald-500/20 hover:border-emerald-500/30 hover:text-emerald-300 transition-all active:scale-90">+</button>
                <button onClick={() => saveQty(item.id, item.quantity)} disabled={qtySaving[item.id]}
                  className="ml-1 px-3 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl text-xs font-black
                             disabled:opacity-50 hover:brightness-110 transition-all active:scale-95 flex items-center gap-1.5">
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
// TAB 6: WORKERS (MESS STAFF MANAGEMENT)
// =============================================================================
function WorkersTab() {
  const [workers,        setWorkers]        = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [toast,          setToast]          = useState(null);
  const [showAddModal,   setShowAddModal]   = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(null); // worker object
  const [markingId,      setMarkingId]      = useState(null);
  const [newWorker,      setNewWorker]      = useState({ name: '', role: 'Cook' });
  const [saving,         setSaving]         = useState(false);
  const [leaveUntil,     setLeaveUntil]     = useState('');

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

  const fetchWorkers = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/workers`);
      const d = await r.json();
      if (d.success) setWorkers(d.workers);
    } catch { setToast({ message: 'Failed to load workers', type: 'error' }); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchWorkers(); }, [fetchWorkers]);

  const markAttendance = async (workerId, status) => {
    setMarkingId(`${workerId}_${status}`);
    try {
      const r = await fetch(`${API_BASE}/api/workers/${workerId}/attendance`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const d = await r.json();
      if (d.success) {
        setWorkers(prev => prev.map(w => w.id === workerId ? { ...w, today_status: status } : w));
        setToast({ message: `Marked ${status}`, type: 'success' });
      } else setToast({ message: d.error, type: 'error' });
    } catch { setToast({ message: 'Network error', type: 'error' }); }
    finally { setMarkingId(null); }
  };

  const handleAddWorker = async (e) => {
    e.preventDefault();
    if (!newWorker.name.trim()) { setToast({ message: 'Name required', type: 'error' }); return; }
    setSaving(true);
    try {
      const r = await fetch(`${API_BASE}/api/workers`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newWorker),
      });
      const d = await r.json();
      if (d.success) {
        setWorkers(prev => [...prev, { ...d.worker, today_status: null, on_leave: false }]);
        setToast({ message: 'Worker added!', type: 'success' });
        setShowAddModal(false);
        setNewWorker({ name: '', role: 'Cook' });
      } else setToast({ message: d.error, type: 'error' });
    } catch { setToast({ message: 'Network error', type: 'error' }); }
    finally { setSaving(false); }
  };

  const handleSetLeave = async () => {
    if (!showLeaveModal || !leaveUntil) return;
    setSaving(true);
    try {
      const r = await fetch(`${API_BASE}/api/workers/${showLeaveModal.id}/leave`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leave_until: leaveUntil }),
      });
      const d = await r.json();
      if (d.success) {
        await fetchWorkers();
        setToast({ message: `Leave set until ${leaveUntil}`, type: 'success' });
        setShowLeaveModal(null); setLeaveUntil('');
      } else setToast({ message: d.error, type: 'error' });
    } catch { setToast({ message: 'Network error', type: 'error' }); }
    finally { setSaving(false); }
  };

  const handleDeleteWorker = async (id) => {
    if (!window.confirm('Remove this worker?')) return;
    try {
      await fetch(`${API_BASE}/api/workers/${id}`, { method: 'DELETE' });
      setWorkers(prev => prev.filter(w => w.id !== id));
      setToast({ message: 'Worker removed.', type: 'info' });
    } catch { setToast({ message: 'Delete failed', type: 'error' }); }
  };

  const statusColors = {
    Present:    'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    Absent:     'bg-rose-500/20    text-rose-300    border-rose-500/30',
    'On Leave': 'bg-amber-500/20  text-amber-300   border-amber-500/30',
  };

  const presentCount  = workers.filter(w => w.today_status === 'Present').length;
  const absentCount   = workers.filter(w => w.today_status === 'Absent').length;
  const onLeaveCount  = workers.filter(w => w.on_leave).length;

  const WORKER_ROLES = ['Cook', 'Helper', 'Cleaner', 'Server', 'Manager', 'Other'];

  return (
    <div className="space-y-4">
      {toast && <Toast {...toast} onDismiss={() => setToast(null)} />}

      {/* Add Worker Modal */}
      {showAddModal && (
        <Modal title="👷 Add New Worker" onClose={() => setShowAddModal(false)}>
          <form onSubmit={handleAddWorker} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Full Name</label>
              <input type="text" value={newWorker.name} onChange={e => setNewWorker(p => ({ ...p, name: e.target.value }))}
                placeholder="Worker's full name" required
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-600
                           focus:outline-none focus:border-cyan-500/60 text-sm transition-all" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Role</label>
              <select value={newWorker.role} onChange={e => setNewWorker(p => ({ ...p, role: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white
                           focus:outline-none focus:border-cyan-500/60 text-sm transition-all">
                {WORKER_ROLES.map(r => <option key={r} value={r} className="text-slate-800">{r}</option>)}
              </select>
            </div>
            <button type="submit" disabled={saving}
              className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-black text-sm
                         disabled:opacity-50 hover:brightness-110 transition-all active:scale-95 flex items-center justify-center gap-2">
              {saving ? <><Spinner small />Adding…</> : '✅ Add Worker'}
            </button>
          </form>
        </Modal>
      )}

      {/* Set Leave Modal */}
      {showLeaveModal && (
        <Modal title={`🏖️ Leave for ${showLeaveModal.name}`} onClose={() => setShowLeaveModal(null)}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Leave Until (inclusive)</label>
              <input type="date" value={leaveUntil} min={today} onChange={e => setLeaveUntil(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white
                           focus:outline-none focus:border-cyan-500/60 text-sm transition-all" />
              <p className="text-xs text-slate-500 mt-1.5">Worker will be auto-marked "On Leave" for all days up to this date.</p>
            </div>
            <button onClick={handleSetLeave} disabled={!leaveUntil || saving}
              className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl font-black text-sm
                         disabled:opacity-50 hover:brightness-110 transition-all active:scale-95 flex items-center justify-center gap-2">
              {saving ? <><Spinner small />Saving…</> : '🏖️ Confirm Leave'}
            </button>
          </div>
        </Modal>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-black text-white text-base">👷 Kitchen Staff</h2>
          <p className="text-xs text-slate-500">Daily attendance & leave management</p>
        </div>
        <button onClick={() => setShowAddModal(true)}
          className="px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:brightness-110
                     text-white rounded-xl font-black text-sm transition-all active:scale-95 flex items-center gap-2">
          ➕ Add Worker
        </button>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Present', count: presentCount,  color: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' },
          { label: 'Absent',  count: absentCount,   color: 'bg-rose-500/10 border-rose-500/20 text-rose-400'         },
          { label: 'On Leave', count: onLeaveCount, color: 'bg-amber-500/10 border-amber-500/20 text-amber-400'      },
        ].map(({ label, count, color }) => (
          <div key={label} className={`${color} border rounded-xl p-3 text-center`}>
            <div className="text-xl font-black">{count}</div>
            <div className="text-[10px] font-bold uppercase tracking-widest opacity-80">{label}</div>
          </div>
        ))}
      </div>

      {loading && <PageLoader />}

      {!loading && workers.length === 0 && (
        <GlassCard>
          <div className="text-center py-8">
            <div className="text-4xl mb-2">👷</div>
            <p className="text-slate-400 font-semibold">No workers registered yet</p>
            <p className="text-slate-600 text-xs mt-1">Click "Add Worker" to register your first staff member.</p>
          </div>
        </GlassCard>
      )}

      {/* Worker cards */}
      {!loading && workers.map(worker => {
        const isOnLeave = worker.on_leave;
        const statusKey = isOnLeave ? 'On Leave' : worker.today_status;

        return (
          <div key={worker.id}
            className={`border rounded-2xl p-4 transition-all
              ${isOnLeave ? 'bg-amber-500/5 border-amber-500/20' : 'bg-white/5 border-white/10 hover:bg-white/8'}`}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-sm">{worker.name}</span>
                  <span className="text-[10px] font-bold text-slate-500 bg-white/10 px-2 py-0.5 rounded-full">{worker.role}</span>
                </div>
                {isOnLeave && worker.leave_until && (
                  <div className="text-xs text-amber-400 mt-0.5">🏖️ On leave until {worker.leave_until}</div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {statusKey && (
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${statusColors[statusKey] || 'bg-white/10 border-white/20 text-white'}`}>
                    {statusKey}
                  </span>
                )}
                <button onClick={() => handleDeleteWorker(worker.id)}
                  className="text-slate-600 hover:text-rose-400 transition-colors">🗑️</button>
              </div>
            </div>

            {/* Attendance + Leave buttons */}
            <div className="flex gap-2 flex-wrap">
              {!isOnLeave && (
                <>
                  <button
                    onClick={() => markAttendance(worker.id, 'Present')}
                    disabled={markingId !== null || worker.today_status === 'Present'}
                    className={`px-3 py-2 rounded-xl text-xs font-black border transition-all active:scale-95
                      ${worker.today_status === 'Present'
                        ? 'bg-emerald-500/30 border-emerald-500/50 text-emerald-300 cursor-default'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:bg-emerald-500/20 hover:border-emerald-500/30 hover:text-emerald-300 disabled:opacity-40'}`}>
                    {markingId === `${worker.id}_Present` ? <Spinner small /> : '✅ Present'}
                  </button>
                  <button
                    onClick={() => markAttendance(worker.id, 'Absent')}
                    disabled={markingId !== null || worker.today_status === 'Absent'}
                    className={`px-3 py-2 rounded-xl text-xs font-black border transition-all active:scale-95
                      ${worker.today_status === 'Absent'
                        ? 'bg-rose-500/30 border-rose-500/50 text-rose-300 cursor-default'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:bg-rose-500/20 hover:border-rose-500/30 hover:text-rose-300 disabled:opacity-40'}`}>
                    {markingId === `${worker.id}_Absent` ? <Spinner small /> : '❌ Absent'}
                  </button>
                </>
              )}
              <button
                onClick={() => { setShowLeaveModal(worker); setLeaveUntil(worker.leave_until || ''); }}
                className="px-3 py-2 rounded-xl text-xs font-black border bg-white/5 border-white/10 text-slate-400
                           hover:bg-amber-500/20 hover:border-amber-500/30 hover:text-amber-300 transition-all active:scale-95">
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
// ROOT: Dashboard — 6-tab shell
// =============================================================================
export default function Dashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('overview');
  const { counts, connected } = useSocket();

  const tabs = [
    { id: 'overview',  label: 'Overview', emoji: '📊' },
    { id: 'menu',      label: 'Menu',     emoji: '📝' },
    { id: 'audit',     label: 'Audit',    emoji: '🔍' },
    { id: 'ratings',   label: 'Ratings',  emoji: '⭐' },
    { id: 'storeroom', label: 'Store',    emoji: '📦' },
    { id: 'workers',   label: 'Staff',    emoji: '👷' },
  ];

  const totalDeliveries = Object.values(counts).reduce((s, c) => s + c, 0);

  return (
    <div className="min-h-screen bg-[#0B0F19] relative overflow-hidden pb-8">
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
                <button onClick={onLogout}
                  className="text-xs text-slate-500 hover:text-white transition-colors border border-white/10 rounded-lg px-2.5 py-1.5 hover:border-white/20">
                  Logout
                </button>
              )}
            </div>
          </div>

          {/* Tab bar — 6 tabs, scrollable */}
          <div className="flex gap-1 bg-white/5 rounded-xl p-1 overflow-x-auto">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`flex-shrink-0 py-2 px-2.5 rounded-lg text-xs font-black transition-all whitespace-nowrap
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
        {activeTab === 'overview'  && <OverviewTab counts={counts} connected={connected} />}
        {activeTab === 'menu'      && <MenuEditorTab />}
        {activeTab === 'audit'     && <AuditLogTab />}
        {activeTab === 'ratings'   && <RatingsTab />}
        {activeTab === 'storeroom' && <StoreRoomTab />}
        {activeTab === 'workers'   && <WorkersTab />}
      </main>
    </div>
  );
}
