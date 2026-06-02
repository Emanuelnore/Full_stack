const orderService = require('../services/order.service')
const { sendError } = require('../lib/appError')

async function preview(req, res) {
  try {
    const { customer_id, items, discount_code } = req.body
    const result = await orderService.previewOrder({ customer_id, items, discount_code })
    res.json({ success: true, data: result })
  } catch (err) {
    sendError(res, err)
  }
}

async function create(req, res) {
  try {
    const { customer_id, items, discount_code } = req.body
    const order = await orderService.createOrder({ customer_id, items, discount_code })
    res.status(201).json({ success: true, data: order })
  } catch (err) {
    sendError(res, err)
  }
}

async function list(req, res) {
  try {
    const { status, customer_id, page, limit } = req.query
    const result = await orderService.listOrders({ status, customer_id, page, limit })
    res.json({ success: true, data: result })
  } catch (err) {
    sendError(res, err)
  }
}

async function updateStatus(req, res) {
  try {
    const { status } = req.body
    const order = await orderService.updateOrderStatus(req.params.id, status)
    res.json({ success: true, data: order })
  } catch (err) {
    sendError(res, err)
  }
}

module.exports = { preview, create, list, updateStatus }
