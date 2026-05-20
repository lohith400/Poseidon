import { useState, useEffect, useRef } from 'react'
import { api, coordsToLatLngs, WS_URL } from '../lib/api'
import { loadLeaflet } from '../lib/mapLoader'
import CrisisDashboard from './CrisisDashboard'
import PageHeader from './PageHeader'

const HUB_COLORS = ['#00c6f7', '#f59e0b', '#8b5cf6', '#10b981', '#f43f5e', '#06b6d4', '#a855f7', '#84cc16']

function routeStops(route) {
  if (route.stops?.length) return route.stops
  return (route.waypoints || [])
    .filter(w => w.type === 'delivery')
    .map(w => ({
      stop_number: w.stop_number,
      order_id: w.order_id,
      citizen_name: w.citizen_name,
      address: w.address,
      lat: w.lat,
      lng: w.lng,
      litres: w.litres_delivered,
      distance_from_prev_km: w.distance_from_prev_km,
    }))
}

export default function AdminDashboard() {
  const today = new Date().toISOString().split('T')[0]
  const [selectedDate, setSelectedDate] = useState(today)
  const [activeTab, setActiveTab] = useState('crisis')
  const [orders, setOrders] = useState([])
  const [hubs, setHubs] = useState([])
  const [routes, setRoutes] = useState([])
  const [tankers, setTankers] = useState([])
  const [optimizing, setOptimizing] = useState(false)
  const [msg, setMsg] = useState(null)

  const mapRef = useRef(null)
  const leafletMap = useRef(null)
  const markersLayer = useRef(null)
  const tankerMarkers = useRef({})

  useEffect(() => {
    loadLeaflet(() => {})
    fetchHubs()
  }, [])

  useEffect(() => {
    fetchOrders()
    fetchRoutes()
  }, [selectedDate])

  useEffect(() => {
    if (activeTab === 'map') setTimeout(() => drawAdminMap(), 150)
  }, [hubs, orders, routes, tankers, activeTab])

  useEffect(() => {
    let ws
    try {
      ws = new WebSocket(WS_URL)
      ws.onmessage = ev => {
        const data = JSON.parse(ev.data)
        if (data.type === 'snapshot') setTankers(data.tankers || [])
        if (data.type === 'position') {
          setTankers(prev => {
            const rest = prev.filter(t => t.driver_id !== data.tanker.driver_id)
            return [...rest, data.tanker]
          })
        }
      }
    } catch (_) {}
    const poll = setInterval(async () => {
      try {
        const d = await api('/tankers/live')
        if (d.tankers?.length) setTankers(d.tankers)
      } catch (_) {}
    }, 15000)
    return () => {
      clearInterval(poll)
      if (ws) ws.close()
    }
  }, [])

  async function fetchHubs() {
    try {
      setHubs(await api('/hubs'))
    } catch (_) {}
  }

  async function fetchOrders() {
    try {
      setOrders(await api(`/orders?delivery_date=${selectedDate}`))
    } catch (_) {}
  }

  async function fetchRoutes() {
    try {
      const d = await api(`/routes/${selectedDate}`)
      setRoutes(d.routes || [])
    } catch (_) {
      setRoutes([])
    }
  }

  async function runOptimizer() {
    setOptimizing(true)
    setMsg(null)
    try {
      const d = await api(`/optimize/${selectedDate}`, { method: 'POST' })
      setMsg({
        type: 'success',
        text: `Optimised ${d.total_orders} orders → ${d.hubs_used} routes (${d.distance_method || 'osrm'})`,
      })
      await fetchOrders()
      await fetchRoutes()
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
    } finally {
      setOptimizing(false)
    }
  }

  function drawAdminMap() {
    const L = window.L
    if (!L || !mapRef.current) return

    if (!leafletMap.current) {
      leafletMap.current = L.map(mapRef.current).setView([12.9716, 77.5946], 11)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OSM',
      }).addTo(leafletMap.current)
    } else {
      leafletMap.current.invalidateSize()
    }

    if (markersLayer.current) markersLayer.current.clearLayers()
    else markersLayer.current = L.layerGroup().addTo(leafletMap.current)

    Object.values(tankerMarkers.current).forEach(m => m.remove())
    tankerMarkers.current = {}

    hubs.forEach((hub, i) => {
      const col = HUB_COLORS[i % HUB_COLORS.length]
      const fill = hub.fill_percent ?? 50
      L.circleMarker([hub.lat, hub.lng], {
        radius: 12,
        fillColor: fill < 30 ? '#ef4444' : col,
        color: 'white',
        weight: 2,
        fillOpacity: 0.9,
      })
        .bindPopup(
          `<strong>${hub.name}</strong><br>Fill: ${fill}%<br>Available: ${(hub.available_litres / 1e6).toFixed(2)}M L`
        )
        .addTo(markersLayer.current)
    })

    if (routes.length > 0) {
      routes.forEach((route, ri) => {
        const col = HUB_COLORS[ri % HUB_COLORS.length]
        const latlngs = coordsToLatLngs(route.route_coords)
        if (latlngs.length > 1) {
          L.polyline(latlngs, { color: col, weight: 3, opacity: 0.7, dashArray: '6 4' }).addTo(
            markersLayer.current
          )
        }
        routeStops(route).forEach(s => {
          L.circleMarker([s.lat, s.lng], {
            radius: 9,
            fillColor: col,
            color: 'white',
            weight: 2,
            fillOpacity: 0.85,
          })
            .bindPopup(`<strong>Stop #${s.stop_number}</strong><br>${s.citizen_name}`)
            .addTo(markersLayer.current)
        })
      })
    } else {
      orders.forEach(o => {
        const hi = hubs.findIndex(h => h.id === o.hub_id)
        const col = hi >= 0 ? HUB_COLORS[hi % HUB_COLORS.length] : '#718096'
        L.circleMarker([o.lat, o.lng], { radius: 7, fillColor: col, color: 'white', weight: 1.5 })
          .bindPopup(`${o.citizen_name}<br>${o.litres_needed} L`)
          .addTo(markersLayer.current)
      })
    }

    tankers.forEach(t => {
      const icon = L.divIcon({
        className: '',
        html: '<div style="font-size:20px">🚛</div>',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      })
      const m = L.marker([t.lat, t.lng], { icon })
        .bindPopup(`<strong>${t.driver_name}</strong><br>Live GPS`)
        .addTo(leafletMap.current)
      tankerMarkers.current[t.driver_id] = m
    })
  }

  const pendingCount = orders.filter(o => o.status === 'pending').length
  const assignedCount = orders.filter(o => o.status === 'assigned').length
  const totalKm = routes.reduce((s, r) => s + (r.total_distance_km || 0), 0)

  const tabs = [
    ['crisis', 'Crisis Intel'],
    ['map', 'Map + Live Tankers'],
    ['routes', 'Routes'],
    ['orders', 'Orders'],
  ]

  return (
    <div className="dashboard">
      <PageHeader
        icon="🌊"
        title="Operations Dashboard"
        subtitle="Forecasting, reservoir heatmaps, OSRM routes, live tanker tracking"
      />

      {activeTab !== 'crisis' && (
        <div className="card">
          <div className="toolbar-row">
            <div className="form-group">
              <label>Date</label>
              <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
            </div>
            <button
              className="btn btn-admin"
              onClick={runOptimizer}
              disabled={optimizing || orders.length === 0}
            >
              {optimizing ? 'Optimising…' : `Run Optimizer (${orders.length})`}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { fetchOrders(); fetchRoutes() }}>
              Refresh
            </button>
          </div>
          {msg && (
            <div className={`alert alert-${msg.type === 'success' ? 'success' : 'error'}`} style={{ marginTop: 12 }}>
              {msg.text}
            </div>
          )}
        </div>
      )}

      {activeTab !== 'crisis' && (
        <div className="stats-bar">
          <div className="stat-card"><div className="stat-value">{orders.length}</div><div className="stat-label">Orders</div></div>
          <div className="stat-card"><div className="stat-value">{pendingCount}</div><div className="stat-label">Pending</div></div>
          <div className="stat-card"><div className="stat-value">{tankers.length}</div><div className="stat-label">Live tankers</div></div>
          <div className="stat-card"><div className="stat-value">{routes.length ? `${totalKm.toFixed(1)} km` : '—'}</div><div className="stat-label">Route km</div></div>
        </div>
      )}

      <div className="tabs">
        {tabs.map(([id, label]) => (
          <button key={id} type="button" className={`tab${activeTab === id ? ' active' : ''}`} onClick={() => setActiveTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'crisis' && <CrisisDashboard />}

      {activeTab === 'map' && (
        <div className="card">
          <div className="card-title">Map — routes & live tankers ({tankers.length} active)</div>
          <div ref={mapRef} className="map-container" />
        </div>
      )}

      {activeTab === 'routes' && (
        <div className="card">
          <div className="card-title">Optimised routes</div>
          {routes.length === 0 ? (
            <p style={{ color: 'var(--text-dim)' }}>Run optimizer first.</p>
          ) : (
            <div className="route-grid">
              {routes.map((route, i) => {
                const col = HUB_COLORS[i % HUB_COLORS.length]
                const stops = routeStops(route)
                return (
                  <div key={route.hub_id} className="route-card" style={{ borderLeftColor: col }}>
                    <h3>{route.hub_name}</h3>
                    {route.driver_id && <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>Driver #{route.driver_id}</p>}
                    <div className="route-stat"><span>Stops</span><strong>{route.total_stops}</strong></div>
                    <div className="route-stat"><span>Refills</span><strong>{route.refill_count || 0}</strong></div>
                    <div className="route-stat"><span>Distance</span><strong>{route.total_distance_km} km</strong></div>
                    <div className="route-stat"><span>Method</span><strong>{route.distance_method || 'osrm'}</strong></div>
                    <div className="stop-list">
                      {stops.map(s => (
                        <div key={s.order_id} className="stop-item">
                          <div className="stop-num" style={{ background: col }}>{s.stop_number}</div>
                          <div>
                            <div style={{ fontWeight: 600 }}>{s.citizen_name}</div>
                            <div style={{ color: 'var(--text-dim)', fontSize: 12 }}>{s.litres} L</div>
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

      {activeTab === 'orders' && (
        <div className="card">
          <div className="card-title">Orders — {selectedDate}</div>
          <div className="overflow-x">
            <table>
              <thead>
                <tr>
                  <th>#</th><th>Citizen</th><th>Address</th><th>Litres</th><th>Hub</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(o => {
                  const hub = hubs.find(h => h.id === o.hub_id)
                  return (
                    <tr key={o.id}>
                      <td>#{o.id}</td>
                      <td>{o.citizen_name}</td>
                      <td>{o.address}</td>
                      <td>{o.litres_needed} L</td>
                      <td style={{ fontSize: 12 }}>{hub?.name || '—'}</td>
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
