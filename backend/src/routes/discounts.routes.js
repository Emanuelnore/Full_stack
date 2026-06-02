const express = require('express')
const router = express.Router()
const ctrl = require('../controllers/discounts.controller')

router.post('/validate', ctrl.validate)

module.exports = router
