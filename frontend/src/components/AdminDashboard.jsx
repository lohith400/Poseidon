import { useState, useEffect, useRef } from 'react'

const API = 'http://localhost:8000'

// Colors for different hubs on the map
const HUB_COLORS = ['#e53e3e', '#dd6b20', '#d69e2e', '#38a169', '#3182ce', '#805ad5', '#d53f8c', '#319795']

export default function AdminDashboard() {
  const today = new Date().toISOString().split('T')[0]
  const [selectedDate, setSelectedDate] = useState(today)
  const [orders, setOrders] = useState([])
  const [hubs, setHubs] = useState([])
  const [routes, setRoutes] = useState([])
  const [loading, setLoading] = useState(false)
  const [optimizing, setOptimizing] = useState(false)
  const [msg, setMsg] = useState(null)
  const mapRef = useRef(null)
  const leafletMap = useRef(null)
  const markersLayer = useRef(null)

  useEffect(() => {
    fetchHubs()
  }, [])

  useEffect(() => {
    fetchOrders()
    fetchRoutes()
  }, [selectedDate])

  useEffect(() => {
    if (hubs.length > 0 || orders.length > 0) {
      initMap()
    }
  }, [hubs, orders, routes])

  async function fetchHubs() {
    const res = await fetch(`${API}/hubs`)
    const data = await res.json()
    setHubs(data)
  }

  async function fetchOrders() {
    const res = await fetch(`${API}/orders?delivery_date=${selectedDate}`)
    const data = await res.json()
    setOrders(data)
  }

  async function fetchRoutes() {
    try {
      const res = await fetch(`${API}/routes/${selectedDate}`)
      if (res.ok) {
        const data = await res.json()
        setRoutes(data.routes || [])
      } else {
        setRoutes([])
      }
    } catch {
      setRoutes([])
    }
  }

  async function runOptimizer() {
    setOptimizing(true)
    setMsg(null)
    try {
      const res = await fetch(`${API}/optimize/${selectedDate}`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail)
      setMsg({ type: 'success', text: `✓ Optimized! ${data.total_orders} orders → ${data.hubs_used} hub routes` })
      await fetchOrders()
      await fetchRoutes()
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
    } finally {
      setOptimizing(false)
    }
  }

  function initMap() {
    if (typeof window === 'undefined') return

    // Dynamically load Leaflet
    if (!window.L) {
      const script = document.createElement('script')
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
      script.onload = () => drawMap()
      document.head.appendChild(script)
    } else {
      drawMap()
    }
  }

  function drawMap() {
    const L = window.L
    if (!L || !mapRef.current) return

    // Init map centered on Bengaluru
    if (!leafletMap.current) {
      leafletMap.current = L.map(mapRef.current).setView([12.9716, 77.5946], 11)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(leafletMap.current)
    }

    // Clear existing layers
    if (markersLayer.current) {
      markersLayer.current.clearLayers()
    } else {
      markersLayer.current = L.layerGroup().addTo(leafletMap.current)
    }

    const layer = markersLayer.current

    // Draw hub markers (large blue circles)
    hubs.forEach((hub, i) => {
      const color = HUB_COLORS[i % HUB_COLORS.length]
      L.circleMarker([hub.lat, hub.lng], {
        radius: 14,
        fillColor: color,
        color: 'white',
        weight: 2,
        fillOpacity: 0.9,
      })
      .bindPopup(`<strong>🏗 ${hub.name}</strong><br>${hub.hub_type}<br>Capacity: ${hub.capacity_litres.toLocaleString()} L`)
      .addTo(layer)
    })

    // If we have optimized routes, draw them
    if (routes.length > 0) {
      routes.forEach((route, ri) => {
        const color = HUB_COLORS[ri % HUB_COLORS.length]

        // Draw route polyline: hub → stop1 → stop2 → ...
        if (route.route_coords && route.route_coords.length > 1) {
          const latlngs = route.route_coords.map(c => [c[0], c[1]])
          L.polyline(latlngs, {
            color,
            weight: 3,
            opacity: 0.7,
            dashArray: '6 4',
          }).addTo(layer)
        }

        // Draw stop markers with stop number
        route.stops && route.stops.forEach(stop => {
          L.circleMarker([stop.lat, stop.lng], {
            radius: 9,
            fillColor: color,
            color: 'white',
            weight: 2,
            fillOpacity: 0.85,
          })
          .bindPopup(`
            <strong>Stop #${stop.stop_number}</strong><br>
            ${stop.citizen_name}<br>
            ${stop.address}<br>
            ${stop.litres} L<br>
            ${stop.distance_from_prev_km} km from prev stop
          `)
          .addTo(layer)
        })
      })
    } else {
      // No routes yet — just draw order dots
      orders.forEach(order => {
        const hub = hubs.find(h => h.id === order.hub_id)
        const hi = hubs.indexOf(hub)
        const color = hi >= 0 ? HUB_COLORS[hi % HUB_COLORS.length] : '#718096'

        L.circleMarker([order.lat, order.lng], {
          radius: 7,
          fillColor: color,
          color: 'white',
          weight: 1.5,
          fillOpacity: 0.8,
        })
        .bindPopup(`<strong>${order.citizen_name}</strong><br>${order.address}<br>${order.litres_needed} L<br>Hub dist: ${order.hub_distance_km} km`)
        .addTo(layer)
      })
    }
  }

  const pendingCount = orders.filter(o => o.status === 'pending').length
  const assignedCount = orders.filter(o => o.status === 'assigned').length
  const deliveredCount = orders.filter(o => o.status === 'delivered').length
  const totalKm = routes.reduce((s, r) => s + (r.total_distance_km || 0), 0)

  return (
    <div>
      {/* Stats bar */}
      <div className="stats-bar">
        <div className="stat-card">
          <div className="value">{orders.length}</div>
          <div className="label">Total Orders</div>
        </div>
        <div className="stat-card">
          <div className="value" style={{ color: '#d69e2e' }}>{pendingCount}</div>
          <div className="label">Pending</div>
        </div>
        <div className="stat-card">
          <div className="value" style={{ color: '#3182ce' }}>{assignedCount}</div>
          <div className="label">Assigned</div>
        </div>
        <div className="stat-card">
          <div className="value" style={{ color: '#38a169' }}>{routes.length > 0 ? `${totalKm.toFixed(1)} km` : '—'}</div>
          <div className="label">Total Route Distance</div>
        </div>
      </div>

      {/* Controls */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <label>Date:</label>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              style={{ padding: '6px 10px', border: '1.5px solid #e2e8f0', borderRadius: 8 }}
            />
          </div>

          <button
            className="btn btn-orange"
            onClick={runOptimizer}
            disabled={optimizing || orders.length === 0}
          >
            {optimizing ? '⚙ Optimizing...' : `⚡ Run TSP Optimizer (${orders.length} orders)`}
          </button>

          <button className="btn btn-primary btn-sm" onClick={() => { fetchOrders(); fetchRoutes() }}>
            ↻ Refresh
          </button>
        </div>

        {msg && (
          <div className={`alert alert-${msg.type === 'success' ? 'success' : 'error'}`} style={{ marginTop: 12, marginBottom: 0 }}>
            {msg.text}
          </div>
        )}
      </div>

      {/* Map */}
      <div className="card">
        <h2>
          🗺 Order Map — {selectedDate}
          {routes.length > 0 && <span style={{ fontSize: 13, color: '#38a169', marginLeft: 12 }}>✓ Optimized routes shown</span>}
          {routes.length === 0 && orders.length > 0 && <span style={{ fontSize: 13, color: '#dd6b20', marginLeft: 12 }}>Orders shown (click Optimizer to get routes)</span>}
        </h2>

        <div ref={mapRef} className="map-container" />

        <div style={{ marginTop: 12, fontSize: 13, color: '#718096', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {hubs.map((h, i) => (
            <span key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 12, height: 12, borderRadius: '50%', background: HUB_COLORS[i % HUB_COLORS.length], display: 'inline-block' }} />
              {h.name.replace('BWSSB ', '').replace(' Depot', '').replace(' Tank', '')}
            </span>
          ))}
        </div>
      </div>

      {/* Optimized routes detail */}
      {routes.length > 0 && (
        <div className="card">
          <h2>🚛 Optimized Driver Routes</h2>
          <p style={{ fontSize: 13, color: '#718096', marginBottom: 16 }}>
            Each card = one driver's full route for the day. Stops ordered to minimize travel distance.
          </p>
          <div className="route-grid">
            {routes.map((route, i) => (
              <div key={route.hub_id} className="route-card" style={{ borderLeftColor: HUB_COLORS[i % HUB_COLORS.length] }}>
                <h3>{route.hub_name}</h3>
                <div className="route-stat">
                  <span>Stops</span>
                  <strong>{route.total_stops}</strong>
                </div>
                <div className="route-stat">
                  <span>Total distance</span>
                  <strong>{route.total_distance_km} km</strong>
                </div>
                <div className="route-stat">
                  <span>Fuel est.</span>
                  <strong>{route.estimated_fuel_litres} L diesel</strong>
                </div>
                <div className="route-stat">
                  <span>Time est.</span>
                  <strong>~{route.estimated_time_minutes + route.total_stops * 10} min</strong>
                </div>

                <div className="stop-list">
                  {route.stops && route.stops.map(stop => (
                    <div key={stop.order_id} className="stop-item">
                      <div className="stop-num">{stop.stop_number}</div>
                      <div>
                        <div style={{ fontWeight: 600 }}>{stop.citizen_name}</div>
                        <div style={{ color: '#718096' }}>{stop.address}</div>
                        <div style={{ color: '#4a5568' }}>{stop.litres} L · {stop.distance_from_prev_km} km from prev</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Orders table */}
      <div className="card">
        <h2>📋 All Orders — {selectedDate}</h2>
        {orders.length === 0 ? (
          <p style={{ color: '#718096', fontSize: 14 }}>No orders for this date.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Citizen</th>
                  <th>Address</th>
                  <th>Litres</th>
                  <th>Hub</th>
                  <th>Hub Dist</th>
                  <th>Stop#</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(o => {
                  const hub = hubs.find(h => h.id === o.hub_id)
                  return (
                    <tr key={o.id}>
                      <td>{o.id}</td>
                      <td>{o.citizen_name}</td>
                      <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.address}</td>
                      <td>{o.litres_needed} L</td>
                      <td style={{ fontSize: 12 }}>{hub ? hub.name.replace('BWSSB ', '') : '—'}</td>
                      <td>{o.hub_distance_km} km</td>
                      <td>{o.stop_order || '—'}</td>
                      <td><span className={`badge badge-${o.status}`}>{o.status}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}