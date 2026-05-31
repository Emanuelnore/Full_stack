const prisma = require('../lib/prisma')

async function listProducts({ page = 1, limit = 50, status }) {
  const where = status ? { status } : {}
  
  const products = await prisma.product.findMany({
    where,
    skip: (page - 1) * limit,
    take: Number(limit),
    orderBy: { synced_at: 'desc' }
  })

  const total = await prisma.product.count({ where })

  return { data: products, page: Number(page), limit: Number(limit), total }
}

async function getProduct(id) {
  return await prisma.product.findUnique({
    where: { id: Number(id) }
  })
}

async function upsertProduct(product) {
  return await prisma.product.upsert({
    where: { shopify_id: product.shopify_id },
    update: { ...product, synced_at: new Date() },
    create: product
  })
}

module.exports = { listProducts, getProduct, upsertProduct }