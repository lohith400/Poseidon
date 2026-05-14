import { useState, useRef, useEffect } from 'react'

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

export default function DriverView() {
  const today = new Date().toISOString().split('T')[0]
  const [hubId, setHubId] = useState(1)
  const [date, setDate] = useState(today)
  const [route, setRoute] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [delivered, setDelivered] = useState(new Set())
  const mapRef = useRef(null)
  const leafletMap = useRef(null)
  const markersLayer = useRef(null)

  async function fetchRoute() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API}/driver/${hubId}/${date}`)
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.detail)
      }
      const data = await res.json()
      setRoute(data)
    } catch (err) {
      setError(err.message)
      setRoute(null)
    } finally {
      setLoading(false)
    }
  }

  async function markDelivered(orderId) {
    await fetch(`${API}/orders/${orderId}/deliver`, { method: 'PATCH' })
    setDelivered(prev => new Set([...prev, orderId]))
  }

  useEffect(() => {
    if (route && typeof window !== 'undefined') {
      drawDriverMap()
    }
  }, [route])

  function drawDriverMap() {
    const L = window.L
    if (!L || !mapRef.current || !route) return

    if (!leafletMap.current) {
      leafletMap.current = L.map(mapRef.current).setView([route.hub.lat, route.hub.lng], 12)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(leafletMap.current)
    } else {
      leafletMap.current.setView([route.hub.lat, route.hub.lng], 12)
    }

    if (markersLayer.current) markersLayer.current.clearLayers()
    else markersLayer.current = L.layerGroup().addTo(leafletMap.current)

    const lyr = markersLayer.current

    // Hub marker
    L.circleMarker([route.hub.lat, route.hub.lng], {
      radius: 16, fillColor: '#3182ce', color: 'white', weight: 3, fillOpacity: 1
    }).bindPopup(`<strong>🏗 Your Hub</strong><br>${route.hub.name}`).addTo(lyr)

    // Route line through all stops
    const coords = [[route.hub.lat, route.hub.lng], ...route.stops.map(s => [s.lat, s.lng])]
    L.polyline(coords, { color: '#3182ce', weight: 3, opacity: 0.6, dashArray: '8 5' }).addTo(lyr)

    // Stop markers
    route.stops.forEach(stop => {
      L.circleMarker([stop.lat, stop.lng], {
        radius: 11, fillColor: '#dd6b20', color: 'white', weight: 2, fillOpacity: 0.9
      })
      .bindPopup(`<strong>#${stop.stop_number} ${stop.citizen_name}</strong><br>${stop.address}<br>${stop.litres_needed} L`)
      .addTo(lyr)
    })
  }

  return (
    <div>
      <div className="card">
        <h2>🚛 Driver Route View</h2>
        <p style={{ fontSize: 14, color: '#718096', marginBottom: 16 }}>
          Select your hub and date to see your optimized delivery route.
        </p>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group">
            <label>Your Hub</label>
            <select value={hubId} onChange={e => setHubId(parseInt(e.target.value))}>
              {HUB_OPTIONS.map(h => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Delivery Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>

          <button className="btn btn-primary" onClick={fetchRoute} disabled={loading}>
            {loading ? 'Loading...' : 'Get My Route →'}
          </button>
        </div>

        {error && <div className="alert alert-error" style={{ marginTop: 12 }}>{error}</div>}
      </div>

      {route && (
        <>
          {/* Summary */}
          <div className="stats-bar">
            <div className="stat-card">
              <div className="value">{route.total_stops}</div>
              <div className="label">Total Stops</div>
            </div>
            <div className="stat-card">
              <div className="value">{route.total_distance_km?.toFixed(1)} km</div>
              <div className="label">Route Distance</div>
            </div>
            <div className="stat-card">
              <div className="value">{delivered.size}</div>
              <div className="label">Delivered</div>
            </div>
            <div className="stat-card">
              <div className="value">{route.total_stops - delivered.size}</div>
              <div className="label">Remaining</div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
              <span>Delivery Progress</span>
              <span>{Math.round((delivered.size / route.total_stops) * 100)}%</span>
            </div>
            <div style={{ background: '#e2e8f0', borderRadius: 4, height: 8 }}>
              <div style={{
                width: `${(delivered.size / route.total_stops) * 100}%`,
                background: '#38a169',
                height: '100%',
                borderRadius: 4,
                transition: 'width 0.4s'
              }} />
            </div>
          </div>

          {/* Map */}
          <div className="card">
            <h2>📍 Route Map — Start at {route.hub.name}</h2>
            <div ref={mapRef} className="map-container" />
          </div>

          {/* Stop list */}
          <div className="card">
            <h2>📋 Your Stops (in order)</h2>
            <p style={{ fontSize: 13, color: '#718096', marginBottom: 16 }}>
              Follow this order — it's optimized to minimize your total travel distance.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Hub start */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                background: '#ebf8ff', borderRadius: 10, borderLeft: '4px solid #3182ce'
              }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#3182ce', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                  🏗
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: '#2a4365' }}>START: {route.hub.name}</div>
                  <div style={{ fontSize: 13, color: '#4a5568' }}>Load your tanker here before departing</div>
                </div>
              </div>

              {route.stops.map(stop => {
                const isDone = delivered.has(stop.order_id)
                return (
                  <div key={stop.order_id} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                    background: isDone ? '#f0fff4' : 'white',
                    borderRadius: 10,
                    border: `1px solid ${isDone ? '#9ae6b4' : '#e2e8f0'}`,
                    borderLeft: `4px solid ${isDone ? '#38a169' : '#dd6b20'}`,
                    opacity: isDone ? 0.75 : 1,
                    transition: 'all 0.3s'
                  }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%',
                      background: isDone ? '#38a169' : '#dd6b20',
                      color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 700, fontSize: 15, flexShrink: 0
                    }}>
                      {isDone ? '✓' : stop.stop_number}
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700 }}>{stop.citizen_name}</div>
                      <div style={{ fontSize: 13, color: '#718096' }}>{stop.address}</div>
                      <div style={{ fontSize: 13, color: '#4a5568' }}>💧 {stop.litres_needed} litres</div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      {!isDone ? (
                        <button
                          className="btn btn-success btn-sm"
                          onClick={() => markDelivered(stop.order_id)}
                        >
                          ✓ Delivered
                        </button>
                      ) : (
                        <span style={{ fontSize: 13, color: '#38a169', fontWeight: 600 }}>Done ✓</span>
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