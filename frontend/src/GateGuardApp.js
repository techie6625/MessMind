/*
=============================================================================
FILE: GateGuardApp.js  —  Gate Security Module (React Component)
=============================================================================
PURPOSE:
  A mobile-first, tap-only UI for campus security guards.
  Guards log food delivery vehicles entering campus by tapping a hostel button.
  NO TYPING REQUIRED — the entire interaction is one tap.

HOW IT WORKS:
  1. Guard sees a 4×2 grid of 8 large hostel buttons
  2. Taps "Seonath" (for example)
  3. socket.emit('log_delivery', { hostel: 'Seonath' }) fires instantly
  4. Server increments the count and broadcasts to ALL connected clients
  5. Every dashboard and guard app updates the count badge on the button live
  6. A green "Logged!" toast confirms success to the guard

SOCKET.IO FLOW:
  Guard App (emit) ──log_delivery──▶ Server ──delivery_count_updated──▶ All Clients
=============================================================================
*/

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client'; // Socket.io client library

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────
const SOCKET_URL = 'http://localhost:3001'; // Must match the backend port

// The 8 campus hostels with their display colors.
// Each hostel gets a distinct gradient so the guard can instantly identify
// which button to tap without reading carefully — critical for speed!
const HOSTEL_CONFIG = [
  { name: 'Chitrakot', gradient: 'from-red-500 to-rose-600',       ring: 'ring-red-300',     bg: 'bg-red-50',    text: 'text-red-700',    emoji: '🏛️' },
  { name: 'Mainpat',   gradient: 'from-sky-500 to-blue-600',       ring: 'ring-sky-300',     bg: 'bg-sky-50',    text: 'text-sky-700',    emoji: '🏔️' },
  { name: 'Sirpur',    gradient: 'from-emerald-500 to-green-600',  ring: 'ring-emerald-300', bg: 'bg-emerald-50',text: 'text-emerald-700',emoji: '🌿' },
  { name: 'Mahanadi',  gradient: 'from-cyan-500 to-teal-600',      ring: 'ring-cyan-300',    bg: 'bg-cyan-50',   text: 'text-cyan-700',   emoji: '🌊' },
  { name: 'Indravati', gradient: 'from-violet-500 to-purple-600',  ring: 'ring-violet-300',  bg: 'bg-violet-50', text: 'text-violet-700', emoji: '⚡' },
  { name: 'Malhar',    gradient: 'from-orange-500 to-amber-600',   ring: 'ring-orange-300',  bg: 'bg-orange-50', text: 'text-orange-700', emoji: '🎵' },
  { name: 'Kotumsar',  gradient: 'from-pink-500 to-fuchsia-600',   ring: 'ring-pink-300',    bg: 'bg-pink-50',   text: 'text-pink-700',   emoji: '💎' },
  { name: 'Seonath',   gradient: 'from-indigo-500 to-blue-700',    ring: 'ring-indigo-300',  bg: 'bg-indigo-50', text: 'text-indigo-700', emoji: '🌙' },
];

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT: GateGuardApp
// ─────────────────────────────────────────────────────────────────────────────
export default function GateGuardApp() {
  // ── STATE ──────────────────────────────────────────────────────────────────
  // counts: live per-hostel delivery counts received from the server via Socket.io
  const [counts, setCounts]       = useState(
    HOSTEL_CONFIG.reduce((acc, h) => ({ ...acc, [h.name]: 0 }), {})
  );

  // toast: shows a brief "Logged!" confirmation after a guard taps a button
  const [toast, setToast]         = useState(null); // { hostel, id }

  // connected: tracks whether the Socket.io WebSocket is established
  const [connected, setConnected] = useState(false);

  // lastTapped: the hostel name of the most recently tapped button (for animation)
  const [lastTapped, setLastTapped] = useState(null);

  // socketRef: persists the socket instance across renders without causing re-renders
  // Using useRef instead of useState because changing the socket shouldn't re-render the component
  const socketRef = useRef(null);

  // ── SOCKET.IO CONNECTION ───────────────────────────────────────────────────
  // useEffect with an empty dependency array [] runs ONCE on component mount.
  // This is the correct pattern for setting up a Socket.io connection:
  //   mount → connect → set up listeners → (user interacts) → disconnect on unmount
  useEffect(() => {
    // Create the socket connection
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'], // Try WebSocket first, fall back to HTTP polling
      reconnectionAttempts: 5,             // Retry up to 5 times if connection drops
      reconnectionDelay: 1000,             // Wait 1 second between retries
    });

    socketRef.current = socket; // Store reference for use in event handlers

    // ── LIFECYCLE EVENTS ─────────────────────────────────────────────────
    socket.on('connect', () => {
      console.log('✅ Guard App connected to server via Socket.io');
      setConnected(true);
    });

    socket.on('disconnect', (reason) => {
      console.log('❌ Guard App disconnected:', reason);
      setConnected(false);
    });

    socket.on('connect_error', (err) => {
      console.error('🔌 Socket connection error:', err.message);
      setConnected(false);
    });

    // ── RECEIVE LIVE COUNT UPDATES ────────────────────────────────────────
    // The server emits 'delivery_count_updated' after every log_delivery event.
    // We update our local state so the count badges on each button refresh.
    socket.on('delivery_count_updated', (updatedCounts) => {
      setCounts(updatedCounts); // Replace entire counts object with server's authoritative state
    });

    // ── CLEANUP: Disconnect when component unmounts ───────────────────────
    // This prevents memory leaks and "ghost" connections when navigating away
    return () => {
      console.log('🔌 Guard App disconnecting…');
      socket.disconnect();
    };
  }, []); // [] = run only once on mount, never on re-renders

  // ── HANDLE HOSTEL BUTTON TAP ───────────────────────────────────────────────
  // Called immediately when a guard taps a hostel button.
  // We emit the event AND show the toast right away — no waiting for server response.
  // The count update comes back async via 'delivery_count_updated'.
  const handleLog = useCallback((hostelName) => {
    if (!socketRef.current?.connected) {
      // Guard should know if they're offline — their taps might not be recorded
      setToast({ hostel: hostelName, type: 'error', id: Date.now() });
      return;
    }

    // Emit the delivery log event to the server
    // socket.emit() is fire-and-forget — we don't await a response
    socketRef.current.emit('log_delivery', { hostel: hostelName });

    // Show the "Logged!" toast immediately (optimistic feedback)
    setToast({ hostel: hostelName, type: 'success', id: Date.now() });
    setLastTapped(hostelName); // Trigger the CSS animation on this button

    // Clear the "last tapped" animation after 600ms
    setTimeout(() => setLastTapped(null), 600);
  }, []); // No dependencies — this function never changes

  // ── TODAY'S TOTAL DELIVERIES across all hostels ────────────────────────────
  const totalDeliveries = Object.values(counts).reduce((sum, c) => sum + c, 0);

  // ── IST CLOCK ─────────────────────────────────────────────────────────────
  const [clock, setClock] = useState('');
  useEffect(() => {
    const tick = () => {
      setClock(new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white pb-20 select-none">

      {/* ── TOAST NOTIFICATION ──────────────────────────────────────────── */}
      {toast && (
        <ToastNotification
          key={toast.id}
          hostel={toast.hostel}
          type={toast.type}
          onDone={() => setToast(null)}
        />
      )}

      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-4">
        <div className="flex items-center justify-between max-w-xl mx-auto">
          <div>
            <h1 className="text-xl font-black flex items-center gap-2">
              🛡️ Gate Security Module
            </h1>
            <p className="text-gray-400 text-xs mt-0.5">Tap a hostel when a delivery arrives</p>
          </div>
          <div className="text-right">
            {/* Live clock */}
            <div className="font-mono text-sm text-green-400">{clock} IST</div>
            {/* Connection status indicator */}
            <div className={`flex items-center gap-1.5 text-xs mt-0.5 justify-end ${connected ? 'text-green-400' : 'text-red-400'}`}>
              <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
              {connected ? 'Live' : 'Offline'}
            </div>
          </div>
        </div>
      </div>

      {/* ── TOTAL COUNTER ────────────────────────────────────────────────── */}
      <div className="max-w-xl mx-auto px-4 py-4">
        <div className="bg-gray-800 rounded-2xl px-5 py-4 flex items-center justify-between border border-gray-700">
          <div>
            <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide">Today's Total Deliveries</p>
            <p className="text-4xl font-black text-white mt-0.5">{totalDeliveries}</p>
          </div>
          <div className="text-5xl">🛵</div>
        </div>
      </div>

      {/* ── INSTRUCTIONS ─────────────────────────────────────────────────── */}
      <div className="max-w-xl mx-auto px-4 mb-3">
        <p className="text-center text-gray-500 text-xs">
          Tap the hostel receiving a delivery. Count updates live on all dashboards.
        </p>
      </div>

      {/* ── 4×2 HOSTEL BUTTON GRID ───────────────────────────────────────── */}
      {/* WHY GRID? — Speed. A guard should be able to tap without thinking.
          Large targets, high contrast, color-coded by hostel identity.
          The count badge on each button gives instant feedback. */}
      <div className="max-w-xl mx-auto px-4 grid grid-cols-2 gap-3">
        {HOSTEL_CONFIG.map((hostel) => (
          <HostelButton
            key={hostel.name}
            hostel={hostel}
            count={counts[hostel.name] || 0}
            isActive={lastTapped === hostel.name}
            onTap={() => handleLog(hostel.name)}
          />
        ))}
      </div>

      {/* ── RESET NOTICE ─────────────────────────────────────────────────── */}
      <div className="max-w-xl mx-auto px-4 mt-6">
        <p className="text-center text-gray-600 text-xs">
          Counts reset daily at midnight IST. Live sync across all screens.
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT: HostelButton
// One of the 8 large tappable buttons.
// Shows the hostel name, an emoji, and the live delivery count badge.
// ─────────────────────────────────────────────────────────────────────────────
function HostelButton({ hostel, count, isActive, onTap }) {
  return (
    <button
      onClick={onTap}
      // active:scale-95 gives tactile press feedback on tap
      // isActive triggers a brief scale-up animation via CSS transition
      className={`
        relative flex flex-col items-center justify-center
        bg-gradient-to-br ${hostel.gradient}
        rounded-2xl py-6 px-4 shadow-lg
        transition-all duration-150 ease-out
        active:scale-95 touch-manipulation
        ${isActive ? 'scale-105 ring-4 ' + hostel.ring : 'scale-100'}
        hover:brightness-110
      `}
      // touch-manipulation: tells the browser this is a touch target,
      // eliminating the 300ms tap delay on mobile browsers
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      {/* Hostel emoji */}
      <span className="text-4xl mb-1">{hostel.emoji}</span>

      {/* Hostel name */}
      <span className="font-black text-white text-base tracking-wide leading-tight text-center">
        {hostel.name}
      </span>

      {/* Live delivery count badge — bottom right corner */}
      <div className="absolute top-2.5 right-2.5 bg-white/25 backdrop-blur-sm rounded-full px-2.5 py-0.5">
        <span className="text-white font-black text-sm">{count}</span>
      </div>

      {/* "+" flash overlay shown on tap (isActive) */}
      {isActive && (
        <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/20">
          <span className="text-white font-black text-3xl">+1</span>
        </div>
      )}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT: ToastNotification
// A brief floating confirmation shown after each tap.
// Auto-dismisses after 1.8 seconds.
// ─────────────────────────────────────────────────────────────────────────────
function ToastNotification({ hostel, type, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 1800); // Auto-dismiss after 1.8 seconds
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
      <span>
        {type === 'success' ? `Logged! → ${hostel}` : `Offline — ${hostel} not saved!`}
      </span>
    </div>
  );
}
