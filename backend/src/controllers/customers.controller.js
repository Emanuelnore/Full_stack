const customerService = require('../services/customer.service')
const { sendError } = require('../lib/appError')

async function list(req, res) {
  try {
    const customers = await customerService.listCustomers()
    res.json({ success: true, data: customers })
  } catch (err) {
    sendError(res, err)
  }
}

module.exports = { list }
