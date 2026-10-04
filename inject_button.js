const fs = require('fs');
let appCode = fs.readFileSync('frontend/src/App.js', 'utf8');

// The code block to inject
const buttonJsx = `
<div className="mt-4 flex justify-center w-full">
  <button 
    onClick={triggerTelegramDemo}
    className="px-6 py-2 rounded-xl text-sm font-black text-white bg-gradient-to-r from-cyan-500 to-blue-500 hover:brightness-110 active:scale-95 transition-all shadow-[0_0_15px_rgba(6,182,212,0.4)] border border-cyan-400/30 flex items-center gap-2"
  >
    <span className="text-lg">📲</span> Trigger Bot Demo
  </button>
</div>
`;

// Find the precise Logout button inside StudentApp
// Look for the exact logout button in the header and inject the new button just before the closing </div> of the header
const targetStr = `        {onLogout && (
          <button onClick={onLogout} className="mt-3 text-slate-500 hover:text-white border border-white/10 rounded-lg px-3 py-1.5 text-xs transition-colors hover:border-white/20">Logout</button>
        )}
      </div>`;

const replacement = `        {onLogout && (
          <button onClick={onLogout} className="mt-3 text-slate-500 hover:text-white border border-white/10 rounded-lg px-3 py-1.5 text-xs transition-colors hover:border-white/20">Logout</button>
        )}
${buttonJsx}
      </div>`;

appCode = appCode.replace(targetStr, replacement);
fs.writeFileSync('frontend/src/App.js', appCode);

console.log('Button injected below Logout');
