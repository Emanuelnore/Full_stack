const orderService = require('../services/order.service')
const { appError, sendError } = require('../lib/appError')

async function validate(req, res) {
  try {
    const { code, customer_id, items } = req.body

    if (!code) {
      throw appError(400, 'CODE_REQUIRED', 'Falta el codigo de descuento')
    }

    // Reutiliza el mismo calculo: si el codigo no aplica, lanza el error correcto
    const calc = await orderService.buildOrderCalculation({
      customer_id,
      items,
      discount_code: code
    })

    res.json({
      success: true,
      data: {
        valid: true,
        code: calc.rule.code,
        type: calc.rule.type,
        subtotal: calc.subtotal,
        discount: calc.discount,
        total: calc.total
      }
    })
  } catch (err) {
    sendError(res, err)
  }
}

module.exports = { validate }
