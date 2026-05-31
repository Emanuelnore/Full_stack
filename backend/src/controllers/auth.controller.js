const jwt = require('jsonwebtoken')
require('dotenv').config()

const login = (req, res) => {
  const { username, password } = req.body

  if (username !== process.env.ADMIN_USERNAME || password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Credenciales incorrectas' })
  }

  const token = jwt.sign(
    { username },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  )

  res.json({ token })
}

module.exports = { login }