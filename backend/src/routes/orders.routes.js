const express = require('express')
const router = express.Router()
const ctrl = require('../controllers/orders.controller')

router.post('/preview', ctrl.preview)
router.post('/', ctrl.create)
router.get('/', ctrl.list)
router.patch('/:id/status', ctrl.updateStatus)

module.exports = router
