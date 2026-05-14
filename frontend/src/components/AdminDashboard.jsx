import { useState, useEffect, useRef } from 'react'

const API = 'http://localhost:8000'
const HUB_COLORS = ['#00c6f7','#f59e0b','#8b5cf6','#10b981','#f43f5e','#06b6d4','#a855f7','#84cc16']

function loadLeaflet(cb) {
  if (window.L) { cb(); return }
  if (!document.getElementById('leaflet-css')) {
    const link = document.createElement('link')
    link.id = 'leaflet-css'
    link.rel = 'stylesheet'
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    document.head.appendChild(link)
  }
  const script = document.createElement('script')
  script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
  script.onload = cb
  document.head.appendChild(script)
}

export default function AdminDashboard() {
  const today = new Date().toISOString().split('T')[0]

  const [selectedDate, setSelectedDate] = useState(today)
  const [activeTab, setActiveTab]       = useState('map')
  const [orders, setOrders]             = useState([])
  const [hubs, setHubs]                 = useState([])
  const [routes, setRoutes]             = useState([])
  const [optimizing, setOptimizing]     = useState(false)
  const [msg, setMsg]                   = useState(null)

  const mapRef       = useRef(null)
  const leafletMap   = useRef(null)
  const markersLayer = useRef(null)

  useEffect(() => {
    loadLeaflet(() => {})
    fetchHubs()
  }, [])

  useEffect(() => {
    fetchOrders()
    fetchRoutes()
  }, [selectedDate])

  useEffect(() => {
    if (activeTab === 'map') {
      setTimeout(() => drawAdminMap(), 100)
    }
  }, [hubs, orders, routes, activeTab])

  // ─── API Calls ───
  async function fetchHubs() {
    try { const r = await fetch(`${API}/hubs`); setHubs(await r.json()) } catch(e) {}
  }

  async function fetchOrders() {
    try { const r = await fetch(`${API}/orders?delivery_date=${selectedDate}`); setOrders(await r.json()) } catch(e) {}
  }

  async function fetchRoutes() {
    try {
      const r = await fetch(`${API}/routes/${selectedDate}`)
      if (r.ok) { const d = await r.json(); setRoutes(d.routes || []) }
      else setRoutes([])
    } catch(e) { setRoutes([]) }
  }

  async function runOptimizer() {
    setOptimizing(true); setMsg(null)
    try {
      const r = await fetch(`${API}/optimize/${selectedDate}`, { method: 'POST' })
      const d = await r.json()
      if (!r.ok) throw new Error(d.detail)
      setMsg({ type: 'success', text: `✓ Optimised! ${d.total_orders} orders → ${d.hubs_used} hub routes` })
      await fetchOrders()
      await fetchRoutes()
    } catch(err) {
      setMsg({ type: 'error', text: err.message })
    } finally {
      setOptimizing(false)
    }
  }

  // ─── Map ───
  function drawAdminMap() {
    const L = window.L
    if (!L || !mapRef.current) return

    if (!leafletMap.current) {
      leafletMap.current = L.map(mapRef.current).setView([12.9716, 77.5946], 11)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OSM' }).addTo(leafletMap.current)
    } else {
      leafletMap.current.invalidateSize()
    }

    if (markersLayer.current) markersLayer.current.clearLayers()
    else markersLayer.current = L.layerGroup().addTo(leafletMap.current)

    // Hub markers
    hubs.forEach((hub, i) => {
      const col = HUB_COLORS[i % HUB_COLORS.length]
      L.circleMarker([hub.lat, hub.lng], { radius: 14, fillColor: col, color: 'white', weight: 2, fillOpacity: 0.9 })
        .bindPopup(`<strong>🏗 ${hub.name}</strong><br>${hub.hub_type}<br>Cap: ${hub.capacity_litres?.toLocaleString()} L`)
        .addTo(markersLayer.current)
    })

    if (routes.length > 0) {
      routes.forEach((route, ri) => {
        const col = HUB_COLORS[ri % HUB_COLORS.length]
        if (route.route_coords?.length > 1) {
          L.polyline(route.route_coords.map(c => [c[0], c[1]]), {
            color: col, weight: 3, opacity: 0.7, dashArray: '6 4',
          }).addTo(markersLayer.current)
        }
        route.stops?.forEach(s => {
          L.circleMarker([s.lat, s.lng], { radius: 9, fillColor: col, color: 'white', weight: 2, fillOpacity: 0.85 })
            .bindPopup(`<strong>Stop #${s.stop_number}</strong><br>${s.citizen_name}<br>${s.address}<br>${s.litres} L`)
            .addTo(markersLayer.current)
        })
      })
    } else {
      orders.forEach(o => {
        const hi  = hubs.findIndex(h => h.id === o.hub_id)
        const col = hi >= 0 ? HUB_COLORS[hi % HUB_COLORS.length] : '#718096'
        L.circleMarker([o.lat, o.lng], { radius: 7, fillColor: col, color: 'white', weight: 1.5, fillOpacity: 0.8 })
          .bindPopup(`<strong>${o.citizen_name}</strong><br>${o.address}<br>${o.litres_needed} L`)
          .addTo(markersLayer.current)
      })
    }
  }

  // ─── Computed ───
  const pendingCount  = orders.filter(o => o.status === 'pending').length
  const assignedCount = orders.filter(o => o.status === 'assigned').length
  const totalKm       = routes.reduce((s, r) => s + (r.total_distance_km || 0), 0)

  return (
    <div className="dashboard">

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'var(--font-head)', fontSize: 28, fontWeight: 800, marginBottom: 6 }}>
          ⚙️ Operations Dashboard
        </h1>
        <p style={{ color: 'var(--text-dim)', fontSize: 15 }}>
          Monitor orders, run route optimisation, and manage all drivers.
        </p>
      </div>

      {/* Controls */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, flexWrap: 'wrap' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label>Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              style={{
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10, padding: '10px 14px', fontSize: 14,
                color: 'var(--text)', fontFamily: 'var(--font-body)',
              }}
            />
          </div>
          <button
            className="btn btn-admin"
            onClick={runOptimizer}
            disabled={optimizing || orders.length === 0}
          >
            {optimizing
              ? <><span className="spin">⚙</span> Optimising...</>
              : `⚡ Run TSP Optimizer (${orders.length} orders)`}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => { fetchOrders(); fetchRoutes() }}>
            ↻ Refresh
          </button>
        </div>
        {msg && (
          <div
            className={`alert alert-${msg.type === 'success' ? 'success' : 'error'}`}
            style={{ marginTop: 12, marginBottom: 0 }}
          >
            {msg.text}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="stats-bar">
        <div className="stat-card">
          <div className="stat-value">{orders.length}</div>
          <div className="stat-label">Total Orders</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--driver-a)' }}>{pendingCount}</div>
          <div className="stat-label">Pending</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--citizen-a)' }}>{assignedCount}</div>
          <div className="stat-label">Assigned</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--success)' }}>
            {routes.length > 0 ? `${totalKm.toFixed(1)} km` : '—'}
          </div>
          <div className="stat-label">Total Route KM</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        {[['map','🗺 Map View'],['routes','🚛 Routes'],['orders','📋 Orders']].map(([id, label]) => (
          <button
            key={id}
            className={`tab${activeTab === id ? ' active' : ''}`}
            onClick={() => setActiveTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Map Tab ── */}
      {activeTab === 'map' && (
        <div className="card">
          <div className="card-title">
            🗺 Order Map — {selectedDate}
            {routes.length > 0 && (
              <span style={{ fontSize: 13, color: 'var(--success)', marginLeft: 8 }}>✓ Optimised routes shown</span>
            )}
            {routes.length === 0 && orders.length > 0 && (
              <span style={{ fontSize: 13, color: 'var(--driver-a)', marginLeft: 8 }}>
                Orders shown — run optimizer for routes
              </span>
            )}
          </div>
          <div ref={mapRef} className="map-container" />
          <div style={{ marginTop: 12, display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 13, color: 'var(--text-dim)' }}>
            {hubs.map((h, i) => (
              <span key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{
                  width: 12, height: 12, borderRadius: '50%',
                  background: HUB_COLORS[i % HUB_COLORS.length], display: 'inline-block',
                }} />
                {h.name.replace('BWSSB ', '').replace(' Depot', '').replace(' Tank', '').replace(' Borewell', '')}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Routes Tab ── */}
      {activeTab === 'routes' && (
        <div className="card">
          <div className="card-title">🚛 Optimised Driver Routes</div>
          <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 18 }}>
            Each card = one driver's full route. Stops ordered to minimise travel distance.
          </p>
          {routes.length === 0 ? (
            <p style={{ color: 'var(--text-dim)', fontSize: 14 }}>Run the optimiser first to see routes here.</p>
          ) : (
            <div className="route-grid">
              {routes.map((route, i) => {
                const col = HUB_COLORS[i % HUB_COLORS.length]
                return (
                  <div key={route.hub_id} className="route-card" style={{ borderLeftColor: col }}>
                    <h3>{route.hub_name}</h3>
                    <div className="route-stat"><span>Stops</span><strong>{route.total_stops}</strong></div>
                    <div className="route-stat"><span>Distance</span><strong>{route.total_distance_km} km</strong></div>
                    <div className="route-stat"><span>Fuel est.</span><strong>{route.estimated_fuel_litres} L diesel</strong></div>
                    <div className="route-stat">
                      <span>Time est.</span>
                      <strong>~{(route.estimated_time_minutes || 0) + route.total_stops * 10} min</strong>
                    </div>
                    <div className="stop-list">
                      {(route.stops || []).map(s => (
                        <div key={s.order_id} className="stop-item">
                          <div className="stop-num" style={{ background: col, color: 'var(--ocean-deep)' }}>
                            {s.stop_number}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600 }}>{s.citizen_name}</div>
                            <div style={{ color: 'var(--text-dim)' }}>{s.address}</div>
                            <div style={{ color: 'var(--text-dim)' }}>
                              {s.litres} L · {s.distance_from_prev_km} km from prev
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Orders Tab ── */}
      {activeTab === 'orders' && (
        <div className="card">
          <div className="card-title">📋 All Orders — {selectedDate}</div>
          <div className="overflow-x">
            <table>
              <thead>
                <tr>
                  <th>#</th><th>Citizen</th><th>Address</th><th>Litres</th>
                  <th>Hub</th><th>Hub Dist</th><th>Stop</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ color: 'var(--text-dim)', textAlign: 'center', padding: 24 }}>
                      No orders for this date.
                    </td>
                  </tr>
                ) : orders.map(o => {
                  const hub = hubs.find(h => h.id === o.hub_id)
                  return (
                    <tr key={o.id}>
                      <td style={{ color: 'var(--cyan)' }}>#{o.id}</td>
                      <td style={{ fontWeight: 500 }}>{o.citizen_name}</td>
                      <td style={{
                        maxWidth: 180, overflow: 'hidden',
                        textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-dim)',
                      }}>
                        {o.address}
                      </td>
                      <td>{o.litres_needed} L</td>
                      <td style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                        {hub ? hub.name.replace('BWSSB ', '') : '—'}
                      </td>
                      <td>{o.hub_distance_km} km</td>
                      <td>{o.stop_order || '—'}</td>
                      <td><span className={`badge badge-${o.status}`}>{o.status}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  )
}