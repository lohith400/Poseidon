import { useState, useEffect, useRef } from 'react'

const API = 'http://localhost:8000'

const HUB_OPTIONS = [
  { id: 1, name: 'Whitefield Depot' },
  { id: 2, name: 'Koramangala Tank' },
  { id: 3, name: 'Hebbal Depot' },
  { id: 4, name: 'Electronic City Depot' },
  { id: 5, name: 'Jayanagar Tank' },
  { id: 6, name: 'HSR Layout Borewell' },
  { id: 7, name: 'Yelahanka Depot' },
  { id: 8, name: 'Marathahalli Tank' },
]

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

export default function DriverView({ driverName, defaultHubId = 1 }) {
  const today = new Date().toISOString().split('T')[0]

  const [hubId, setHubId]     = useState(defaultHubId)
  const [date, setDate]       = useState(today)
  const [route, setRoute]     = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)
  const [delivered, setDelivered] = useState(new Set())

  const mapRef      = useRef(null)
  const leafletMap  = useRef(null)
  const markersLayer = useRef(null)

  useEffect(() => { loadLeaflet(() => {}) }, [])

  useEffect(() => {
    if (route) setTimeout(() => drawDriverMap(), 100)
  }, [route])

  async function fetchRoute() {
    setLoading(true); setError(null)
    try {
      const res = await fetch(`${API}/driver/${hubId}/${date}`)
      if (!res.ok) { const d = await res.json(); throw new Error(d.detail || 'No route found') }
      const data = await res.json()
      setRoute(data)
      setDelivered(new Set())
    } catch (err) {
      setError(err.message)
      setRoute(null)
    } finally {
      setLoading(false)
    }
  }

  async function markDelivered(orderId) {
    await fetch(`${API}/orders/${orderId}/deliver`, { method: 'PATCH' }).catch(() => {})
    setDelivered(prev => new Set([...prev, orderId]))
  }

  function drawDriverMap() {
    const L = window.L
    if (!L || !mapRef.current || !route) return

    if (!leafletMap.current) {
      leafletMap.current = L.map(mapRef.current).setView([route.hub.lat, route.hub.lng], 12)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OSM' }).addTo(leafletMap.current)
    } else {
      leafletMap.current.setView([route.hub.lat, route.hub.lng], 12)
      leafletMap.current.invalidateSize()
    }

    if (markersLayer.current) markersLayer.current.clearLayers()
    else markersLayer.current = L.layerGroup().addTo(leafletMap.current)

    const lyr = markersLayer.current

    // Hub marker
    L.circleMarker([route.hub.lat, route.hub.lng], {
      radius: 16, fillColor: '#0ea5e9', color: 'white', weight: 3, fillOpacity: 1,
    }).bindPopup(`<strong>🏗 Your Hub</strong><br>${route.hub.name}`).addTo(lyr)

    // Route line
    const coords = [
      [route.hub.lat, route.hub.lng],
      ...route.stops.map(s => [s.lat, s.lng]),
    ]
    L.polyline(coords, { color: '#f59e0b', weight: 3, opacity: 0.7, dashArray: '8 5' }).addTo(lyr)

    // Stop markers
    route.stops.forEach(s => {
      L.circleMarker([s.lat, s.lng], {
        radius: 10, fillColor: '#f59e0b', color: 'white', weight: 2, fillOpacity: 0.9,
      })
        .bindPopup(`<strong>#${s.stop_number} ${s.citizen_name}</strong><br>${s.address}<br>${s.litres_needed} L`)
        .addTo(lyr)
    })
  }

  const hubName   = HUB_OPTIONS.find(h => h.id === hubId)?.name || ''
  const total     = route?.total_stops || 0
  const doneCount = delivered.size
  const pct       = total > 0 ? Math.round((doneCount / total) * 100) : 0

  return (
    <div className="dashboard">

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'var(--font-head)', fontSize: 28, fontWeight: 800, marginBottom: 6 }}>
          🚛 Your Route for Today
        </h1>
        <p style={{ color: 'var(--text-dim)', fontSize: 15 }}>
          <span style={{ color: 'var(--driver-a)', fontWeight: 600 }}>{hubName}</span>
          {' '}— optimised delivery schedule
        </p>
      </div>

      {/* Controls */}
      <div className="card">
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label>Your Hub</label>
            <select value={hubId} onChange={e => setHubId(parseInt(e.target.value))}>
              {HUB_OPTIONS.map(h => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label>Delivery Date</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              style={{
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10, padding: '10px 14px', fontSize: 14,
                color: 'var(--text)', fontFamily: 'var(--font-body)',
              }}
            />
          </div>
          <button className="btn btn-driver" onClick={fetchRoute} disabled={loading}>
            {loading ? <><span className="spin">⚙</span> Loading...</> : 'Load My Route →'}
          </button>
          {route && (
            <button className="btn btn-ghost btn-sm" onClick={fetchRoute}>↻ Refresh</button>
          )}
        </div>
        {error && (
          <div className="alert alert-error" style={{ marginTop: 12, marginBottom: 0 }}>⚠ {error}</div>
        )}
      </div>

      {route && (
        <>
          {/* Stats */}
          <div className="stats-bar">
            <div className="stat-card">
              <div className="stat-value">{total}</div>
              <div className="stat-label">Total Stops</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: 'var(--driver-a)' }}>
                {route.total_distance_km?.toFixed(1)} km
              </div>
              <div className="stat-label">Route Distance</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: 'var(--success)' }}>{doneCount}</div>
              <div className="stat-label">Delivered</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: 'var(--driver-a)' }}>{total - doneCount}</div>
              <div className="stat-label">Remaining</div>
            </div>
          </div>

          {/* Progress */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
              <span>Delivery Progress</span>
              <span style={{ fontWeight: 600, color: 'var(--success)' }}>{pct}%</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${pct}%` }} />
            </div>
          </div>

          {/* Map + Stops */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

            <div className="card">
              <div className="card-title">📍 Route Map — Start at {route.hub.name}</div>
              <div ref={mapRef} className="map-container" />
            </div>

            <div className="card" style={{ maxHeight: 500, overflowY: 'auto' }}>
              <div className="card-title">📋 Your Stops — Follow This Order</div>
              <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 16 }}>
                Optimised to minimise total travel distance.
              </p>

              {/* Hub start */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0',
                borderBottom: '1px solid var(--border)', marginBottom: 8,
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: '50%',
                  background: 'rgba(14,165,233,0.2)', color: 'var(--citizen-a)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0,
                }}>🏗</div>
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--citizen-a)' }}>START: {route.hub.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>Load your tanker before departing</div>
                </div>
              </div>

              {route.stops.map(stop => {
                const done = delivered.has(stop.order_id)
                return (
                  <div
                    key={stop.order_id}
                    className={`stop-card${done ? ' done' : ''}`}
                  >
                    <div className={`stop-num-circle${done ? ' done-circle' : ''}`}>
                      {done ? '✓' : stop.stop_number}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{stop.citizen_name}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>{stop.address}</div>
                      <div style={{ fontSize: 13, color: 'var(--driver-a)' }}>💧 {stop.litres_needed} litres</div>
                    </div>
                    <div>
                      {done ? (
                        <span style={{ fontSize: 13, color: 'var(--success)', fontWeight: 600 }}>Done ✓</span>
                      ) : (
                        <button className="btn btn-success btn-sm" onClick={() => markDelivered(stop.order_id)}>
                          ✓ Delivered
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

          </div>
        </>
      )}
    </div>
  )
}