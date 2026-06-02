const prisma = require('../lib/prisma')
const { appError } = require('../lib/appError')
const { validateDiscount } = require('./discount.service')

const round2 = (n) => Math.round(n * 100) / 100

// Nucleo compartido por preview y create:
// trae cliente y productos reales de la DB, arma el subtotal y aplica el descuento.
// NO persiste nada ni toca stock.
async function buildOrderCalculation({ customer_id, items, discount_code }) {
  const customer = await prisma.customer.findUnique({ where: { id: Number(customer_id) } })
  if (!customer) {
    throw appError(404, 'CUSTOMER_NOT_FOUND', `Cliente ${customer_id} no encontrado`)
  }

  if (!Array.isArray(items) || items.length === 0) {
    throw appError(400, 'EMPTY_ITEMS', 'La orden debe tener al menos un producto')
  }

  // Traemos todos los productos de una sola consulta
  const productIds = items.map(i => Number(i.product_id))
  const products = await prisma.product.findMany({ where: { id: { in: productIds } } })
  const productMap = Object.fromEntries(products.map(p => [p.id, p]))

  const lineItems = items.map(i => {
    const product = productMap[Number(i.product_id)]
    if (!product) {
      throw appError(404, 'PRODUCT_NOT_FOUND', `Producto ${i.product_id} no encontrado`)
    }
    const quantity = Number(i.quantity)
    if (!quantity || quantity <= 0) {
      throw appError(400, 'INVALID_QUANTITY', `Cantidad invalida para el producto ${i.product_id}`)
    }
    return { product, quantity, price: product.price } // price = snapshot del precio actual
  })

  const subtotal = round2(lineItems.reduce((acc, li) => acc + li.price * li.quantity, 0))

  let discount = 0
  let rule = null
  if (discount_code) {
    const result = await validateDiscount(discount_code, customer, subtotal)
    rule = result.rule
    discount = round2(result.discount)
  }

  const total = round2(subtotal - discount)
  return { customer, lineItems, subtotal, discount, total, rule }
}

// POST /orders/preview - calcula sin persistir
async function previewOrder({ customer_id, items, discount_code }) {
  const calc = await buildOrderCalculation({ customer_id, items, discount_code })
  return {
    customer_id: calc.customer.id,
    subtotal: calc.subtotal,
    discount: calc.discount,
    total: calc.total,
    discount_code: calc.rule ? calc.rule.code : null,
    items: calc.lineItems.map(li => ({
      product_id: li.product.id,
      title: li.product.title,
      quantity: li.quantity,
      price: li.price,
      line_total: round2(li.price * li.quantity)
    }))
  }
}

// POST /orders - crea la orden de forma ATOMICA (todo o nada)
async function createOrder({ customer_id, items, discount_code }) {
  const calc = await buildOrderCalculation({ customer_id, items, discount_code })

  return await prisma.$transaction(async (tx) => {
    // 1. Releer stock DENTRO de la transaccion y verificar TODOS los items
    const productIds = calc.lineItems.map(li => li.product.id)
    const fresh = await tx.product.findMany({ where: { id: { in: productIds } } })
    const stockMap = Object.fromEntries(fresh.map(p => [p.id, p.stock]))

    const insufficient = []
    for (const li of calc.lineItems) {
      if (stockMap[li.product.id] < li.quantity) {
        insufficient.push({
          product_id: li.product.id,
          title: li.product.title,
          requested: li.quantity,
          available: stockMap[li.product.id]
        })
      }
    }
    // Si algun producto no alcanza, lanzamos error -> la transaccion hace rollback
    if (insufficient.length > 0) {
      throw appError(409, 'INSUFFICIENT_STOCK', 'Stock insuficiente para uno o mas productos', insufficient)
    }

    // 2. Descontar stock
    for (const li of calc.lineItems) {
      await tx.product.update({
        where: { id: li.product.id },
        data: { stock: { decrement: li.quantity } }
      })
    }

    // 3. Crear la orden con sus items (snapshot de precios)
    const order = await tx.order.create({
      data: {
        customer_id: Number(customer_id),
        discount_rule_id: calc.rule ? calc.rule.id : null,
        subtotal: calc.subtotal,
        discount: calc.discount,
        total: calc.total,
        status: 'pending',
        items: {
          create: calc.lineItems.map(li => ({
            product_id: li.product.id,
            quantity: li.quantity,
            price: li.price
          }))
        }
      },
      include: { items: true, customer: true }
    })

    // 4. Si se uso un descuento, incrementar su contador de usos
    if (calc.rule) {
      await tx.discountRule.update({
        where: { id: calc.rule.id },
        data: { uses_count: { increment: 1 } }
      })
    }

    return order
  })
}

// GET /orders - listado con filtros y paginacion
async function listOrders({ status, customer_id, page = 1, limit = 10 }) {
  const where = {}
  if (status) where.status = status
  if (customer_id) where.customer_id = Number(customer_id)

  const skip = (Number(page) - 1) * Number(limit)

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: { customer: true, items: { include: { product: true } } },
      orderBy: { created_at: 'desc' },
      skip,
      take: Number(limit)
    }),
    prisma.order.count({ where })
  ])

  return {
    orders,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      pages: Math.ceil(total / Number(limit))
    }
  }
}

// PATCH /orders/:id/status - cambia estado; al cancelar restaura stock
async function updateOrderStatus(id, newStatus) {
  const validStatuses = ['pending', 'confirmed', 'cancelled']
  if (!validStatuses.includes(newStatus)) {
    throw appError(400, 'INVALID_STATUS', `Status invalido: ${newStatus}`)
  }

  const order = await prisma.order.findUnique({
    where: { id: Number(id) },
    include: { items: true }
  })
  if (!order) {
    throw appError(404, 'ORDER_NOT_FOUND', `Orden ${id} no encontrada`)
  }

  // Transiciones permitidas
  const transitions = {
    pending: ['confirmed', 'cancelled'],
    confirmed: ['cancelled'],
    cancelled: []
  }
  if (!transitions[order.status].includes(newStatus)) {
    throw appError(400, 'INVALID_TRANSITION', `No se puede pasar de "${order.status}" a "${newStatus}"`)
  }

  return await prisma.$transaction(async (tx) => {
    // Al cancelar, devolvemos el stock que se habia descontado
    if (newStatus === 'cancelled') {
      for (const item of order.items) {
        await tx.product.update({
          where: { id: item.product_id },
          data: { stock: { increment: item.quantity } }
        })
      }
    }

    return await tx.order.update({
      where: { id: Number(id) },
      data: { status: newStatus },
      include: { items: true, customer: true }
    })
  })
}

module.exports = {
  buildOrderCalculation,
  previewOrder,
  createOrder,
  listOrders,
  updateOrderStatus
}
