#!/usr/bin/env bash
# Recrea todos los archivos nuevos/modificados del Order Engine Challenge.
# Ejecutar desde la RAIZ del proyecto (la carpeta Full_stack/).
set -e

echo "Creando archivos del Order Engine..."

mkdir -p "backend/prisma"
cat > "backend/prisma/schema.prisma" << 'CLAUDE_FILE_EOF'
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Product {
  id         Int      @id @default(autoincrement())
  shopify_id String   @unique
  title      String
  status     String   // active | draft | archived
  vendor     String?
  price      Float    // antes era String; ahora Float para poder calcular
  stock      Int      @default(0) // inventory_quantity de la 1ra variante
  image_url  String?
  synced_at  DateTime @default(now())

  order_items OrderItem[]
}

model Customer {
  id         Int      @id @default(autoincrement())
  name       String
  email      String   @unique
  tier       String   @default("regular") // regular | vip | wholesale
  created_at DateTime @default(now())

  orders     Order[]
}

model DiscountRule {
  id               Int       @id @default(autoincrement())
  code             String    @unique
  type             String    // percentage | fixed
  value            Float     // % (ej. 20) o monto fijo (ej. 5000) segun type
  min_order_amount Float     @default(0)
  applicable_tier  String?   // null = aplica a todos; o regular | vip | wholesale
  max_uses         Int?      // null = usos ilimitados
  uses_count       Int       @default(0)
  expires_at       DateTime?
  created_at       DateTime  @default(now())

  orders           Order[]
}

model Order {
  id               Int           @id @default(autoincrement())
  customer_id      Int
  customer         Customer      @relation(fields: [customer_id], references: [id])
  discount_rule_id Int?
  discount_rule    DiscountRule? @relation(fields: [discount_rule_id], references: [id])
  subtotal         Float
  discount         Float         @default(0)
  total            Float
  status           String        @default("pending") // pending | confirmed | cancelled
  created_at       DateTime      @default(now())

  items            OrderItem[]
}

model OrderItem {
  id         Int     @id @default(autoincrement())
  order_id   Int
  order      Order   @relation(fields: [order_id], references: [id])
  product_id Int
  product    Product @relation(fields: [product_id], references: [id])
  quantity   Int
  price      Float   // precio "congelado" al momento de crear la orden

  @@index([order_id])
}
CLAUDE_FILE_EOF
echo "  ok backend/prisma/schema.prisma"

mkdir -p "backend/prisma"
cat > "backend/prisma/seed.js" << 'CLAUDE_FILE_EOF'
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  // --- 3 clientes con tiers distintos ---
  const customers = [
    { name: 'Ana Regular',      email: 'ana@test.com',     tier: 'regular' },
    { name: 'Beatriz VIP',      email: 'beatriz@test.com', tier: 'vip' },
    { name: 'Carlos Mayorista', email: 'carlos@test.com',  tier: 'wholesale' }
  ]

  for (const c of customers) {
    await prisma.customer.upsert({
      where: { email: c.email },
      update: c,
      create: c
    })
  }

  // --- 3 reglas de descuento ---
  const rules = [
    {
      code: 'SAVE20',          // porcentaje, para todos
      type: 'percentage',
      value: 20,               // -20% del subtotal
      min_order_amount: 100,   // ajusta segun los precios de tus productos
      applicable_tier: null,   // null = aplica a cualquier cliente
      max_uses: 100,
      expires_at: null
    },
    {
      code: 'OFF5000',         // monto fijo, para todos
      type: 'fixed',
      value: 5000,             // -$5000 (no puede superar el subtotal)
      min_order_amount: 0,
      applicable_tier: null,
      max_uses: 50,
      expires_at: null
    },
    {
      code: 'VIPONLY',         // exclusivo para clientes vip
      type: 'percentage',
      value: 15,               // -15% del subtotal
      min_order_amount: 0,
      applicable_tier: 'vip',  // solo tier vip; otros -> 403
      max_uses: null,          // usos ilimitados
      expires_at: null
    }
  ]

  for (const r of rules) {
    await prisma.discountRule.upsert({
      where: { code: r.code },
      update: r,
      create: r
    })
  }

  console.log('Seed completado: 3 clientes y 3 reglas de descuento')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
CLAUDE_FILE_EOF
echo "  ok backend/prisma/seed.js"

mkdir -p "backend/src/controllers"
cat > "backend/src/controllers/customers.controller.js" << 'CLAUDE_FILE_EOF'
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
CLAUDE_FILE_EOF
echo "  ok backend/src/controllers/customers.controller.js"

mkdir -p "backend/src/controllers"
cat > "backend/src/controllers/discounts.controller.js" << 'CLAUDE_FILE_EOF'
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
CLAUDE_FILE_EOF
echo "  ok backend/src/controllers/discounts.controller.js"

mkdir -p "backend/src/controllers"
cat > "backend/src/controllers/orders.controller.js" << 'CLAUDE_FILE_EOF'
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
CLAUDE_FILE_EOF
echo "  ok backend/src/controllers/orders.controller.js"

mkdir -p "backend/src/controllers"
cat > "backend/src/controllers/products.controller.js" << 'CLAUDE_FILE_EOF'
const productService = require('../services/product.service')

async function listProducts(req, res) {
  try {
    const { status } = req.query
    const products = await productService.listProducts({ status })
    res.json({ success: true, data: products })
  } catch (err) {
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: 'Error al obtener productos' })
  }
}

async function getProduct(req, res) {
  try {
    const product = await productService.getProduct(req.params.id)
    if (!product) {
      return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Producto no encontrado' })
    }
    res.json({ success: true, data: product })
  } catch (err) {
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: 'Error al obtener producto' })
  }
}

module.exports = {
  listProducts,
  getProduct
}
CLAUDE_FILE_EOF
echo "  ok backend/src/controllers/products.controller.js"

mkdir -p "backend/src/controllers"
cat > "backend/src/controllers/sync.controller.js" << 'CLAUDE_FILE_EOF'
const shopifyService = require('../services/shopify.service')
const productService = require('../services/product.service')

async function sync(req, res) {
  try {
    const products = await shopifyService.fetchProducts()
    const summary = await productService.syncProducts(products)

    res.json({
      success: true,
      data: {
        message: `${summary.total} productos sincronizados`,
        created: summary.created,
        updated: summary.updated,
        total: summary.total
      }
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({
      success: false,
      error: 'SYNC_FAILED',
      message: 'Error al sincronizar con Shopify'
    })
  }
}

module.exports = { sync }
CLAUDE_FILE_EOF
echo "  ok backend/src/controllers/sync.controller.js"

mkdir -p "backend/src"
cat > "backend/src/index.js" << 'CLAUDE_FILE_EOF'
const express = require('express')
const cors = require('cors')
require('dotenv').config()
const authMiddleware = require('./middleware/auth.middleware')

const app = express()

app.use(cors())
app.use(express.json())

// Rutas publicas
app.use('/auth', require('./routes/auth.routes'))

// Rutas protegidas
app.use('/sync', authMiddleware, require('./routes/sync.routes'))
app.use('/products', authMiddleware, require('./routes/products.routes'))
app.use('/orders', authMiddleware, require('./routes/orders.routes'))
app.use('/discounts', authMiddleware, require('./routes/discounts.routes'))
app.use('/customers', authMiddleware, require('./routes/customers.routes'))

app.get('/', (req, res) => {
  res.json({ message: 'Servidor funcionando' })
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`)
})
CLAUDE_FILE_EOF
echo "  ok backend/src/index.js"

mkdir -p "backend/src/lib"
cat > "backend/src/lib/appError.js" << 'CLAUDE_FILE_EOF'
function appError(status, code, message, details = null) {
  const err = new Error(message)
  err.status = status
  err.code = code
  err.details = details
  return err
}

// Traduce un error (AppError o inesperado) a la respuesta JSON consistente
function sendError(res, err) {
  if (err.status) {
    return res.status(err.status).json({
      success: false,
      error: err.code,
      message: err.message,
      ...(err.details ? { details: err.details } : {})
    })
  }
  // Error no controlado -> 500
  console.error(err)
  return res.status(500).json({
    success: false,
    error: 'INTERNAL_ERROR',
    message: 'Error interno del servidor'
  })
}

module.exports = { appError, sendError }
CLAUDE_FILE_EOF
echo "  ok backend/src/lib/appError.js"

mkdir -p "backend/src/routes"
cat > "backend/src/routes/customers.routes.js" << 'CLAUDE_FILE_EOF'
const express = require('express')
const router = express.Router()
const ctrl = require('../controllers/customers.controller')

router.get('/', ctrl.list)

module.exports = router
CLAUDE_FILE_EOF
echo "  ok backend/src/routes/customers.routes.js"

mkdir -p "backend/src/routes"
cat > "backend/src/routes/discounts.routes.js" << 'CLAUDE_FILE_EOF'
const express = require('express')
const router = express.Router()
const ctrl = require('../controllers/discounts.controller')

router.post('/validate', ctrl.validate)

module.exports = router
CLAUDE_FILE_EOF
echo "  ok backend/src/routes/discounts.routes.js"

mkdir -p "backend/src/routes"
cat > "backend/src/routes/orders.routes.js" << 'CLAUDE_FILE_EOF'
const express = require('express')
const router = express.Router()
const ctrl = require('../controllers/orders.controller')

router.post('/preview', ctrl.preview)
router.post('/', ctrl.create)
router.get('/', ctrl.list)
router.patch('/:id/status', ctrl.updateStatus)

module.exports = router
CLAUDE_FILE_EOF
echo "  ok backend/src/routes/orders.routes.js"

mkdir -p "backend/src/services"
cat > "backend/src/services/customer.service.js" << 'CLAUDE_FILE_EOF'
const prisma = require('../lib/prisma')

async function listCustomers() {
  return await prisma.customer.findMany({ orderBy: { id: 'asc' } })
}

module.exports = { listCustomers }
CLAUDE_FILE_EOF
echo "  ok backend/src/services/customer.service.js"

mkdir -p "backend/src/services"
cat > "backend/src/services/discount.service.js" << 'CLAUDE_FILE_EOF'
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
CLAUDE_FILE_EOF
echo "  ok backend/src/services/discount.service.js"

mkdir -p "backend/src/services"
cat > "backend/src/services/order.service.js" << 'CLAUDE_FILE_EOF'
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
CLAUDE_FILE_EOF
echo "  ok backend/src/services/order.service.js"

mkdir -p "backend/src/services"
cat > "backend/src/services/product.service.js" << 'CLAUDE_FILE_EOF'
const prisma = require('../lib/prisma')

async function listProducts({ status }) {
  const where = status ? { status } : {}

  return await prisma.product.findMany({
    where,
    orderBy: {
      synced_at: 'desc'
    }
  })
}

async function getProduct(id) {
  return await prisma.product.findUnique({
    where: {
      id: Number(id)
    }
  })
}

async function upsertProduct(product) {
  return await prisma.product.upsert({
    where: {
      shopify_id: product.shopify_id
    },
    update: {
      ...product,
      synced_at: new Date()
    },
    create: product
  })
}

async function syncProducts(products) {
  let created = 0
  let updated = 0

  for (const product of products) {
    const existing = await prisma.product.findUnique({
      where: { shopify_id: product.shopify_id }
    })

    await upsertProduct(product)

    existing ? updated++ : created++
  }

  return { created, updated, total: products.length }
}

module.exports = {
  listProducts,
  getProduct,
  upsertProduct,
  syncProducts
}
CLAUDE_FILE_EOF
echo "  ok backend/src/services/product.service.js"

mkdir -p "backend/src/services"
cat > "backend/src/services/shopify.service.js" << 'CLAUDE_FILE_EOF'
const axios = require('axios')
require('dotenv').config()

async function fetchProducts() {
  const { data } = await axios.get(
    `${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products.json?limit=50`,
    { headers: { 'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN } }
  )

  return data.products.map(p => ({
    shopify_id: String(p.id),
    title: p.title,
    status: p.status,
    vendor: p.vendor || null,
    price: parseFloat(p.variants?.[0]?.price) || 0,           // numero, no string
    stock: Math.max(0, p.variants?.[0]?.inventory_quantity ?? 0), // 1ra variante, nunca negativo
    image_url: p.image?.src || null
  }))
}

module.exports = { fetchProducts }
CLAUDE_FILE_EOF
echo "  ok backend/src/services/shopify.service.js"

mkdir -p "frontend/src"
cat > "frontend/src/App.jsx" << 'CLAUDE_FILE_EOF'
import { useState, useEffect } from 'react'
import { getProducts, syncProducts } from './services/api'
import ProductCard from './components/ProductCard'
import FilterBar from './components/FilterBar'
import SyncButton from './components/SyncButton'
import Cart from './components/Cart'
import OrdersTable from './components/OrdersTable'

function App() {
  const [view, setView] = useState('catalog') // 'catalog' | 'orders'
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [cart, setCart] = useState([])
  const [ordersRefreshKey, setOrdersRefreshKey] = useState(0)

  const loadProducts = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await getProducts({ status })
      setProducts(data || [])
    } catch {
      setError('Error al cargar productos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadProducts() }, [status])

  const handleSync = async () => {
    setSyncing(true); setMessage(''); setError('')
    try {
      const result = await syncProducts()
      setMessage(result.message)
      await loadProducts()
    } catch {
      setError('Error al sincronizar')
    } finally {
      setSyncing(false)
    }
  }

  // Carrito
  const addToCart = (product) => {
    setCart(prev => {
      const existing = prev.find(i => i.product_id === product.id)
      if (existing) return prev.map(i => i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i)
      return [...prev, { product_id: product.id, title: product.title, price: product.price, quantity: 1 }]
    })
  }
  const updateQty = (product_id, quantity) => {
    if (quantity < 1) return
    setCart(prev => prev.map(i => i.product_id === product_id ? { ...i, quantity } : i))
  }
  const removeFromCart = (product_id) => setCart(prev => prev.filter(i => i.product_id !== product_id))
  const clearCart = () => setCart([])

  // Al crear una orden: refresca productos (stock) y la tabla de ordenes
  const handleOrderCreated = () => {
    loadProducts()
    setOrdersRefreshKey(k => k + 1)
  }

  const filtered = (products || []).filter(p => p.title.toLowerCase().includes(search.toLowerCase()))

  const handleLogout = () => {
    localStorage.removeItem('token')
    window.location.href = '/login'
  }

  const navBtn = (key, label) => (
    <button onClick={() => setView(key)}
      className={`px-4 py-2 rounded-lg font-medium ${
        view === key ? 'bg-purple-600 text-white' : 'bg-white text-gray-700 border border-gray-300'
      }`}>
      {label}
    </button>
  )

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800">Order Engine</h1>
          <div className="flex gap-3">
            <SyncButton onSync={handleSync} loading={syncing} />
            <button onClick={handleLogout} className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium">
              Cerrar sesion
            </button>
          </div>
        </div>

        <div className="flex gap-3 mb-6">
          {navBtn('catalog', 'Catalogo')}
          {navBtn('orders', 'Ordenes')}
        </div>

        {message && <div className="bg-green-100 text-green-700 px-4 py-3 rounded-lg mb-4">{message}</div>}
        {error && <div className="bg-red-100 text-red-700 px-4 py-3 rounded-lg mb-4">{error}</div>}

        {view === 'catalog' ? (
          <>
            <FilterBar status={status} onStatusChange={setStatus} search={search} onSearchChange={setSearch} />
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
              <div>
                {loading ? (
                  <div className="text-center text-gray-500 py-20">Cargando productos...</div>
                ) : filtered.length === 0 ? (
                  <div className="text-center text-gray-500 py-20">No hay productos</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                    {filtered.map(p => <ProductCard key={p.id} product={p} onAdd={addToCart} />)}
                  </div>
                )}
              </div>
              <Cart cart={cart} onUpdateQty={updateQty} onRemove={removeFromCart} onClear={clearCart} onOrderCreated={handleOrderCreated} />
            </div>
          </>
        ) : (
          <OrdersTable refreshKey={ordersRefreshKey} onStatusChanged={loadProducts} />
        )}
      </div>
    </div>
  )
}

export default App
CLAUDE_FILE_EOF
echo "  ok frontend/src/App.jsx"

mkdir -p "frontend/src/components"
cat > "frontend/src/components/Cart.jsx" << 'CLAUDE_FILE_EOF'
import { useState, useEffect } from 'react'
import { getCustomers, previewOrder, createOrder } from '../services/api'

const Cart = ({ cart, onUpdateQty, onRemove, onClear, onOrderCreated }) => {
  const [customers, setCustomers] = useState([])
  const [customerId, setCustomerId] = useState('')
  const [discountCode, setDiscountCode] = useState('')
  const [preview, setPreview] = useState(null)
  const [previewError, setPreviewError] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [confirmMsg, setConfirmMsg] = useState('')

  // Cargar clientes una vez
  useEffect(() => {
    getCustomers().then(setCustomers).catch(() => {})
  }, [])

  // Preview automatico cuando cambia carrito, cliente o codigo
  useEffect(() => {
    const run = async () => {
      setConfirmMsg('')
      if (cart.length === 0 || !customerId) {
        setPreview(null)
        setPreviewError('')
        return
      }
      try {
        const result = await previewOrder({
          customer_id: Number(customerId),
          items: cart.map(c => ({ product_id: c.product_id, quantity: c.quantity })),
          discount_code: discountCode || undefined
        })
        setPreview(result)
        setPreviewError('')
      } catch (err) {
        setPreview(null)
        setPreviewError(err.response?.data?.message || 'Error al calcular el preview')
      }
    }
    run()
  }, [cart, customerId, discountCode])

  const handleConfirm = async () => {
    setConfirming(true)
    setPreviewError('')
    try {
      const order = await createOrder({
        customer_id: Number(customerId),
        items: cart.map(c => ({ product_id: c.product_id, quantity: c.quantity })),
        discount_code: discountCode || undefined
      })
      setConfirmMsg(`Orden #${order.id} creada`)
      setDiscountCode('')
      onClear()
      onOrderCreated?.()
    } catch (err) {
      setPreviewError(err.response?.data?.message || 'Error al crear la orden')
    } finally {
      setConfirming(false)
    }
  }

  return (
    <div className="bg-white rounded-xl shadow p-5 flex flex-col gap-4 h-fit sticky top-8">
      <h2 className="text-xl font-bold text-gray-800">Carrito</h2>

      <div>
        <label className="block text-sm text-gray-600 mb-1">Cliente</label>
        <select
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400"
        >
          <option value="">Selecciona un cliente</option>
          {customers.map(c => (
            <option key={c.id} value={c.id}>{c.name} ({c.tier})</option>
          ))}
        </select>
      </div>

      {cart.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-4">El carrito esta vacio</p>
      ) : (
        <div className="flex flex-col gap-2">
          {cart.map(item => (
            <div key={item.product_id} className="flex items-center gap-2 text-sm">
              <span className="flex-1 truncate" title={item.title}>{item.title}</span>
              <input
                type="number"
                min="1"
                value={item.quantity}
                onChange={(e) => onUpdateQty(item.product_id, Number(e.target.value))}
                className="w-14 border border-gray-300 rounded px-2 py-1"
              />
              <span className="w-16 text-right">${(item.price * item.quantity).toFixed(2)}</span>
              <button onClick={() => onRemove(item.product_id)} className="text-red-500 hover:text-red-700">x</button>
            </div>
          ))}
        </div>
      )}

      <div>
        <label className="block text-sm text-gray-600 mb-1">Codigo de descuento (opcional)</label>
        <input
          type="text"
          value={discountCode}
          onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
          placeholder="Ej. SAVE20"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400"
        />
      </div>

      {previewError && (
        <div className="bg-red-100 text-red-700 px-3 py-2 rounded-lg text-sm">{previewError}</div>
      )}

      {preview && (
        <div className="border-t pt-3 flex flex-col gap-1 text-sm">
          <div className="flex justify-between"><span>Subtotal</span><span>${preview.subtotal.toFixed(2)}</span></div>
          <div className="flex justify-between text-green-700"><span>Descuento</span><span>-${preview.discount.toFixed(2)}</span></div>
          <div className="flex justify-between font-bold text-base"><span>Total</span><span>${preview.total.toFixed(2)}</span></div>
        </div>
      )}

      {confirmMsg && (
        <div className="bg-green-100 text-green-700 px-3 py-2 rounded-lg text-sm">{confirmMsg}</div>
      )}

      <button
        onClick={handleConfirm}
        disabled={!preview || confirming}
        className={`py-2 rounded-lg text-white font-medium transition-all ${
          !preview || confirming ? 'bg-purple-300 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700'
        }`}
      >
        {confirming ? 'Creando orden...' : 'Confirmar orden'}
      </button>
    </div>
  )
}

export default Cart
CLAUDE_FILE_EOF
echo "  ok frontend/src/components/Cart.jsx"

mkdir -p "frontend/src/components"
cat > "frontend/src/components/OrdersTable.jsx" << 'CLAUDE_FILE_EOF'
import { useState, useEffect } from 'react'
import { getOrders, updateOrderStatus } from '../services/api'

// Mismas transiciones que el backend, para mostrar solo opciones validas
const TRANSITIONS = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['cancelled'],
  cancelled: []
}

const statusColor = (s) =>
  s === 'confirmed' ? 'bg-green-100 text-green-700'
  : s === 'cancelled' ? 'bg-red-100 text-red-700'
  : 'bg-yellow-100 text-yellow-700'

const OrdersTable = ({ refreshKey, onStatusChanged }) => {
  const [orders, setOrders] = useState([])
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 })
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await getOrders({ status: status || undefined, page, limit: 10 })
      setOrders(data.orders || [])
      setPagination(data.pagination)
    } catch {
      setError('Error al cargar ordenes')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [status, page, refreshKey])

  const handleChangeStatus = async (order, newStatus) => {
    if (!newStatus || newStatus === order.status) return
    setMessage('')
    setError('')
    try {
      await updateOrderStatus(order.id, newStatus)
      setMessage(
        newStatus === 'cancelled'
          ? `Orden #${order.id} cancelada - stock restaurado`
          : `Orden #${order.id} actualizada a "${newStatus}"`
      )
      await load()
      onStatusChanged?.()
    } catch (err) {
      setError(err.response?.data?.message || 'Error al cambiar el estado')
    }
  }

  return (
    <div className="bg-white rounded-xl shadow p-5">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-gray-800">Ordenes</h2>
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1) }}
          className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400"
        >
          <option value="">Todos los estados</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {message && <div className="bg-green-100 text-green-700 px-3 py-2 rounded-lg mb-3 text-sm">{message}</div>}
      {error && <div className="bg-red-100 text-red-700 px-3 py-2 rounded-lg mb-3 text-sm">{error}</div>}

      {loading ? (
        <div className="text-center text-gray-500 py-10">Cargando ordenes...</div>
      ) : orders.length === 0 ? (
        <div className="text-center text-gray-500 py-10">No hay ordenes</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2 px-2">#</th>
                <th className="py-2 px-2">Cliente</th>
                <th className="py-2 px-2">Items</th>
                <th className="py-2 px-2">Subtotal</th>
                <th className="py-2 px-2">Desc.</th>
                <th className="py-2 px-2">Total</th>
                <th className="py-2 px-2">Estado</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id} className="border-b last:border-0">
                  <td className="py-2 px-2 font-medium">{o.id}</td>
                  <td className="py-2 px-2">{o.customer?.name} <span className="text-gray-400">({o.customer?.tier})</span></td>
                  <td className="py-2 px-2">{o.items?.length}</td>
                  <td className="py-2 px-2">${o.subtotal.toFixed(2)}</td>
                  <td className="py-2 px-2 text-green-700">-${o.discount.toFixed(2)}</td>
                  <td className="py-2 px-2 font-semibold">${o.total.toFixed(2)}</td>
                  <td className="py-2 px-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor(o.status)}`}>
                        {o.status}
                      </span>
                      {TRANSITIONS[o.status].length > 0 && (
                        <select
                          value=""
                          onChange={(e) => handleChangeStatus(o, e.target.value)}
                          className="border border-gray-300 rounded px-2 py-1 text-xs"
                        >
                          <option value="">Cambiar...</option>
                          {TRANSITIONS[o.status].map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pagination.pages > 1 && (
        <div className="flex justify-center items-center gap-3 mt-4">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
            className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40">Anterior</button>
          <span className="text-sm text-gray-600">Pagina {pagination.page} de {pagination.pages}</span>
          <button onClick={() => setPage(p => Math.min(pagination.pages, p + 1))} disabled={page >= pagination.pages}
            className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40">Siguiente</button>
        </div>
      )}
    </div>
  )
}

export default OrdersTable
CLAUDE_FILE_EOF
echo "  ok frontend/src/components/OrdersTable.jsx"

mkdir -p "frontend/src/components"
cat > "frontend/src/components/ProductCard.jsx" << 'CLAUDE_FILE_EOF'
const ProductCard = ({ product, onAdd }) => {
  return (
    <div className="bg-white rounded-xl shadow p-4 flex flex-col gap-3 border border-gray-100">
      {product.image_url ? (
        <img src={product.image_url} alt={product.title} className="w-full h-48 object-cover rounded-lg" />
      ) : (
        <div className="w-full h-48 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">
          Sin imagen
        </div>
      )}

      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-gray-800">{product.title}</h2>
        <p className="text-gray-500 text-sm">{product.vendor}</p>
      </div>

      <div className="flex justify-between items-center">
        <span className="text-xl font-bold text-gray-900">${product.price}</span>
        <span className={`text-xs px-3 py-1 rounded-full font-medium ${
          product.status === 'active'
            ? 'bg-green-100 text-green-700'
            : product.status === 'draft'
            ? 'bg-yellow-100 text-yellow-700'
            : 'bg-red-100 text-red-700'
        }`}>
          {product.status}
        </span>
      </div>

      <p className="text-gray-500 text-sm">Stock: {product.stock}</p>

      {onAdd && (
        <button
          onClick={() => onAdd(product)}
          disabled={product.stock <= 0}
          className={`mt-1 py-2 rounded-lg text-white text-sm font-medium transition-all ${
            product.stock <= 0
              ? 'bg-gray-300 cursor-not-allowed'
              : 'bg-purple-600 hover:bg-purple-700'
          }`}
        >
          {product.stock <= 0 ? 'Agotado' : 'Agregar al carrito'}
        </button>
      )}
    </div>
  )
}

export default ProductCard
CLAUDE_FILE_EOF
echo "  ok frontend/src/components/ProductCard.jsx"

mkdir -p "frontend/src/services"
cat > "frontend/src/services/api.js" << 'CLAUDE_FILE_EOF'
import axios from 'axios'

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL
})

API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// --- Productos ---
export const getProducts = async (params) => {
  const res = await API.get('/products', { params })
  return res.data.data
}

export const syncProducts = async () => {
  const res = await API.post('/sync')
  return res.data.data
}

// --- Auth ---
export const login = async (username, password) => {
  const res = await API.post('/auth/login', { username, password })
  return res.data
}

// --- Clientes ---
export const getCustomers = async () => {
  const res = await API.get('/customers')
  return res.data.data
}

// --- Ordenes ---
export const previewOrder = async (payload) => {
  const res = await API.post('/orders/preview', payload)
  return res.data.data
}

export const createOrder = async (payload) => {
  const res = await API.post('/orders', payload)
  return res.data.data
}

export const getOrders = async (params) => {
  const res = await API.get('/orders', { params })
  return res.data.data   // { orders, pagination }
}

export const updateOrderStatus = async (id, status) => {
  const res = await API.patch(`/orders/${id}/status`, { status })
  return res.data.data
}

export default API
CLAUDE_FILE_EOF
echo "  ok frontend/src/services/api.js"

echo ""
echo "Listo. Siguientes pasos:"
echo "  cd backend && npm install && npx prisma migrate dev --name order_engine && node prisma/seed.js"
echo "  cd ../frontend && npm install"

