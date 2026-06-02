import { useState, useEffect } from 'react'
import { getProducts, syncProducts } from './services/api'
import ProductCard from './components/ProductCard'
import FilterBar from './components/FilterBar'
import SyncButton from './components/SyncButton'
import Cart from './components/Cart'
import OrdersTable from './components/OrdersTable'

function App() {
  const [view, setView] = useState('catalog') // 'catalog' | 'orders'
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [cart, setCart] = useState([])
  const [ordersRefreshKey, setOrdersRefreshKey] = useState(0)

  const loadProducts = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await getProducts({ status })
      setProducts(data || [])
    } catch {
      setError('Error al cargar productos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadProducts() }, [status])

  const handleSync = async () => {
    setSyncing(true); setMessage(''); setError('')
    try {
      const result = await syncProducts()
      setMessage(result.message)
      await loadProducts()
    } catch {
      setError('Error al sincronizar')
    } finally {
      setSyncing(false)
    }
  }

  // Carrito
  const addToCart = (product) => {
    setCart(prev => {
      const existing = prev.find(i => i.product_id === product.id)
      if (existing) return prev.map(i => i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i)
      return [...prev, { product_id: product.id, title: product.title, price: product.price, quantity: 1 }]
    })
  }
  const updateQty = (product_id, quantity) => {
    if (quantity < 1) return
    setCart(prev => prev.map(i => i.product_id === product_id ? { ...i, quantity } : i))
  }
  const removeFromCart = (product_id) => setCart(prev => prev.filter(i => i.product_id !== product_id))
  const clearCart = () => setCart([])

  // Al crear una orden: refresca productos (stock) y la tabla de órdenes
  const handleOrderCreated = () => {
    loadProducts()
    setOrdersRefreshKey(k => k + 1)
  }

  const filtered = (products || []).filter(p => p.title.toLowerCase().includes(search.toLowerCase()))

  const handleLogout = () => {
    localStorage.removeItem('token')
    window.location.href = '/login'
  }

  const navBtn = (key, label) => (
    <button onClick={() => setView(key)}
      className={`px-4 py-2 rounded-lg font-medium ${
        view === key ? 'bg-purple-600 text-white' : 'bg-white text-gray-700 border border-gray-300'
      }`}>
      {label}
    </button>
  )

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800">🛍️ Order Engine</h1>
          <div className="flex gap-3">
            <SyncButton onSync={handleSync} loading={syncing} />
            <button onClick={handleLogout} className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium">
              Cerrar sesión
            </button>
          </div>
        </div>

        <div className="flex gap-3 mb-6">
          {navBtn('catalog', 'Catálogo')}
          {navBtn('orders', 'Órdenes')}
        </div>

        {message && <div className="bg-green-100 text-green-700 px-4 py-3 rounded-lg mb-4">{message}</div>}
        {error && <div className="bg-red-100 text-red-700 px-4 py-3 rounded-lg mb-4">{error}</div>}

        {view === 'catalog' ? (
          <>
            <FilterBar status={status} onStatusChange={setStatus} search={search} onSearchChange={setSearch} />
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
              <div>
                {loading ? (
                  <div className="text-center text-gray-500 py-20">Cargando productos...</div>
                ) : filtered.length === 0 ? (
                  <div className="text-center text-gray-500 py-20">No hay productos</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                    {filtered.map(p => <ProductCard key={p.id} product={p} onAdd={addToCart} />)}
                  </div>
                )}
              </div>
              <Cart cart={cart} onUpdateQty={updateQty} onRemove={removeFromCart} onClear={clearCart} onOrderCreated={handleOrderCreated} />
            </div>
          </>
        ) : (
          <OrdersTable refreshKey={ordersRefreshKey} onStatusChanged={loadProducts} />
        )}
      </div>
    </div>
  )
}

export default App