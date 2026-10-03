/*
=============================================================================
FILE: App.js  —  React Frontend v2  (AI-Powered Mess Demand Forecasting)
=============================================================================
VIEWS:
  A. Student App  — mobile-first meal cancellation + leave application
  B. Kitchen Dashboard — three tabs:
       1. Overview     — stats cards + per-meal ML prediction
       2. Menu Editor  — 7-day × 4-meal weekly menu grid
       3. Audit Log    — cancellation trail with spam detection

KEY CONCEPTS:
  • All time logic is anchored to IST (Asia/Kolkata, UTC+5:30)
  • Meal deadlines disable toggles only when viewing TODAY's date
  • Future dates have fully unlocked toggles (plan ahead)
  • Pydantic-style input validation happens on the backend (Node.js)
  • The UI uses optimistic state updates for snappy UX
=============================================================================
*/

import React, { useState, useEffect, useCallback, useRef } from 'react';
import GateGuardApp from './GateGuardApp';
import Dashboard from './Dashboard';
import LandingPage from './LandingPage';


// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────
const API_BASE = 'http://localhost:3001';

// MEAL_CONFIG: Central config for all 4 meal types.
// Contains display properties AND time-gate deadlines (in minutes since midnight IST).
const MEAL_CONFIG = {
  Breakfast: {
    icon:       '🌅',
    label:      'Breakfast',
    deadline:   8 * 60,      // 8:00 AM = 480 minutes since midnight
    timeLabel:  'Locks at 8:00 AM',
    colorBg:    'from-amber-50 to-orange-50',
    colorBorder:'border-amber-200',
    colorBadge: 'bg-amber-100 text-amber-700',
    colorBtn:   'bg-amber-500 hover:bg-amber-600',
    colorIcon:  'text-amber-500',
    colorText:  'text-amber-700',
    colorRing:  'ring-amber-300',
  },
  Lunch: {
    icon:       '☀️',
    label:      'Lunch',
    deadline:   13 * 60,     // 1:00 PM = 780 minutes since midnight
    timeLabel:  'Locks at 1:00 PM',
    colorBg:    'from-emerald-50 to-green-50',
    colorBorder:'border-emerald-200',
    colorBadge: 'bg-emerald-100 text-emerald-700',
    colorBtn:   'bg-emerald-500 hover:bg-emerald-600',
    colorIcon:  'text-emerald-500',
    colorText:  'text-emerald-700',
    colorRing:  'ring-emerald-300',
  },
  Snacks: {
    icon:       '🫖',
    label:      'Snacks',
    deadline:   17 * 60,     // 5:00 PM = 1020 minutes since midnight
    timeLabel:  'Locks at 5:00 PM',
    colorBg:    'from-violet-50 to-purple-50',
    colorBorder:'border-violet-200',
    colorBadge: 'bg-violet-100 text-violet-700',
    colorBtn:   'bg-violet-500 hover:bg-violet-600',
    colorIcon:  'text-violet-500',
    colorText:  'text-violet-700',
    colorRing:  'ring-violet-300',
  },
  Dinner: {
    icon:       '🌙',
    label:      'Dinner',
    deadline:   20 * 60,     // 8:00 PM = 1200 minutes since midnight
    timeLabel:  'Locks at 8:00 PM',
    colorBg:    'from-indigo-50 to-blue-50',
    colorBorder:'border-indigo-200',
    colorBadge: 'bg-indigo-100 text-indigo-700',
    colorBtn:   'bg-indigo-500 hover:bg-indigo-600',
    colorIcon:  'text-indigo-500',
    colorText:  'text-indigo-700',
    colorRing:  'ring-indigo-300',
  },
};

const MEAL_TYPES   = ['Breakfast', 'Lunch', 'Snacks', 'Dinner'];
const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// ─────────────────────────────────────────────────────────────────────────────
// TIME & DATE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

// Returns current IST time as total minutes since midnight (e.g., 9:30 AM → 570)
// We use the Intl API to reliably convert to IST regardless of user's local timezone.
const getISTMinutes = () => {
  const nowIST = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
  const d = new Date(nowIST);
  return d.getHours() * 60 + d.getMinutes(); // Total minutes since midnight IST
};

// Returns today's date in IST as 'YYYY-MM-DD' string (the format SQLite stores)
const getTodayIST = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // en-CA → YYYY-MM-DD

// Checks whether a given 'YYYY-MM-DD' string is today in IST
const isToday = (dateStr) => dateStr === getTodayIST();

// Checks whether a given 'YYYY-MM-DD' string is a past date
const isPastDate = (dateStr) => dateStr < getTodayIST();

// Formats a 'YYYY-MM-DD' string into a human-readable label, e.g. "Wed, 15 Nov 2024"
const formatDisplayDate = (dateStr) => {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
};

// Returns the full day name for a 'YYYY-MM-DD' string (e.g., "Friday")
const getDayName = (dateStr) => {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long' });
};

// Returns minimum date string allowed for leave start date (today)
const minLeaveDate = () => getTodayIST();

// ─────────────────────────────────────────────────────────────────────────────
// SMALL REUSABLE COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

// Generic spinner shown during API loading states
const Spinner = ({ small = false }) => (
  <div className={`inline-block border-4 border-gray-200 border-t-indigo-500 rounded-full animate-spin
    ${small ? 'w-5 h-5' : 'w-10 h-10'}`} />
);

// Full-page loading overlay
const PageLoader = () => (
  <div className="flex flex-col items-center justify-center py-20 gap-4">
    <Spinner /> <p className="text-gray-400 text-sm">Loading…</p>
  </div>
);

// Toast notification — a dismissible floating message
const Toast = ({ message, type = 'success', onDismiss }) => {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3500); // Auto-dismiss after 3.5 s
    return () => clearTimeout(t);
  }, [onDismiss]);

  const colors = {
    success: 'bg-green-600',
    error:   'bg-red-600',
    info:    'bg-indigo-600',
  };

  return (
    <div className={`fixed top-4 right-4 z-50 ${colors[type]} text-white px-5 py-3 rounded-2xl
                     shadow-xl flex items-center gap-3 max-w-xs animate-bounce-in`}>
      <span className="text-lg">{type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
      <span className="text-sm font-medium">{message}</span>
      <button onClick={onDismiss} className="ml-2 opacity-70 hover:opacity-100 text-lg leading-none">×</button>
    </div>
  );
};

// Reusable section card wrapper
const Card = ({ children, className = '' }) => (
  <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-5 ${className}`}>
    {children}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT: MealToggleCard
// One of the 4 meal toggle buttons on the Student App.
// Displays: meal icon, name, menu items, deadline label, and a cancel/reinstate toggle.
//
// Props:
//   mealType   — 'Breakfast' | 'Lunch' | 'Snacks' | 'Dinner'
//   cancelled  — boolean: is this meal currently cancelled?
//   locked     — boolean: past the deadline, cannot change
//   menuItems  — string: comma-separated food items for this meal
//   onToggle   — function called when the button is clicked
//   loading    — boolean: API call in progress
// ─────────────────────────────────────────────────────────────────────────────
const MealToggleCard = ({ mealType, cancelled, locked, menuItems, onToggle, loading }) => {
  const cfg = MEAL_CONFIG[mealType];

  return (
    <div className={`
      rounded-2xl border-2 p-4 bg-gradient-to-br transition-all duration-200
      ${cfg.colorBg} ${cfg.colorBorder}
      ${locked ? 'opacity-60 cursor-not-allowed' : 'hover:shadow-md'}
      ${cancelled ? 'opacity-75' : ''}
    `}>
      {/* Top row: icon + meal name + status badge */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{cfg.icon}</span>
          <div>
            <p className={`font-bold text-sm ${cfg.colorText}`}>{cfg.label}</p>
            <p className="text-xs text-gray-400">{cfg.timeLabel}</p>
          </div>
        </div>
        {/* Status badge: locked / cancelled / active */}
        <span className={`text-xs font-bold px-2 py-1 rounded-full ${
          locked    ? 'bg-gray-100 text-gray-500' :
          cancelled ? 'bg-red-100 text-red-600'   :
                      `${cfg.colorBadge}`
        }`}>
          {locked ? '🔒 Locked' : cancelled ? '❌ Off' : '✅ On'}
        </span>
      </div>

      {/* Menu items for this meal */}
      {menuItems && (
        <p className="text-xs text-gray-500 mb-3 leading-relaxed border-t border-gray-200 pt-2 mt-1">
          <span className="font-semibold text-gray-600">Today: </span>{menuItems}
        </p>
      )}

      {/* Toggle button */}
      <button
        onClick={onToggle}
        disabled={locked || loading}
        className={`
          w-full py-2.5 rounded-xl text-white text-sm font-bold transition-all duration-200
          ${locked ? 'bg-gray-300 cursor-not-allowed' :
            loading ? 'bg-gray-400 cursor-wait' :
            cancelled ? 'bg-green-500 hover:bg-green-600' :
            `${cfg.colorBtn}`
          }
        `}
      >
        {loading ? <span className="flex items-center justify-center gap-2"><Spinner small /> Updating…</span>
          : locked    ? 'Deadline passed'
          : cancelled ? `✅ Reinstate ${cfg.label}`
          :             `🛵 Cancel ${cfg.label}`
        }
      </button>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT: StatCard
// Metric card for the Kitchen Dashboard overview.
// ─────────────────────────────────────────────────────────────────────────────
const StatCard = ({ title, value, subtitle, emoji, highlight = false }) => (
  <div className={`
    rounded-2xl border-2 p-5 flex flex-col gap-2 transition-all
    ${highlight
      ? 'border-green-400 bg-green-50 shadow-lg shadow-green-100 scale-105'
      : 'border-gray-100 bg-white shadow-sm'
    }
  `}>
    <div className="text-3xl">{emoji}</div>
    <div className={`text-4xl font-black ${highlight ? 'text-green-600' : 'text-gray-800'}`}>
      {value ?? '—'}
    </div>
    <div className="font-semibold text-gray-600 text-sm">{title}</div>
    {subtitle && <div className="text-xs text-gray-400">{subtitle}</div>}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOM HOOK: useToast
// Manages a simple queue of toast notifications.
// ─────────────────────────────────────────────────────────────────────────────
const useToast = () => {
  const [toast, setToast] = useState(null); // { message, type }

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type, id: Date.now() }); // id forces re-render even if same message
  }, []);

  const dismissToast = useCallback(() => setToast(null), []);

  return { toast, showToast, dismissToast };
};

// =============================================================================
// ─────────────────────────────────────────────────────────────────────────────
// HISTORY TAB — past meals: Ate vs Skipped with cancel time
// ─────────────────────────────────────────────────────────────────────────────
const HistoryTab = ({ studentId }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!studentId) { setLoading(false); return; }
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/api/meal-history/${studentId}`);
        const d = await r.json();
        if (d.success) setHistory(d.history);
      } catch { /* silent */ }
      finally { setLoading(false); }
    })();
  }, [studentId]);

  if (!studentId) return (
    <div className="text-center py-10 text-white/60">
      <p className="text-2xl mb-2">📋</p><p>No student linked.</p>
    </div>
  );
  if (loading) return (
    <div className="flex justify-center py-12">
      <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin" />
    </div>
  );
  if (history.length === 0) return (
    <div className="text-center py-10 text-white/60">
      <p className="text-3xl mb-2">🍽️</p>
      <p className="font-semibold">No meal history yet.</p>
    </div>
  );

  return (
    <div className="space-y-3 pb-6">
      <p className="text-white/60 text-xs text-center font-semibold uppercase tracking-wide">
        Last 14 Days · Tap a meal to see details
      </p>
      {history.map(day => (
        <div key={day.date} className="bg-white/10 rounded-2xl p-4 border border-white/10">
          <div className="flex items-center justify-between mb-3">
            <span className="text-white font-bold text-sm">
              {new Date(day.date + 'T00:00:00').toLocaleDateString('en-IN', {
                weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata'
              })}
            </span>
            <span className="text-white/50 text-xs font-mono">{day.date}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {MEAL_TYPES.map(mealType => {
              const meal = day.meals[mealType];
              const skipped    = meal?.cancelled === 1;
              const cancelTime = meal?.cancelled_at
                ? new Date(meal.cancelled_at.replace(' ', 'T') + 'Z').toLocaleTimeString('en-IN', {
                    timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true
                  })
                : null;
              return (
                <div key={mealType}
                  className={`rounded-xl px-3 py-2 flex items-center gap-2 text-xs font-semibold
                    ${skipped
                      ? 'bg-red-900/50 text-red-300 border border-red-700/50'
                      : 'bg-green-900/30 text-green-300 border border-green-700/30'}`}>
                  <span className="text-base">{MEAL_CONFIG[mealType]?.icon}</span>
                  <div>
                    <div>{mealType}</div>
                    {skipped
                      ? <div className="text-red-400 font-mono" style={{ fontSize: '0.6rem' }}>
                          Skipped {cancelTime ? `@ ${cancelTime}` : ''}
                        </div>
                      : <div className="text-green-400" style={{ fontSize: '0.6rem' }}>Ate ✓</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// LEADERBOARD TAB — top students by cancellation points this month
// ─────────────────────────────────────────────────────────────────────────────
const LeaderboardTab = ({ studentName }) => {
  const [board,   setBoard]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/api/leaderboard`);
        const d = await r.json();
        if (d.success) setBoard(d.leaderboard);
      } catch { /* silent */ }
      finally { setLoading(false); }
    })();
  }, []);

  const medals = ['🥇', '🥈', '🥉'];

  if (loading) return (
    <div className="flex justify-center py-12">
      <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-3 pb-6">
      <div className="bg-white/10 rounded-2xl p-4 border border-white/10 text-center">
        <div className="text-3xl mb-1">🏆</div>
        <h3 className="text-white font-black text-lg">Responsible Eaters</h3>
        <p className="text-white/60 text-xs mt-1">
          10 pts per on-time cancellation · Ranked this month
        </p>
      </div>

      {board.length === 0 ? (
        <div className="text-center text-white/50 py-8">No data yet this month.</div>
      ) : board.map((entry, i) => {
        const isMe = studentName && entry.name.toLowerCase() === studentName.toLowerCase();
        return (
          <div key={entry.name}
            className={`flex items-center gap-4 rounded-2xl px-4 py-3 border transition-all
              ${isMe
                ? 'bg-indigo-500/30 border-indigo-400/50 shadow-lg shadow-indigo-900/30'
                : 'bg-white/10 border-white/10'}`}>
            <div className="w-8 text-center flex-shrink-0">
              {i < 3
                ? <span className="text-2xl">{medals[i]}</span>
                : <span className="text-white/50 font-black text-sm">#{i + 1}</span>}
            </div>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-base flex-shrink-0
              ${isMe ? 'bg-indigo-500 text-white' : 'bg-white/20 text-white'}`}>
              {entry.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className={`font-bold text-sm truncate ${isMe ? 'text-indigo-200' : 'text-white'}`}>
                {entry.name} {isMe && <span className="text-indigo-300 text-xs">(You)</span>}
              </div>
              <div className="text-white/50 text-xs">{entry.cancellations} cancellations this month</div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className={`font-black text-lg ${isMe ? 'text-yellow-300' : 'text-yellow-400'}`}>
                {entry.points}
              </div>
              <div className="text-white/40 text-xs">pts</div>
            </div>
          </div>
        );
      })}

      <div className="bg-white/5 rounded-xl border border-white/10 px-4 py-3 text-xs text-white/50 text-center">
        💡 Cancel meals on time to earn points and climb the leaderboard!
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// TODAY TAB — meal toggle cards + leave application
// ─────────────────────────────────────────────────────────────────────────────
const TodayTab = ({ studentId, showToast }) => {
  const [selectedDate, setSelectedDate]     = useState(getTodayIST());
  const [statuses, setStatuses]             = useState({ Breakfast: false, Lunch: false, Snacks: false, Dinner: false });
  const [menu, setMenu]                     = useState({ Breakfast: '', Lunch: '', Snacks: '', Dinner: '' });
  const [loadingMeal, setLoadingMeal]       = useState(null);
  const [fetchingStatus, setFetchingStatus] = useState(false);
  const [showLeaveForm, setShowLeaveForm]   = useState(false);
  const [leaveStart, setLeaveStart]         = useState(getTodayIST());
  const [leaveEnd, setLeaveEnd]             = useState(getTodayIST());
  const [leavePending, setLeavePending]     = useState(false);
  const [istMinutes, setIstMinutes]         = useState(getISTMinutes());

  useEffect(() => {
    const iv = setInterval(() => setIstMinutes(getISTMinutes()), 30000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (!studentId) return;
    const load = async () => {
      setFetchingStatus(true);
      try {
        const r = await fetch(`${API_BASE}/meal-status/${studentId}/${selectedDate}`);
        const d = await r.json();
        if (d.success) setStatuses(d.statuses);
      } catch { showToast('Could not fetch meal status', 'error'); }
      finally { setFetchingStatus(false); }
    };
    load();
  }, [studentId, selectedDate]); // eslint-disable-line

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/menu/${selectedDate}`);
        const d = await r.json();
        if (d.success) setMenu(d.menu);
      } catch { /* optional */ }
    })();
  }, [selectedDate]);

  const isMealLocked = (mealType) => {
    if (isPastDate(selectedDate)) return true;
    if (!isToday(selectedDate))   return false;
    return istMinutes >= MEAL_CONFIG[mealType].deadline;
  };

  const handleToggle = async (mealType) => {
    if (!studentId) { showToast('No student linked to this account', 'info'); return; }
    if (isMealLocked(mealType)) return;
    setLoadingMeal(mealType);
    try {
      const r = await fetch(`${API_BASE}/cancel-meal`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentId, date: selectedDate, meal_type: mealType }),
      });
      const d = await r.json();
      if (d.success) {
        setStatuses(prev => ({ ...prev, [mealType]: d.action === 'cancelled' }));
        showToast(d.message, d.action === 'cancelled' ? 'info' : 'success');
      } else {
        showToast(d.error || 'Toggle failed', 'error');
      }
    } catch { showToast('Network error. Is the backend running?', 'error'); }
    finally { setLoadingMeal(null); }
  };

  const handleApplyLeave = async () => {
    if (!studentId) { showToast('No student linked', 'info'); return; }
    if (leaveEnd < leaveStart) { showToast('End date must be after start date', 'error'); return; }
    setLeavePending(true);
    try {
      const r = await fetch(`${API_BASE}/apply-leave`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentId, start_date: leaveStart, end_date: leaveEnd }),
      });
      const d = await r.json();
      if (d.success) {
        showToast(d.message, 'success');
        setShowLeaveForm(false);
        if (selectedDate >= leaveStart && selectedDate <= leaveEnd)
          setStatuses({ Breakfast: true, Lunch: true, Snacks: true, Dinner: true });
      } else {
        showToast(d.error || 'Leave application failed', 'error');
      }
    } catch { showToast('Network error', 'error'); }
    finally { setLeavePending(false); }
  };

  const cancelledCount = Object.values(statuses).filter(Boolean).length;

  return (
    <div className="space-y-4">
      <Card>
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">📅 Select Date:</label>
        <input type="date" value={selectedDate} min={getTodayIST()} onChange={e => setSelectedDate(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 text-gray-700 focus:outline-none focus:border-indigo-400 font-medium text-sm" />
        <p className="text-xs text-gray-400 mt-2 text-center">
          {isToday(selectedDate) ? '📍 Today' : `📆 ${formatDisplayDate(selectedDate)} (${getDayName(selectedDate)})`}
          {!isToday(selectedDate) && <span className="ml-2 text-green-500 font-semibold">All meals unlocked</span>}
        </p>
      </Card>

      {studentId && (
        <div className={`rounded-2xl px-5 py-3 flex items-center justify-between font-semibold text-sm
          ${cancelledCount === 0 ? 'bg-green-100 text-green-700' :
            cancelledCount === 4 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
          <span>
            {cancelledCount === 0 ? '✅ All meals active' :
             cancelledCount === 4 ? '🚫 All meals cancelled' :
             `🔴 ${cancelledCount} meal${cancelledCount > 1 ? 's' : ''} cancelled`}
          </span>
          {fetchingStatus && <Spinner small />}
        </div>
      )}

      {fetchingStatus ? (
        <div className="flex justify-center py-6"><Spinner /></div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {MEAL_TYPES.map(mealType => (
            <MealToggleCard key={mealType} mealType={mealType} cancelled={statuses[mealType]}
              locked={isMealLocked(mealType)} menuItems={menu[mealType]}
              onToggle={() => handleToggle(mealType)} loading={loadingMeal === mealType} />
          ))}
        </div>
      )}

      <div className="mt-2">
        <button onClick={() => setShowLeaveForm(v => !v)}
          className="w-full py-3.5 rounded-2xl bg-white/20 hover:bg-white/30 text-white font-bold text-sm border-2 border-white/30 transition-all backdrop-blur-sm">
          🏡 {showLeaveForm ? 'Cancel Leave Application' : 'Apply for Leave (Going Home?)'}
        </button>
        {showLeaveForm && (
          <Card className="mt-3">
            <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2"><span className="text-xl">🧳</span> Apply for Leave</h3>
            <p className="text-xs text-gray-400 mb-4">All 4 meals will be automatically cancelled for every day in the range.</p>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Start Date</label>
                <input type="date" value={leaveStart} min={minLeaveDate()}
                  onChange={e => { setLeaveStart(e.target.value); if (e.target.value > leaveEnd) setLeaveEnd(e.target.value); }}
                  className="w-full px-3 py-2.5 rounded-xl border-2 border-gray-200 text-sm focus:outline-none focus:border-indigo-400" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">End Date</label>
                <input type="date" value={leaveEnd} min={leaveStart} onChange={e => setLeaveEnd(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border-2 border-gray-200 text-sm focus:outline-none focus:border-indigo-400" />
              </div>
            </div>
            {leaveStart && leaveEnd && leaveEnd >= leaveStart && (() => {
              const days = Math.round((new Date(leaveEnd) - new Date(leaveStart)) / 86400000) + 1;
              return (
                <div className="bg-indigo-50 rounded-xl p-3 mb-4 text-xs text-indigo-700 font-semibold text-center">
                  📆 {days} day{days > 1 ? 's' : ''} · {days * 4} meals will be cancelled
                </div>
              );
            })()}
            <button onClick={handleApplyLeave} disabled={leavePending || !studentId}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm disabled:opacity-50">
              {leavePending
                ? <span className="flex items-center justify-center gap-2"><Spinner small /> Applying…</span>
                : '✅ Confirm Leave Application'}
            </button>
          </Card>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// STUDENT APP ROOT — 3-tab shell
// ─────────────────────────────────────────────────────────────────────────────
const StudentApp = ({ studentId, studentName, onLogout }) => {
  const [activeTab, setActiveTab]          = useState('today');
  const { toast, showToast, dismissToast } = useToast();

  const tabs = [
    { id: 'today',       emoji: '📅', label: 'Today'       },
    { id: 'history',     emoji: '📜', label: 'History'     },
    { id: 'leaderboard', emoji: '🏆', label: 'Leaderboard' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 pb-6">
      {toast && <Toast {...toast} onDismiss={dismissToast} />}

      {/* Header */}
      <div className="px-4 pt-8 pb-4 text-center text-white">
        <div className="text-5xl mb-2">🍱</div>
        <h1 className="text-2xl font-black">Mess Portal</h1>
        {studentName && <p className="text-white/80 text-sm mt-1 font-semibold">👤 {studentName}</p>}
        <p className="text-white/60 text-xs mt-0.5">Manage your meals for the day</p>
        {onLogout && (
          <button onClick={onLogout} className="mt-2 text-white/40 hover:text-white text-xs transition-colors">Logout</button>
        )}
      </div>

      {/* Tab bar */}
      <div className="max-w-md mx-auto px-4 mb-4">
        <div className="flex bg-white/10 backdrop-blur-sm rounded-2xl p-1 gap-1">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all flex flex-col items-center gap-0.5
                ${activeTab === t.id ? 'bg-white text-indigo-700 shadow-md' : 'text-white/60 hover:text-white'}`}>
              <span className="text-base">{t.emoji}</span>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 max-w-md mx-auto">
        {activeTab === 'today'       && <TodayTab studentId={studentId} showToast={showToast} />}
        {activeTab === 'history'     && <HistoryTab studentId={studentId} />}
        {activeTab === 'leaderboard' && <LeaderboardTab studentName={studentName} />}
      </div>
    </div>
  );
};



// =============================================================================
// VIEW B: KITCHEN DASHBOARD
// Three-tab interface: Overview | Menu Editor | Audit Log
// =============================================================================

// ─────────────────────────────────────────────────────────────────────────────
// Tab 1: Overview — Stats cards + ML prediction with per-meal selector
// ─────────────────────────────────────────────────────────────────────────────
const OverviewTab = () => {
  const [conditions, setConditions] = useState({ weather: 'Clear', menu_item: 'Paneer', delivery_traffic: 'Low' });
  const [mealType, setMealType]     = useState('Lunch');
  const [data, setData]             = useState(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState(null);

  const fetchDashboard = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({ ...conditions, meal_type: mealType });
      const r = await fetch(`${API_BASE}/dashboard?${params}`);
      const d = await r.json();
      if (!d.success) throw new Error(d.error);
      setData(d);
    } catch (e) {
      setError(e.message || 'Failed to load dashboard');
    } finally { setLoading(false); }
  }, [conditions, mealType]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  const cfg = MEAL_CONFIG[mealType];

  return (
    <div className="space-y-5">
      {/* ── CONDITION SELECTORS ────────────────────────────────────────── */}
      <Card>
        <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2 text-sm">
          🤖 Set Conditions for AI Prediction
        </h3>
        <div className="grid grid-cols-2 gap-3">

          {/* Meal Selector — picks which meal to get prediction for */}
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wide">Predict for meal:</label>
            <div className="grid grid-cols-4 gap-1.5">
              {MEAL_TYPES.map(m => {
                const c = MEAL_CONFIG[m];
                return (
                  <button key={m}
                    onClick={() => setMealType(m)}
                    className={`py-2 rounded-xl text-xs font-bold transition-all border-2
                      ${mealType === m
                        ? `${c.colorBadge} ${c.colorBorder} scale-105`
                        : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                    {c.icon} {m}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wide">☁️ Weather</label>
            <select value={conditions.weather}
              onChange={e => setConditions(p => ({ ...p, weather: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border-2 border-gray-200 text-sm focus:outline-none focus:border-indigo-400">
              <option value="Clear">☀️ Clear</option>
              <option value="Rain">🌧️ Rain</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wide">🍛 Menu Type</label>
            <select value={conditions.menu_item}
              onChange={e => setConditions(p => ({ ...p, menu_item: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border-2 border-gray-200 text-sm focus:outline-none focus:border-indigo-400">
              <option value="Paneer">🧀 Paneer (Popular)</option>
              <option value="Tori">🥒 Tori (Unpopular)</option>
            </select>
          </div>

          <div className="col-span-2">
            <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wide">🛵 Delivery Traffic</label>
            <select value={conditions.delivery_traffic}
              onChange={e => setConditions(p => ({ ...p, delivery_traffic: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border-2 border-gray-200 text-sm focus:outline-none focus:border-indigo-400">
              <option value="Low">🟢 Low (Students staying in)</option>
              <option value="Medium">🟡 Medium</option>
              <option value="High">🔴 High (Students eating out)</option>
            </select>
          </div>
        </div>

        <button onClick={fetchDashboard} disabled={loading}
          className="mt-4 w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl
                     text-sm font-bold disabled:opacity-50 transition-colors">
          {loading ? <span className="flex items-center justify-center gap-2"><Spinner small /> Refreshing…</span>
                   : '🔄 Refresh Prediction'}
        </button>
      </Card>

      {/* ── ERROR STATE ──────────────────────────────────────────────── */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-700 text-sm">
          ⚠️ {error} — Make sure all servers are running.
        </div>
      )}

      {/* ── STATS CARDS ──────────────────────────────────────────────── */}
      {loading && !data && <PageLoader />}

      {data && (
        <>
          {/* Visual calculation formula */}
          <Card>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">
              {cfg.icon} {mealType} Calculation — {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}
            </p>
            <div className="flex flex-wrap items-center gap-2 text-sm font-mono">
              <span className="bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg font-bold">{data.total_enrolled} Total</span>
              <span className="text-gray-400 font-bold">−</span>
              <span className="bg-red-100 text-red-700 px-3 py-1.5 rounded-lg font-bold">{data.manual_cancellations} Cancelled</span>
              <span className="text-gray-400 font-bold">−</span>
              <span className="bg-purple-100 text-purple-700 px-3 py-1.5 rounded-lg font-bold">{data.unreported_absences} AI Skip</span>
              <span className="text-gray-400 font-bold">=</span>
              <span className="bg-green-100 text-green-700 px-3 py-1.5 rounded-lg font-bold text-base">
                🍽️ {data.final_plates_to_cook} Plates
              </span>
            </div>
            {data.meal_scale_factor && data.meal_scale_factor !== 1 && (
              <p className="text-xs text-gray-400 mt-2">
                ℹ️ ML base prediction ({data.raw_ml_prediction}) scaled by {(data.meal_scale_factor * 100).toFixed(0)}% for {mealType}
              </p>
            )}
          </Card>

          <div className="grid grid-cols-2 gap-3">
            <StatCard emoji="👥" title="Total Enrolled"       value={data.total_enrolled}       subtitle="All registered students" />
            <StatCard emoji="❌" title={`${mealType} Cancelled`} value={data.manual_cancellations} subtitle="Explicit app cancellations" />
            <StatCard emoji="🤖" title="AI Predicted Skips"   value={data.unreported_absences}  subtitle="Won't show, didn't cancel" />
            <StatCard emoji="🍽️" title="Plates to Cook"       value={data.final_plates_to_cook} subtitle="Final recommendation" highlight={true} />
          </div>

          {/* Safety Buffer Explainer */}
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">🧮</span>
              <h3 className="font-bold text-amber-900 text-sm">90th Percentile Safety Buffer (α = 0.90)</h3>
            </div>
            <div className="text-xs text-amber-800 space-y-1.5">
              <p>Under-prediction penalty = <strong className="text-red-600">0.90 × error</strong> — very heavy (students go hungry)</p>
              <p>Over-prediction penalty  = <strong className="text-green-600">0.10 × error</strong> — light (some waste, but acceptable)</p>
              <p className="pt-1 border-t border-amber-200">Result: The model predicts the <strong>90th percentile</strong> — enough food on 9 out of 10 days.</p>
            </div>
          </div>

          {data.ml_error && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-xs text-yellow-700">
              ⚠️ ML service unavailable — showing conservative estimates. Start FastAPI on port 8000.
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Tab 2: Menu Editor — 7-day × 4-meal editable grid
// ─────────────────────────────────────────────────────────────────────────────
const MenuEditorTab = () => {
  // weekMenu: { Monday: { Breakfast: '...', ... }, ... }
  const [weekMenu, setWeekMenu] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const { toast, showToast, dismissToast } = useToast();

  // Load the full week's menu on mount
  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch(`${API_BASE}/menu-week`);
        const d = await r.json();
        if (d.success) setWeekMenu(d.menu);
        else throw new Error(d.error);
      } catch (e) {
        showToast('Failed to load menu: ' + e.message, 'error');
      } finally { setLoading(false); }
    };
    load();
  }, []); // eslint-disable-line

  // Update a single cell in the local state (for controlled inputs)
  const handleChange = (day, meal, value) => {
    setWeekMenu(prev => ({
      ...prev,
      [day]: { ...prev[day], [meal]: value }
    }));
  };

  // Save the entire menu to the backend via PUT /menu
  const handleSave = async () => {
    setSaving(true);
    try {
      const r = await fetch(`${API_BASE}/menu`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(weekMenu),
      });
      const d = await r.json();
      if (d.success) showToast('Weekly menu saved successfully! 🎉', 'success');
      else throw new Error(d.error);
    } catch (e) {
      showToast('Save failed: ' + e.message, 'error');
    } finally { setSaving(false); }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-4">
      {toast && <Toast {...toast} onDismiss={dismissToast} />}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-gray-800">Weekly Menu Editor</h2>
          <p className="text-xs text-gray-400">Click any field to edit. Press "Save Menu" when done.</p>
        </div>
        <button onClick={handleSave} disabled={saving}
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl
                     font-bold text-sm disabled:opacity-50 transition-colors whitespace-nowrap">
          {saving ? <span className="flex items-center gap-2"><Spinner small />Saving…</span> : '💾 Save Menu'}
        </button>
      </div>

      {/* Meal type legend */}
      <div className="flex gap-2 flex-wrap">
        {MEAL_TYPES.map(m => {
          const c = MEAL_CONFIG[m];
          return (
            <span key={m} className={`text-xs font-bold px-2.5 py-1 rounded-full ${c.colorBadge}`}>
              {c.icon} {m}
            </span>
          );
        })}
      </div>

      {/* Day-by-day accordion cards */}
      {weekMenu && DAYS_OF_WEEK.map(day => (
        <Card key={day} className="!p-4">
          <h3 className="font-bold text-gray-700 mb-3 pb-2 border-b border-gray-100">📅 {day}</h3>
          <div className="grid grid-cols-1 gap-2.5">
            {MEAL_TYPES.map(meal => {
              const c = MEAL_CONFIG[meal];
              return (
                <div key={meal} className={`rounded-xl bg-gradient-to-r ${c.colorBg} border ${c.colorBorder} p-3`}>
                  <label className={`text-xs font-bold ${c.colorText} mb-1 block`}>
                    {c.icon} {meal}
                  </label>
                  <input
                    type="text"
                    value={weekMenu[day]?.[meal] || ''}
                    onChange={e => handleChange(day, meal, e.target.value)}
                    placeholder={`Enter ${meal.toLowerCase()} items, comma-separated…`}
                    className="w-full bg-white/70 backdrop-blur-sm border border-white rounded-lg
                               px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-2
                               focus:ring-white/80 placeholder-gray-400"
                  />
                </div>
              );
            })}
          </div>
        </Card>
      ))}

      {/* Bottom Save button for convenience */}
      <button onClick={handleSave} disabled={saving}
        className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl
                   font-bold text-sm disabled:opacity-50 transition-colors">
        {saving ? 'Saving…' : '💾 Save All Changes'}
      </button>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Tab 3: Audit Log — Cancellation trail with spam detection badges
// ─────────────────────────────────────────────────────────────────────────────
const AuditLogTab = () => {
  const [auditDate, setAuditDate]   = useState(getTodayIST());
  const [data, setData]             = useState(null);
  const [loading, setLoading]       = useState(false);
  const [filterMeal, setFilterMeal] = useState('All'); // Filter by meal type

  const fetchAudit = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/audit-cancellations?date=${auditDate}`);
      const d = await r.json();
      if (d.success) setData(d);
      else throw new Error(d.error);
    } catch (e) {
      setData(null);
    } finally { setLoading(false); }
  }, [auditDate]);

  useEffect(() => { fetchAudit(); }, [fetchAudit]);

  // Apply meal type filter to the cancellation list
  const filtered = data?.cancellations?.filter(c =>
    filterMeal === 'All' || c.meal_type === filterMeal
  ) || [];

  // Count cancellations per meal type for the summary chips
  const countByMeal = MEAL_TYPES.reduce((acc, m) => {
    acc[m] = data?.cancellations?.filter(c => c.meal_type === m).length || 0;
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {/* Date selector + refresh */}
      <Card>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
              📅 Audit Date
            </label>
            <input type="date" value={auditDate}
              onChange={e => setAuditDate(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border-2 border-gray-200 text-sm
                         focus:outline-none focus:border-indigo-400" />
          </div>
          <button onClick={fetchAudit} disabled={loading}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl
                       text-sm font-bold disabled:opacity-50">
            {loading ? <Spinner small /> : '🔍 Load'}
          </button>
        </div>
      </Card>

      {/* Summary chips: count per meal type */}
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

      {/* Meal type filter tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {['All', ...MEAL_TYPES].map(m => {
          const c = m === 'All' ? null : MEAL_CONFIG[m];
          return (
            <button key={m} onClick={() => setFilterMeal(m)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border-2 ${
                filterMeal === m
                  ? (c ? `${c.colorBadge} ${c.colorBorder}` : 'bg-gray-800 text-white border-gray-800')
                  : 'border-gray-200 text-gray-500 hover:border-gray-300 bg-white'}`}>
              {c ? `${c.icon} ` : ''}{m}
            </button>
          );
        })}
      </div>

      {/* Cancellation table */}
      {loading && <PageLoader />}

      {!loading && filtered.length === 0 && (
        <Card className="text-center py-8">
          <div className="text-4xl mb-2">🎉</div>
          <p className="text-gray-500 font-semibold">No cancellations found</p>
          <p className="text-gray-400 text-xs mt-1">
            {filterMeal === 'All' ? 'No meals were cancelled on this date.' : `No ${filterMeal} cancellations on this date.`}
          </p>
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
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Time (IST)</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((c, idx) => {
                  const cfg = MEAL_CONFIG[c.meal_type] || MEAL_CONFIG.Lunch;
                  const timeStr = c.cancelled_at
                    ? new Date(c.cancelled_at).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })
                    : '—';
                  return (
                    <tr key={`${c.id}-${idx}`} className={`hover:bg-gray-50 ${c.is_frequent ? 'bg-red-50/30' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-gray-800">{c.roll_number}</div>
                        <div className="text-xs text-gray-400">{c.name}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${cfg.colorBadge}`}>
                          {cfg.icon} {c.meal_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 font-mono">{timeStr}</td>
                      <td className="px-4 py-3">
                        {c.is_frequent ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-red-100 text-red-700">
                            ⚠️ Frequent ({c.monthly_count}/mo)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">
                            Normal
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Legend */}
      <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700">
        ⚠️ <strong>Spam Detection:</strong> Students with ≥ {data?.spam_threshold || 15} cancellations this month are flagged as "Frequent". Admins can investigate these cases.
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Kitchen Dashboard — shell with 3 tabs
// ─────────────────────────────────────────────────────────────────────────────
const KitchenDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'menu' | 'audit'

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
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white text-lg">🍽️</div>
            <div>
              <h1 className="font-black text-gray-800 text-base leading-tight">Kitchen Intelligence Dashboard</h1>
              <p className="text-xs text-gray-400">
                {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' })}
              </p>
            </div>
          </div>

          {/* Tab bar */}
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                  activeTab === t.id
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}>
                {t.emoji} {t.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Tab content */}
      <main className="max-w-2xl mx-auto px-4 py-5">
        {activeTab === 'overview' && <OverviewTab />}
        {activeTab === 'menu'     && <MenuEditorTab />}
        {activeTab === 'audit'    && <AuditLogTab />}
      </main>
    </div>
  );
};

// =============================================================================
// ROOT COMPONENT: App
// Auth flow: LandingPage → role-specific dashboard
// =============================================================================
export default function App() {
  // auth: { id, name, role } | null
  const [user, setUser] = useState(null);

  // For students: we match their name to a Students DB row to get the student_id
  const [studentId, setStudentId] = useState(null);

  // Called by LandingPage on successful login
  const handleLogin = useCallback(async (loggedInUser) => {
    setUser(loggedInUser);

    // If student, use ensure-student to get/create their Students DB row
    if (loggedInUser.role === 'student') {
      try {
        const r = await fetch(`${API_BASE}/api/ensure-student`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ name: loggedInUser.name }),
        });
        const d = await r.json();
        if (d.success) setStudentId(d.student.id);
      } catch { /* non-critical */ }
    }
  }, []);


  const handleLogout = useCallback(() => {
    setUser(null);
    setStudentId(null);
  }, []);

  // ── NOT LOGGED IN → Show Landing Page ──────────────────────────────────────
  if (!user) {
    return (
      <div className="font-sans">
        <LandingPage onLogin={handleLogin} />
      </div>
    );
  }

  // ── LOGGED IN → Route by role ───────────────────────────────────────────────
  return (
    <div className="font-sans">
      {user.role === 'student' && (
        <StudentApp
          studentId={studentId}
          studentName={user.name}
          onLogout={handleLogout}
        />
      )}
      {user.role === 'contractor' && (
        <Dashboard
          user={user}
          onLogout={handleLogout}
        />
      )}
      {user.role === 'guard' && (
        <GateGuardApp
          user={user}
          onLogout={handleLogout}
        />
      )}
    </div>
  );
}

