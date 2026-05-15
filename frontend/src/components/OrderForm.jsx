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

// Only two tanker sizes — matches the 12 000 L capacity-constrained routing logic.
// 6 000 L = half load  → driver may batch two of these in one trip
// 12 000 L = full load → driver uses entire tanker in one delivery
const WATER_OPTIONS = [
  { litres: 6000,  label: '6 000 L (Half Tanker)',  price: '₹900'  },
  { litres: 12000, label: '12 000 L (Full Tanker)', price: '₹1,600' },
]

export default function OrderForm({ userName }) {
  const today = new Date().toISOString().split('T')[0]

  const [lat, setLat]                   = useState(null)
  const [lng, setLng]                   = useState(null)
  const [address, setAddress]           = useState('')
  const [litres, setLitres]             = useState(6000)          // default: half tanker
  const [deliveryDate, setDeliveryDate] = useState(today)
  const [status, setStatus]             = useState(null)
  const [loading, setLoading]           = useState(false)
  const [result, setResult]             = useState(null)

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
          citizen_name:  userName,
          address,
          lat:           parseFloat(lat),
          lng:           parseFloat(lng),
          litres_needed: parseInt(litres),
          delivery_date: deliveryDate,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Failed to book')
      setResult(data)
      setStatus({
        type: 'success',
        msg: `✓ Order #${data.id} booked! Assigned to hub (${data.hub_distance_km} km away).`,
      })
      setLat(null); setLng(null); setAddress('')
      setLitres(6000)
    } catch (err) {
      setStatus({ type: 'error', msg: err.message })
    } finally {
      setLoading(false)
    }
  }

  // Lookup selected option details for the info pill
  const selectedOption = WATER_OPTIONS.find(o => o.litres === parseInt(litres))

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

            {/* Location */}
            <div className="form-group col-span">
              <label>Select Location (Bengaluru) *</label>
              <select onChange={handleLocationSelect} defaultValue="">
                <option value="">— Pick your area —</option>
                {PRESET_LOCATIONS.map((loc, i) => (
                  <option key={i} value={i}>{loc.label}</option>
                ))}
              </select>
            </div>

            {/* Address */}
            <div className="form-group">
              <label>Address / Landmark</label>
              <input
                value={address}
                onChange={e => setAddress(e.target.value)}
                placeholder="Flat no., building name..."
              />
            </div>

            {/* ── Water quantity — only 6 000 L or 12 000 L ── */}
            <div className="form-group">
              <label>Water Required</label>
              <select value={litres} onChange={e => setLitres(parseInt(e.target.value))}>
                {WATER_OPTIONS.map(opt => (
                  <option key={opt.litres} value={opt.litres}>
                    {opt.label} — {opt.price}
                  </option>
                ))}
              </select>
            </div>

            {/* Capacity info pill — helps citizen understand tanker sizes */}
            {selectedOption && (
              <div className="form-group col-span">
                <div
                  className="alert alert-info"
                  style={{ margin: 0, fontSize: 13, display: 'flex', alignItems: 'center', gap: 10 }}
                >
                  {litres === 6000 ? (
                    <>
                      💧 <strong>Half Tanker (6 000 L)</strong> — the driver may combine your
                      delivery with another nearby 6 000 L order in one trip, saving fuel.
                    </>
                  ) : (
                    <>
                      🚛 <strong>Full Tanker (12 000 L)</strong> — the entire tanker is dedicated
                      to your delivery. Driver fills up and comes directly to you.
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Delivery date */}
            <div className="form-group col-span">
              <label>Delivery Date *</label>
              <input
                type="date"
                value={deliveryDate}
                min={today}
                onChange={e => setDeliveryDate(e.target.value)}
              />
            </div>

            {/* Coordinates confirmation */}
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
            {loading
              ? <><span className="spin">⚙</span> Booking...</>
              : `Book ${litres.toLocaleString()} L Delivery →`}
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
                <div>
                  <strong>Water</strong><br />
                  {result.litres_needed?.toLocaleString()} L
                  <span style={{ color: 'var(--text-dim)', fontSize: 12, marginLeft: 4 }}>
                    ({result.litres_needed === 6000 ? 'Half Tanker' : 'Full Tanker'})
                  </span>
                </div>
                <div><strong>Hub Distance</strong><br />{result.hub_distance_km} km</div>
              </div>
              <p style={{ marginTop: 12, fontSize: 13, color: 'var(--text-dim)' }}>
                {result.litres_needed === 6000
                  ? 'Your order may be batched with a nearby 6 000 L order — saves fuel and gets faster delivery.'
                  : 'A full tanker is reserved for your delivery. Driver fills up and heads straight to you.'}
              </p>
            </div>
          )}

          <div className="card">
            <div className="card-title">💧 How It Works</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                'Pick your Bengaluru area — 6 000 L or 12 000 L',
                'System assigns the nearest BWSSB water hub',
                'Optimizer batches 6 000 L orders to share one tanker load',
                'Driver refills at hub only when tank runs dry',
                'You get your water on the chosen date ✓',
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

            {/* Tanker size visual guide */}
            <div style={{
              marginTop: 20, padding: '14px 16px',
              background: 'rgba(255,255,255,0.04)',
              borderRadius: 10, fontSize: 13,
            }}>
              <div style={{ fontWeight: 700, marginBottom: 10, color: 'var(--text-dim)' }}>
                🚛 Tanker Size Guide
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Half Tanker</span>
                  <span style={{ color: 'var(--cyan)', fontWeight: 600 }}>6 000 L — ₹900</span>
                </div>
                {/* Visual bar */}
                <div style={{
                  height: 10, borderRadius: 5,
                  background: 'rgba(14,165,233,0.15)',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    width: '50%', height: '100%',
                    background: 'var(--cyan)', borderRadius: 5,
                  }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                  <span>Full Tanker</span>
                  <span style={{ color: 'var(--success)', fontWeight: 600 }}>12 000 L — ₹1,600</span>
                </div>
                <div style={{
                  height: 10, borderRadius: 5,
                  background: 'rgba(14,165,233,0.15)',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    width: '100%', height: '100%',
                    background: 'var(--success)', borderRadius: 5,
                  }} />
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  )
}