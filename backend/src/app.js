const path = require('path');
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
const asyncHandler = require('./middleware/asyncHandler');
const { renderPayPage } = require('./controllers/payPageController');

const app = express();

// CORS_ORIGIN lets you lock this down to your actual deployed frontend
// URL once you have one (e.g. https://your-app.vercel.app). Any
// *.vercel.app origin is also allowed since Vercel generates a new
// preview URL on every push while actively developing.
app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (process.env.CORS_ORIGIN && origin === process.env.CORS_ORIGIN) return callback(null, true);
    if (origin.endsWith('.vercel.app')) return callback(null, true);
    if (origin === 'http://localhost:5173') return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
}));
app.use(express.json());

// Serves /pay-preview.png for the WhatsApp link-preview image.
app.use(express.static(path.join(__dirname, '../public')));

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

// Public payment page -- no auth, meant to be opened directly by a
// customer from the WhatsApp reminder link. Access is controlled by
// the signed token in the URL, not by login.
app.get('/pay/:id/:token', asyncHandler(renderPayPage));

app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

app.use(errorHandler);

module.exports = app;