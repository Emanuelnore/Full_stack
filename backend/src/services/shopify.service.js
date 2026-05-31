const axios = require('axios')
require('dotenv').config()

async function fetchProducts() {
  const { data } = await axios.get(
    `${process.env.SHOPIFY_STORE_URL}/admin/api/2023-10/products.json?limit=50`,
    { headers: { 'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN } }
  )

  return data.products.map(p => ({
    shopify_id: String(p.id),
    title: p.title,
    status: p.status,
    vendor: p.vendor,
    price: p.variants?.[0]?.price || '0',
    inventory_quantity: p.variants?.reduce((acc, v) => acc + (v.inventory_quantity || 0), 0),
    image_url: p.image?.src || null
  }))
}

module.exports = { fetchProducts }