import { useState, useEffect, useRef } from 'react'
import { api, coordsToLatLngs } from '../lib/api'
import { loadLeaflet } from '../lib/mapLoader'
import PageHeader from './PageHeader'

export default function DriverView({ driverName, defaultHubId = null }) {
  const today = new Date().toISOString().split('T')[0]

  const [hubId, setHubId]         = useState(defaultHubId)
  const [date, setDate]           = useState(today)
  const [route, setRoute]         = useState(null)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState(null)
  const [delivered, setDelivered] = useState(new Set())

  // Hubs fetched live from the real DB (replaces the old hardcoded HUB_OPTIONS)
  const [hubOptions, setHubOptions] = useState([])

  const mapRef       = useRef(null)
  const leafletMap   = useRef(null)
  const markersLayer = useRef(null)

  useEffect(() => { loadLeaflet(() => {}) }, [])

  useEffect(() => {
    api('/hubs')
      .then(data => {
        setHubOptions(data)
        if (!hubId && data.length > 0) setHubId(data[0].id)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (defaultHubId) setHubId(defaultHubId)
  }, [defaultHubId])

  useEffect(() => {
    if (route) setTimeout(() => drawDriverMap(), 100)
  }, [route])

  useEffect(() => {
    if (!route) return undefined
    const sendGps = () => {
      const wps = route.waypoints?.filter(w => w.type === 'delivery') || []
      const next = wps.find(w => !delivered.has(w.order_id))
      const lat = next?.lat ?? route.hub.lat
      const lng = next?.lng ?? route.hub.lng
      api('/driver/location', {
        method: 'POST',
        body: JSON.stringify({ lat, lng, speed_kmh: 18, heading: 0 }),
      }).catch(() => {})
    }
    sendGps()
    const id = setInterval(sendGps, 10000)
    return () => clearInterval(id)
  }, [route, delivered])

  async function fetchRoute() {
    setLoading(true); setError(null)
    try {
      const data = await api(`/driver/${hubId}/${date}`)
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
    await api(`/orders/${orderId}/deliver`, { method: 'PATCH' }).catch(() => {})
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

    const coords = route.route_coords?.length
      ? coordsToLatLngs(route.route_coords)
      : [
          [route.hub.lat, route.hub.lng],
          ...(route.waypoints || []).map(wp => [wp.lat, wp.lng]),
        ]

    L.polyline(coords, { color: '#f59e0b', weight: 3, opacity: 0.7, dashArray: '8 5' }).addTo(lyr)

    route.waypoints.forEach(wp => {
      if (wp.type === 'delivery') {
        L.circleMarker([wp.lat, wp.lng], {
          radius: 10, fillColor: '#f59e0b', color: 'white', weight: 2, fillOpacity: 0.9,
        })
          .bindPopup(
            `<strong>#${wp.stop_number} ${wp.citizen_name}</strong><br>${wp.address}<br>${wp.litres_delivered} L`
          )
          .addTo(lyr)
      } else if (wp.type === 'refill') {
        L.circleMarker([wp.lat, wp.lng], {
          radius: 10, fillColor: '#ef4444', color: 'white', weight: 2, fillOpacity: 0.9,
        })
          .bindPopup(`<strong>⛽ Refill Stop #${wp.refill_number}</strong><br>${wp.hub_name || 'Hub'}`)
          .addTo(lyr)
      }
    })
  }

  // Look up selected hub name from live hubOptions
  const hubName = hubOptions.find(h => h.id === hubId)?.name || ''

  const total     = route?.total_delivery_stops || 0
  const doneCount = delivered.size
  const pct       = total > 0 ? Math.round((doneCount / total) * 100) : 0

  const deliveryStops = route?.waypoints?.filter(wp => wp.type === 'delivery') || []
  const refillStops   = route?.waypoints?.filter(wp => wp.type === 'refill') || []

  return (
    <div className="dashboard">

      <PageHeader
        icon="🚛"
        title="Your Route for Today"
        subtitle={hubName ? `${hubName} — optimised delivery schedule` : 'Select your hub and load today\'s route'}
      />

      {/* Controls */}
      <div className="card">
        <div className="toolbar-row">
          <div className="form-group">
            <label>Your Hub</label>
            <select value={hubId ?? ''} onChange={e => setHubId(parseInt(e.target.value))}>
              {hubOptions.length === 0
                ? <option disabled>Loading hubs…</option>
                : hubOptions.map(h => (
                    <option key={h.id} value={h.id}>
                      {h.name} — {h.ward}
                    </option>
                  ))
              }
            </select>
          </div>
          <div className="form-group">
            <label>Delivery Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} />
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
              <div className="stat-value">{route.total_delivery_stops}</div>
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
            {refillStops.length > 0 && (
              <div className="stat-card">
                <div className="stat-value" style={{ color: '#ef4444' }}>{refillStops.length}</div>
                <div className="stat-label">Refill Stops</div>
              </div>
            )}
          </div>

          {/* Progress */}
          <div className="card">
            <div className="progress-header">
              <span>Delivery Progress</span>
              <span style={{ fontWeight: 600, color: 'var(--success)' }}>{pct}%</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${pct}%` }} />
            </div>
          </div>

          {/* Map + Stops */}
          <div className="layout-2col">

            <div className="card">
              <div className="card-title">📍 Route Map — Start at {route.hub.name}</div>
              <div ref={mapRef} className="map-container" />
            </div>

            <div className="card card-scroll">
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

              {/* All waypoints in order — delivery and refill */}
              {route.waypoints.map((wp, idx) => {
                if (wp.type === 'refill') {
                  return (
                    <div
                      key={`refill-${wp.refill_number}-${idx}`}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '12px 14px', borderRadius: 10, marginBottom: 10,
                        background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)',
                      }}
                    >
                      <div style={{
                        width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                        background: 'rgba(239,68,68,0.25)', color: '#ef4444',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
                      }}>⛽</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: '#ef4444' }}>
                          REFILL STOP #{wp.refill_number}
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>
                          {wp.message || `Return to hub and refill`}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>
                          Refill to {wp.capacity_after_refill?.toLocaleString()} L
                        </div>
                      </div>
                    </div>
                  )
                }

                // Delivery waypoint
                const done = delivered.has(wp.order_id)
                return (
                  <div
                    key={wp.order_id}
                    className={`stop-card${done ? ' done' : ''}`}
                  >
                    <div className={`stop-num-circle${done ? ' done-circle' : ''}`}>
                      {done ? '✓' : wp.stop_number}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{wp.citizen_name}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>{wp.address}</div>
                      <div style={{ fontSize: 13, color: 'var(--driver-a)' }}>💧 {wp.litres_delivered} litres</div>
                    </div>
                    <div>
                      {done ? (
                        <span style={{ fontSize: 13, color: 'var(--success)', fontWeight: 600 }}>Done ✓</span>
                      ) : (
                        <button className="btn btn-success btn-sm" onClick={() => markDelivered(wp.order_id)}>
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