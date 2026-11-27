const express = require('express');
const router = express.Router();
const { getOverview, sendAll, sendOne, cron, sendSummaryNow } = require('../controllers/smsController');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

router.post('/cron', asyncHandler(cron)); // secret header, no login
router.use(requireAuth);
router.get('/', asyncHandler(getOverview));
router.post('/send-all', asyncHandler(sendAll));
router.post('/send/:customerId', asyncHandler(sendOne));
router.post('/summary/send', asyncHandler(sendSummaryNow));

module.exports = router;
