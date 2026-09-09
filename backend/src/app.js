const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/authRoutes');
const customerRoutes = require('./routes/customerRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const productRoutes = require('./routes/productRoutes');
const purchaseRoutes = require('./routes/purchaseRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const supplierRoutes = require('./routes/supplierRoutes');
const reportRoutes = require('./routes/reportRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// CORS_ORIGIN is your stable production URL (e.g.
// https://dairy-erp-pi.vercel.app, no trailing slash). Beyond that,
// any *.vercel.app origin is allowed too -- Vercel generates a new
// unique preview URL on every git push while you're actively
// developing, so hardcoding one exact URL breaks on the next deploy.
// Once things are stable and you're not pushing new previews all the
// time, you can tighten this back down to just CORS_ORIGIN.
const productionOrigin = process.env.CORS_ORIGIN;

app.use(cors({
  origin(origin, callback) {
    // Requests with no Origin header (curl, server-to-server, Postman)
    if (!origin) return callback(null, true);

    if (productionOrigin && origin === productionOrigin) return callback(null, true);
    if (origin.endsWith('.vercel.app')) return callback(null, true);
    if (origin === 'http://localhost:5173') return callback(null, true);

    callback(new Error('Not allowed by CORS'));
  },
}));
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/products', productRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/settings', settingsRoutes);

app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

app.use(errorHandler);

module.exports = app;