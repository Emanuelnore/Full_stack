const shopifyService = require('../services/shopify.service')
const productService = require('../services/product.service')

async function sync(req, res) {
  try {
    const products = await shopifyService.fetchProducts()
    
    for (const product of products) {
      await productService.upsertProduct(product)
    }

    res.json({ message: `✅ ${products.length} productos sincronizados` })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al sincronizar con Shopify' })
  }
}

module.exports = { sync }