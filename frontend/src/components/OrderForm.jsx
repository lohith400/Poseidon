import { useState } from 'react'

const API = 'http://localhost:8000'

// Preset Bengaluru locations so demo is easy without Google Maps geocoding
const PRESET_LOCATIONS = [
  { label: 'Whitefield - ITPL Road',         lat: 12.9769, lng: 77.7480 },
  { label: 'Koramangala 5th Block',           lat: 12.9350, lng: 77.6245 },
  { label: 'HSR Layout Sector 2',             lat: 12.9120, lng: 77.6400 },
  { label: 'Hebbal - Nagavara',               lat: 13.0450, lng: 77.6010 },
  { label: 'Electronic City Phase 1',         lat: 12.8447, lng: 77.6760 },
  { label: 'Jayanagar 9th Block',             lat: 12.9170, lng: 77.5920 },
  { label: 'Marathahalli Bridge Area',        lat: 12.9545, lng: 77.7012 },
  { label: 'Yelahanka New Town',              lat: 13.1050, lng: 77.5975 },
  { label: 'Indiranagar 100ft Road',          lat: 12.9784, lng: 77.6408 },
  { label: 'Bannerghatta Road, JP Nagar',     lat: 12.8905, lng: 77.5873 },
]

export default function OrderForm({ onOrderPlaced }) {
  const today = new Date().toISOString().split('T')[0]

  const [form, setForm] = useState({
    citizen_name: '',
    address: '',
    lat: '',
    lng: '',
    litres_needed: 500,
    delivery_date: today,
  })

  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)

  function handleLocationSelect(e) {
    const idx = e.target.value
    if (idx === '') return
    const loc = PRESET_LOCATIONS[idx]
    setForm(f => ({ ...f, address: loc.label, lat: loc.lat, lng: loc.lng }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.lat || !form.lng) {
      setStatus({ type: 'error', msg: 'Please select a location from the preset list.' })
      return
    }
    setLoading(true)
    setStatus(null)
    try {
      const res = await fetch(`${API}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          lat: parseFloat(form.lat),
          lng: parseFloat(form.lng),
          litres_needed: parseInt(form.litres_needed),
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Failed')
      setResult(data)
      setStatus({ type: 'success', msg: `✓ Order #${data.id} booked! Assigned to hub (${data.hub_distance_km} km away).` })
      setForm(f => ({ ...f, citizen_name: '', address: '', lat: '', lng: '' }))
      if (onOrderPlaced) onOrderPlaced()
    } catch (err) {
      setStatus({ type: 'error', msg: err.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="card">
        <h2>🚰 Book Water Delivery</h2>
        <p style={{ fontSize: 14, color: '#718096', marginBottom: 20 }}>
          Enter your details. The system automatically finds the nearest water hub and assigns you to the optimized route.
        </p>

        {status && (
          <div className={`alert alert-${status.type === 'success' ? 'success' : 'error'}`}>
            {status.msg}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group">
              <label>Your Name *</label>
              <input
                required
                value={form.citizen_name}
                onChange={e => setForm(f => ({ ...f, citizen_name: e.target.value }))}
                placeholder="e.g. Ravi Kumar"
              />
            </div>

            <div className="form-group">
              <label>Delivery Date *</label>
              <input
                type="date"
                required
                value={form.delivery_date}
                min={today}
                onChange={e => setForm(f => ({ ...f, delivery_date: e.target.value }))}
              />
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Select Location (Bengaluru) *</label>
              <select onChange={handleLocationSelect} defaultValue="">
                <option value="">— Pick your area —</option>
                {PRESET_LOCATIONS.map((loc, i) => (
                  <option key={i} value={i}>{loc.label}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Address / Landmark</label>
              <input
                value={form.address}
                onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                placeholder="Flat no., building name..."
              />
            </div>

            <div className="form-group">
              <label>Water Required (litres)</label>
              <select
                value={form.litres_needed}
                onChange={e => setForm(f => ({ ...f, litres_needed: e.target.value }))}
              >
                <option value={500}>500 L (₹150)</option>
                <option value={750}>750 L (₹220)</option>
                <option value={1000}>1000 L (₹290)</option>
                <option value={2000}>2000 L (₹550)</option>
              </select>
            </div>

            {form.lat && (
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <div className="alert alert-info" style={{ margin: 0 }}>
                  📍 Coordinates: {form.lat}, {form.lng}
                </div>
              </div>
            )}
          </div>

          <div style={{ marginTop: 20 }}>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Booking...' : 'Book Water Delivery →'}
            </button>
          </div>
        </form>
      </div>

      {result && (
        <div className="card" style={{ borderLeft: '4px solid #38a169' }}>
          <h2>✅ Booking Confirmed</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 14 }}>
            <div><strong>Order ID:</strong> #{result.id}</div>
            <div><strong>Status:</strong> <span className="badge badge-pending">Pending</span></div>
            <div><strong>Delivery Date:</strong> {result.delivery_date}</div>
            <div><strong>Litres:</strong> {result.litres_needed} L</div>
            <div><strong>Hub Distance:</strong> {result.hub_distance_km} km</div>
          </div>
          <p style={{ marginTop: 12, fontSize: 13, color: '#718096' }}>
            Your stop will be optimized into a fuel-efficient route. You'll be notified when the tanker is on the way.
          </p>
        </div>
      )}
    </div>
  )
}