/*
=============================================================================
FILE: LandingPage.jsx  —  Auth Entry Point  v3 (Glassmorphism Dark)
=============================================================================
Changes:
  • Deep dark bg-[#0B0F19] with ambient glow orbs
  • Glassmorphism form cards with glowing borders
  • Gradient text accents
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
    gradient: 'from-gray-500 to-slate-600',
    ring:     'ring-slate-400',
    needsHostel: false,
  },
];

const Spinner = () => (
  <div className="inline-block w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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
      <div className="min-h-screen bg-[#0B0F19] relative overflow-hidden flex flex-col items-center justify-center px-4 py-12">
        {/* Ambient Orbs */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative z-10 text-center mb-10">
          <div className="text-7xl mb-4 drop-shadow-2xl">🍱</div>
          <h1 className="text-4xl md:text-5xl font-black bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-500 bg-clip-text text-transparent tracking-tight">
            MessMind
          </h1>
          <p className="text-slate-400 text-sm md:text-base mt-2 font-medium tracking-wide">
            AI-Powered Mess Demand Forecasting
          </p>
        </div>

        <h2 className="relative z-10 text-slate-500 text-xs font-bold mb-6 tracking-widest uppercase">
          Select Your Role to Continue
        </h2>

        <div className="relative z-10 grid grid-cols-1 gap-4 w-full max-w-sm">
          {ROLES.map(role => (
            <button
              key={role.id}
              onClick={() => setSelectedRole(role.id)}
              className="
                bg-white/5 backdrop-blur-xl border border-white/10
                rounded-2xl p-5 text-left text-white shadow-xl
                hover:bg-white/10 hover:border-white/20 hover:-translate-y-1
                active:scale-95 transition-all duration-300
                flex items-center gap-4 group relative overflow-hidden
              "
            >
              <div className={`absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-300 bg-gradient-to-br ${role.gradient}`} />
              <span className="text-4xl drop-shadow-lg relative z-10">{role.emoji}</span>
              <div className="relative z-10">
                <div className="font-black text-lg leading-tight group-hover:text-cyan-300 transition-colors">{role.label}</div>
                <div className="text-slate-400 text-xs mt-0.5">{role.desc}</div>
              </div>
              <span className="ml-auto text-slate-500 group-hover:text-white transition-colors text-xl relative z-10">›</span>
            </button>
          ))}
        </div>

        <p className="relative z-10 text-slate-600 text-xs mt-12 text-center font-semibold">
          © 2025 MessMind · Hackathon Project
        </p>
      </div>
    );
  }

  // ── RENDER: Login / Sign-up Form ───────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0B0F19] relative overflow-hidden flex flex-col items-center justify-center px-4 py-10">
      {/* Ambient Orbs */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[100px] pointer-events-none" />

      <button
        onClick={() => setSelectedRole(null)}
        className="relative z-10 self-start md:self-center md:mr-auto md:ml-4 lg:ml-[20%] mb-6 text-slate-400 hover:text-white text-sm flex items-center gap-1.5 transition-colors font-medium max-w-sm w-full"
      >
        ← Back to roles
      </button>

      <div className="relative z-10 w-full max-w-sm">

        <div className="text-center mb-7">
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-br ${roleObj.gradient} text-white font-bold text-sm mb-3 shadow-lg shadow-black/20`}>
            <span>{roleObj.emoji}</span>
            <span>{roleObj.label}</span>
          </div>
          <h2 className="text-white text-3xl font-black">
            {mode === 'login' ? 'Welcome Back!' : 'Create Account'}
          </h2>
          <p className="text-slate-400 text-sm mt-1.5 font-medium">
            {mode === 'login' ? 'Sign in to your account' : 'Fill in the details below'}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white/5 backdrop-blur-xl rounded-3xl p-6 shadow-2xl border border-white/10 space-y-4"
        >
          {/* Name */}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">👤 Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Enter your name"
              className="w-full px-4 py-3 rounded-xl bg-white/5 text-white placeholder-slate-600
                         border border-white/10 focus:outline-none focus:border-cyan-500/60 focus:bg-white/10 text-sm transition-all" />
          </div>

          {/* Mobile (signup only) */}
          {mode === 'signup' && (
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">📱 Mobile No</label>
              <input type="tel" value={mobileNo} onChange={e => setMobileNo(e.target.value)} placeholder="10-digit mobile number" maxLength={10}
                className="w-full px-4 py-3 rounded-xl bg-white/5 text-white placeholder-slate-600
                           border border-white/10 focus:outline-none focus:border-cyan-500/60 focus:bg-white/10 text-sm transition-all" />
            </div>
          )}

          {/* Hostel (signup only, for student/contractor) */}
          {mode === 'signup' && roleObj?.needsHostel && (
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                🏠 Your Hostel <span className="text-rose-400">*</span>
              </label>
              <select value={hostelName} onChange={e => setHostelName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/5 text-white border border-white/10
                           focus:outline-none focus:border-cyan-500/60 focus:bg-white/10 text-sm transition-all">
                <option value="" className="text-slate-800">— Select your hostel —</option>
                {HOSTELS.map(h => <option key={h} value={h} className="text-slate-800">{h}</option>)}
              </select>
            </div>
          )}

          {/* Password */}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">🔒 Password</label>
            <div className="relative">
              <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password"
                className="w-full px-4 py-3 rounded-xl bg-white/5 text-white placeholder-slate-600
                           border border-white/10 focus:outline-none focus:border-cyan-500/60 focus:bg-white/10 text-sm pr-12 transition-all" />
              <button type="button" onClick={() => setShowPass(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-cyan-400 text-xs font-bold transition-colors">
                {showPass ? 'HIDE' : 'SHOW'}
              </button>
            </div>
          </div>

          {/* Confirm Password (signup only) */}
          {mode === 'signup' && (
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">🔒 Confirm Password</label>
              <input type={showPass ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Re-enter password"
                className="w-full px-4 py-3 rounded-xl bg-white/5 text-white placeholder-slate-600
                           border border-white/10 focus:outline-none focus:border-cyan-500/60 focus:bg-white/10 text-sm transition-all" />
            </div>
          )}

          {/* Error / Success */}
          {error && (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl px-4 py-3 text-rose-300 text-sm flex items-start gap-2">
              <span>❌</span><span>{error}</span>
            </div>
          )}
          {success && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3 text-emerald-300 text-sm flex items-start gap-2">
              <span>✅</span><span>{success}</span>
            </div>
          )}

          {/* Submit */}
          <button type="submit" disabled={loading}
            className={`w-full py-3.5 rounded-xl font-black text-white text-sm transition-all mt-2
              bg-gradient-to-r ${roleObj.gradient} shadow-lg
              hover:brightness-110 active:scale-95 disabled:opacity-50 disabled:cursor-wait
              flex items-center justify-center gap-2`}>
            {loading
              ? <><Spinner /> {mode === 'login' ? 'Signing in…' : 'Creating account…'}</>
              : mode === 'login' ? '🚀 Sign In' : '✅ Create Account'
            }
          </button>

          {/* Toggle mode */}
          <p className="text-center text-slate-400 text-xs pt-3 border-t border-white/5">
            {mode === 'login' ? (
              <>New user?{' '}
                <button type="button" onClick={() => setMode('signup')}
                  className="text-cyan-400 hover:text-cyan-300 font-bold transition-colors">
                  Sign up here
                </button>
              </>
            ) : (
              <>Already have an account?{' '}
                <button type="button" onClick={() => setMode('login')}
                  className="text-cyan-400 hover:text-cyan-300 font-bold transition-colors">
                  Log in
                </button>
              </>
            )}
          </p>
        </form>

        {/* Test credentials */}
        <div className="mt-5 bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-4 text-xs text-slate-400 shadow-inner">
          <p className="font-bold text-white mb-1.5">🧪 Test Credentials</p>
          <div className="space-y-1">
            <p>Student → <span className="text-cyan-300 font-mono">Navodit / student123</span></p>
            <p>Contractor → <span className="text-cyan-300 font-mono">Mess Contractor / contractor123</span></p>
            <p>Guard → <span className="text-cyan-300 font-mono">Gate Guard / guard123</span></p>
          </div>
        </div>
      </div>
    </div>
  );
}
