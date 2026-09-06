const express = require('express');
const auth = require('../middleware/auth');
const { getDashboardStats, getLatencyStats, getUptimeHistory } = require('../controllers/statsController');

const router = express.Router();
router.use(auth);

router.get('/', getDashboardStats);
router.get('/latency/:endpointId', getLatencyStats);
router.get('/uptime-history/:endpointId', getUptimeHistory);

module.exports = router;
