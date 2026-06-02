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
