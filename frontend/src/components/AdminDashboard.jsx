import { useState, useEffect, useRef } from 'react'

const API = 'http://localhost:8000'
const HUB_COLORS = ['#00c6f7','#f59e0b','#8b5cf6','#10b981','#f43f5e','#06b6d4','#a855f7','#84cc16','#ef4444','#22c55e','#f97316','#3b82f6']

function loadLeaflet(cb) {
  if (window.L) { cb(); return }
  if (!document.getElementById('leaflet-css')) {
    const link = document.createElement('link')
    link.id = 'leaflet-css'; link.rel = 'stylesheet'
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
  const [drivers, setDrivers]           = useState([])
  const [trucks, setTrucks]             = useState([])
  const [truckStats, setTruckStats]     = useState(null)
  const [optimizing, setOptimizing]     = useState(false)
  const [msg, setMsg]                   = useState(null)
  const [zoneFilter, setZoneFilter]     = useState('All')

  const mapRef       = useRef(null)
  const leafletMap   = useRef(null)
  const markersLayer = useRef(null)

  useEffect(() => {
    loadLeaflet(() => {})
    fetchHubs(); fetchDrivers(); fetchTrucks()
  }, [])

  useEffect(() => { fetchOrders(); fetchRoutes() }, [selectedDate])

  useEffect(() => {
    if (activeTab === 'map') setTimeout(() => drawAdminMap(), 100)
  }, [hubs, orders, routes, activeTab])

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
  async function fetchDrivers() {
    try { const r = await fetch(`${API}/drivers`); setDrivers(await r.json()) } catch(e) {}
  }
  async function fetchTrucks() {
    try {
      const r = await fetch(`${API}/trucks`)
      const ts = await fetch(`${API}/trucks/stats/summary`)
      if (r.ok) setTrucks(await r.json())
      if (ts.ok) setTruckStats(await ts.json())
    } catch(e) {}
  }

  async function runOptimizer() {
    setOptimizing(true); setMsg(null)
    try {
      const r = await fetch(`${API}/optimize/${selectedDate}`, { method: 'POST' })
      const d = await r.json()
      if (!r.ok) throw new Error(d.detail)
      setMsg({ type: 'success', text: `✓ Optimised! ${d.total_orders} orders → ${d.hubs_used} hub routes with auto-assigned trucks & drivers` })
      await fetchOrders(); await fetchRoutes()
    } catch(err) {
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
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OSM' }).addTo(leafletMap.current)
    } else {
      leafletMap.current.invalidateSize()
    }
    if (markersLayer.current) markersLayer.current.clearLayers()
    else markersLayer.current = L.layerGroup().addTo(leafletMap.current)

    hubs.forEach((hub, i) => {
      const col = HUB_COLORS[i % HUB_COLORS.length]
      L.circleMarker([hub.lat, hub.lng], { radius: hub.stage_v ? 16 : 12, fillColor: col, color: 'white', weight: 2, fillOpacity: 0.9 })
        .bindPopup(`<strong>🏗 ${hub.name}</strong><br>Zone: ${hub.zone || '—'}<br>Cap: ${(hub.capacity_litres/1000000).toFixed(0)} ML${hub.stage_v ? '<br><span style="color:#f59e0b">⭐ Stage V</span>' : ''}`)
        .addTo(markersLayer.current)
    })

    if (routes.length > 0) {
      routes.forEach((route, ri) => {
        const col = HUB_COLORS[ri % HUB_COLORS.length]
        if (route.route_coords?.length > 1) {
          L.polyline(route.route_coords.map(c => [c[0], c[1]]), { color: col, weight: 3, opacity: 0.7, dashArray: '6 4' }).addTo(markersLayer.current)
        }
        route.waypoints?.filter(w => w.type === 'delivery').forEach(s => {
          L.circleMarker([s.lat, s.lng], { radius: 7, fillColor: col, color: 'white', weight: 2, fillOpacity: 0.85 })
            .bindPopup(`<strong>Stop #${s.stop_number}</strong><br>${s.citizen_name}<br>${s.litres_delivered || s.litres} L`)
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

  const pendingCount  = orders.filter(o => o.status === 'pending').length
  const assignedCount = orders.filter(o => o.status === 'assigned').length
  const totalKm       = routes.reduce((s, r) => s + (r.total_distance_km || 0), 0)

  const zones = ['All', ...new Set(hubs.map(h => h.zone).filter(Boolean))]
  const filteredHubs = zoneFilter === 'All' ? hubs : hubs.filter(h => h.zone === zoneFilter)

  return (
    <div className="dashboard">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'var(--font-head)', fontSize: 28, fontWeight: 800, marginBottom: 6 }}>⚙️ Operations Dashboard</h1>
        <p style={{ color: 'var(--text-dim)', fontSize: 15 }}>70 BWSSB GLR hubs · 220 trucks · 150 drivers — Bengaluru</p>
      </div>

      {/* Truck Fleet Summary */}
      {truckStats && (
        <div className="stats-bar" style={{ marginBottom: 16 }}>
          <div className="stat-card">
            <div className="stat-value">{truckStats.total_trucks}</div>
            <div className="stat-label">Total Trucks</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--success)' }}>{truckStats.available_trucks}</div>
            <div className="stat-label">Available</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--citizen-a)' }}>{truckStats.assigned_to_driver}</div>
            <div className="stat-label">Assigned to Driver</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--text-dim)' }}>{truckStats.unassigned_trucks}</div>
            <div className="stat-label">Spare Trucks</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{drivers.length}</div>
            <div className="stat-label">Total Drivers</div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, flexWrap: 'wrap' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label>Date</label>
            <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 14px', fontSize: 14, color: 'var(--text)', fontFamily: 'var(--font-body)' }} />
          </div>
          <button className="btn btn-admin" onClick={runOptimizer} disabled={optimizing || orders.length === 0}>
            {optimizing ? <><span className="spin">⚙</span> Optimising...</> : `⚡ Run Optimizer + Auto-Assign Trucks (${orders.length} orders)`}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => { fetchOrders(); fetchRoutes(); fetchTrucks() }}>↻ Refresh</button>
        </div>
        {msg && (
          <div className={`alert alert-${msg.type === 'success' ? 'success' : 'error'}`} style={{ marginTop: 12, marginBottom: 0 }}>{msg.text}</div>
        )}
      </div>

      {/* Order Stats */}
      <div className="stats-bar">
        <div className="stat-card"><div className="stat-value">{orders.length}</div><div className="stat-label">Total Orders</div></div>
        <div className="stat-card"><div className="stat-value" style={{ color: 'var(--driver-a)' }}>{pendingCount}</div><div className="stat-label">Pending</div></div>
        <div className="stat-card"><div className="stat-value" style={{ color: 'var(--citizen-a)' }}>{assignedCount}</div><div className="stat-label">Assigned</div></div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--success)' }}>{routes.length > 0 ? `${totalKm.toFixed(1)} km` : '—'}</div>
          <div className="stat-label">Total Route KM</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        {[['map','🗺 Map'],['routes','🚛 Routes & Trucks'],['hubs','🏗 GLR Hubs'],['fleet','🚌 Fleet'],['orders','📋 Orders']].map(([id, label]) => (
          <button key={id} className={`tab${activeTab === id ? ' active' : ''}`} onClick={() => setActiveTab(id)}>{label}</button>
        ))}
      </div>

      {/* Map Tab */}
      {activeTab === 'map' && (
        <div className="card">
          <div className="card-title">
            🗺 GLR Map — {selectedDate}
            {routes.length > 0 && <span style={{ fontSize: 13, color: 'var(--success)', marginLeft: 8 }}>✓ Optimised routes shown</span>}
          </div>
          <div ref={mapRef} className="map-container" />
          <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-dim)' }}>
            ● Large circles = Stage V GLRs &nbsp;|&nbsp; ● Small circles = existing GLRs &nbsp;|&nbsp; Dashed lines = driver routes
          </div>
        </div>
      )}

      {/* Routes & Trucks Tab */}
      {activeTab === 'routes' && (
        <div className="card">
          <div className="card-title">🚛 Optimised Routes — Driver & Truck Assignments</div>
          <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 18 }}>
            Each route shows the assigned driver, truck registration, and full delivery schedule.
          </p>
          {routes.length === 0 ? (
            <p style={{ color: 'var(--text-dim)', fontSize: 14 }}>Run the optimiser to see routes with auto-assigned trucks and drivers.</p>
          ) : (
            <div className="route-grid">
              {routes.map((route, i) => {
                const col = HUB_COLORS[i % HUB_COLORS.length]
                const drv = route.assigned_driver
                const trk = route.assigned_truck
                return (
                  <div key={route.hub_id} className="route-card" style={{ borderLeftColor: col }}>
                    <h3>{route.hub_name}</h3>
                    <div style={{ color: 'var(--text-dim)', fontSize: 12, marginBottom: 10 }}>
                      {route.hub_zone || ''} GLR
                    </div>

                    {/* Driver + Truck assignment block */}
                    <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '10px 12px', marginBottom: 12, border: '1px solid rgba(255,255,255,0.07)' }}>
                      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 6, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Assignment</div>
                      {drv ? (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                          <span style={{ fontSize: 18 }}>👷</span>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 13 }}>{drv.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{drv.employee_id} · {drv.phone}</div>
                          </div>
                        </div>
                      ) : (
                        <div style={{ fontSize: 13, color: 'var(--driver-a)' }}>⚠ No driver assigned</div>
                      )}
                      {trk ? (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span style={{ fontSize: 18 }}>🚛</span>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 13, color: col }}>{trk.registration}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{trk.capacity_litres.toLocaleString()} L tanker</div>
                          </div>
                        </div>
                      ) : (
                        <div style={{ fontSize: 13, color: 'var(--driver-a)' }}>⚠ No truck assigned</div>
                      )}
                    </div>

                    <div className="route-stat"><span>Stops</span><strong>{route.total_stops}</strong></div>
                    <div className="route-stat"><span>Distance</span><strong>{route.total_distance_km} km</strong></div>
                    <div className="route-stat"><span>Fuel est.</span><strong>{route.estimated_fuel_litres} L diesel</strong></div>
                    <div className="route-stat"><span>Refills</span><strong>{route.refill_count}</strong></div>
                    <div className="route-stat"><span>Time est.</span><strong>~{(route.estimated_time_minutes || 0) + route.total_stops * 10} min</strong></div>

                    <div className="stop-list" style={{ marginTop: 12 }}>
                      {(route.waypoints || []).filter(w => w.type === 'delivery').map(s => (
                        <div key={s.order_id} className="stop-item">
                          <div className="stop-num" style={{ background: col, color: 'var(--ocean-deep)' }}>{s.stop_number}</div>
                          <div>
                            <div style={{ fontWeight: 600 }}>{s.citizen_name}</div>
                            <div style={{ color: 'var(--text-dim)', fontSize: 12 }}>{s.address}</div>
                            <div style={{ color: 'var(--text-dim)', fontSize: 12 }}>{s.litres_delivered} L · {s.distance_from_prev_km} km</div>
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

      {/* GLR Hubs Tab */}
      {activeTab === 'hubs' && (
        <div className="card">
          <div className="card-title">🏗 BWSSB GLR Hubs — All 70 Bengaluru Reservoirs</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            {zones.map(z => (
              <button key={z} onClick={() => setZoneFilter(z)}
                style={{ padding: '4px 12px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.15)', background: zoneFilter === z ? 'var(--cyan)' : 'transparent', color: zoneFilter === z ? 'var(--ocean-deep)' : 'var(--text)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                {z}
              </button>
            ))}
          </div>
          <div className="overflow-x">
            <table>
              <thead>
                <tr><th>#</th><th>GLR Name</th><th>Zone</th><th>Capacity</th><th>Stage V</th><th>Key Areas</th><th>Status</th></tr>
              </thead>
              <tbody>
                {filteredHubs.map((h, i) => (
                  <tr key={h.id}>
                    <td style={{ color: 'var(--cyan)' }}>#{h.id}</td>
                    <td style={{ fontWeight: 600 }}>{h.name}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-dim)' }}>{h.zone || '—'}</td>
                    <td>{h.capacity_litres >= 1000000 ? `${(h.capacity_litres/1000000).toFixed(0)} ML` : `${h.capacity_litres.toLocaleString()} L`}</td>
                    <td>{h.stage_v ? <span style={{ color: '#f59e0b', fontWeight: 700 }}>⭐ Yes</span> : '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-dim)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.areas_served || '—'}</td>
                    <td><span className={`badge badge-${h.available ? 'assigned' : 'pending'}`}>{h.available ? 'Active' : 'Offline'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Fleet Tab */}
      {activeTab === 'fleet' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Drivers panel */}
          <div className="card" style={{ maxHeight: 600, overflowY: 'auto' }}>
            <div className="card-title">👷 Drivers ({drivers.length})</div>
            <table>
              <thead>
                <tr><th>ID</th><th>Name</th><th>Emp ID</th><th>Truck</th><th>Status</th></tr>
              </thead>
              <tbody>
                {drivers.map(d => (
                  <tr key={d.id}>
                    <td style={{ color: 'var(--cyan)' }}>#{d.id}</td>
                    <td style={{ fontWeight: 500 }}>{d.name}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-dim)' }}>{d.employee_id || '—'}</td>
                    <td style={{ fontSize: 12 }}>
                      {d.truck_id ? (
                        <span style={{ color: 'var(--success)' }}>
                          {trucks.find(t => t.id === d.truck_id)?.registration || `Truck #${d.truck_id}`}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--driver-a)' }}>Unassigned</span>
                      )}
                    </td>
                    <td><span className={`badge badge-${d.available ? 'assigned' : 'pending'}`}>{d.available ? 'Active' : 'Off'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Trucks panel */}
          <div className="card" style={{ maxHeight: 600, overflowY: 'auto' }}>
            <div className="card-title">🚛 Trucks ({trucks.length})</div>
            <table>
              <thead>
                <tr><th>ID</th><th>Registration</th><th>Capacity</th><th>Driver</th><th>Status</th></tr>
              </thead>
              <tbody>
                {trucks.map(t => {
                  const assignedDriver = drivers.find(d => d.truck_id === t.id)
                  return (
                    <tr key={t.id}>
                      <td style={{ color: 'var(--cyan)' }}>#{t.id}</td>
                      <td style={{ fontWeight: 600, fontFamily: 'monospace', fontSize: 13 }}>{t.registration}</td>
                      <td style={{ fontSize: 12 }}>{t.capacity_litres.toLocaleString()} L</td>
                      <td style={{ fontSize: 12 }}>
                        {assignedDriver ? (
                          <span style={{ color: 'var(--citizen-a)' }}>{assignedDriver.name}</span>
                        ) : (
                          <span style={{ color: 'var(--text-dim)' }}>Spare</span>
                        )}
                      </td>
                      <td><span className={`badge badge-${t.available ? 'assigned' : 'pending'}`}>{t.available ? 'Available' : 'Out'}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Orders Tab */}
      {activeTab === 'orders' && (
        <div className="card">
          <div className="card-title">📋 All Orders — {selectedDate}</div>
          <div className="overflow-x">
            <table>
              <thead>
                <tr><th>#</th><th>Citizen</th><th>Address</th><th>Litres</th><th>GLR Hub</th><th>Hub Dist</th><th>Stop</th><th>Status</th></tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr><td colSpan={8} style={{ color: 'var(--text-dim)', textAlign: 'center', padding: 24 }}>No orders for this date.</td></tr>
                ) : orders.map(o => {
                  const hub = hubs.find(h => h.id === o.hub_id)
                  return (
                    <tr key={o.id}>
                      <td style={{ color: 'var(--cyan)' }}>#{o.id}</td>
                      <td style={{ fontWeight: 500 }}>{o.citizen_name}</td>
                      <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-dim)' }}>{o.address}</td>
                      <td>{o.litres_needed} L</td>
                      <td style={{ fontSize: 12, color: 'var(--text-dim)' }}>{hub ? hub.name.replace(' GLR', '') : '—'}</td>
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