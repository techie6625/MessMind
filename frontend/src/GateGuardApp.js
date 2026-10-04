/*
=============================================================================
FILE: GateGuardApp.js  —  Gate Security Module v3  (Glassmorphism Dark)
=============================================================================
Design: Deep dark bg-[#0B0F19], glassmorphism cards, neon green/cyan accents,
        colorful hostel gradient headers, smooth animations.
=============================================================================
*/

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = 'http://192.168.137.1:3001';
const API_BASE   = 'http://192.168.137.1:3001';

const HOSTEL_CONFIG = [
  { name: 'Chitrakot', gradient: 'from-red-500 to-rose-600',       glow: 'shadow-red-500/30',     emoji: '🏛️' },
  { name: 'Mainpat',   gradient: 'from-sky-500 to-blue-600',       glow: 'shadow-sky-500/30',     emoji: '🏔️' },
  { name: 'Sirpur',    gradient: 'from-emerald-500 to-green-600',  glow: 'shadow-emerald-500/30', emoji: '🌿' },
  { name: 'Mahanadi',  gradient: 'from-cyan-500 to-teal-600',      glow: 'shadow-cyan-500/30',    emoji: '🌊' },
  { name: 'Indravati', gradient: 'from-violet-500 to-purple-600',  glow: 'shadow-violet-500/30',  emoji: '⚡' },
  { name: 'Malhar',    gradient: 'from-orange-500 to-amber-600',   glow: 'shadow-orange-500/30',  emoji: '🎵' },
  { name: 'Kotumsar',  gradient: 'from-pink-500 to-fuchsia-600',   glow: 'shadow-pink-500/30',    emoji: '💎' },
  { name: 'Seonath',   gradient: 'from-indigo-500 to-blue-700',    glow: 'shadow-indigo-500/30',  emoji: '🌙' },
];

const Spinner = () => (
  <div className="inline-block w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
);

// ─────────────────────────────────────────────────────────────────────────────
// DELIVERY MODAL — glassmorphism dark
// ─────────────────────────────────────────────────────────────────────────────
function DeliveryModal({ hostel, onClose, onSubmit }) {
  const [personName, setPersonName] = useState('');
  const [mobile,     setMobile]     = useState('');
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');
  const [successInfo, setSuccessInfo] = useState(null);

  const hostelCfg = HOSTEL_CONFIG.find(h => h.name === hostel);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!personName.trim())               { setError('Delivery person name is required.'); return; }
    if (!/^\d{10}$/.test(mobile.trim()))  { setError('Enter a valid 10-digit mobile number.'); return; }

    setLoading(true);
    try {
      const inTime = new Date().toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
      });
      const r = await fetch(`${API_BASE}/api/delivery-logs`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostel, delivery_person_name: personName.trim(), mobile_no: mobile.trim(), in_time: inTime }),
      });
      const d = await r.json();
      if (!d.success) { setError(d.error || 'Failed to save.'); return; }

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

  // ── SUCCESS STATE ────────────────────────────────────────────────────────
  if (successInfo) {
    return (
      <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center px-4">
        <div className="bg-[#0d1117] border border-emerald-500/40 rounded-3xl shadow-2xl shadow-emerald-500/10 w-full max-w-sm overflow-hidden">
          <div className={`bg-gradient-to-br ${hostelCfg?.gradient || 'from-gray-600 to-gray-800'} px-6 py-5 text-center`}>
            <div className="text-4xl mb-1">{hostelCfg?.emoji}</div>
            <h2 className="text-white font-black text-lg">{hostel} Hostel</h2>
          </div>
          <div className="px-6 py-8 text-center space-y-4">
            <div className="text-6xl">✅</div>
            <h3 className="text-white font-black text-xl">Logged Successfully!</h3>
            <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-left space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Person</span>
                <span className="text-white font-semibold">{successInfo.personName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">In-Time</span>
                <span className="text-emerald-400 font-mono font-bold">{successInfo.inTime} IST</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Hostel</span>
                <span className="text-white font-semibold">{hostel}</span>
              </div>
            </div>
            <p className="text-slate-500 text-xs animate-pulse">Closing automatically in 3 seconds…</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center px-4 py-10">
      <div className="bg-[#0d1117] border border-white/10 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className={`bg-gradient-to-br ${hostelCfg?.gradient || 'from-gray-600 to-gray-800'} px-6 py-5`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{hostelCfg?.emoji}</span>
              <div>
                <h2 className="text-white font-black text-lg leading-tight">{hostel} Hostel</h2>
                <p className="text-white/70 text-xs">Log delivery details</p>
              </div>
            </div>
            <button onClick={onClose} className="text-white/50 hover:text-white text-2xl leading-none transition-colors">×</button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">👤 Delivery Person Name</label>
            <input type="text" value={personName} onChange={e => setPersonName(e.target.value)} placeholder="Full name" autoFocus
              className="w-full px-4 py-3 rounded-xl bg-white/5 text-white placeholder-slate-600
                         border border-white/10 focus:outline-none focus:border-cyan-500/60 focus:bg-white/10 text-sm transition-all" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">📱 Mobile No</label>
            <input type="tel" value={mobile} onChange={e => setMobile(e.target.value)} placeholder="10-digit mobile number" maxLength={10}
              className="w-full px-4 py-3 rounded-xl bg-white/5 text-white placeholder-slate-600
                         border border-white/10 focus:outline-none focus:border-cyan-500/60 focus:bg-white/10 text-sm transition-all" />
          </div>

          {error && (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl px-4 py-2.5 text-rose-400 text-sm flex items-center gap-2">
              <span>❌</span><span>{error}</span>
            </div>
          )}

          <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl px-4 py-2.5 text-xs text-cyan-400 flex items-center gap-2">
            <span>🕐</span>
            <span>In-time will be captured automatically at submission (IST)</span>
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10 font-semibold text-sm transition-all">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className={`flex-1 py-3 rounded-xl font-black text-sm text-white transition-all
                bg-gradient-to-r ${hostelCfg?.gradient || 'from-gray-500 to-gray-700'}
                hover:brightness-110 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2`}>
              {loading ? <><Spinner /> Logging…</> : '📝 Log Delivery'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HOSTEL BUTTON — glass card with colorful gradient top strip
// ─────────────────────────────────────────────────────────────────────────────
function HostelButton({ hostelCfg, count, onTap, lastTapped }) {
  const isActive = lastTapped === hostelCfg.name;
  return (
    <button
      onClick={() => onTap(hostelCfg.name)}
      className={`relative overflow-hidden rounded-2xl border transition-all duration-300 group
        ${isActive
          ? `border-white/30 bg-white/15 shadow-xl ${hostelCfg.glow} scale-95`
          : 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 hover:-translate-y-1 hover:shadow-xl'
        }`}
    >
      {/* Gradient top strip */}
      <div className={`h-1.5 w-full bg-gradient-to-r ${hostelCfg.gradient} absolute top-0 left-0`} />

      <div className="pt-5 pb-4 px-3 flex flex-col items-center gap-1.5">
        <span className="text-3xl">{hostelCfg.emoji}</span>
        <span className="text-white font-bold text-xs leading-tight text-center">{hostelCfg.name}</span>

        {/* Count badge */}
        <div className={`mt-1 min-w-[2rem] h-8 rounded-xl flex items-center justify-center font-black text-lg
          bg-gradient-to-br ${hostelCfg.gradient} text-white shadow-lg`}>
          {count}
        </div>
        <span className="text-slate-500 text-xs">deliveries</span>
      </div>

      {/* Ripple on tap */}
      {isActive && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-white font-black text-4xl opacity-70 animate-ping">+1</span>
        </div>
      )}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DELIVERY AUDIT TAB — glass dark table
// ─────────────────────────────────────────────────────────────────────────────
function DeliveryAuditTab() {
  const [logs,    setLogs]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      const r = await fetch(`${API_BASE}/api/delivery-logs?date=${today}`);
      const d = await r.json();
      if (d.success) setLogs(d.logs);
      else setError('Could not load delivery logs.');
    } catch { setError('Network error.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-black text-lg flex items-center gap-2">
          📋 <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">Today's Delivery Log</span>
        </h3>
        <button onClick={fetchLogs}
          className="text-xs text-slate-400 hover:text-cyan-400 transition-colors border border-white/10 rounded-lg px-3 py-1.5 hover:border-cyan-500/30">
          🔄 Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-white/20 border-t-cyan-400 rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 text-rose-400 text-sm">{error}</div>
      ) : logs.length === 0 ? (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
          <div className="text-4xl mb-2">📭</div>
          <p className="text-slate-400">No deliveries logged today yet.</p>
        </div>
      ) : (
        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                <th className="px-4 py-3 text-left text-slate-400 font-semibold text-xs uppercase tracking-wider">#</th>
                <th className="px-4 py-3 text-left text-slate-400 font-semibold text-xs uppercase tracking-wider">Person</th>
                <th className="px-4 py-3 text-left text-slate-400 font-semibold text-xs uppercase tracking-wider">Mobile</th>
                <th className="px-4 py-3 text-left text-slate-400 font-semibold text-xs uppercase tracking-wider">Hostel</th>
                <th className="px-4 py-3 text-left text-slate-400 font-semibold text-xs uppercase tracking-wider">In-Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {logs.map((log, i) => {
                const cfg = HOSTEL_CONFIG.find(h => h.name === log.hostel);
                return (
                  <tr key={log.id || i} className="hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 text-slate-500 font-mono text-xs">{i + 1}</td>
                    <td className="px-4 py-3 text-white font-semibold">{log.delivery_person_name}</td>
                    <td className="px-4 py-3 text-slate-400 font-mono text-xs">{log.mobile_no}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full bg-gradient-to-r ${cfg?.gradient || 'from-gray-600 to-gray-700'} text-white`}>
                        {cfg?.emoji} {log.hostel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-emerald-400 font-mono font-bold text-xs">{log.in_time}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="px-4 py-2.5 border-t border-white/10 bg-white/5 text-xs text-slate-500 text-right">
            {logs.length} total {logs.length === 1 ? 'delivery' : 'deliveries'} today
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GATE GUARD APP — main component
// ─────────────────────────────────────────────────────────────────────────────
export default function GateGuardApp({ user, onLogout }) {
  const [hostelCounts, setHostelCounts] = useState(
    Object.fromEntries(HOSTEL_CONFIG.map(h => [h.name, 0]))
  );
  const [modal,      setModal]      = useState(null); // hostel name or null
  const [lastTapped, setLastTapped] = useState(null);
  const [activeTab,  setActiveTab]  = useState('grid'); // 'grid' | 'audit'
  const [clock,      setClock]      = useState('');
  const [connected,  setConnected]  = useState(false);

  const socketRef = useRef(null);

  // Live IST clock
  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    }));
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, []);

  // Socket.io
  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;
    socket.on('connect',    () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('delivery_count_updated', counts => setHostelCounts(prev => ({ ...prev, ...counts })));
    return () => socket.disconnect();
  }, []);

  const handleHostelTap = useCallback((hostelName) => {
    setModal(hostelName);
    setLastTapped(hostelName);
    setTimeout(() => setLastTapped(null), 600);
  }, []);

  const handleDeliverySubmit = useCallback(() => {
    setModal(null);
  }, []);

  const totalToday = Object.values(hostelCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="min-h-screen bg-[#0B0F19] relative overflow-hidden">
      {/* Ambient glow orbs */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/8 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-cyan-500/6 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-violet-500/4 rounded-full blur-3xl pointer-events-none" />

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-[#0B0F19]/80 backdrop-blur-xl border-b border-white/8">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center text-lg shadow-lg shadow-emerald-500/20">
              🛡️
            </div>
            <div>
              <h1 className="text-white font-black text-base leading-tight">Security Gate</h1>
              <p className="text-slate-500 text-xs">NIT Raipur · Guard Panel</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Live clock */}
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-emerald-400 font-mono font-bold text-sm leading-none">{clock}</span>
              <span className="text-slate-600 text-xs">IST</span>
            </div>

            {/* Connection dot */}
            <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full border
              ${connected ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-rose-500/10 border-rose-500/30 text-rose-400'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
              {connected ? 'Live' : 'Offline'}
            </div>

            {onLogout && (
              <button onClick={onLogout} className="text-xs text-slate-500 hover:text-white transition-colors border border-white/10 rounded-lg px-2.5 py-1.5 hover:border-white/20">
                Logout
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── CONTENT ─────────────────────────────────────────────────────────── */}
      <div className="max-w-2xl mx-auto px-4 py-5 space-y-5">

        {/* Total deliveries bar */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Total Deliveries Today</p>
            <p className="text-3xl font-black text-white leading-none mt-0.5">{totalToday}</p>
          </div>
          <div className="text-right">
            <div className="text-5xl font-black text-emerald-400/20">{totalToday}</div>
          </div>
          <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            <span className="text-emerald-400 text-xs font-bold">Live</span>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-1 gap-1">
          {[
            { id: 'grid',  emoji: '🏘️', label: 'Hostel Grid' },
            { id: 'audit', emoji: '📋', label: 'Audit Log'   },
          ].map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2
                ${activeTab === t.id
                  ? 'bg-white/10 text-white shadow-inner border border-white/10'
                  : 'text-slate-400 hover:text-slate-300'}`}>
              <span>{t.emoji}</span>{t.label}
            </button>
          ))}
        </div>

        {/* ── HOSTEL GRID ─────────────────────────────────────────────────── */}
        {activeTab === 'grid' && (
          <div>
            <p className="text-slate-500 text-xs text-center mb-3 uppercase tracking-widest font-semibold">
              Tap a hostel to log delivery
            </p>
            <div className="grid grid-cols-4 gap-3">
              {HOSTEL_CONFIG.map(h => (
                <HostelButton
                  key={h.name}
                  hostelCfg={h}
                  count={hostelCounts[h.name] || 0}
                  onTap={handleHostelTap}
                  lastTapped={lastTapped}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── AUDIT LOG ───────────────────────────────────────────────────── */}
        {activeTab === 'audit' && <DeliveryAuditTab />}
      </div>

      {/* ── MODAL ─────────────────────────────────────────────────────────── */}
      {modal && (
        <DeliveryModal
          hostel={modal}
          onClose={() => setModal(null)}
          onSubmit={handleDeliverySubmit}
        />
      )}
    </div>
  );
}
