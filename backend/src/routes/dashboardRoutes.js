const express = require('express');
const router = express.Router();
const { getStats, getPurchaseTrend } = require('../controllers/dashboardController');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.get('/stats', getStats);
router.get('/purchase-trend', getPurchaseTrend);

module.exports = router;