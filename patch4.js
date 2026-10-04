const fs = require('fs');

let lp = fs.readFileSync('frontend/src/LandingPage.jsx', 'utf8');

const wardenSnippet = `
          <div className="text-center mt-6 mb-4 relative z-10">
            <a href="/warden" className="text-slate-400 hover:text-white text-sm font-bold border-b border-slate-600 hover:border-white transition-all">
              🏛️ Warden Portal (Admin)
            </a>
          </div>
`;

// Insert above the 2025 MessMind text
lp = lp.replace(/(<p className="relative z-10 text-slate-600 text-xs mt-12 text-center font-semibold">)/, wardenSnippet + '$1');

fs.writeFileSync('frontend/src/LandingPage.jsx', lp);
console.log('LandingPage fully patched for first screen');
