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
