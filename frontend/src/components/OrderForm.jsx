import { useState } from 'react'

const API = 'http://localhost:8000'

const PRESET_LOCATIONS = [
  { label: 'Whitefield — ITPL Road',      lat: 12.9769, lng: 77.7480 },
  { label: 'Koramangala 5th Block',        lat: 12.9350, lng: 77.6245 },
  { label: 'HSR Layout Sector 2',          lat: 12.9120, lng: 77.6400 },
  { label: 'Hebbal — Nagavara',            lat: 13.0450, lng: 77.6010 },
  { label: 'Electronic City Phase 1',      lat: 12.8447, lng: 77.6760 },
  { label: 'Jayanagar 9th Block',          lat: 12.9170, lng: 77.5920 },
  { label: 'Marathahalli Bridge Area',     lat: 12.9545, lng: 77.7012 },
  { label: 'Yelahanka New Town',           lat: 13.1050, lng: 77.5975 },
  { label: 'Indiranagar 100ft Road',       lat: 12.9784, lng: 77.6408 },
  { label: 'Bannerghatta Road, JP Nagar',  lat: 12.8905, lng: 77.5873 },
]

export default function OrderForm({ userName }) {
  const today = new Date().toISOString().split('T')[0]

  const [lat, setLat] = useState(null)
  const [lng, setLng] = useState(null)
  const [address, setAddress]         = useState('')
  const [litres, setLitres]           = useState(500)
  const [deliveryDate, setDeliveryDate] = useState(today)
  const [status, setStatus]           = useState(null)
  const [loading, setLoading]         = useState(false)
  const [result, setResult]           = useState(null)

  function handleLocationSelect(e) {
    const idx = e.target.value
    if (idx === '') return
    const loc = PRESET_LOCATIONS[parseInt(idx)]
    setLat(loc.lat)
    setLng(loc.lng)
    setAddress(loc.label)
  }

  async function submitOrder() {
    setStatus(null)
    if (!lat || !lng) {
      setStatus({ type: 'error', msg: 'Please select a location from the list.' })
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`${API}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          citizen_name: userName,
          address,
          lat: parseFloat(lat),
          lng: parseFloat(lng),
          litres_needed: parseInt(litres),
          delivery_date: deliveryDate,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Failed to book')
      setResult(data)
      setStatus({ type: 'success', msg: `✓ Order #${data.id} booked! Assigned to hub (${data.hub_distance_km} km away).` })
      setLat(null); setLng(null); setAddress('')
    } catch (err) {
      setStatus({ type: 'error', msg: err.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="dashboard">

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'var(--font-head)', fontSize: 28, fontWeight: 800, marginBottom: 6 }}>
          🚰 Book Water Delivery
        </h1>
        <p style={{ color: 'var(--text-dim)', fontSize: 15 }}>
          Enter your details. We'll find the nearest hub and optimise your delivery route.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>

        {/* ── Booking Form ── */}
        <div className="card">
          <div className="card-title">📋 New Booking</div>

          {status && (
            <div className={`alert alert-${status.type === 'success' ? 'success' : 'error'}`}>
              {status.msg}
            </div>
          )}

          <div className="form-grid">
            <div className="form-group col-span">
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
                value={address}
                onChange={e => setAddress(e.target.value)}
                placeholder="Flat no., building name..."
              />
            </div>

            <div className="form-group">
              <label>Water Required</label>
              <select value={litres} onChange={e => setLitres(e.target.value)}>
                <option value={500}>500 L (₹150)</option>
                <option value={750}>750 L (₹220)</option>
                <option value={1000}>1000 L (₹290)</option>
                <option value={2000}>2000 L (₹550)</option>
              </select>
            </div>

            <div className="form-group col-span">
              <label>Delivery Date *</label>
              <input
                type="date"
                value={deliveryDate}
                min={today}
                onChange={e => setDeliveryDate(e.target.value)}
              />
            </div>

            {lat && (
              <div className="form-group col-span">
                <div className="alert alert-info" style={{ margin: 0, fontSize: 13 }}>
                  📍 Coordinates: {lat}, {lng}
                </div>
              </div>
            )}
          </div>

          <button
            className="btn btn-citizen btn-full"
            style={{ marginTop: 8 }}
            onClick={submitOrder}
            disabled={loading}
          >
            {loading ? <><span className="spin">⚙</span> Booking...</> : 'Book Water Delivery →'}
          </button>
        </div>

        {/* ── Right Column ── */}
        <div>
          {result && (
            <div className="card" style={{ borderLeft: '3px solid var(--success)', marginBottom: 20 }}>
              <div className="card-title">✅ Booking Confirmed</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 14 }}>
                <div><strong>Order ID</strong><br /><span style={{ color: 'var(--cyan)' }}>#{result.id}</span></div>
                <div><strong>Status</strong><br /><span className="badge badge-pending">Pending</span></div>
                <div><strong>Delivery Date</strong><br />{result.delivery_date}</div>
                <div><strong>Litres</strong><br />{result.litres_needed} L</div>
                <div><strong>Hub Distance</strong><br />{result.hub_distance_km} km</div>
              </div>
              <p style={{ marginTop: 12, fontSize: 13, color: 'var(--text-dim)' }}>
                Your stop will be optimised into a fuel-efficient route. You'll be notified when the tanker is on its way.
              </p>
            </div>
          )}

          <div className="card">
            <div className="card-title">💧 How It Works</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                'Pick your Bengaluru area and water quantity',
                'System assigns the nearest BWSSB water hub',
                'TSP optimizer builds the most efficient tanker route',
                'Driver delivers on your chosen date ✓',
              ].map((step, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 14 }}>
                  <span style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: 'rgba(14,165,233,0.2)', color: 'var(--citizen-a)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, flexShrink: 0,
                  }}>
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}