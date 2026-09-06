const express = require('express');
const auth = require('../middleware/auth');
const { listEndpoints, createEndpoint, deleteEndpoint, getEndpointPings } = require('../controllers/endpointController');

const router = express.Router();

// All routes protected by JWT middleware
router.use(auth);

router.get('/', listEndpoints);
router.post('/', createEndpoint);
router.delete('/:id', deleteEndpoint);
router.get('/:id/pings', getEndpointPings);

module.exports = router;
