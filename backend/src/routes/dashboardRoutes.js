const express = require('express');
const router = express.Router();
const { getStats, getPurchaseTrend, getDairyToday } = require('../controllers/dashboardController');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

router.use(requireAuth);
router.get('/stats', asyncHandler(getStats));
router.get('/today', asyncHandler(getDairyToday));
router.get('/purchase-trend', asyncHandler(getPurchaseTrend));
module.exports = router;