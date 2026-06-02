const prisma = require('../lib/prisma')

async function listCustomers() {
  return await prisma.customer.findMany({ orderBy: { id: 'asc' } })
}

module.exports = { listCustomers }
