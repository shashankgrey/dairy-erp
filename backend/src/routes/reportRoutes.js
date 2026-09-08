const express = require('express');
const router = express.Router();
const { dailyReport } = require('../controllers/reportController');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

router.use(requireAuth);
router.get('/daily', asyncHandler(dailyReport));
module.exports = router;