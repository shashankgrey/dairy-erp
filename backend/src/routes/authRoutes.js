const express = require('express');
const router = express.Router();
const { login, createUser, changePassword } = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { loginSchema, createUserSchema, changePasswordSchema } = require('../validation/authSchemas');
const asyncHandler = require('../middleware/asyncHandler');

router.post('/login', validate(loginSchema), asyncHandler(login));
router.post('/users', requireAuth, validate(createUserSchema), asyncHandler(createUser));
router.post('/change-password', requireAuth, validate(changePasswordSchema), asyncHandler(changePassword));
module.exports = router;