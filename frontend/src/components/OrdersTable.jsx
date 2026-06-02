import { useState, useEffect } from 'react'
import { getOrders, updateOrderStatus } from '../services/api'

// Mismas transiciones que el backend, para mostrar solo opciones validas
const TRANSITIONS = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['cancelled'],
  cancelled: []
}

const statusColor = (s) =>
  s === 'confirmed' ? 'bg-green-100 text-green-700'
  : s === 'cancelled' ? 'bg-red-100 text-red-700'
  : 'bg-yellow-100 text-yellow-700'

const OrdersTable = ({ refreshKey, onStatusChanged }) => {
  const [orders, setOrders] = useState([])
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 })
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await getOrders({ status: status || undefined, page, limit: 10 })
      setOrders(data.orders || [])
      setPagination(data.pagination)
    } catch {
      setError('Error al cargar ordenes')
    } finally {
      setLoading(false)
    }
  }
// eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [status, page, refreshKey])

  const handleChangeStatus = async (order, newStatus) => {
    if (!newStatus || newStatus === order.status) return
    setMessage('')
    setError('')
    try {
      await updateOrderStatus(order.id, newStatus)
      setMessage(
        newStatus === 'cancelled'
          ? `Orden #${order.id} cancelada - stock restaurado`
          : `Orden #${order.id} actualizada a "${newStatus}"`
      )
      await load()
      onStatusChanged?.()
    } catch (err) {
      setError(err.response?.data?.message || 'Error al cambiar el estado')
    }
  }

  return (
    <div className="bg-white rounded-xl shadow p-5">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-gray-800">Ordenes</h2>
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1) }}
          className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400"
        >
          <option value="">Todos los estados</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {message && <div className="bg-green-100 text-green-700 px-3 py-2 rounded-lg mb-3 text-sm">{message}</div>}
      {error && <div className="bg-red-100 text-red-700 px-3 py-2 rounded-lg mb-3 text-sm">{error}</div>}

      {loading ? (
        <div className="text-center text-gray-500 py-10">Cargando ordenes...</div>
      ) : orders.length === 0 ? (
        <div className="text-center text-gray-500 py-10">No hay ordenes</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2 px-2">#</th>
                <th className="py-2 px-2">Cliente</th>
                <th className="py-2 px-2">Items</th>
                <th className="py-2 px-2">Subtotal</th>
                <th className="py-2 px-2">Desc.</th>
                <th className="py-2 px-2">Total</th>
                <th className="py-2 px-2">Estado</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id} className="border-b last:border-0">
                  <td className="py-2 px-2 font-medium">{o.id}</td>
                  <td className="py-2 px-2">{o.customer?.name} <span className="text-gray-400">({o.customer?.tier})</span></td>
                  <td className="py-2 px-2">{o.items?.length}</td>
                  <td className="py-2 px-2">${o.subtotal.toFixed(2)}</td>
                  <td className="py-2 px-2 text-green-700">-${o.discount.toFixed(2)}</td>
                  <td className="py-2 px-2 font-semibold">${o.total.toFixed(2)}</td>
                  <td className="py-2 px-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor(o.status)}`}>
                        {o.status}
                      </span>
                      {TRANSITIONS[o.status].length > 0 && (
                        <select
                          value=""
                          onChange={(e) => handleChangeStatus(o, e.target.value)}
                          className="border border-gray-300 rounded px-2 py-1 text-xs"
                        >
                          <option value="">Cambiar...</option>
                          {TRANSITIONS[o.status].map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pagination.pages > 1 && (
        <div className="flex justify-center items-center gap-3 mt-4">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
            className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40">Anterior</button>
          <span className="text-sm text-gray-600">Pagina {pagination.page} de {pagination.pages}</span>
          <button onClick={() => setPage(p => Math.min(pagination.pages, p + 1))} disabled={page >= pagination.pages}
            className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40">Siguiente</button>
        </div>
      )}
    </div>
  )
}

export default OrdersTable
