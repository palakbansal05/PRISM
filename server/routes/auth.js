const express = require('express');
const auth = require('../middleware/auth');
const { register, login, changePassword, getMe } = require('../controllers/authController');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.put('/password', auth, changePassword);
router.get('/me', auth, getMe);

module.exports = router;
