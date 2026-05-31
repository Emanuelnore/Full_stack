const express = require('express')
const cors = require('cors')
require('dotenv').config()
const authMiddleware = require('./middleware/auth.middleware')

const app = express()

// Middlewares
app.use(cors())
app.use(express.json())

// Rutas públicas
app.use('/auth', require('./routes/auth.routes'))

// Rutas protegidas
app.use('/sync', authMiddleware, require('./routes/sync.routes'))
app.use('/products', authMiddleware, require('./routes/products.routes'))

// Ruta de prueba
app.get('/', (req, res) => {
  res.json({ message: 'Servidor funcionando ✅' })
})

// Arrancar servidor
const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`)
})