const express = require('express');
const router = express.Router();
const { getSettings, updateSettings } = require('../controllers/settingsController');
const { requireAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { settingsBodySchema } = require('../validation/settingsSchemas');

router.use(requireAuth);
router.get('/', getSettings);
router.put('/', validate(settingsBodySchema), updateSettings);

module.exports = router;