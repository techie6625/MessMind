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

// Toast notification — glass dark floating message
const Toast = ({ message, type = 'success', onDismiss }) => {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3500);
    return () => clearTimeout(t);
  }, [onDismiss]);

  const styles = {
    success: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300',
    error:   'bg-rose-500/20 border-rose-500/40 text-rose-300',
    info:    'bg-cyan-500/20 border-cyan-500/40 text-cyan-300',
  };

  return (
    <div className={`fixed top-4 right-4 z-50 ${styles[type]} border backdrop-blur-xl
                     px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 max-w-xs`}>
      <span className="text-lg">{type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
      <span className="text-sm font-medium">{message}</span>
      <button onClick={onDismiss} className="ml-2 opacity-50 hover:opacity-100 text-lg leading-none">×</button>
    </div>
  );
};

// Reusable glass card wrapper
const Card = ({ children, className = '' }) => (
  <div className={`bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 ${className}`}>
    {children}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT: MealToggleCard — with reason-prompt before cancellation
// ─────────────────────────────────────────────────────────────────────────────
const CANCEL_REASONS = [
  'Ordered online',
  "Don't like this meal",
  'Other reasons',
];

const MealToggleCard = ({ mealType, cancelled, locked, menuItems, onToggle, loading }) => {
  const cfg = MEAL_CONFIG[mealType];
  const [showReasonPicker, setShowReasonPicker] = useState(false);
  const [selectedReason,   setSelectedReason]   = useState('');

  const stateStyles = {
    locked:    { card: 'bg-white/3 border-white/5 opacity-50',                             badge: 'bg-white/10 text-slate-500 border-white/10' },
    cancelled: { card: 'bg-rose-500/10 border-rose-500/30 shadow-rose-500/10',             badge: 'bg-rose-500/20 text-rose-300 border-rose-500/30' },
    active:    { card: 'bg-emerald-500/8 border-emerald-500/20 shadow-emerald-500/5',      badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  };
  const state = locked ? 'locked' : cancelled ? 'cancelled' : 'active';
  const s = stateStyles[state];

  const handleCancelClick = () => {
    if (cancelled) { onToggle(''); return; } // reinstating — no reason needed
    setShowReasonPicker(true);
    setSelectedReason('');
  };

  const handleConfirmCancel = () => {
    if (!selectedReason) return;
    setShowReasonPicker(false);
    onToggle(selectedReason);
  };

  return (
    <div className={`rounded-2xl border p-4 transition-all duration-300 shadow-lg
      ${s.card} ${!locked ? 'hover:-translate-y-0.5 hover:shadow-xl' : 'cursor-not-allowed'}`}>
      {/* Top row */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl">{cfg.icon}</span>
          <div>
            <p className="font-bold text-sm text-white">{cfg.label}</p>
            <p className="text-xs text-slate-500">{cfg.timeLabel}</p>
          </div>
        </div>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${s.badge}`}>
          {locked ? '🔒 Locked' : cancelled ? '❌ Off' : '✅ On'}
        </span>
      </div>

      {/* Menu items */}
      {menuItems && (
        <p className="text-xs text-slate-500 mb-3 leading-relaxed border-t border-white/10 pt-2 mt-1">
          <span className="font-semibold text-slate-400">Today: </span>{menuItems}
        </p>
      )}

      {/* Reason picker — shown when about to cancel */}
      {showReasonPicker && !cancelled && (
        <div className="mb-3 p-3 rounded-xl bg-white/5 border border-white/10 space-y-2 animate-fade-in">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-2">Why are you cancelling?</p>
          {CANCEL_REASONS.map((reason, i) => (
            <button key={i} onClick={() => setSelectedReason(reason)}
              className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all
                ${selectedReason === reason
                  ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                  : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white'}`}>
              {i + 1}. {reason}
            </button>
          ))}
          <div className="flex gap-2 pt-1">
            <button onClick={handleConfirmCancel} disabled={!selectedReason}
              className="flex-1 py-2 bg-gradient-to-r from-rose-500 to-pink-600 text-white rounded-xl text-xs font-black
                         disabled:opacity-40 hover:brightness-110 transition-all active:scale-95">
              ✓ Confirm Cancel
            </button>
            <button onClick={() => setShowReasonPicker(false)}
              className="px-4 py-2 bg-white/5 border border-white/10 text-slate-400 rounded-xl text-xs font-bold
                         hover:bg-white/10 hover:text-white transition-all">
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Toggle button */}
      {!showReasonPicker && (
        <button
          onClick={handleCancelClick}
          disabled={locked || loading}
          className={`w-full py-2.5 rounded-xl text-white text-sm font-black transition-all duration-200 active:scale-95
            ${locked    ? 'bg-white/5 text-slate-600 cursor-not-allowed border border-white/5' :
              loading   ? 'bg-white/10 cursor-wait' :
              cancelled ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 shadow-lg shadow-emerald-500/20' :
                          'bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-400 hover:to-pink-500 shadow-lg shadow-rose-500/20'
            }`}
        >
          {loading ? <span className="flex items-center justify-center gap-2"><Spinner small /> Updating…</span>
            : locked    ? 'Deadline passed'
            : cancelled ? `✅ Reinstate ${cfg.label}`
            :             `🚫 Cancel ${cfg.label}`
          }
        </button>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT: StatCard — glass dark KPI card
// ─────────────────────────────────────────────────────────────────────────────
const StatCard = ({ title, value, subtitle, emoji, highlight = false }) => (
  <div className={`rounded-2xl border p-4 flex flex-col gap-1.5 transition-all duration-300
    ${highlight
      ? 'bg-emerald-500/10 border-emerald-500/30 shadow-lg shadow-emerald-500/10'
      : 'bg-white/5 border-white/10 hover:bg-white/8 hover:border-white/20 hover:-translate-y-0.5'
    }`}>
    <div className="text-2xl">{emoji}</div>
    <div className={`text-4xl font-black ${highlight ? 'text-emerald-400' : 'text-white'}`}>{value ?? '—'}</div>
    <div className={`font-semibold text-xs ${highlight ? 'text-emerald-300' : 'text-slate-400'}`}>{title}</div>
    {subtitle && <div className={`text-xs leading-tight ${highlight ? 'text-emerald-400/60' : 'text-slate-500'}`}>{subtitle}</div>}
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
// STAR RATING WIDGET — anonymous post-meal rating (per student device only)
// ─────────────────────────────────────────────────────────────────────────────
const StarRating = ({ mealDate, mealType }) => {
  // Store submitted ratings in localStorage so we don't re-prompt
  const storageKey = `rating_${mealDate}_${mealType}`;
  const saved = parseInt(localStorage.getItem(storageKey) || '0', 10);

  const [selected, setSelected] = useState(saved);
  const [hovered,  setHovered]  = useState(0);
  const [submitted, setSubmitted] = useState(saved > 0);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selected || submitting) return;
    setSubmitting(true);
    try {
      const r = await fetch(`${API_BASE}/api/ratings`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meal_date: mealDate, meal_type: mealType, stars: selected }),
      });
      const d = await r.json();
      if (d.success) {
        localStorage.setItem(storageKey, String(selected));
        setSubmitted(true);
      }
    } catch { /* silent */ }
    finally { setSubmitting(false); }
  };

  if (submitted) {
    return (
      <div className="flex items-center gap-1.5 mt-2">
        <span className="text-amber-400 text-xs">{'⭐'.repeat(selected)}</span>
        <span className="text-slate-500 text-[10px] font-semibold">Rated</span>
      </div>
    );
  }

  return (
    <div className="mt-2.5 pt-2 border-t border-white/10">
      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1.5">Rate this meal</p>
      <div className="flex items-center gap-1.5">
        {[1,2,3,4,5].map(s => (
          <button key={s}
            onMouseEnter={() => setHovered(s)}
            onMouseLeave={() => setHovered(0)}
            onClick={() => setSelected(s)}
            className={`text-xl transition-all duration-100 ${s <= (hovered || selected) ? 'text-amber-400 scale-110' : 'text-slate-600'}`}>
            ★
          </button>
        ))}
        {selected > 0 && (
          <button onClick={handleSubmit} disabled={submitting}
            className="ml-2 text-[10px] font-black px-2.5 py-1 bg-amber-500/20 border border-amber-500/30 text-amber-300
                       rounded-full hover:brightness-110 disabled:opacity-50 transition-all active:scale-95">
            {submitting ? '…' : 'Submit'}
          </button>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// HISTORY TAB — past meals: Ate vs Skipped + star rating for Ate meals
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
    <div className="text-center py-10 text-slate-500">
      <p className="text-2xl mb-2">📋</p><p>No student linked.</p>
    </div>
  );
  if (loading) return (
    <div className="flex justify-center py-12">
      <div className="w-8 h-8 border-2 border-white/20 border-t-cyan-400 rounded-full animate-spin" />
    </div>
  );
  if (history.length === 0) return (
    <div className="text-center py-10 text-slate-500">
      <p className="text-3xl mb-2">🍽️</p>
      <p className="font-semibold">No meal history yet.</p>
    </div>
  );

  const todayIST = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

  return (
    <div className="space-y-3 pb-6 relative z-10">
      <p className="text-slate-500 text-[10px] text-center font-bold uppercase tracking-widest mb-4">
        Last 14 Days · Rate your meals ⭐
      </p>
      {history.map(day => (
        <div key={day.date} className="bg-white/5 backdrop-blur-xl rounded-2xl p-4 border border-white/10 hover:bg-white/10 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <span className="text-white font-bold text-sm">
              {new Date(day.date + 'T00:00:00').toLocaleDateString('en-IN', {
                weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata'
              })}
            </span>
            <span className="text-slate-400 text-xs font-mono">{day.date}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {MEAL_TYPES.map(mealType => {
              const meal = day.meals[mealType];
              const skipped    = meal?.cancelled === 1;
              const isPast     = day.date < todayIST;
              const cancelTime = meal?.cancelled_at
                ? new Date(meal.cancelled_at.replace(' ', 'T') + 'Z').toLocaleTimeString('en-IN', {
                    timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true
                  })
                : null;
              return (
                <div key={mealType}
                  className={`rounded-xl px-3 py-2.5 border transition-all
                    ${skipped
                      ? 'bg-rose-500/10 text-rose-300 border-rose-500/20'
                      : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{MEAL_CONFIG[mealType]?.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold opacity-90 truncate">{mealType}</div>
                      {skipped
                        ? <>
                            <div className="text-rose-400/80 font-mono" style={{ fontSize: '0.65rem' }}>
                              Skipped {cancelTime ? `@ ${cancelTime}` : ''}
                            </div>
                            {meal?.reason && meal.reason.trim() && (
                              <div className="text-rose-400/60 italic" style={{ fontSize: '0.6rem' }}>
                                "{meal.reason}"
                              </div>
                            )}
                          </>
                        : <div className="text-emerald-400/80" style={{ fontSize: '0.65rem' }}>Ate ✓</div>
                      }
                    </div>
                  </div>
                  {/* Show star rating UI for past Ate meals */}
                  {!skipped && isPast && (
                    <StarRating mealDate={day.date} mealType={mealType} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-3 text-xs text-cyan-300 font-semibold text-center">
        ⭐ Rate your past meals — all ratings are 100% anonymous!
      </div>
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
      <div className="w-8 h-8 border-2 border-white/20 border-t-cyan-400 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-3 pb-6 relative z-10">
      <div className="bg-gradient-to-br from-indigo-500/20 to-purple-500/10 rounded-2xl p-5 border border-indigo-500/20 text-center shadow-lg shadow-indigo-500/10 mb-2">
        <div className="text-4xl mb-2">🏆</div>
        <h3 className="text-white font-black text-lg bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">Responsible Eaters</h3>
        <p className="text-indigo-300/70 text-xs mt-1 font-semibold">
          10 pts per on-time cancellation · Ranked this month
        </p>
      </div>

      {board.length === 0 ? (
        <div className="text-center text-slate-500 py-8">No data yet this month.</div>
      ) : board.map((entry, i) => {
        const isMe = studentName && entry.name.toLowerCase() === studentName.toLowerCase();
        return (
          <div key={entry.name}
            className={`flex items-center gap-4 rounded-2xl px-4 py-3 border transition-all duration-300
              ${isMe
                ? 'bg-gradient-to-r from-indigo-500/20 to-purple-500/10 border-indigo-400/40 shadow-lg shadow-indigo-500/20 scale-[1.02]'
                : 'bg-white/5 border-white/10 hover:bg-white/10'}`}>
            <div className="w-8 text-center flex-shrink-0">
              {i < 3
                ? <span className="text-2xl drop-shadow-md">{medals[i]}</span>
                : <span className="text-slate-500 font-black text-sm">#{i + 1}</span>}
            </div>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-base flex-shrink-0 shadow-inner
              ${isMe ? 'bg-indigo-500 text-white border border-indigo-400' : 'bg-white/10 text-white border border-white/20'}`}>
              {entry.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className={`font-bold text-sm truncate ${isMe ? 'text-indigo-200' : 'text-white'}`}>
                {entry.name} {isMe && <span className="text-indigo-400 text-xs ml-1">(You)</span>}
              </div>
              <div className="text-slate-500 text-xs font-medium">{entry.cancellations} cancellations this month</div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className={`font-black text-xl leading-none ${isMe ? 'text-yellow-400' : 'text-amber-500'}`}>
                {entry.points}
              </div>
              <div className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">pts</div>
            </div>
          </div>
        );
      })}

      <div className="bg-cyan-500/10 rounded-xl border border-cyan-500/20 px-4 py-3.5 text-xs text-cyan-300 font-semibold text-center shadow-inner">
        💡 Cancel meals on time to earn points and climb the leaderboard!
      </div>
    </div>
  );
};


// ─────────────────────────────────────────────────────────────────────────────
// TODAY TAB — meal toggle cards + leave application
// ─────────────────────────────────────────────────────────────────────────────
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

  const handleToggle = async (mealType, reason = '') => {
    if (!studentId) { showToast('No student linked to this account', 'info'); return; }
    if (isMealLocked(mealType)) return;
    setLoadingMeal(mealType);
    try {
      const r = await fetch(`${API_BASE}/cancel-meal`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentId, date: selectedDate, meal_type: mealType, reason }),
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
    <div className="space-y-4 relative z-10">
      <Card>
        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">📅 Select Date</label>
        <input type="date" value={selectedDate} min={getTodayIST()} onChange={e => setSelectedDate(e.target.value)}
          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/60 font-medium text-sm transition-all" />
        <p className="text-xs text-slate-500 mt-2 text-center">
          {isToday(selectedDate) ? '📍 Today' : `📆 ${formatDisplayDate(selectedDate)} (${getDayName(selectedDate)})`}
          {!isToday(selectedDate) && <span className="ml-2 text-emerald-400 font-semibold">All meals unlocked</span>}
        </p>
      </Card>

      {studentId && (
        <div className={`rounded-2xl px-5 py-3 flex items-center justify-between font-semibold text-sm border backdrop-blur-md
          ${cancelledCount === 0 ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' :
            cancelledCount === 4 ? 'bg-rose-500/10 text-rose-300 border-rose-500/20' : 'bg-amber-500/10 text-amber-300 border-amber-500/20'}`}>
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
              onToggle={(reason) => handleToggle(mealType, reason)} loading={loadingMeal === mealType} />
          ))}
        </div>
      )}

      <div className="mt-2">
        <button onClick={() => setShowLeaveForm(v => !v)}
          className="w-full py-3.5 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-bold text-sm border border-white/10 transition-all backdrop-blur-md">
          🏡 {showLeaveForm ? 'Cancel Leave Application' : 'Apply for Leave (Going Home?)'}
        </button>
        {showLeaveForm && (
          <Card className="mt-3">
            <h3 className="font-bold text-white mb-4 flex items-center gap-2"><span className="text-xl">🧳</span> Apply for Leave</h3>
            <p className="text-xs text-slate-400 mb-4">All 4 meals will be automatically cancelled for every day in the range.</p>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-widest">Start Date</label>
                <input type="date" value={leaveStart} min={minLeaveDate()}
                  onChange={e => { setLeaveStart(e.target.value); if (e.target.value > leaveEnd) setLeaveEnd(e.target.value); }}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-500/60 transition-all" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-widest">End Date</label>
                <input type="date" value={leaveEnd} min={leaveStart} onChange={e => setLeaveEnd(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-500/60 transition-all" />
              </div>
            </div>
            {leaveStart && leaveEnd && leaveEnd >= leaveStart && (() => {
              const days = Math.round((new Date(leaveEnd) - new Date(leaveStart)) / 86400000) + 1;
              return (
                <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-3 mb-4 text-xs text-cyan-300 font-semibold text-center">
                  📆 {days} day{days > 1 ? 's' : ''} · {days * 4} meals will be cancelled
                </div>
              );
            })()}
            <button onClick={handleApplyLeave} disabled={leavePending || !studentId}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-black text-sm disabled:opacity-50 transition-all shadow-lg shadow-cyan-500/20">
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
// STUDENT APP ROOT — 3-tab shell (Glassmorphism dark)
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
    <div className="min-h-screen bg-[#0B0F19] relative overflow-hidden pb-8">
      {/* Ambient glow orbs */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/8 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-cyan-500/6 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-violet-500/4 rounded-full blur-3xl pointer-events-none" />

      {toast && <Toast {...toast} onDismiss={dismissToast} />}

      {/* Header */}
      <div className="relative z-10 px-4 pt-10 pb-6 text-center text-white">
        <div className="text-5xl mb-3 drop-shadow-2xl">🍱</div>
        <h1 className="text-3xl font-black bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">Mess Portal</h1>
        {studentName && <p className="text-white/90 text-sm mt-1.5 font-bold">👤 {studentName}</p>}
        <p className="text-slate-400 text-xs mt-1">Manage your meals for the day</p>
        {onLogout && (
          <button onClick={onLogout} className="mt-3 text-slate-500 hover:text-white border border-white/10 rounded-lg px-3 py-1.5 text-xs transition-colors hover:border-white/20">Logout</button>
        )}
      </div>

      {/* Tab bar */}
      <div className="relative z-10 max-w-md mx-auto px-4 mb-5">
        <div className="flex bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-1.5 gap-1.5">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`flex-1 py-3 rounded-xl text-xs font-black transition-all flex flex-col items-center gap-1
                ${activeTab === t.id ? 'bg-white/10 text-white shadow-inner border border-white/5' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}>
              <span className="text-lg">{t.emoji}</span>
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

          {/* ── PLATES SAVED KPI ─────────────────────────────────────────────────── */}
          {/* Formula: Plates Saved = Total Enrolled − Plates to Cook              */}
          {/* This is the KEY metric judges care about — food waste avoided today   */}
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
                  // SQLite CURRENT_TIMESTAMP stores UTC without 'Z'. We must append 'Z'
                  // so JavaScript's Date constructor treats it as UTC, not local time.
                  // Without 'Z', browsers assume local timezone → wrong IST display.
                  const rawTime = c.cancelled_at;
                  const timeStr = rawTime
                    ? new Date(rawTime.replace(' ', 'T') + 'Z').toLocaleTimeString('en-IN', {
                        timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit'
                      })
                    : '—';
                  return (
                    <tr key={`${c.id}-${idx}`} className={`hover:bg-gray-50 ${c.is_frequent ? 'bg-red-50/30' : ''}`}>
                      <td className="px-4 py-3">
                        {/* Name is PRIMARY — judges/admin need to see who cancelled, not a roll number */}
                        <div className="font-semibold text-gray-800">{c.name}</div>
                        <div className="text-xs text-gray-400">{c.roll_number}</div>
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

