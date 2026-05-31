import axios from 'axios'

const API = axios.create({
  baseURL: 'http://localhost:3001'
})

API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export const getProducts = (params) => API.get('/products', { params })
export const syncProducts = () => API.post('/sync')
export const login = (username, password) => API.post('/auth/login', { username, password })