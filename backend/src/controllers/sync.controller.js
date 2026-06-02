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
