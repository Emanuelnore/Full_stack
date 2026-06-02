const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  // --- 3 clientes con tiers distintos ---
  const customers = [
    { name: 'Ana Regular',      email: 'ana@test.com',     tier: 'regular' },
    { name: 'Beatriz VIP',      email: 'beatriz@test.com', tier: 'vip' },
    { name: 'Carlos Mayorista', email: 'carlos@test.com',  tier: 'wholesale' }
  ]

  for (const c of customers) {
    await prisma.customer.upsert({
      where: { email: c.email },
      update: c,
      create: c
    })
  }

  // --- 3 reglas de descuento ---
  const rules = [
    {
      code: 'SAVE20',          // porcentaje, para todos
      type: 'percentage',
      value: 20,               // -20% del subtotal
      min_order_amount: 100,   // ajusta segun los precios de tus productos
      applicable_tier: null,   // null = aplica a cualquier cliente
      max_uses: 100,
      expires_at: null
    },
    {
      code: 'OFF5000',         // monto fijo, para todos
      type: 'fixed',
      value: 5000,             // -$5000 (no puede superar el subtotal)
      min_order_amount: 0,
      applicable_tier: null,
      max_uses: 50,
      expires_at: null
    },
    {
      code: 'VIPONLY',         // exclusivo para clientes vip
      type: 'percentage',
      value: 15,               // -15% del subtotal
      min_order_amount: 0,
      applicable_tier: 'vip',  // solo tier vip; otros -> 403
      max_uses: null,          // usos ilimitados
      expires_at: null
    }
  ]

  for (const r of rules) {
    await prisma.discountRule.upsert({
      where: { code: r.code },
      update: r,
      create: r
    })
  }

  console.log('Seed completado: 3 clientes y 3 reglas de descuento')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
