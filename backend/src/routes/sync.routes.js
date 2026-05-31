const express = require('express')
const router = express.Router()
const { sync } = require('../controllers/sync.controller')

router.post('/', sync)

module.exports = router