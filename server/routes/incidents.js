const express = require('express');
const auth = require('../middleware/auth');
const { listIncidents, replayIncident } = require('../controllers/incidentController');

const router = express.Router();
router.use(auth);

router.get('/', listIncidents);
router.post('/replay/:id', replayIncident);

module.exports = router;
