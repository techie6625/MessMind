/*
=============================================================================
FILE: WardenDashboard.js  —  Warden Portal v1
=============================================================================
A high-level analytics dashboard for the Hostel Warden.

Sections:
  1. Financial KPI — Total & weekly expenditure
  2. Receipts Gallery — Scrollable grid of uploaded bills
  3. Student Satisfaction — Weekly average star rating
  4. Red Flags — Top skipped / most-cancelled meals
  5. Waste Overview — Total waste this week per meal
=============================================================================
*/

import React, { useState, useEffect, useCallback } from 'react';

const API_BASE = 'http://localhost:3001';

// ─────────────────────────────────────────────────────────────────────────────
// UI HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const Spinner = () => (
  <div className="inline-block w-6 h-6 border-2 border-white/20 border-t-violet-400 rounded-full animate-spin" />
);

const GlassCard = ({ children, className = '' }) => (
  <div className={`bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 ${className}`}>
    {children}
  </div>
);

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
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// WARDEN LOGIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
function WardenLogin({ onLogin }) {
  const [name,     setName]     = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
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
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

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
          </>
        )}
      </main>
    </div>
  );
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
