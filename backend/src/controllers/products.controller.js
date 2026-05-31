const productService = require('../services/product.service')

async function listProducts(req, res) {
  try {
    const { page, limit, status } = req.query
    const result = await productService.listProducts({ page, limit, status })
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener productos' })
  }
}

async function getProduct(req, res) {
  try {
    const product = await productService.getProduct(req.params.id)
    if (!product) return res.status(404).json({ error: 'Producto no encontrado' })
    res.json(product)
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener producto' })
  }
}

module.exports = { listProducts, getProduct }