const express = require('express');
const router = express.Router();
const { login, createUser } = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { loginSchema, createUserSchema } = require('../validation/authSchemas');
const asyncHandler = require('../middleware/asyncHandler');

router.post('/login', validate(loginSchema), asyncHandler(login));
router.post('/users', requireAuth, validate(createUserSchema), asyncHandler(createUser));
module.exports = router;