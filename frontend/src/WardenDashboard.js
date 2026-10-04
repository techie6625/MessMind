import React, { useState, useEffect } from 'react';

export default function WardenDashboard({ user, onLogout }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('http://localhost:3001/api/warden-stats')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setStats(data);
        } else {
          setError(data.error);
        }
      })
      .catch(() => setError('Failed to connect to backend'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-[#0B0F19] text-white relative overflow-hidden pb-10">
      {/* Background elements */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#0B0F19]/80 backdrop-blur-xl border-b border-white/8">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-xl shadow-lg shadow-violet-500/20">🏛️</div>
            <div>
              <h1 className="font-black text-lg leading-tight bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">Warden Portal</h1>
              <p className="text-xs text-slate-500 font-medium">Logged in as {user.name}</p>
            </div>
          </div>
          <button 
            onClick={onLogout} 
            className="text-xs font-bold text-slate-400 hover:text-white border border-white/10 rounded-xl px-4 py-2 hover:border-white/20 transition-all bg-white/5 active:scale-95"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Dashboard Content */}
      <main className="max-w-4xl mx-auto px-6 py-8 relative z-10">
        {loading && <div className="text-center py-20 text-violet-400 font-bold animate-pulse">Loading Analytics...</div>}
        {error && <div className="text-center py-20 text-rose-400 bg-rose-500/10 rounded-2xl border border-rose-500/20">{error}</div>}
        
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* Metric 1: Total Money Spent */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-colors">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">💰</span>
                <h2 className="text-slate-400 text-xs font-bold uppercase tracking-widest">Total Money Spent</h2>
              </div>
              <div className="text-5xl font-black text-emerald-400 mt-2">
                ₹{stats.totalSpent.toLocaleString('en-IN')}
              </div>
              <div className="text-slate-500 text-[10px] mt-2 font-medium">Lifetime expenditure logged by Contractor</div>
            </div>

            {/* Metric 2: Average Food Rating */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-colors">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">⭐</span>
                <h2 className="text-slate-400 text-xs font-bold uppercase tracking-widest">Avg Food Rating</h2>
              </div>
              <div className="flex items-baseline gap-2 mt-2">
                <div className="text-5xl font-black text-amber-400">{stats.averageRating}</div>
                <div className="text-slate-500 font-bold text-lg">/ 5.0</div>
              </div>
              <div className="text-slate-500 text-[10px] mt-2 font-medium">Based on student feedback (Last 7 Days)</div>
            </div>

            {/* Metric 3: Top 3 Skipped Meals */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-colors md:col-span-2 lg:col-span-1">
              <div className="flex items-center gap-3 mb-5">
                <span className="text-3xl">🚩</span>
                <h2 className="text-slate-400 text-xs font-bold uppercase tracking-widest">Top 3 Skipped Meals</h2>
              </div>
              
              {stats.topSkippedMeals.length === 0 ? (
                <div className="text-slate-500 text-sm font-semibold text-center py-4">No skipped meals this week 🎉</div>
              ) : (
                <div className="space-y-3">
                  {stats.topSkippedMeals.map((meal, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{['🥇', '🥈', '🥉'][idx] || '📌'}</span>
                        <span className="text-white font-bold text-sm">{meal.meal_type}</span>
                      </div>
                      <span className="text-rose-400 font-black text-sm bg-rose-500/20 px-3 py-1 rounded-lg">
                        {meal.count} skips
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <div className="text-slate-500 text-[10px] mt-3 font-medium">Meals with highest cancellation rate (Last 7 Days)</div>
            </div>

          </div>
        )}
      </main>
    </div>
  );
}
