const API_BASE = import.meta.env.VITE_API_URL || '/api'
export const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws/tankers'

export function getToken() {
  return localStorage.getItem('poseidon_token')
}

export function setAuth(token, profile) {
  localStorage.setItem('poseidon_token', token)
  if (profile) localStorage.setItem('poseidon_profile', JSON.stringify(profile))
}

export function clearAuth() {
  localStorage.removeItem('poseidon_token')
  localStorage.removeItem('poseidon_profile')
}

export function getProfile() {
  try {
    return JSON.parse(localStorage.getItem('poseidon_profile') || 'null')
  } catch {
    return null
  }
}

export async function api(path, options = {}) {
  const token = getToken()
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  }
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail || data)
    throw new Error(msg || res.statusText)
  }
  return data
}

export async function login(username, password) {
  const data = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
  setAuth(data.access_token, data)
  return data
}

/** Normalise route_coords from API: [[lat,lng],...] or [{lat,lng},...] */
export function coordsToLatLngs(coords) {
  if (!coords?.length) return []
  return coords.map(c => {
    if (Array.isArray(c)) return [c[0], c[1]]
    return [c.lat, c.lng]
  })
}
