const express = require('express');
const router = express.Router();
const { dailyReport } = require('../controllers/reportController');
const { requireAuth } = require('../middleware/auth');
router.use(requireAuth);
router.get('/daily', dailyReport);
module.exports = router;
