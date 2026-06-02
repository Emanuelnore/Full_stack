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
