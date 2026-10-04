/*
=============================================================================
<<<<<<< HEAD
FILE: WardenDashboard.js  —  Warden Administration Portal
=============================================================================
Features:
  • Fetches live KPIs from GET /api/warden-stats on mount:
      – Total Expenditure (sum of Purchases table)
      – Average Meal Rating (from anonymous Ratings table)
      – Top Skipped Meal (most cancelled with reason "Don't like this meal")
  • Receipts / Bills table — dynamically rendered from Purchases records
  • "+ Add Purchase" modal — lets contractor log bills on the spot
  • Telegram demo trigger button — calls /api/trigger-bot-lunch for live demo
  • Logout button
Theme: deep dark bg-gray-900, glassmorphism cards (bg-white/10 backdrop-blur-lg)
=======
FILE: WardenDashboard.js  —  Warden Portal v1
=============================================================================
A high-level analytics dashboard for the Hostel Warden.

Sections:
  1. Financial KPI — Total & weekly expenditure
  2. Receipts Gallery — Scrollable grid of uploaded bills
  3. Student Satisfaction — Weekly average star rating
  4. Red Flags — Top skipped / most-cancelled meals
  5. Waste Overview — Total waste this week per meal
>>>>>>> 00bde25fc7fd19a0eddd476e4b6149a3801bf83a
=============================================================================
*/

import React, { useState, useEffect, useCallback } from 'react';

const API_BASE = 'http://localhost:3001';

// ─────────────────────────────────────────────────────────────────────────────
<<<<<<< HEAD
// SMALL UI HELPERS
// ─────────────────────────────────────────────────────────────────────────────

// Spinner — small rotating ring used during loading states
const Spinner = ({ small = false }) => (
  <div
    className={`inline-block border-2 border-white/20 border-t-cyan-400
                rounded-full animate-spin
                ${small ? 'w-4 h-4' : 'w-8 h-8'}`}
  />
);

// GlassCard — the shared glassmorphism container for every widget
const GlassCard = ({ children, className = '' }) => (
  <div
    className={`bg-white/10 backdrop-blur-lg border border-white/20
                rounded-2xl shadow-xl ${className}`}
  >
=======
// UI HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const Spinner = () => (
  <div className="inline-block w-6 h-6 border-2 border-white/20 border-t-violet-400 rounded-full animate-spin" />
);

const GlassCard = ({ children, className = '' }) => (
  <div className={`bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 ${className}`}>
>>>>>>> 00bde25fc7fd19a0eddd476e4b6149a3801bf83a
    {children}
  </div>
);

<<<<<<< HEAD
// Toast — ephemeral feedback message (auto-dismisses after 3.5 s)
const Toast = ({ message, type = 'success', onDismiss }) => {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3500);
    return () => clearTimeout(t);
  }, [onDismiss]);

  const styles = {
    success: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300',
    error:   'bg-rose-500/20   border-rose-500/40   text-rose-300',
    info:    'bg-cyan-500/20   border-cyan-500/40   text-cyan-300',
  };

  return (
    <div
      className={`fixed top-4 right-4 z-50 ${styles[type]} border backdrop-blur-xl
                  px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 max-w-xs`}
    >
      <span className="text-lg">
        {type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}
      </span>
      <span className="text-sm font-medium flex-1">{message}</span>
      <button
        onClick={onDismiss}
        className="opacity-50 hover:opacity-100 text-lg leading-none"
      >
        ×
      </button>
=======
const KPIBlock = ({ label, value, sub, accent = 'violet' }) => {
  const colors = {
    violet:  'text-violet-400',
    emerald: 'text-emerald-400',
    amber:   'text-amber-400',
    rose:    'text-rose-400',
    cyan:    'text-cyan-400',
  };
  return (
    <div className="flex flex-col gap-1">
      <div className={`text-3xl font-black ${colors[accent] || 'text-white'}`}>{value ?? '—'}</div>
      <div className="text-white text-xs font-bold">{label}</div>
      {sub && <div className="text-slate-500 text-[10px] leading-tight">{sub}</div>}
    </div>
  );
};

// Star display (read-only)
const StarDisplay = ({ rating, max = 5 }) => {
  const filled  = Math.round(rating || 0);
  const empty   = max - filled;
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: filled }).map((_, i) => <span key={`f${i}`} className="text-amber-400 text-xl">⭐</span>)}
      {Array.from({ length: empty  }).map((_, i) => <span key={`e${i}`} className="text-slate-700 text-xl">⭐</span>)}
>>>>>>> 00bde25fc7fd19a0eddd476e4b6149a3801bf83a
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
<<<<<<< HEAD
// ADD PURCHASE MODAL
// ─────────────────────────────────────────────────────────────────────────────
// A simple modal form to let the contractor (or warden) log a new bill entry.
// On submit it POSTs to /api/purchases and refetches stats.
const AddPurchaseModal = ({ onClose, onSaved }) => {
  const [desc,   setDesc]   = useState('');
  const [amount, setAmount] = useState('');
  const [date,   setDate]   = useState(
    new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  );
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
=======
// WARDEN LOGIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
function WardenLogin({ onLogin }) {
  const [name,     setName]     = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
>>>>>>> 00bde25fc7fd19a0eddd476e4b6149a3801bf83a

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
<<<<<<< HEAD
    if (!desc.trim())               { setError('Description is required.'); return; }
    if (!amount || isNaN(amount))   { setError('Enter a valid amount.'); return; }
    if (!date)                      { setError('Date is required.'); return; }

    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/purchases`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ description: desc.trim(), amount: parseFloat(amount), date_bought: date }),
      });
      const d = await r.json();
      if (!d.success) { setError(d.error || 'Failed to save.'); return; }
      onSaved(); // triggers stats refetch in parent
      onClose();
    } catch {
      setError('Network error.');
    } finally {
      setLoading(false);
    }
  };

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <GlassCard className="w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white font-black text-lg">📋 Add Purchase</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">
              Item / Description
            </label>
            <input
              value={desc} onChange={e => setDesc(e.target.value)}
              placeholder="e.g. Rice (50 kg), Gas cylinder…"
              className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10
                         text-white placeholder-gray-600 text-sm
                         focus:outline-none focus:border-cyan-500/60 transition-all"
            />
          </div>

          {/* Amount */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">
              Amount (₹)
            </label>
            <input
              type="number" min="0" step="0.01"
              value={amount} onChange={e => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10
                         text-white placeholder-gray-600 text-sm
                         focus:outline-none focus:border-cyan-500/60 transition-all"
            />
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">
              Date of Purchase
            </label>
            <input
              type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10
                         text-white text-sm
                         focus:outline-none focus:border-cyan-500/60 transition-all"
            />
          </div>

          {error && (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl px-4 py-2 text-rose-300 text-sm">
              ❌ {error}
            </div>
          )}

          <button
            type="submit" disabled={loading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600
                       text-white font-black text-sm hover:brightness-110 active:scale-95
                       transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <><Spinner small /> Saving…</> : '💾 Save Purchase'}
          </button>
        </form>
      </GlassCard>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
const WardenDashboard = ({ user, onLogout }) => {
  // ── State ─────────────────────────────────────────────────────────────────
  const [stats,   setStats]   = useState(null);   // warden KPI response from API
  const [loading, setLoading] = useState(true);   // initial page load
  const [error,   setError]   = useState('');     // fetch error message
  const [showModal,  setShowModal]  = useState(false); // add-purchase modal
  const [toast,      setToast]      = useState(null);  // { message, type }
  const [botLoading, setBotLoading] = useState(false); // Telegram trigger loading

  // ── Fetch live stats from /api/warden-stats ───────────────────────────────
  // Called on mount and after every successful purchase addition.
  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await fetch(`${API_BASE}/api/warden-stats`);
      const d = await r.json();
      if (!d.success) { setError(d.error || 'Failed to load stats.'); return; }
      setStats(d);
    } catch {
      setError('Cannot reach the backend. Is the server running?');
    } finally {
      setLoading(false);
    }
=======
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/login`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: name.trim(), password, role: 'warden' }),
      });
      const d = await r.json();
      if (!d.success) { setError(d.error || 'Invalid credentials.'); return; }
      onLogin(d.user);
    } catch { setError('Cannot reach the server. Is the backend running?'); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#0B0F19] relative overflow-hidden flex flex-col items-center justify-center px-4">
      {/* Ambient orbs */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-violet-500/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative z-10 text-center mb-8">
        <div className="text-6xl mb-3">🏛️</div>
        <h1 className="text-3xl font-black bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">Warden Portal</h1>
        <p className="text-slate-400 text-sm mt-2">Analytics & oversight for mess management</p>
      </div>

      <div className="relative z-10 w-full max-w-sm bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
        <h2 className="font-black text-white text-base mb-5 text-center">🔐 Warden Login</h2>
        {error && <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-xs">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Warden ID</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="admin" required
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-600 focus:outline-none focus:border-violet-500/60 text-sm transition-all" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-600 focus:outline-none focus:border-violet-500/60 text-sm transition-all" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-violet-500 to-indigo-600 hover:brightness-110 text-white rounded-xl font-black text-sm disabled:opacity-50 transition-all active:scale-95 flex items-center justify-center gap-2">
            {loading ? <><Spinner /> Verifying…</> : '🏛️ Enter Portal'}
          </button>
        </form>
        <p className="text-slate-600 text-[10px] text-center mt-4">Default: <span className="text-slate-500 font-mono">admin</span> / <span className="text-slate-500 font-mono">admin123</span></p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WARDEN DASHBOARD — main view
// ─────────────────────────────────────────────────────────────────────────────
function WardenDashboardView({ user, onLogout }) {
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [lightbox, setLightbox] = useState(null); // image URL for lightbox

  const fetchStats = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const r = await fetch(`${API_BASE}/api/warden-stats`);
      const d = await r.json();
      if (!d.success) throw new Error(d.error);
      setStats(d);
    } catch (e) { setError(e.message || 'Failed to load stats.'); }
    finally { setLoading(false); }
>>>>>>> 00bde25fc7fd19a0eddd476e4b6149a3801bf83a
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

<<<<<<< HEAD
  // ── Telegram demo trigger ─────────────────────────────────────────────────
  // Calls GET /api/trigger-bot-lunch which blasts a Telegram DM to all linked
  // students with today's lunch menu and inline Yes/No buttons.
  const handleTriggerBot = async () => {
    setBotLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/trigger-bot-lunch`);
      const d = await r.json();
      if (d.success) {
        setToast({ message: `📲 Sent to ${d.sent} student(s)! Menu: ${d.menu?.substring(0, 40)}…`, type: 'success' });
      } else {
        setToast({ message: d.error || 'Bot trigger failed.', type: 'error' });
      }
    } catch {
      setToast({ message: 'Network error triggering bot.', type: 'error' });
    } finally {
      setBotLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans">

      {/* ── Toast Notification ─────────────────────────────────────────── */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}

      {/* ── Add Purchase Modal ─────────────────────────────────────────── */}
      {showModal && (
        <AddPurchaseModal
          onClose={() => setShowModal(false)}
          onSaved={() => {
            setToast({ message: 'Purchase saved!', type: 'success' });
            fetchStats();
          }}
        />
      )}

      {/* ── Sticky Header ──────────────────────────────────────────────── */}
      <header className="bg-gray-900/90 backdrop-blur-sm border-b border-white/10 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-700/60 rounded-xl flex items-center justify-center text-xl">
              🏛️
            </div>
            <div>
              <h1 className="font-black text-white text-base leading-tight">
                Warden Administration Portal
              </h1>
              <p className="text-xs text-gray-500">
                {user?.name ? `👤 ${user.name}` : 'Warden'} ·{' '}
                {new Date().toLocaleDateString('en-IN', {
                  weekday: 'long', day: 'numeric', month: 'short',
                  timeZone: 'Asia/Kolkata',
                })}
              </p>
            </div>
          </div>

          {onLogout && (
            <button
              onClick={onLogout}
              className="text-xs text-gray-500 hover:text-red-400 font-semibold transition-colors"
            >
              Logout
            </button>
          )}
        </div>
      </header>

      {/* ── Main Content ───────────────────────────────────────────────── */}
      <main className="max-w-5xl mx-auto px-5 py-7 space-y-8">

        {/* Loading skeleton */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Spinner />
            <p className="text-gray-500 text-sm">Loading warden data…</p>
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl px-6 py-5 text-rose-300 text-sm">
            ❌ {error}
          </div>
        )}

        {/* ── KPI CARDS ──────────────────────────────────────────────────── */}
        {!loading && stats && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

              {/* Finance Widget — reads from Purchases table */}
              <GlassCard className="p-6">
                <h2 className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-3">
                  💰 Total Expenditure
                </h2>
                <p className="text-4xl font-black text-emerald-400">
                  ₹{stats.totalSpent.toLocaleString('en-IN')}
                </p>
                <p className="text-gray-500 text-xs mt-1">Sum of all contractor bills</p>
              </GlassCard>

              {/* Satisfaction Widget — reads from Ratings table */}
              <GlassCard className="p-6">
                <h2 className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-3">
                  ⭐ Average Meal Rating
                </h2>
                <p className="text-4xl font-black text-yellow-400">
                  {stats.avgRating !== null ? `${stats.avgRating} / 5.0` : 'No data'}
                </p>
                <p className="text-gray-500 text-xs mt-1">Across all anonymous student ratings</p>
              </GlassCard>

              {/* Red Flag Widget — top skipped meals */}
              <GlassCard className="p-6 border-l-4 border-l-red-500">
                <h2 className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-3">
                  🚩 Top Skipped (Disliked)
                </h2>
                {stats.topSkipped && stats.topSkipped.length > 0 ? (
                  <ul className="space-y-1.5">
                    {stats.topSkipped.map((item, i) => (
                      <li key={i} className="flex items-center justify-between">
                        <span className="text-red-300 font-bold text-sm">{item.meal_type}</span>
                        <span className="text-gray-500 text-xs bg-red-900/30 px-2 py-0.5 rounded-full">
                          {item.cancel_count} cancellations
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-500 text-sm">No "Don't like" cancellations yet.</p>
                )}
              </GlassCard>
            </div>

            {/* ── TELEGRAM DEMO TRIGGER ─────────────────────────────────── */}
            {/* This button calls GET /api/trigger-bot-lunch to send a live */}
            {/* notification to all linked students during the hackathon demo. */}
            <GlassCard className="p-5">
              <div className="flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex-1">
                  <h2 className="text-white font-black text-base">📲 Telegram Bot Demo</h2>
                  <p className="text-gray-400 text-xs mt-1">
                    Blast today's lunch notification to all linked students via Telegram.
                    Students can confirm or cancel their meal directly from the message.
                  </p>
                </div>
                <button
                  onClick={handleTriggerBot}
                  disabled={botLoading}
                  className="flex-shrink-0 flex items-center gap-2 px-5 py-3 rounded-xl
                             bg-gradient-to-r from-blue-600 to-indigo-600 text-white
                             font-black text-sm hover:brightness-110 active:scale-95
                             transition-all disabled:opacity-50"
                >
                  {botLoading ? <><Spinner small /> Sending…</> : '🚀 Trigger Lunch Alert'}
                </button>
              </div>

              {/* How to link instructions for the demo */}
              <div className="mt-4 bg-white/5 border border-white/10 rounded-xl p-4 text-xs text-gray-400 space-y-1">
                <p className="font-bold text-white text-sm mb-2">📖 How to link a Telegram account:</p>
                <p>1. Open Telegram and find your bot (the one you created with BotFather).</p>
                <p>2. Send: <code className="text-cyan-300 font-mono bg-white/10 px-1 rounded">/start 9876543210</code> (replace with your registered mobile number).</p>
                <p>3. The bot confirms the link. Now click "Trigger Lunch Alert" above!</p>
              </div>
            </GlassCard>

            {/* ── CONTRACTOR BILLS / RECEIPTS TABLE ──────────────────────── */}
            <GlassCard className="p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-xl font-black text-cyan-300">📄 Contractor Bills & Receipts</h2>
                  <p className="text-gray-500 text-xs mt-0.5">
                    All purchase records logged by the mess contractor
                  </p>
                </div>
                <button
                  onClick={() => setShowModal(true)}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl
                             bg-gradient-to-r from-cyan-600 to-blue-600 text-white
                             font-black text-xs hover:brightness-110 active:scale-95 transition-all"
                >
                  + Add Purchase
                </button>
              </div>

              {stats.receipts && stats.receipts.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left text-gray-400 text-xs uppercase tracking-widest pb-3 font-bold">
                          Description
                        </th>
                        <th className="text-right text-gray-400 text-xs uppercase tracking-widest pb-3 font-bold">
                          Amount
                        </th>
                        <th className="text-center text-gray-400 text-xs uppercase tracking-widest pb-3 font-bold">
                          Date
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {stats.receipts.map((receipt) => (
                        <tr key={receipt.id} className="hover:bg-white/5 transition-colors">
                          <td className="py-3 text-white font-medium pr-4">
                            {receipt.description}
                          </td>
                          <td className="py-3 text-right">
                            <span className="text-emerald-400 font-black">
                              ₹{parseFloat(receipt.amount).toLocaleString('en-IN')}
                            </span>
                          </td>
                          <td className="py-3 text-center text-gray-400 text-xs">
                            {receipt.date_bought}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-white/20">
                        <td className="pt-3 text-gray-400 text-xs font-bold uppercase tracking-widest">
                          Total
                        </td>
                        <td className="pt-3 text-right">
                          <span className="text-emerald-300 font-black text-base">
                            ₹{stats.totalSpent.toLocaleString('en-IN')}
                          </span>
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                /* Empty state — shown when no purchases have been logged yet */
                <div className="flex flex-col items-center justify-center h-40
                                border-2 border-dashed border-white/20 rounded-xl
                                text-gray-400 gap-2">
                  <span className="text-3xl">📂</span>
                  <p className="text-sm">No bills uploaded yet.</p>
                  <button
                    onClick={() => setShowModal(true)}
                    className="text-cyan-400 hover:text-cyan-300 text-xs font-bold transition-colors"
                  >
                    + Add your first purchase
                  </button>
                </div>
              )}
            </GlassCard>
=======
  const MEAL_ICONS = { Breakfast: '🌅', Lunch: '☀️', Snacks: '🫖', Dinner: '🌙' };

  const ratingColor = (r) => {
    if (!r) return 'text-slate-500';
    if (r >= 4) return 'text-emerald-400';
    if (r >= 3) return 'text-amber-400';
    return 'text-rose-400';
  };

  return (
    <div className="min-h-screen bg-[#0B0F19] relative overflow-hidden pb-10">
      {/* Ambient orbs */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-violet-500/8 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-indigo-500/6 rounded-full blur-3xl pointer-events-none" />

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <div className="relative max-w-lg w-full">
            <img src={lightbox} alt="Receipt" className="w-full rounded-2xl border border-white/10 shadow-2xl" />
            <button onClick={() => setLightbox(null)} className="absolute top-3 right-3 w-8 h-8 bg-black/60 text-white rounded-full font-black text-lg flex items-center justify-center">×</button>
          </div>
        </div>
      )}

      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-[#0B0F19]/80 backdrop-blur-xl border-b border-white/8">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-lg shadow-lg shadow-violet-500/20">🏛️</div>
            <div>
              <h1 className="font-black text-base leading-tight bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">Warden Portal</h1>
              <p className="text-xs text-slate-500">
                {user?.name} · {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchStats} disabled={loading}
              className="text-xs text-slate-400 hover:text-white border border-white/10 rounded-lg px-2.5 py-1.5 hover:border-white/20 transition-colors flex items-center gap-1">
              {loading ? <Spinner /> : '🔄'} Refresh
            </button>
            {onLogout && (
              <button onClick={onLogout} className="text-xs text-slate-500 hover:text-white border border-white/10 rounded-lg px-2.5 py-1.5 hover:border-white/20 transition-colors">
                Logout
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5 space-y-5">
        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 text-rose-400 text-sm">⚠️ {error}</div>
        )}

        {loading && !stats && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Spinner /><p className="text-slate-500 text-sm">Loading analytics…</p>
          </div>
        )}

        {stats && (
          <>
            {/* ── Period badge ─────────────────────────────────────────────── */}
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-bold uppercase tracking-widest">Weekly Overview</span>
              <span className="font-mono bg-white/5 border border-white/10 px-3 py-1 rounded-full">
                {stats.period.from} → {stats.period.to}
              </span>
            </div>

            {/* ── 1. FINANCIAL KPI ─────────────────────────────────────────── */}
            <GlassCard>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">💰</span>
                <h2 className="font-black text-white text-base">Expenditure</h2>
              </div>
              <div className="grid grid-cols-2 gap-5">
                <KPIBlock
                  label="Total Spent (All Time)"
                  value={`₹${stats.financial.total_spent.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
                  sub={`${stats.financial.purchase_count} purchase${stats.financial.purchase_count !== 1 ? 's' : ''} recorded`}
                  accent="emerald"
                />
                <KPIBlock
                  label="This Week"
                  value={`₹${stats.financial.weekly_spent.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
                  sub="Last 7 days"
                  accent="violet"
                />
              </div>

              {/* Recent purchases breakdown */}
              {stats.financial.recent_purchases.length > 0 && (
                <div className="mt-5 pt-4 border-t border-white/10">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Recent Bills</p>
                  <div className="space-y-2">
                    {stats.financial.recent_purchases.map(p => (
                      <div key={p.id} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-none">
                        <div>
                          <div className="text-white text-xs font-semibold">{p.description || 'No description'}</div>
                          <div className="text-slate-500 text-[10px]">{p.date}</div>
                        </div>
                        <div className="text-emerald-400 font-black text-sm">₹{parseFloat(p.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </GlassCard>

            {/* ── 2. RECEIPTS GALLERY ───────────────────────────────────────── */}
            {stats.financial.all_purchases.filter(p => p.receipt_image).length > 0 && (
              <GlassCard>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-2xl">🧾</span>
                  <h2 className="font-black text-white text-base">Receipts Gallery</h2>
                  <span className="text-slate-500 text-xs ml-auto">{stats.financial.all_purchases.filter(p => p.receipt_image).length} photos</span>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {stats.financial.all_purchases.filter(p => p.receipt_image).map(p => (
                    <div key={p.id} className="flex-shrink-0 cursor-pointer group" onClick={() => setLightbox(p.receipt_image)}>
                      <div className="w-28 h-28 rounded-xl overflow-hidden border border-white/10 group-hover:border-violet-500/40 transition-all shadow-lg">
                        <img src={p.receipt_image} alt={p.description} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      </div>
                      <div className="mt-1.5">
                        <div className="text-emerald-400 font-black text-xs">₹{parseFloat(p.amount).toLocaleString('en-IN')}</div>
                        <div className="text-slate-500 text-[10px] line-clamp-1">{p.date}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-slate-600 text-[10px] mt-2">Tap any receipt to view full size</p>
              </GlassCard>
            )}

            {/* No images yet placeholder */}
            {stats.financial.all_purchases.length > 0 && stats.financial.all_purchases.filter(p => p.receipt_image).length === 0 && (
              <GlassCard>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">🧾</span>
                  <h2 className="font-black text-white text-base">Receipts Gallery</h2>
                </div>
                <div className="text-center py-4">
                  <div className="text-3xl mb-1">📷</div>
                  <p className="text-slate-500 text-xs">No receipt photos uploaded yet.</p>
                  <p className="text-slate-600 text-[10px]">Contractor can add photos from the Bills tab.</p>
                </div>
              </GlassCard>
            )}

            {/* ── 3. STUDENT SATISFACTION ──────────────────────────────────── */}
            <GlassCard>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">😊</span>
                <h2 className="font-black text-white text-base">Student Satisfaction</h2>
                <span className="text-slate-500 text-xs ml-auto">Last 7 days</span>
              </div>

              {stats.satisfaction.total_ratings === 0 ? (
                <div className="text-center py-4">
                  <div className="text-3xl mb-1">⭐</div>
                  <p className="text-slate-400 text-sm font-semibold">No ratings this week</p>
                  <p className="text-slate-600 text-xs mt-1">Students can rate meals from their History tab.</p>
                </div>
              ) : (
                <>
                  {/* Big avg rating */}
                  <div className="flex items-center gap-5 mb-5">
                    <div>
                      <div className={`text-5xl font-black ${ratingColor(parseFloat(stats.satisfaction.avg_rating))}`}>
                        {stats.satisfaction.avg_rating}
                      </div>
                      <div className="text-slate-400 text-xs font-bold">/ 5.0 Stars</div>
                      <div className="text-slate-500 text-[10px] mt-0.5">{stats.satisfaction.total_ratings} ratings collected</div>
                    </div>
                    <div>
                      <StarDisplay rating={parseFloat(stats.satisfaction.avg_rating)} />
                      <div className="text-xs mt-2">
                        {parseFloat(stats.satisfaction.avg_rating) >= 4 && <span className="text-emerald-400 font-bold">✅ Excellent — keep it up!</span>}
                        {parseFloat(stats.satisfaction.avg_rating) >= 3 && parseFloat(stats.satisfaction.avg_rating) < 4 && <span className="text-amber-400 font-bold">⚠️ Average — room to improve</span>}
                        {parseFloat(stats.satisfaction.avg_rating) < 3 && <span className="text-rose-400 font-bold">❌ Poor — action required!</span>}
                      </div>
                    </div>
                  </div>

                  {/* Star breakdown */}
                  <div className="space-y-2">
                    {stats.satisfaction.breakdown.map(({ stars, count }) => {
                      const pct = stats.satisfaction.total_ratings > 0 ? Math.round((count / stats.satisfaction.total_ratings) * 100) : 0;
                      const barColor = stars >= 4 ? 'bg-emerald-400' : stars === 3 ? 'bg-amber-400' : 'bg-rose-400';
                      return (
                        <div key={stars} className="flex items-center gap-3">
                          <span className="text-xs text-slate-400 w-14 font-mono shrink-0">{'⭐'.repeat(stars)}</span>
                          <div className="flex-1 h-4 bg-white/10 rounded-full overflow-hidden">
                            <div className={`h-full ${barColor} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-white font-black text-sm w-5 text-right">{count}</span>
                          <span className="text-slate-500 text-xs w-10">{pct}%</span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </GlassCard>

            {/* ── 4. RED FLAGS — Top Skipped Meals ─────────────────────────── */}
            <GlassCard>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">🚩</span>
                <h2 className="font-black text-white text-base">Red Flags</h2>
                <span className="text-slate-500 text-xs ml-auto">Top skipped meals</span>
              </div>

              <p className="text-xs text-slate-400 mb-3">Most cancelled meal types this week — may indicate quality or menu issues:</p>

              {stats.cancellations.top_skipped_dishes.length === 0 && stats.cancellations.top_cancelled_meals.length === 0 ? (
                <div className="text-center py-4 text-slate-500 text-sm">No significant cancellations this week 🎉</div>
              ) : (
                <div className="space-y-3">
                  {(stats.cancellations.top_skipped_dishes.length > 0
                    ? stats.cancellations.top_skipped_dishes
                    : stats.cancellations.top_cancelled_meals
                  ).map((item, i) => {
                    const rank   = i + 1;
                    const medals = ['🥇', '🥈', '🥉'];
                    const icon   = MEAL_ICONS[item.meal_type] || '🍽️';
                    return (
                      <div key={i} className="flex items-start gap-3 p-3 bg-rose-500/5 border border-rose-500/10 rounded-xl hover:bg-rose-500/10 transition-colors">
                        <span className="text-xl shrink-0">{medals[i] || '📌'}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm">{icon}</span>
                            <span className="text-white font-black text-sm">{item.meal_type}</span>
                            <span className="ml-auto text-rose-400 font-black text-sm">{item.count} skips</span>
                          </div>
                          {item.menu_items && (
                            <div className="text-slate-400 text-[11px] leading-relaxed line-clamp-2">📋 {item.menu_items}</div>
                          )}
                          <div className="text-rose-400/50 text-[10px] mt-1">
                            {rank === 1 ? '⚠️ Needs immediate quality audit' : rank === 2 ? '⚡ Monitor closely' : 'Keep an eye on this'}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </GlassCard>

            {/* ── 5. WASTE OVERVIEW ────────────────────────────────────────── */}
            <GlassCard>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">♻️</span>
                <h2 className="font-black text-white text-base">Food Waste (This Week)</h2>
              </div>

              {stats.waste.total_waste_kg === 0 ? (
                <div className="text-center py-4 text-slate-500 text-sm">No waste logged this week.</div>
              ) : (
                <>
                  <div className="flex items-center gap-4 mb-4">
                    <div>
                      <div className="text-4xl font-black text-orange-400">{stats.waste.total_waste_kg} kg</div>
                      <div className="text-slate-400 text-xs mt-0.5">Total food wasted this week</div>
                    </div>
                    <div className="flex-1 text-right">
                      <div className="text-slate-500 text-xs">≈ <span className="text-orange-300 font-bold">₹{(stats.waste.total_waste_kg * 80).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span> estimated loss</div>
                      <div className="text-slate-600 text-[10px]">at ₹80/kg average food cost</div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {stats.waste.by_meal.map(item => {
                      const maxKg = Math.max(...stats.waste.by_meal.map(x => x.total_kg));
                      const pct   = maxKg > 0 ? (item.total_kg / maxKg) * 100 : 0;
                      return (
                        <div key={item.meal_type} className="flex items-center gap-3">
                          <span className="text-sm shrink-0">{MEAL_ICONS[item.meal_type] || '🍽️'}</span>
                          <span className="text-slate-300 text-xs font-semibold w-20 shrink-0">{item.meal_type}</span>
                          <div className="flex-1 h-4 bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-orange-500 to-red-500 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-orange-300 font-black text-sm w-16 text-right shrink-0">{item.total_kg} kg</span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </GlassCard>
>>>>>>> 00bde25fc7fd19a0eddd476e4b6149a3801bf83a
          </>
        )}
      </main>
    </div>
  );
<<<<<<< HEAD
};

export default WardenDashboard;
=======
}

// =============================================================================
// EXPORT: Root Warden component — handles login state internally
// =============================================================================
export default function WardenDashboard({ onLogout }) {
  const [wardenUser, setWardenUser] = useState(null);

  const handleLogin = (user) => setWardenUser(user);
  const handleLogout = () => { setWardenUser(null); onLogout && onLogout(); };

  if (!wardenUser) return <WardenLogin onLogin={handleLogin} />;
  return <WardenDashboardView user={wardenUser} onLogout={handleLogout} />;
}
>>>>>>> 00bde25fc7fd19a0eddd476e4b6149a3801bf83a
