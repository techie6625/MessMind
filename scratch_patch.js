const fs = require('fs');

let c = fs.readFileSync('frontend/src/App.js', 'utf8');

const imports = `import Login from './Login';\nimport WardenDashboard from './WardenDashboard';\n`;
if (!c.includes("import WardenDashboard")) {
  c = c.replace(/import [^\n]+\n/, match => match + imports);
}

const targetRegex = /if \(!user\) \{[\s\S]*\}\s*\n$/m;
const newContent = `if (!user) {
    if (window.location.pathname === '/warden') {
      return (
        <div className="font-sans">
          <Login onLogin={(loggedInUser) => {
            setUser(loggedInUser);
            window.history.pushState({}, '', '/warden-dashboard');
          }} />
        </div>
      );
    }
    return (
      <div className="font-sans">
        <LandingPage onLogin={handleLogin} />
      </div>
    );
  }

  return (
    <div className="font-sans">
      {user.role === 'warden' && (
        <WardenDashboard user={user} onLogout={handleLogout} />
      )}
      {user.role === 'student' && (
        <StudentApp studentId={studentId} studentName={user.name} onLogout={handleLogout} />
      )}
      {user.role === 'contractor' && (
        <Dashboard user={user} onLogout={handleLogout} />
      )}
      {user.role === 'guard' && (
        <GateGuardApp user={user} onLogout={handleLogout} />
      )}
    </div>
  );
}`;

c = c.replace(targetRegex, newContent);
fs.writeFileSync('frontend/src/App.js', c);
console.log("App.js updated");
