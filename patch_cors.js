const fs = require('fs');

let serverCode = fs.readFileSync('backend/server.js', 'utf8');

// Fix Socket.io CORS
serverCode = serverCode.replace(
  /const io\s*=\s*new Server\(server,\s*\{\s*cors:\s*\{\s*origin:\s*'http:\/\/localhost:3000'[^}]*\}\s*\}\);/,
  "const io     = new Server(server, { cors: { origin: '*', methods: ['GET', 'POST'] } });"
);

// Fix Express CORS
serverCode = serverCode.replace(
  /app\.use\(cors\(\{\s*origin:\s*'http:\/\/localhost:3000'[^)]*\}\)\);/,
  "app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE'] }));"
);

fs.writeFileSync('backend/server.js', serverCode);
console.log('CORS patched successfully');
