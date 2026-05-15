import { useState } from 'react'

const API = 'http://localhost:8000'

const PRESET_LOCATIONS = [

  // ── Whitefield / ITPL ──────────────────────────────────────────────────────
  { label: 'Whitefield — ITPL Road',            lat: 12.9769, lng: 77.7480 },
  { label: 'Whitefield — Hope Farm Junction',   lat: 12.9698, lng: 77.7500 },
  { label: 'Whitefield — Varthur Road',         lat: 12.9600, lng: 77.7430 },
  { label: 'Whitefield — Kadugodi Main Road',   lat: 12.9823, lng: 77.7612 },
  { label: 'Whitefield — Channasandra',         lat: 12.9912, lng: 77.7541 },
  { label: 'Whitefield — Hoodi Junction',       lat: 12.9907, lng: 77.7186 },
  { label: 'Whitefield — Brookefield',          lat: 12.9744, lng: 77.7168 },
  { label: 'Whitefield — EPIP Zone',            lat: 12.9795, lng: 77.7398 },
  { label: 'Whitefield — Nallurhalli',          lat: 12.9653, lng: 77.7370 },
  { label: 'Whitefield — Hagadur',              lat: 12.9740, lng: 77.7620 },
  { label: 'Whitefield — Panathur',             lat: 12.9491, lng: 77.7338 },
  { label: 'Whitefield — Gunjur',               lat: 12.9363, lng: 77.7462 },
  { label: 'Whitefield — Seetharampalya',       lat: 12.9856, lng: 77.7302 },
  { label: 'Whitefield — Kundalahalli Gate',    lat: 12.9840, lng: 77.7101 },
  { label: 'Whitefield — Mahadevapura',         lat: 12.9947, lng: 77.7108 },
  { label: 'Whitefield — Ramagondanahalli',     lat: 12.9581, lng: 77.7548 },

  // ── Koramangala ────────────────────────────────────────────────────────────
  { label: 'Koramangala 5th Block',             lat: 12.9350, lng: 77.6245 },
  { label: 'Koramangala 1st Block',             lat: 12.9390, lng: 77.6135 },
  { label: 'Koramangala 2nd Block',             lat: 12.9378, lng: 77.6180 },
  { label: 'Koramangala 3rd Block',             lat: 12.9362, lng: 77.6210 },
  { label: 'Koramangala 4th Block',             lat: 12.9355, lng: 77.6230 },
  { label: 'Koramangala 6th Block',             lat: 12.9330, lng: 77.6270 },
  { label: 'Koramangala 7th Block',             lat: 12.9310, lng: 77.6295 },
  { label: 'Koramangala 8th Block',             lat: 12.9285, lng: 77.6320 },
  { label: 'Koramangala — Ejipura',             lat: 12.9410, lng: 77.6290 },
  { label: 'Koramangala — Sony World Signal',   lat: 12.9340, lng: 77.6260 },
  { label: 'Koramangala — Forum Mall Area',     lat: 12.9345, lng: 77.6110 },
  { label: 'Koramangala — Jakkasandra',         lat: 12.9290, lng: 77.6205 },
  { label: 'Koramangala — Harlur Road',         lat: 12.9200, lng: 77.6390 },
  { label: 'Koramangala — Sarjapur Road Jn',   lat: 12.9173, lng: 77.6278 },
  { label: 'Koramangala — Agara',               lat: 12.9150, lng: 77.6340 },
  { label: 'Koramangala — Iblur Junction',      lat: 12.9100, lng: 77.6430 },

  // ── HSR Layout ─────────────────────────────────────────────────────────────
  { label: 'HSR Layout Sector 2',               lat: 12.9120, lng: 77.6400 },
  { label: 'HSR Layout Sector 1',               lat: 12.9142, lng: 77.6358 },
  { label: 'HSR Layout Sector 3',               lat: 12.9098, lng: 77.6441 },
  { label: 'HSR Layout Sector 4',               lat: 12.9075, lng: 77.6380 },
  { label: 'HSR Layout Sector 5',               lat: 12.9055, lng: 77.6355 },
  { label: 'HSR Layout Sector 6',               lat: 12.9038, lng: 77.6330 },
  { label: 'HSR Layout Sector 7',               lat: 12.9022, lng: 77.6310 },
  { label: 'HSR Layout — 27th Main',            lat: 12.9110, lng: 77.6420 },
  { label: 'HSR Layout — BDA Complex',          lat: 12.9160, lng: 77.6370 },
  { label: 'HSR Layout — Somasundarapalya',     lat: 12.9180, lng: 77.6410 },
  { label: 'HSR Layout — Mangammanapalya',      lat: 12.9045, lng: 77.6290 },
  { label: 'HSR Layout — Haralur Road',         lat: 12.9020, lng: 77.6480 },
  { label: 'HSR Layout — Kudlu Gate',           lat: 12.8982, lng: 77.6421 },
  { label: 'HSR Layout — Bommanahalli',         lat: 12.8999, lng: 77.6270 },
  { label: 'HSR Layout — Singasandra',          lat: 12.8960, lng: 77.6310 },
  { label: 'HSR Layout — Harlur Main Road',     lat: 12.9063, lng: 77.6500 },

  // ── Hebbal / Nagavara ──────────────────────────────────────────────────────
  { label: 'Hebbal — Nagavara',                 lat: 13.0450, lng: 77.6010 },
  { label: 'Hebbal — Flyover Junction',         lat: 13.0489, lng: 77.5965 },
  { label: 'Hebbal — Kempapura',                lat: 13.0420, lng: 77.5940 },
  { label: 'Hebbal — Sahakar Nagar',            lat: 13.0530, lng: 77.5910 },
  { label: 'Hebbal — Anand Nagar',              lat: 13.0380, lng: 77.5980 },
  { label: 'Hebbal — Palace Guttahalli',        lat: 13.0310, lng: 77.5870 },
  { label: 'Hebbal — Ganganagar',               lat: 13.0460, lng: 77.5870 },
  { label: 'Hebbal — RT Nagar Main Road',       lat: 13.0265, lng: 77.5931 },
  { label: 'Hebbal — Nagawara Lake',            lat: 13.0500, lng: 77.6100 },
  { label: 'Hebbal — HMT Layout',               lat: 13.0410, lng: 77.5780 },
  { label: 'Hebbal — Thanisandra Main Road',    lat: 13.0620, lng: 77.6150 },
  { label: 'Hebbal — Rachenahalli',             lat: 13.0700, lng: 77.6080 },
  { label: 'Hebbal — Jakkur Main Road',         lat: 13.0780, lng: 77.5950 },
  { label: 'Hebbal — Yelahanka Link Road',      lat: 13.0560, lng: 77.5840 },
  { label: 'Hebbal — Byatarayanapura',          lat: 13.0620, lng: 77.5810 },
  { label: 'Hebbal — Hennur Road',              lat: 13.0440, lng: 77.6200 },

  // ── Electronic City ────────────────────────────────────────────────────────
  { label: 'Electronic City Phase 1',           lat: 12.8447, lng: 77.6760 },
  { label: 'Electronic City Phase 2',           lat: 12.8320, lng: 77.6760 },
  { label: 'Electronic City — Neeladri Road',   lat: 12.8480, lng: 77.6720 },
  { label: 'Electronic City — Hebbagodi',       lat: 12.8260, lng: 77.6800 },
  { label: 'Electronic City — Doddathoguru',    lat: 12.8395, lng: 77.6695 },
  { label: 'Electronic City — Hosa Road Jn',    lat: 12.8558, lng: 77.6712 },
  { label: 'Electronic City — Kudlu',           lat: 12.8640, lng: 77.6630 },
  { label: 'Electronic City — Singasandra',     lat: 12.8710, lng: 77.6550 },
  { label: 'Electronic City — Bommasandra',     lat: 12.8180, lng: 77.6930 },
  { label: 'Electronic City — Nayandahalli',    lat: 12.8500, lng: 77.6820 },
  { label: 'Electronic City — Chandapura',      lat: 12.8050, lng: 77.6890 },
  { label: 'Electronic City — Anekal Road',     lat: 12.8120, lng: 77.6960 },
  { label: 'Electronic City — Jigani Link',     lat: 12.8280, lng: 77.6620 },
  { label: 'Electronic City — Konappana Agrahara', lat: 12.8420, lng: 77.6640 },
  { label: 'Electronic City — Begur Road',      lat: 12.8600, lng: 77.6490 },
  { label: 'Electronic City — Hulimavu',        lat: 12.8690, lng: 77.6420 },

  // ── Jayanagar ──────────────────────────────────────────────────────────────
  { label: 'Jayanagar 9th Block',               lat: 12.9170, lng: 77.5920 },
  { label: 'Jayanagar 1st Block',               lat: 12.9395, lng: 77.5825 },
  { label: 'Jayanagar 2nd Block',               lat: 12.9370, lng: 77.5840 },
  { label: 'Jayanagar 3rd Block',               lat: 12.9345, lng: 77.5855 },
  { label: 'Jayanagar 4th Block (T Circle)',     lat: 12.9316, lng: 77.5830 },
  { label: 'Jayanagar 5th Block',               lat: 12.9280, lng: 77.5850 },
  { label: 'Jayanagar 6th Block',               lat: 12.9255, lng: 77.5870 },
  { label: 'Jayanagar 7th Block',               lat: 12.9230, lng: 77.5890 },
  { label: 'Jayanagar 8th Block',               lat: 12.9205, lng: 77.5905 },
  { label: 'Jayanagar — South End Circle',      lat: 12.9350, lng: 77.5800 },
  { label: 'Jayanagar — Banashankari 1st Stage',lat: 12.9250, lng: 77.5760 },
  { label: 'Jayanagar — JP Nagar 1st Phase',    lat: 12.9100, lng: 77.5850 },
  { label: 'Jayanagar — Basavanagudi',          lat: 12.9430, lng: 77.5750 },
  { label: 'Jayanagar — VV Puram',              lat: 12.9470, lng: 77.5770 },
  { label: 'Jayanagar — Lalbagh West Gate',     lat: 12.9492, lng: 77.5840 },
  { label: 'Jayanagar — RV Road',               lat: 12.9380, lng: 77.5740 },

  // ── Marathahalli ───────────────────────────────────────────────────────────
  { label: 'Marathahalli Bridge Area',          lat: 12.9545, lng: 77.7012 },
  { label: 'Marathahalli — HAL Airport Road',   lat: 12.9600, lng: 77.6900 },
  { label: 'Marathahalli — ORR (Outer Ring Rd)',lat: 12.9520, lng: 77.7080 },
  { label: 'Marathahalli — Spice Garden Layout',lat: 12.9490, lng: 77.7050 },
  { label: 'Marathahalli — Doddanekundi',       lat: 12.9618, lng: 77.7132 },
  { label: 'Marathahalli — Kadubeesanahalli',   lat: 12.9430, lng: 77.7100 },
  { label: 'Marathahalli — Bellandur Gate',     lat: 12.9388, lng: 77.7060 },
  { label: 'Marathahalli — Aswath Nagar',       lat: 12.9570, lng: 77.6980 },
  { label: 'Marathahalli — Garudacharpalya',    lat: 12.9660, lng: 77.7060 },
  { label: 'Marathahalli — Thubarahalli',       lat: 12.9700, lng: 77.7120 },
  { label: 'Marathahalli — Varthur Hobli',      lat: 12.9440, lng: 77.7280 },
  { label: 'Marathahalli — Nallurhalli',        lat: 12.9650, lng: 77.7360 },
  { label: 'Marathahalli — Ramagondanahalli',   lat: 12.9578, lng: 77.7430 },
  { label: 'Marathahalli — Brookefield',        lat: 12.9742, lng: 77.7170 },
  { label: 'Marathahalli — KR Puram Link Road', lat: 12.9780, lng: 77.7050 },
  { label: 'Marathahalli — Kundalahalli',       lat: 12.9840, lng: 77.7100 },

  // ── Yelahanka ──────────────────────────────────────────────────────────────
  { label: 'Yelahanka New Town',                lat: 13.1050, lng: 77.5975 },
  { label: 'Yelahanka — Old Town',              lat: 13.1008, lng: 77.5936 },
  { label: 'Yelahanka — Attur Layout',          lat: 13.1120, lng: 77.5920 },
  { label: 'Yelahanka — Kogilu Cross',          lat: 13.0890, lng: 77.5930 },
  { label: 'Yelahanka — Doddaballapur Road',    lat: 13.1190, lng: 77.5850 },
  { label: 'Yelahanka — Bagalur Cross',         lat: 13.1310, lng: 77.5900 },
  { label: 'Yelahanka — CRPF Layout',           lat: 13.1060, lng: 77.6080 },
  { label: 'Yelahanka — Chokkanahalli',         lat: 13.0820, lng: 77.6020 },
  { label: 'Yelahanka — Shettihalli',           lat: 13.0960, lng: 77.5770 },
  { label: 'Yelahanka — HMT Main Gate',         lat: 13.0415, lng: 77.5785 },
  { label: 'Yelahanka — Vidyaranyapura',        lat: 13.0730, lng: 77.5700 },
  { label: 'Yelahanka — Sahakar Nagar',         lat: 13.0530, lng: 77.5910 },
  { label: 'Yelahanka — KIAL Road (NH 44)',     lat: 13.1450, lng: 77.6050 },
  { label: 'Yelahanka — Thirumenahalli',        lat: 13.0710, lng: 77.5880 },
  { label: 'Yelahanka — Jakkur Aerodrome Road', lat: 13.0810, lng: 77.5940 },
  { label: 'Yelahanka — Singanayakanahalli',    lat: 13.1240, lng: 77.5970 },

  // ── Indiranagar ────────────────────────────────────────────────────────────
  { label: 'Indiranagar 100ft Road',            lat: 12.9784, lng: 77.6408 },
  { label: 'Indiranagar — 12th Main',           lat: 12.9790, lng: 77.6380 },
  { label: 'Indiranagar — CMH Road',            lat: 12.9820, lng: 77.6430 },
  { label: 'Indiranagar — Defence Colony',      lat: 12.9760, lng: 77.6360 },
  { label: 'Indiranagar — HAL 2nd Stage',       lat: 12.9745, lng: 77.6450 },
  { label: 'Indiranagar — Domlur Flyover',      lat: 12.9640, lng: 77.6380 },
  { label: 'Indiranagar — Domlur Layout',       lat: 12.9620, lng: 77.6360 },
  { label: 'Indiranagar — Jeevanbhima Nagar',   lat: 12.9850, lng: 77.6460 },
  { label: 'Indiranagar — CV Raman Nagar',      lat: 12.9870, lng: 77.6530 },
  { label: 'Indiranagar — Old Madras Road',     lat: 12.9900, lng: 77.6480 },
  { label: 'Indiranagar — Ulsoor Road',         lat: 12.9750, lng: 77.6300 },
  { label: 'Indiranagar — Halasuru',            lat: 12.9720, lng: 77.6270 },
  { label: 'Indiranagar — 80ft Road (1st Stage)',lat: 12.9780, lng: 77.6310 },
  { label: 'Indiranagar — ST Bed Layout',       lat: 12.9810, lng: 77.6500 },
  { label: 'Indiranagar — Kodihalli',           lat: 12.9660, lng: 77.6455 },
  { label: 'Indiranagar — Nagavara Road',       lat: 12.9910, lng: 77.6350 },

  // ── Bannerghatta Road / JP Nagar ───────────────────────────────────────────
  { label: 'Bannerghatta Road, JP Nagar',       lat: 12.8905, lng: 77.5873 },
  { label: 'JP Nagar 1st Phase',                lat: 12.9108, lng: 77.5847 },
  { label: 'JP Nagar 2nd Phase',                lat: 12.9040, lng: 77.5840 },
  { label: 'JP Nagar 3rd Phase',                lat: 12.8980, lng: 77.5830 },
  { label: 'JP Nagar 4th Phase',                lat: 12.8920, lng: 77.5810 },
  { label: 'JP Nagar 5th Phase',                lat: 12.8860, lng: 77.5800 },
  { label: 'JP Nagar 6th Phase',                lat: 12.8800, lng: 77.5790 },
  { label: 'JP Nagar 7th Phase',                lat: 12.8740, lng: 77.5780 },
  { label: 'Bannerghatta Road — Arekere',       lat: 12.8820, lng: 77.5960 },
  { label: 'Bannerghatta Road — Gottigere',     lat: 12.8610, lng: 77.5990 },
  { label: 'Bannerghatta Road — Hulimavu',      lat: 12.8695, lng: 77.6020 },
  { label: 'Bannerghatta Road — Sarakki',       lat: 12.9050, lng: 77.5760 },
  { label: 'Bannerghatta Road — Raghuvanahalli',lat: 12.8700, lng: 77.5700 },
  { label: 'Bannerghatta Road — Begur',         lat: 12.8580, lng: 77.6070 },
  { label: 'Bannerghatta Road — Meenakshi Mall',lat: 12.8930, lng: 77.5910 },
  { label: 'Bannerghatta Road — Akshayanagar',  lat: 12.8770, lng: 77.5870 },
]

const WATER_OPTIONS = [
  { litres: 6000,  label: '6 000 L (Half Tanker)',  price: '₹900'  },
  { litres: 12000, label: '12 000 L (Full Tanker)', price: '₹1,600' },
]

// ── IoT Tank Monitor button — pulsing dot + label ─────────────────────────
function IoTMonitorButton() {
  const [hovered, setHovered] = useState(false)

  return (
    <a
      href="https://iot-smarttankmonitor.onrender.com"
      target="_blank"
      rel="noopener noreferrer"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display:        'inline-flex',
        alignItems:     'center',
        gap:            8,
        padding:        '8px 16px',
        borderRadius:   999,
        background:     hovered
          ? 'linear-gradient(135deg, #0ea5e9 0%, #06b6d4 100%)'
          : 'linear-gradient(135deg, rgba(14,165,233,0.15) 0%, rgba(6,182,212,0.15) 100%)',
        border:         '1.5px solid',
        borderColor:    hovered ? '#0ea5e9' : 'rgba(14,165,233,0.4)',
        color:          hovered ? '#fff' : '#0ea5e9',
        fontWeight:     600,
        fontSize:       13,
        letterSpacing:  0.3,
        textDecoration: 'none',
        cursor:         'pointer',
        transition:     'all 0.2s ease',
        boxShadow:      hovered
          ? '0 0 18px rgba(14,165,233,0.45), 0 2px 8px rgba(0,0,0,0.2)'
          : '0 0 0px transparent',
        whiteSpace:     'nowrap',
        userSelect:     'none',
      }}
    >
      {/* Pulsing live dot */}
      <span style={{ position: 'relative', display: 'flex', alignItems: 'center', width: 10, height: 10 }}>
        <span style={{
          position:     'absolute',
          display:      'inline-flex',
          width:        '100%',
          height:       '100%',
          borderRadius: '50%',
          background:   hovered ? 'rgba(255,255,255,0.6)' : 'rgba(14,165,233,0.5)',
          animation:    'iot-ping 1.4s cubic-bezier(0,0,0.2,1) infinite',
        }} />
        <span style={{
          position:     'relative',
          display:      'inline-flex',
          width:        8,
          height:       8,
          borderRadius: '50%',
          background:   hovered ? '#fff' : '#0ea5e9',
        }} />
      </span>

      {/* Icon + label */}
      <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <svg
          width="14" height="14" viewBox="0 0 24 24"
          fill="none" stroke="currentColor"
          strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
        >
          {/* WiFi / signal arcs representing IoT */}
          <path d="M5 12.55a11 11 0 0 1 14.08 0" />
          <path d="M1.42 9a16 16 0 0 1 21.16 0" />
          <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
          <circle cx="12" cy="20" r="1" fill="currentColor" />
        </svg>
        IoT Tank Monitor
      </span>

      {/* Arrow */}
      <svg
        width="11" height="11" viewBox="0 0 24 24"
        fill="none" stroke="currentColor"
        strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        style={{ opacity: hovered ? 1 : 0.6, transition: 'opacity 0.2s' }}
      >
        <path d="M7 17L17 7M17 7H7M17 7v10" />
      </svg>

      {/* Keyframe injection */}
      <style>{`
        @keyframes iot-ping {
          0%   { transform: scale(1);   opacity: 0.75; }
          75%  { transform: scale(2.2); opacity: 0;    }
          100% { transform: scale(2.2); opacity: 0;    }
        }
      `}</style>
    </a>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

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

  const selectedOption = WATER_OPTIONS.find(o => o.litres === parseInt(litres))

  return (
    <div className="dashboard">

      {/* ── Page header with IoT button ── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{
          display:        'flex',
          alignItems:     'center',
          flexWrap:       'wrap',
          gap:            14,
          marginBottom:   6,
        }}>
          <h1 style={{
            fontFamily: 'var(--font-head)',
            fontSize:   28,
            fontWeight: 800,
            margin:     0,
          }}>
            🚰 Book Water Delivery
          </h1>

          {/* ← IoT Tank Monitor button sits right next to the title */}
          <IoTMonitorButton />
        </div>

        <p style={{ color: 'var(--text-dim)', fontSize: 15, margin: 0 }}>
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

            {/* ── IoT banner at bottom of card ── */}
            <div style={{
              marginTop:    20,
              padding:      '14px 16px',
              borderRadius: 10,
              background:   'linear-gradient(135deg, rgba(14,165,233,0.08) 0%, rgba(6,182,212,0.12) 100%)',
              border:       '1px solid rgba(14,165,233,0.25)',
              display:      'flex',
              alignItems:   'center',
              justifyContent: 'space-between',
              gap:          12,
              flexWrap:     'wrap',
            }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>
                  📡 Smart Tank Monitor
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                  Real-time IoT sensor data for your tank level
                </div>
              </div>
              <IoTMonitorButton />
            </div>

          </div>
        </div>

      </div>
    </div>
  )
}