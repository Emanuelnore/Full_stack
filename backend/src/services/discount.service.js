const prisma = require('../lib/prisma')
const { appError } = require('../lib/appError')

// Calcula CUANTO se descuenta segun el tipo de regla
function calculateDiscount(rule, subtotal) {
  if (rule.type === 'percentage') {
    return subtotal * (rule.value / 100)
  }
  if (rule.type === 'fixed') {
    // el descuento nunca puede superar el subtotal (total minimo = 0)
    return Math.min(rule.value, subtotal)
  }
  return 0
}

// Valida un codigo contra un cliente y un subtotal.
// Si algo falla, lanza un AppError con el status HTTP correcto.
// Si todo esta bien, devuelve { rule, discount }.
async function validateDiscount(code, customer, subtotal) {
  const rule = await prisma.discountRule.findUnique({ where: { code } })

  // 1. Existencia
  if (!rule) {
    throw appError(404, 'DISCOUNT_NOT_FOUND', `El codigo "${code}" no existe`)
  }

  // 2. Expiracion
  if (rule.expires_at && new Date(rule.expires_at) < new Date()) {
    throw appError(400, 'DISCOUNT_EXPIRED', `El codigo "${code}" esta vencido`)
  }

  // 3. Usos disponibles
  if (rule.max_uses !== null && rule.uses_count >= rule.max_uses) {
    throw appError(400, 'DISCOUNT_EXHAUSTED', `El codigo "${code}" ya agoto sus usos`)
  }

  // 4. Tier del cliente (403 si la regla es exclusiva y no coincide)
  if (rule.applicable_tier && rule.applicable_tier !== customer.tier) {
    throw appError(
      403,
      'DISCOUNT_TIER_MISMATCH',
      `El codigo "${code}" es exclusivo para clientes ${rule.applicable_tier}`
    )
  }

  // 5. Monto minimo
  if (subtotal < rule.min_order_amount) {
    throw appError(
      400,
      'MIN_ORDER_NOT_MET',
      `El subtotal (${subtotal}) no alcanza el minimo de ${rule.min_order_amount} para "${code}"`
    )
  }

  const discount = calculateDiscount(rule, subtotal)
  return { rule, discount }
}

module.exports = { validateDiscount, calculateDiscount }
