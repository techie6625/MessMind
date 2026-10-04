const fs = require('fs');
let appCode = fs.readFileSync('frontend/src/App.js', 'utf8');

if (!appCode.includes('triggerTelegramDemo')) {
  const triggerFunc = `
  const triggerTelegramDemo = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/trigger-bot-demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          chatId: '6818379808', // INJECTED EXACTLY AS REQUESTED
          mealType: 'Lunch' 
        })
      });
      const data = await response.json();
      if (data.success) {
        alert('📲 Notification sent to your Telegram!');
      } else {
        alert('Failed: ' + data.error);
      }
    } catch (err) {
      alert('Error triggering demo: ' + err.message);
    }
  };
`;
  
  const btnJsx = `
        <button 
          onClick={triggerTelegramDemo}
          className="ml-4 px-4 py-2 rounded-xl text-sm font-black text-white bg-gradient-to-r from-cyan-500 to-blue-500 hover:brightness-110 active:scale-95 transition-all shadow-[0_0_15px_rgba(6,182,212,0.4)] border border-cyan-400/30 flex items-center gap-2"
        >
          <span className="text-lg">📲</span> Trigger Bot Demo
        </button>`;

  appCode = appCode.replace(/(const StudentApp = \(\{.*?\}\) => \{[\s\S]*?)(return \()/, "$1" + triggerFunc + "\n  $2");
  
  appCode = appCode.replace(/(<button[^>]*onClick=\{\(\) => setActiveTab\('history'\)\}[^>]*>[\s\S]*?<\/button>)/, "$1" + btnJsx);

  fs.writeFileSync('frontend/src/App.js', appCode);
  console.log("App.js correctly patched");
}
