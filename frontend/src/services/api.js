import axios from 'axios'

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL
})

API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// --- Productos ---
export const getProducts = async (params) => {
  const res = await API.get('/products', { params })
  return res.data.data
}

export const syncProducts = async () => {
  const res = await API.post('/sync')
  return res.data.data
}

// --- Auth ---
export const login = async (username, password) => {
  const res = await API.post('/auth/login', { username, password })
  return res.data
}

// --- Clientes ---
export const getCustomers = async () => {
  const res = await API.get('/customers')
  return res.data.data
}

// --- Ordenes ---
export const previewOrder = async (payload) => {
  const res = await API.post('/orders/preview', payload)
  return res.data.data
}

export const createOrder = async (payload) => {
  const res = await API.post('/orders', payload)
  return res.data.data
}

export const getOrders = async (params) => {
  const res = await API.get('/orders', { params })
  return res.data.data   // { orders, pagination }
}

export const updateOrderStatus = async (id, status) => {
  const res = await API.patch(`/orders/${id}/status`, { status })
  return res.data.data
}

export default API
