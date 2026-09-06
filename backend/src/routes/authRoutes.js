const express = require('express');
const router = express.Router();
const { login, createUser } = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { loginSchema, createUserSchema } = require('../validation/authSchemas');

router.post('/login', validate(loginSchema), login);
router.post('/users', requireAuth, validate(createUserSchema), createUser);
module.exports = router;