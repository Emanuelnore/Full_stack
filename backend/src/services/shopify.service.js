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
