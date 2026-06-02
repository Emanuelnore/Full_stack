import { useState, useEffect } from 'react'
import { getCustomers, previewOrder, createOrder } from '../services/api'

const Cart = ({ cart, onUpdateQty, onRemove, onClear, onOrderCreated }) => {
  const [customers, setCustomers] = useState([])
  const [customerId, setCustomerId] = useState('')
  const [discountCode, setDiscountCode] = useState('')
  const [preview, setPreview] = useState(null)
  const [previewError, setPreviewError] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [confirmMsg, setConfirmMsg] = useState('')

  // Cargar clientes una vez
useEffect(() => {
  getCustomers().then(setCustomers).catch(err => console.error('Error cargando clientes:', err))
}, [])
  // Preview automatico cuando cambia carrito, cliente o codigo
  useEffect(() => {
    const run = async () => {
      setConfirmMsg('')
      if (cart.length === 0 || !customerId) {
        setPreview(null)
        setPreviewError('')
        return
      }
      try {
        const result = await previewOrder({
          customer_id: Number(customerId),
          items: cart.map(c => ({ product_id: c.product_id, quantity: c.quantity })),
          discount_code: discountCode || undefined
        })
        setPreview(result)
        setPreviewError('')
      } catch (err) {
        setPreview(null)
        setPreviewError(err.response?.data?.message || 'Error al calcular el preview')
      }
    }
    run()
  }, [cart, customerId, discountCode])

  const handleConfirm = async () => {
    setConfirming(true)
    setPreviewError('')
    try {
      const order = await createOrder({
        customer_id: Number(customerId),
        items: cart.map(c => ({ product_id: c.product_id, quantity: c.quantity })),
        discount_code: discountCode || undefined
      })
      setConfirmMsg(`Orden #${order.id} creada`)
      setDiscountCode('')
      onClear()
      onOrderCreated?.()
    } catch (err) {
      setPreviewError(err.response?.data?.message || 'Error al crear la orden')
    } finally {
      setConfirming(false)
    }
  }

  return (
    <div className="bg-white rounded-xl shadow p-5 flex flex-col gap-4 h-fit sticky top-8">
      <h2 className="text-xl font-bold text-gray-800">Carrito</h2>

      <div>
        <label className="block text-sm text-gray-600 mb-1">Cliente</label>
        <select
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400"
        >
          <option value="">Selecciona un cliente</option>
          {customers.map(c => (
            <option key={c.id} value={c.id}>{c.name} ({c.tier})</option>
          ))}
        </select>
      </div>

      {cart.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-4">El carrito esta vacio</p>
      ) : (
        <div className="flex flex-col gap-2">
          {cart.map(item => (
            <div key={item.product_id} className="flex items-center gap-2 text-sm">
              <span className="flex-1 truncate" title={item.title}>{item.title}</span>
              <input
                type="number"
                min="1"
                value={item.quantity}
                onChange={(e) => onUpdateQty(item.product_id, Number(e.target.value))}
                className="w-14 border border-gray-300 rounded px-2 py-1"
              />
              <span className="w-16 text-right">${(item.price * item.quantity).toFixed(2)}</span>
              <button onClick={() => onRemove(item.product_id)} className="text-red-500 hover:text-red-700">x</button>
            </div>
          ))}
        </div>
      )}

      <div>
        <label className="block text-sm text-gray-600 mb-1">Codigo de descuento (opcional)</label>
        <input
          type="text"
          value={discountCode}
          onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
          placeholder="Ej. SAVE20"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400"
        />
      </div>

      {previewError && (
        <div className="bg-red-100 text-red-700 px-3 py-2 rounded-lg text-sm">{previewError}</div>
      )}

      {preview && (
        <div className="border-t pt-3 flex flex-col gap-1 text-sm">
          <div className="flex justify-between"><span>Subtotal</span><span>${preview.subtotal.toFixed(2)}</span></div>
          <div className="flex justify-between text-green-700"><span>Descuento</span><span>-${preview.discount.toFixed(2)}</span></div>
          <div className="flex justify-between font-bold text-base"><span>Total</span><span>${preview.total.toFixed(2)}</span></div>
        </div>
      )}

      {confirmMsg && (
        <div className="bg-green-100 text-green-700 px-3 py-2 rounded-lg text-sm">{confirmMsg}</div>
      )}

      <button
        onClick={handleConfirm}
        disabled={!preview || confirming}
        className={`py-2 rounded-lg text-white font-medium transition-all ${
          !preview || confirming ? 'bg-purple-300 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700'
        }`}
      >
        {confirming ? 'Creando orden...' : 'Confirmar orden'}
      </button>
    </div>
  )
}

export default Cart
