const express = require('express');
const router = express.Router();
const { getSettings, updateSettings } = require('../controllers/settingsController');
const { requireAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { settingsBodySchema } = require('../validation/settingsSchemas');
const asyncHandler = require('../middleware/asyncHandler');

router.use(requireAuth);
router.get('/', asyncHandler(getSettings));
router.put('/', validate(settingsBodySchema), asyncHandler(updateSettings));

module.exports = router;