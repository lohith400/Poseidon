import { useState, useEffect, useRef } from 'react'
import { api } from '../lib/api'
import { loadLeaflet } from '../lib/mapLoader'

const RISK_COLORS = {
  critical: '#ef4444',
  high: '#f59e0b',
  medium: '#eab308',
  low: '#10b981',
}

export default function CrisisDashboard() {
  const [forecasts, setForecasts] = useState([])
  const [meta, setMeta] = useState(null)
  const [hubs, setHubs] = useState([])
  const [loading, setLoading] = useState(true)
  const [horizon, setHorizon] = useState(14)
  const mapRef = useRef(null)
  const mapInst = useRef(null)
  const heatLayer = useRef(null)

  async function load() {
    setLoading(true)
    try {
      const [fc, hs] = await Promise.all([
        api(`/forecast?horizon=${horizon}`),
        api('/hubs/status'),
      ])
      setMeta(fc)
      setForecasts(fc.forecasts || [])
      setHubs(hs.hubs || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const id = setInterval(load, 30000)
    return () => clearInterval(id)
  }, [horizon])

  useEffect(() => {
    if (!hubs.length) return
    loadLeaflet(() => drawHeatmap())
  }, [hubs, forecasts])

  function drawHeatmap() {
    const L = window.L
    if (!L || !mapRef.current) return

    if (!mapInst.current) {
      mapInst.current = L.map(mapRef.current).setView([12.9716, 77.5946], 11)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OSM · BWSSB GLR',
      }).addTo(mapInst.current)
    } else {
      mapInst.current.invalidateSize()
    }

    if (heatLayer.current) {
      mapInst.current.removeLayer(heatLayer.current)
    }

    const points = hubs.map(h => {
      const fc = forecasts.find(f => f.hub_id === h.id)
      const intensity = fc?.shortage_risk_score ?? (100 - (h.fill_percent || 50))
      return [h.lat, h.lng, Math.max(0.15, intensity / 100)]
    })

    if (L.heatLayer) {
      heatLayer.current = L.heatLayer(points, {
        radius: 28,
        blur: 22,
        maxZoom: 13,
        gradient: { 0.2: '#10b981', 0.45: '#eab308', 0.7: '#f59e0b', 1.0: '#ef4444' },
      }).addTo(mapInst.current)
    }

    hubs.forEach(h => {
      const fc = forecasts.find(f => f.hub_id === h.id)
      const col = RISK_COLORS[fc?.risk_level] || '#64a0c0'
      L.circleMarker([h.lat, h.lng], {
        radius: 8,
        fillColor: col,
        color: '#fff',
        weight: 2,
        fillOpacity: 0.9,
      })
        .bindPopup(
          `<strong>${h.name}</strong><br>Fill: ${h.fill_percent}%<br>${fc?.alert_message || ''}`
        )
        .addTo(mapInst.current)
    })
  }

  const topAlerts = forecasts.filter(f => !f.error).slice(0, 8)

  return (
    <div className="crisis-panel">
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontFamily: 'var(--font-head)', fontSize: 24, fontWeight: 800, marginBottom: 6 }}>
          Water Crisis Intelligence
        </h2>
        <p style={{ color: 'var(--text-dim)', fontSize: 14 }}>
          Shortage forecasting and reservoir stress (30s refresh)
          {meta?.prophet_enabled ? ' — Prophet' : ' — seasonal model'}
        </p>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ fontSize: 13 }}>Horizon</label>
          <select value={horizon} onChange={e => setHorizon(parseInt(e.target.value, 10))}>
            {[7, 14, 21, 30].map(d => (
              <option key={d} value={d}>{d} days</option>
            ))}
          </select>
          <button type="button" className="btn btn-ghost btn-sm" onClick={load} disabled={loading}>
            {loading ? 'Updating…' : 'Refresh'}
          </button>
        </div>
        {meta && (
          <div className="stats-bar" style={{ marginTop: 12 }}>
            <div className="stat-card">
              <div className="stat-value">{meta.hubs_analyzed}</div>
              <div className="stat-label">GLRs monitored</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: 'var(--danger)' }}>{meta.critical_count}</div>
              <div className="stat-label">High / critical</div>
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div className="card">
          <div className="card-title">Reservoir stress heatmap</div>
          <div ref={mapRef} className="map-container" style={{ minHeight: 360 }} />
        </div>
        <div className="card">
          <div className="card-title">Priority alerts</div>
          {topAlerts.length === 0 ? (
            <p style={{ color: 'var(--text-dim)' }}>Loading forecasts…</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {topAlerts.map(f => (
                <div
                  key={f.hub_id}
                  style={{
                    borderLeft: `4px solid ${RISK_COLORS[f.risk_level] || '#ccc'}`,
                    padding: '12px 14px',
                    background: 'rgba(14,165,233,0.06)',
                    borderRadius: 10,
                  }}
                >
                  <div style={{ fontWeight: 700 }}>{f.hub_name}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 4 }}>{f.alert_message}</div>
                  <div style={{ fontSize: 12, marginTop: 6 }}>
                    Risk {f.shortage_risk_score}% · Fill {f.fill_percent}%
                    {f.days_until_critical != null && (
                      <span style={{ color: 'var(--danger)', marginLeft: 8 }}>
                        Critical in {f.days_until_critical}d
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
