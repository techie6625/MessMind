const fs = require('fs');
let code = fs.readFileSync('frontend/src/Dashboard.js', 'utf8');

const rescueCard = `
        {/* Zero Food Wastage Social Impact Card */}
        <div className="bg-gradient-to-br from-emerald-500/20 to-emerald-700/10 border border-emerald-500/40 rounded-2xl p-5 shadow-[0_0_20px_rgba(16,185,129,0.15)] relative overflow-hidden group">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-emerald-500/20 rounded-full blur-2xl group-hover:bg-emerald-500/30 transition-all"></div>
          <div className="flex items-center justify-between relative z-10">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl">🤝</span>
                <h3 className="text-sm font-black text-emerald-400 uppercase tracking-widest">Zero Food Wastage</h3>
              </div>
              <p className="text-xs text-emerald-100/70 font-medium">Robin Hood Army (Raipur Chapter) - Food Rescue</p>
            </div>
            <a 
              href="tel:+919876543210" 
              className="bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-black text-xs px-4 py-2.5 rounded-xl transition-all shadow-lg shadow-emerald-500/30 active:scale-95 flex items-center gap-1.5 border border-emerald-400/50"
            >
              <span>📞</span> Tap to Call
            </a>
          </div>
        </div>
`;

// Replace the first occurrence of <div className="space-y-4"> inside OverviewTab
// To be safe, we will specifically target the one in OverviewTab.
const targetRegex = /(function OverviewTab\(\{[\s\S]*?return \(\s*<div className="space-y-4">)/;

if (targetRegex.test(code)) {
  code = code.replace(targetRegex, "$1\n" + rescueCard);
  fs.writeFileSync('frontend/src/Dashboard.js', code);
  console.log("Injected rescue card.");
} else {
  console.log("Regex did not match.");
}
