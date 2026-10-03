/*
=============================================================================
FILE: GateGuardApp.js  —  Gate Security Module v2
=============================================================================
WHAT'S NEW:
  • Clicking a hostel card opens a modal form (delivery person name + mobile)
  • On submit: auto-captures in_time, POSTs to /api/delivery-logs
  • New "Audit Log" tab shows all delivery logs for today: Name, Mobile, Hostel, In-Time
  • Socket.io still used to broadcast live count updates to Dashboard
=============================================================================
*/

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = 'http://localhost:3001';
const API_BASE   = 'http://localhost:3001';

const HOSTEL_CONFIG = [
  { name: 'Chitrakot', gradient: 'from-red-500 to-rose-600',       ring: 'ring-red-300',     emoji: '🏛️' },
  { name: 'Mainpat',   gradient: 'from-sky-500 to-blue-600',       ring: 'ring-sky-300',     emoji: '🏔️' },
  { name: 'Sirpur',    gradient: 'from-emerald-500 to-green-600',  ring: 'ring-emerald-300', emoji: '🌿' },
  { name: 'Mahanadi',  gradient: 'from-cyan-500 to-teal-600',      ring: 'ring-cyan-300',    emoji: '🌊' },
  { name: 'Indravati', gradient: 'from-violet-500 to-purple-600',  ring: 'ring-violet-300',  emoji: '⚡' },
  { name: 'Malhar',    gradient: 'from-orange-500 to-amber-600',   ring: 'ring-orange-300',  emoji: '🎵' },
  { name: 'Kotumsar',  gradient: 'from-pink-500 to-fuchsia-600',   ring: 'ring-pink-300',    emoji: '💎' },
  { name: 'Seonath',   gradient: 'from-indigo-500 to-blue-700',    ring: 'ring-indigo-300',  emoji: '🌙' },
];

const Spinner = () => (
  <div className="inline-block w-5 h-5 border-4 border-white/30 border-t-white rounded-full animate-spin" />
);

// ─────────────────────────────────────────────────────────────────────────────
// DELIVERY MODAL
// ─────────────────────────────────────────────────────────────────────────────
function DeliveryModal({ hostel, onClose, onSubmit }) {
  const [personName, setPersonName] = useState('');
  const [mobile,     setMobile]     = useState('');
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');
  const [successInfo, setSuccessInfo] = useState(null); // { personName, inTime }

  const hostelCfg = HOSTEL_CONFIG.find(h => h.name === hostel);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!personName.trim())               { setError('Delivery person name is required.'); return; }
    if (!/^\d{10}$/.test(mobile.trim()))  { setError('Enter a valid 10-digit mobile number.'); return; }

    setLoading(true);
    try {
      const inTime = new Date().toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour:     '2-digit',
        minute:   '2-digit',
        second:   '2-digit',
        hour12:   false,
      });

      const r = await fetch(`${API_BASE}/api/delivery-logs`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          hostel,
          delivery_person_name: personName.trim(),
          mobile_no: mobile.trim(),
          in_time:   inTime,
        }),
      });
      const d = await r.json();
      if (!d.success) { setError(d.error || 'Failed to save.'); return; }

      // Show success screen inside the modal for 3 seconds, then close
      setSuccessInfo({ personName: personName.trim(), inTime });
      setTimeout(() => {
        onSubmit({ hostel, personName: personName.trim(), mobile: mobile.trim(), inTime });
      }, 3000);

    } catch {
      setError('Network error. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  // ── SUCCESS STATE ───────────────────────────────────────────────────────────
  if (successInfo) {
    return (
      <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center px-4 py-10">
        <div className="bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm border border-green-600 overflow-hidden text-center">
          <div className={`bg-gradient-to-br ${hostelCfg?.gradient || 'from-gray-600 to-gray-800'} px-6 py-5`}>
            <div className="text-4xl mb-1">{hostelCfg?.emoji}</div>
            <h2 className="text-white font-black text-lg">{hostel} Hostel</h2>
          </div>
          <div className="px-6 py-8 space-y-3">
            <div className="text-6xl">✅</div>
            <h3 className="text-white font-black text-xl">Logged Successfully!</h3>
            <div className="bg-gray-800 rounded-xl px-4 py-3 text-left border border-gray-700 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Person</span>
                <span className="text-white font-semibold">{successInfo.personName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">In-Time</span>
                <span className="text-green-400 font-mono font-bold">{successInfo.inTime} IST</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Hostel</span>
                <span className="text-white font-semibold">{hostel}</span>
              </div>
            </div>
            <p className="text-gray-500 text-xs animate-pulse">Closing automatically in 3 seconds…</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center px-4 py-10">
      <div className="bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm border border-gray-700 overflow-hidden">
        {/* Modal header */}
        <div className={`bg-gradient-to-br ${hostelCfg?.gradient || 'from-gray-600 to-gray-800'} px-6 py-5`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{hostelCfg?.emoji}</span>
              <div>
                <h2 className="text-white font-black text-lg leading-tight">{hostel} Hostel</h2>
                <p className="text-white/70 text-xs">Log delivery details</p>
              </div>
            </div>
            <button onClick={onClose} className="text-white/60 hover:text-white text-2xl leading-none transition-colors">×</button>
          </div>
        </div>

        {/* Modal body */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">
              👤 Delivery Person Name
            </label>
            <input
              type="text"
              value={personName}
              onChange={e => setPersonName(e.target.value)}
              placeholder="Full name"
              className="w-full px-4 py-3 rounded-xl bg-gray-800 text-white placeholder-gray-600
                         border-2 border-gray-700 focus:outline-none focus:border-indigo-500
                         text-sm transition-colors"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">
              📱 Mobile No
            </label>
            <input
              type="tel"
              value={mobile}
              onChange={e => setMobile(e.target.value)}
              placeholder="10-digit mobile number"
              maxLength={10}
              className="w-full px-4 py-3 rounded-xl bg-gray-800 text-white placeholder-gray-600
                         border-2 border-gray-700 focus:outline-none focus:border-indigo-500
                         text-sm transition-colors"
            />
          </div>

          <div className="bg-gray-800 rounded-xl px-4 py-3 flex items-center gap-3 border border-gray-700">
            <span className="text-xl">⏱️</span>
            <div>
              <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">In-Time</p>
              <p className="text-green-400 font-mono font-bold text-sm">
                Auto-captured on submit (IST)
              </p>
            </div>
          </div>

          {error && (
            <div className="bg-red-900/40 border border-red-700 rounded-xl px-4 py-3 text-red-300 text-sm">
              ❌ {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="py-3 rounded-xl bg-gray-700 hover:bg-gray-600 text-white font-bold text-sm transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`py-3 rounded-xl font-black text-white text-sm transition-all
                bg-gradient-to-br ${hostelCfg?.gradient || 'from-indigo-500 to-indigo-700'}
                hover:brightness-110 active:scale-95 disabled:opacity-50
                flex items-center justify-center gap-2`}
            >
              {loading ? <><Spinner /> Saving…</> : '✅ Log Delivery'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HOSTEL BUTTON
// ─────────────────────────────────────────────────────────────────────────────
function HostelButton({ hostel, count, isActive, onTap }) {
  return (
    <button
      onClick={onTap}
      className={`
        relative flex flex-col items-center justify-center
        bg-gradient-to-br ${hostel.gradient}
        rounded-2xl py-6 px-4 shadow-lg
        transition-all duration-150 ease-out
        active:scale-95 touch-manipulation
        ${isActive ? 'scale-105 ring-4 ' + hostel.ring : 'scale-100'}
        hover:brightness-110
      `}
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      <span className="text-4xl mb-1">{hostel.emoji}</span>
      <span className="font-black text-white text-base tracking-wide leading-tight text-center">
        {hostel.name}
      </span>
      <div className="absolute top-2.5 right-2.5 bg-white/25 backdrop-blur-sm rounded-full px-2.5 py-0.5">
        <span className="text-white font-black text-sm">{count}</span>
      </div>
      {isActive && (
        <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/20">
          <span className="text-white font-black text-3xl">+1</span>
        </div>
      )}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TOAST
// ─────────────────────────────────────────────────────────────────────────────
function ToastNotification({ hostel, type, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2000);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className={`
      fixed top-4 left-1/2 -translate-x-1/2 z-50
      px-6 py-3 rounded-2xl shadow-2xl
      flex items-center gap-3 font-bold text-white text-sm
      ${type === 'success' ? 'bg-green-600' : 'bg-red-600'}
      animate-bounce
    `}>
      <span className="text-xl">{type === 'success' ? '✅' : '📵'}</span>
      <span>{type === 'success' ? `Logged! → ${hostel}` : `Offline — ${hostel} not saved!`}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AUDIT LOG TAB
// ─────────────────────────────────────────────────────────────────────────────
function DeliveryAuditTab() {
  const [logs,    setLogs]    = useState([]);
  const [loading, setLoading] = useState(false);
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/delivery-logs?date=${today}`);
      const d = await r.json();
      if (d.success) setLogs(d.logs);
    } catch { /* fail silently */ }
    finally { setLoading(false); }
  }, [today]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  return (
    <div className="max-w-xl mx-auto px-4 py-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-white font-black text-lg">Delivery Audit Log</h2>
          <p className="text-gray-500 text-xs">Today's logged deliveries</p>
        </div>
        <button
          onClick={fetchLogs}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-xl text-xs font-bold transition-colors"
        >
          🔄 Refresh
        </button>
      </div>

      {loading && (
        <div className="flex justify-center py-10">
          <div className="w-8 h-8 border-4 border-gray-600 border-t-indigo-400 rounded-full animate-spin" />
        </div>
      )}

      {!loading && logs.length === 0 && (
        <div className="bg-gray-800 rounded-2xl p-8 text-center border border-gray-700">
          <div className="text-4xl mb-2">📋</div>
          <p className="text-gray-400 font-semibold">No deliveries logged yet today.</p>
          <p className="text-gray-600 text-xs mt-1">Tap a hostel card to log a delivery.</p>
        </div>
      )}

      {!loading && logs.length > 0 && (
        <div className="bg-gray-800 rounded-2xl overflow-hidden border border-gray-700">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-700 border-b border-gray-600">
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-300 uppercase tracking-wide">Person</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-300 uppercase tracking-wide">Mobile</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-300 uppercase tracking-wide">Hostel</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-300 uppercase tracking-wide">In-Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {logs.map((log, i) => {
                  const hostelCfg = HOSTEL_CONFIG.find(h => h.name === log.hostel);
                  return (
                    <tr key={log.id || i} className="hover:bg-gray-700/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-white text-xs">{log.delivery_person_name}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-300 text-xs font-mono">{log.mobile_no}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full
                          bg-gradient-to-br ${hostelCfg?.gradient || 'from-gray-500 to-gray-700'} text-white`}>
                          {hostelCfg?.emoji} {log.hostel}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-green-400 text-xs font-mono font-bold">{log.in_time}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 bg-gray-700/50 border-t border-gray-700">
            <p className="text-xs text-gray-500">{logs.length} delivery log{logs.length !== 1 ? 's' : ''} for today</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN: GateGuardApp
// ─────────────────────────────────────────────────────────────────────────────
export default function GateGuardApp({ user, onLogout }) {
  const [counts,     setCounts]     = useState(HOSTEL_CONFIG.reduce((a, h) => ({ ...a, [h.name]: 0 }), {}));
  const [toast,      setToast]      = useState(null);
  const [connected,  setConnected]  = useState(false);
  const [lastTapped, setLastTapped] = useState(null);
  const [modal,      setModal]      = useState(null); // hostel name | null
  const [activeTab,  setActiveTab]  = useState('log'); // 'log' | 'audit'
  const socketRef = useRef(null);

  // IST clock
  const [clock, setClock] = useState('');
  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit'
    }));
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, []);

  // Socket.io connection
  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;

    socket.on('connect',                 () => setConnected(true));
    socket.on('disconnect',              () => setConnected(false));
    socket.on('connect_error',           () => setConnected(false));
    socket.on('delivery_count_updated',  (c) => setCounts(c));

    return () => socket.disconnect();
  }, []);

  // Called when guard taps a hostel card → open modal
  const handleHostelTap = useCallback((hostelName) => {
    setModal(hostelName);
    setLastTapped(hostelName);
    setTimeout(() => setLastTapped(null), 600);
  }, []);

  // Called when modal form is submitted successfully
  const handleDeliverySubmit = useCallback(({ hostel, personName, inTime }) => {
    setModal(null);
    setToast({ hostel, type: 'success', id: Date.now(), personName, inTime });
  }, []);

  const totalDeliveries = Object.values(counts).reduce((s, c) => s + c, 0);

  return (
    <div className="min-h-screen bg-gray-900 text-white pb-20 select-none">

      {/* Delivery modal */}
      {modal && (
        <DeliveryModal
          hostel={modal}
          onClose={() => setModal(null)}
          onSubmit={handleDeliverySubmit}
        />
      )}

      {/* Toast */}
      {toast && (
        <ToastNotification
          key={toast.id}
          hostel={toast.hostel}
          type={toast.type}
          onDone={() => setToast(null)}
        />
      )}

      {/* ── HEADER ────────────────────────────────────────────────────────────── */}
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-4">
        <div className="flex items-center justify-between max-w-xl mx-auto">
          <div>
            <h1 className="text-xl font-black flex items-center gap-2">
              🛡️ Gate Security Module
            </h1>
            <p className="text-gray-400 text-xs mt-0.5">
              {user ? `👤 ${user.name}` : 'Tap a hostel to log a delivery'}
            </p>
          </div>
          <div className="text-right flex flex-col items-end gap-1">
            <div className="font-mono text-sm text-green-400">{clock} IST</div>
            <div className={`flex items-center gap-1.5 text-xs ${connected ? 'text-green-400' : 'text-red-400'}`}>
              <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
              {connected ? 'Live' : 'Offline'}
            </div>
            {onLogout && (
              <button onClick={onLogout} className="text-xs text-gray-500 hover:text-red-400 transition-colors mt-0.5">
                Logout
              </button>
            )}
          </div>
        </div>

        {/* Tab bar */}
        <div className="max-w-xl mx-auto mt-3 flex gap-1 bg-gray-700/50 rounded-xl p-1">
          {[{ id: 'log', label: '📲 Log Delivery' }, { id: 'audit', label: '📋 Audit Log' }].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === t.id
                  ? 'bg-gray-600 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── LOG DELIVERY TAB ──────────────────────────────────────────────────── */}
      {activeTab === 'log' && (
        <>
          {/* Total counter */}
          <div className="max-w-xl mx-auto px-4 py-4">
            <div className="bg-gray-800 rounded-2xl px-5 py-4 flex items-center justify-between border border-gray-700">
              <div>
                <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide">Today's Total Deliveries</p>
                <p className="text-4xl font-black text-white mt-0.5">{totalDeliveries}</p>
              </div>
              <div className="text-5xl">🛵</div>
            </div>
          </div>

          {/* Instruction */}
          <div className="max-w-xl mx-auto px-4 mb-3">
            <p className="text-center text-gray-500 text-xs">
              Tap a hostel card to log a new delivery. You'll be asked for the delivery person's details.
            </p>
          </div>

          {/* 4×2 hostel grid */}
          <div className="max-w-xl mx-auto px-4 grid grid-cols-2 gap-3">
            {HOSTEL_CONFIG.map(hostel => (
              <HostelButton
                key={hostel.name}
                hostel={hostel}
                count={counts[hostel.name] || 0}
                isActive={lastTapped === hostel.name}
                onTap={() => handleHostelTap(hostel.name)}
              />
            ))}
          </div>

          <div className="max-w-xl mx-auto px-4 mt-6">
            <p className="text-center text-gray-600 text-xs">
              Counts reset daily at midnight IST. Live sync across all screens.
            </p>
          </div>
        </>
      )}

      {/* ── AUDIT LOG TAB ─────────────────────────────────────────────────────── */}
      {activeTab === 'audit' && <DeliveryAuditTab />}
    </div>
  );
}
