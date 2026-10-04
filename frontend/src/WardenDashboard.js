/*
=============================================================================
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
=============================================================================
*/

import React, { useState, useEffect, useCallback } from 'react';

const API_BASE = 'http://localhost:3001';

// ─────────────────────────────────────────────────────────────────────────────
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
    {children}
  </div>
);

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
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
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
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

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
          </>
        )}
      </main>
    </div>
  );
};

export default WardenDashboard;