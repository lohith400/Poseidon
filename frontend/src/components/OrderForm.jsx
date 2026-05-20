import { useState } from 'react'
import { api } from '../lib/api'
import PageHeader from './PageHeader'

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

const WATER_OPTIONS = [
  { litres: 6000,  label: '6 000 L (Half Tanker)',  price: '₹900'  },
  { litres: 12000, label: '12 000 L (Full Tanker)', price: '₹1,600' },
]

function IoTMonitorButton() {
  return (
    <a
      href="https://iot-smarttankmonitor.onrender.com"
      target="_blank"
      rel="noopener noreferrer"
      className="iot-btn"
    >
      <span className="iot-dot-wrap">
        <span className="iot-dot-ping" />
        <span className="iot-dot" />
      </span>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 12.55a11 11 0 0 1 14.08 0" />
        <path d="M1.42 9a16 16 0 0 1 21.16 0" />
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
        <circle cx="12" cy="20" r="1" fill="currentColor" />
      </svg>
      IoT Tank Monitor
    </a>
  )
}

export default function OrderForm({ userName }) {
  const today = new Date().toISOString().split('T')[0]

  const [lat, setLat]                   = useState(null)
  const [lng, setLng]                   = useState(null)
  const [address, setAddress]           = useState('')
  const [litres, setLitres]             = useState(6000)
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
      const data = await api('/orders', {
        method: 'POST',
        body: JSON.stringify({
          citizen_name: userName,
          address,
          lat: parseFloat(lat),
          lng: parseFloat(lng),
          litres_needed: parseInt(litres, 10),
          delivery_date: deliveryDate,
        }),
      })
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

  const selectedOption = WATER_OPTIONS.find(o => o.litres === parseInt(litres))

  return (
    <div className="dashboard">
      <PageHeader
        icon="🚰"
        title="Book Water Delivery"
        subtitle="Enter your details. We'll find the nearest hub and optimise your delivery route."
      >
        <IoTMonitorButton />
      </PageHeader>

      <div className="layout-2col">
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
              <select value={litres} onChange={e => setLitres(parseInt(e.target.value))}>
                {WATER_OPTIONS.map(opt => (
                  <option key={opt.litres} value={opt.litres}>
                    {opt.label} — {opt.price}
                  </option>
                ))}
              </select>
            </div>

            {selectedOption && (
              <div className="form-group col-span">
                <div className="alert alert-info" style={{ margin: 0, fontSize: 13 }}>
                  {litres === 6000 ? (
                    <>
                      💧 <strong>Half Tanker (6 000 L)</strong> — may be combined with a nearby order to save fuel.
                    </>
                  ) : (
                    <>
                      🚛 <strong>Full Tanker (12 000 L)</strong> — dedicated delivery straight to you.
                    </>
                  )}
                </div>
              </div>
            )}

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
                <div className="alert alert-info text-sm" style={{ margin: 0 }}>
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

        <div>
          {result && (
            <div className="card card-accent-success" style={{ marginBottom: 20 }}>
              <div className="card-title">✅ Booking Confirmed</div>
              <div className="detail-grid">
                <div><strong>Order ID</strong><br /><span className="text-accent">#{result.id}</span></div>
                <div><strong>Status</strong><br /><span className="badge badge-pending">Pending</span></div>
                <div><strong>Delivery Date</strong><br />{result.delivery_date}</div>
                <div>
                  <strong>Water</strong><br />
                  {result.litres_needed?.toLocaleString()} L
                  <span className="text-muted" style={{ marginLeft: 4 }}>
                    ({result.litres_needed === 6000 ? 'Half Tanker' : 'Full Tanker'})
                  </span>
                </div>
                <div><strong>Hub Distance</strong><br />{result.hub_distance_km} km</div>
              </div>
              <p className="text-muted" style={{ marginTop: 12 }}>
                {result.litres_needed === 6000
                  ? 'Your order may be batched with a nearby 6 000 L order for faster delivery.'
                  : 'A full tanker is reserved for your delivery.'}
              </p>
            </div>
          )}

          <div className="card">
            <div className="card-title">💧 How It Works</div>
            <div className="step-list">
              {[
                'Pick your Bengaluru area — 6 000 L or 12 000 L',
                'System assigns the nearest BWSSB water hub',
                'Optimizer batches 6 000 L orders to share one tanker load',
                'Driver refills at hub only when tank runs dry',
                'You get your water on the chosen date ✓',
              ].map((step, i) => (
                <div key={i} className="step-item">
                  <span className="step-num">{i + 1}</span>
                  <span>{step}</span>
                </div>
              ))}
            </div>

            <div className="tank-guide">
              <div className="tank-guide-title">🚛 Tanker Size Guide</div>
              <div className="tank-row">
                <span>Half Tanker</span>
                <span className="text-accent">6 000 L — ₹900</span>
              </div>
              <div className="tank-bar">
                <div className="tank-bar-fill" style={{ width: '50%', background: 'var(--sea)' }} />
              </div>
              <div className="tank-row">
                <span>Full Tanker</span>
                <span style={{ color: 'var(--success)', fontWeight: 600 }}>12 000 L — ₹1,600</span>
              </div>
              <div className="tank-bar">
                <div className="tank-bar-fill" style={{ width: '100%', background: 'var(--success)' }} />
              </div>
            </div>

            <div className="iot-banner">
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>📡 Smart Tank Monitor</div>
                <div className="text-muted">Real-time IoT sensor data for your tank level</div>
              </div>
              <IoTMonitorButton />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
