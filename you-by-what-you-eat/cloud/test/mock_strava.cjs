const http = require('http');
const now = () => Math.floor(Date.now() / 1000);
const hist = [];
http.createServer((req, res) => {
  let b = ''; req.on('data', c => b += c); req.on('end', () => {
    hist.push(req.method + ' ' + req.url); const j = o => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
    if (req.url === '/__hist') return j(hist);
    if (req.url === '/oauth/token') { const p = new URLSearchParams(b);
      if (p.get('grant_type') === 'authorization_code') return p.get('code') === 'goodcode' && p.get('client_secret') ? j({ token_type: 'Bearer', access_token: 'A1', refresh_token: 'R1', expires_at: now() + 21600, athlete: { firstname: 'Luca', lastname: 'Test' } }) : (res.writeHead(400), res.end('{}'));
      return j({ access_token: 'A2', refresh_token: 'R2', expires_at: now() + 21600 }); }
    if (!/Bearer A[12]/.test(req.headers.authorization || '')) { res.writeHead(401); return res.end('{"message":"Authorization Error"}'); }
    if (req.url.startsWith('/api/v3/athlete/activities')) { const d = new Date(Date.now() - 3600e3).toISOString().slice(0, 19) + 'Z';
      return j([{ id: 9001, name: 'Abendlauf', sport_type: 'Run', distance: 5200, moving_time: 1900, elapsed_time: 1990, start_date_local: d, average_heartrate: 148.6, max_heartrate: 171, total_elevation_gain: 42.3 }, { id: 9002, name: 'Radtour', sport_type: 'Ride', distance: 31000, moving_time: 4800, start_date_local: d }]); }
    if (/^\/api\/v3\/activities\/\d+/.test(req.url)) return j({ calories: 412 });
    res.writeHead(404); res.end('{}');
  });
}).listen(8799, '127.0.0.1');
