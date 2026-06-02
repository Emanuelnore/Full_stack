const express = require('express')
const router = express.Router()
const ctrl = require('../controllers/customers.controller')

router.get('/', ctrl.list)

module.exports = router
