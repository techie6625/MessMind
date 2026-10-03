/*
=============================================================================
FILE: LandingPage.jsx  —  Auth Entry Point  v2
=============================================================================
Changes:
  • Signup for Student/Contractor shows a mandatory Hostel dropdown
  • hostel_name sent to /api/signup
=============================================================================
*/

import React, { useState, useEffect } from 'react';

const API_BASE = 'http://localhost:3001';

const HOSTELS = ['Chitrakot', 'Mainpat', 'Sirpur', 'Mahanadi', 'Indravati', 'Malhar', 'Kotumsar', 'Seonath'];

const ROLES = [
  {
    id:       'student',
    emoji:    '🎓',
    label:    'Student',
    desc:     'Manage meals & apply for leave',
    gradient: 'from-indigo-500 to-purple-600',
    ring:     'ring-indigo-400',
    needsHostel: true,
  },
  {
    id:       'contractor',
    emoji:    '👨‍🍳',
    label:    'Mess Contractor',
    desc:     'View AI predictions & manage menu',
    gradient: 'from-emerald-500 to-teal-600',
    ring:     'ring-emerald-400',
    needsHostel: true,
  },
  {
    id:       'guard',
    emoji:    '🛡️',
    label:    'Security Guard',
    desc:     'Log hostel deliveries in real-time',
    gradient: 'from-gray-600 to-gray-800',
    ring:     'ring-gray-400',
    needsHostel: false,
  },
];

const Spinner = () => (
  <div className="inline-block w-5 h-5 border-4 border-white/30 border-t-white rounded-full animate-spin" />
);

export default function LandingPage({ onLogin }) {
  const [selectedRole, setSelectedRole] = useState(null);
  const [mode, setMode]                 = useState('login');

  // Form fields
  const [name,            setName]            = useState('');
  const [mobileNo,        setMobileNo]        = useState('');
  const [password,        setPassword]        = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [hostelName,      setHostelName]      = useState('');
  const [showPass,        setShowPass]        = useState(false);

  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState('');

  // Reset form when role or mode changes
  useEffect(() => {
    setName(''); setMobileNo(''); setPassword('');
    setConfirmPassword(''); setHostelName(''); setError(''); setSuccess('');
  }, [selectedRole, mode]);

  const roleObj = ROLES.find(r => r.id === selectedRole);

  // ── SUBMIT ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');

    if (!name.trim())  { setError('Name is required.'); return; }
    if (!password)     { setError('Password is required.'); return; }

    if (mode === 'signup') {
      if (!mobileNo.trim())                         { setError('Mobile number is required.'); return; }
      if (!/^\d{10}$/.test(mobileNo.trim()))        { setError('Enter a valid 10-digit mobile number.'); return; }
      if (password.length < 6)                      { setError('Password must be at least 6 characters.'); return; }
      if (password !== confirmPassword)             { setError('Passwords do not match.'); return; }
      if (roleObj?.needsHostel && !hostelName)      { setError('Please select your hostel.'); return; }
    }

    setLoading(true);
    try {
      const endpoint = mode === 'login' ? '/api/login' : '/api/signup';
      const body     = mode === 'login'
        ? { name: name.trim(), password, role: selectedRole }
        : {
            name:       name.trim(),
            mobile_no:  mobileNo.trim(),
            password,
            role:       selectedRole,
            hostel_name: hostelName || '',
          };

      const r = await fetch(`${API_BASE}${endpoint}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });
      const d = await r.json();

      if (!d.success) { setError(d.error || 'Something went wrong.'); return; }

      if (mode === 'signup') {
        setSuccess('Account created! You can now log in.');
        setMode('login');
        setPassword(''); setConfirmPassword('');
        return;
      }

      onLogin(d.user);
    } catch {
      setError('Cannot reach the server. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  // ── RENDER: Role Selection ─────────────────────────────────────────────────
  if (!selectedRole) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex flex-col items-center justify-center px-4 py-12">
        <div className="text-center mb-10">
          <div className="text-7xl mb-3">🍱</div>
          <h1 className="text-3xl font-black text-white tracking-tight">MessMind</h1>
          <p className="text-gray-400 text-sm mt-1">AI-Powered Mess Demand Forecasting</p>
        </div>

        <h2 className="text-white text-sm font-bold mb-6 tracking-widest uppercase opacity-50">
          Select Your Role to Continue
        </h2>

        <div className="grid grid-cols-1 gap-4 w-full max-w-sm">
          {ROLES.map(role => (
            <button
              key={role.id}
              onClick={() => setSelectedRole(role.id)}
              className={`
                bg-gradient-to-br ${role.gradient}
                rounded-2xl p-5 text-left text-white shadow-xl
                hover:scale-105 active:scale-95 transition-all duration-200
                hover:ring-4 ${role.ring} hover:ring-opacity-50
                flex items-center gap-4
              `}
            >
              <span className="text-4xl">{role.emoji}</span>
              <div>
                <div className="font-black text-lg leading-tight">{role.label}</div>
                <div className="text-white/70 text-xs mt-0.5">{role.desc}</div>
              </div>
              <span className="ml-auto text-white/50 text-xl">›</span>
            </button>
          ))}
        </div>

        <p className="text-gray-600 text-xs mt-10 text-center">© 2025 MessMind · Hackathon Project</p>
      </div>
    );
  }

  // ── RENDER: Login / Sign-up Form ───────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex flex-col items-center justify-center px-4 py-10">

      <button
        onClick={() => setSelectedRole(null)}
        className="self-start mb-6 text-gray-400 hover:text-white text-sm flex items-center gap-1 transition-colors max-w-sm w-full"
      >
        ← Back to role selection
      </button>

      <div className="w-full max-w-sm">

        <div className="text-center mb-7">
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-br ${roleObj.gradient} text-white font-bold text-sm mb-3 shadow-lg`}>
            <span>{roleObj.emoji}</span>
            <span>{roleObj.label}</span>
          </div>
          <h2 className="text-white text-2xl font-black">
            {mode === 'login' ? 'Welcome Back!' : 'Create Account'}
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            {mode === 'login' ? 'Sign in to your account' : 'Fill in the details below'}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-gray-800 rounded-2xl p-6 shadow-2xl border border-gray-700 space-y-4"
        >
          {/* Name */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">👤 Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Enter your name"
              className="w-full px-4 py-3 rounded-xl bg-gray-700 text-white placeholder-gray-500
                         border-2 border-gray-600 focus:outline-none focus:border-indigo-500 text-sm transition-colors"
            />
          </div>

          {/* Mobile (signup only) */}
          {mode === 'signup' && (
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">📱 Mobile No</label>
              <input
                type="tel"
                value={mobileNo}
                onChange={e => setMobileNo(e.target.value)}
                placeholder="10-digit mobile number"
                maxLength={10}
                className="w-full px-4 py-3 rounded-xl bg-gray-700 text-white placeholder-gray-500
                           border-2 border-gray-600 focus:outline-none focus:border-indigo-500 text-sm transition-colors"
              />
            </div>
          )}

          {/* Hostel (signup only, for student/contractor) */}
          {mode === 'signup' && roleObj?.needsHostel && (
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">
                🏠 Your Hostel <span className="text-red-400">*</span>
              </label>
              <select
                value={hostelName}
                onChange={e => setHostelName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-gray-700 text-white border-2 border-gray-600
                           focus:outline-none focus:border-indigo-500 text-sm transition-colors"
              >
                <option value="">— Select your hostel —</option>
                {HOSTELS.map(h => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
          )}

          {/* Password */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">🔒 Password</label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full px-4 py-3 rounded-xl bg-gray-700 text-white placeholder-gray-500
                           border-2 border-gray-600 focus:outline-none focus:border-indigo-500 text-sm pr-12 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPass(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 text-xs"
              >
                {showPass ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {/* Confirm Password (signup only) */}
          {mode === 'signup' && (
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">🔒 Confirm Password</label>
              <input
                type={showPass ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                className="w-full px-4 py-3 rounded-xl bg-gray-700 text-white placeholder-gray-500
                           border-2 border-gray-600 focus:outline-none focus:border-indigo-500 text-sm transition-colors"
              />
            </div>
          )}

          {/* Error / Success */}
          {error && (
            <div className="bg-red-900/50 border border-red-700 rounded-xl px-4 py-3 text-red-300 text-sm flex items-start gap-2">
              <span>❌</span><span>{error}</span>
            </div>
          )}
          {success && (
            <div className="bg-green-900/50 border border-green-700 rounded-xl px-4 py-3 text-green-300 text-sm flex items-start gap-2">
              <span>✅</span><span>{success}</span>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3.5 rounded-xl font-black text-white text-sm transition-all
              bg-gradient-to-br ${roleObj.gradient}
              hover:brightness-110 active:scale-95 disabled:opacity-50 disabled:cursor-wait
              flex items-center justify-center gap-2 shadow-lg`}
          >
            {loading
              ? <><Spinner /> {mode === 'login' ? 'Signing in…' : 'Creating account…'}</>
              : mode === 'login' ? '🚀 Sign In' : '✅ Create Account'
            }
          </button>

          {/* Toggle mode */}
          <p className="text-center text-gray-500 text-xs pt-1">
            {mode === 'login' ? (
              <>New user?{' '}
                <button type="button" onClick={() => setMode('signup')}
                  className="text-indigo-400 hover:text-indigo-300 font-bold transition-colors">
                  Sign up here
                </button>
              </>
            ) : (
              <>Already have an account?{' '}
                <button type="button" onClick={() => setMode('login')}
                  className="text-indigo-400 hover:text-indigo-300 font-bold transition-colors">
                  Log in
                </button>
              </>
            )}
          </p>
        </form>

        {/* Test credentials */}
        <div className="mt-4 bg-gray-800/50 border border-gray-700 rounded-xl p-4 text-xs text-gray-500">
          <p className="font-bold text-gray-400 mb-1">🧪 Test Credentials</p>
          <p>Student → <span className="text-gray-300">Navodit / student123</span></p>
          <p>Contractor → <span className="text-gray-300">Mess Contractor / contractor123</span></p>
          <p>Guard → <span className="text-gray-300">Gate Guard / guard123</span></p>
        </div>
      </div>
    </div>
  );
}
