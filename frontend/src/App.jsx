import { useState, useEffect } from 'react'
import { getProducts, syncProducts } from './services/api'
import ProductCard from './components/ProductCard'
import FilterBar from './components/FilterBar'
import SyncButton from './components/SyncButton'

function App() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      setError('')
      try {
        await syncProducts()
        const res = await getProducts({ status })
        setProducts(res.data || [])  // ← corregido
      } catch {
        setError('Error al cargar productos')
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [status])

  const handleSync = async () => {
    setSyncing(true)
    setMessage('')
    setError('')
    try {
      const res = await syncProducts()
      setMessage(res.data.message)
      const res2 = await getProducts({ status })
      setProducts(res2.data || [])  // ← corregido
    } catch {
      setError('Error al sincronizar')
    } finally {
      setSyncing(false)
    }
  }

  const filtered = (products || []).filter(p =>
    p.title.toLowerCase().includes(search.toLowerCase())
  )

  const handleLogout = () => {
    localStorage.removeItem('token')
    window.location.href = '/login'
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">

        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">
            🛍️ Catálogo de Productos
          </h1>
          <div className="flex gap-3">
            <SyncButton onSync={handleSync} loading={syncing} />
            <button
              onClick={handleLogout}
              className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium"
            >
              Cerrar sesión
            </button>
          </div>
        </div>

        {message && (
          <div className="bg-green-100 text-green-700 px-4 py-3 rounded-lg mb-4">
            {message}
          </div>
        )}
        {error && (
          <div className="bg-red-100 text-red-700 px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        <FilterBar
          status={status}
          onStatusChange={setStatus}
          search={search}
          onSearchChange={setSearch}
        />

        {loading ? (
          <div className="text-center text-gray-500 py-20">
            Cargando productos...
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-gray-500 py-20">
            No hay productos
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filtered.map(p => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}

      </div>
    </div>
  )
}

export default App