/** Load Leaflet + optional heat plugin from CDN */
export function loadLeaflet(callback) {
  if (window.L) {
    loadHeat(callback)
    return
  }
  if (!document.getElementById('leaflet-css')) {
    const link = document.createElement('link')
    link.id = 'leaflet-css'
    link.rel = 'stylesheet'
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    document.head.appendChild(link)
  }
  const script = document.createElement('script')
  script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
  script.onload = () => loadHeat(callback)
  document.head.appendChild(script)
}

function loadHeat(callback) {
  if (window.L?.heatLayer) {
    callback()
    return
  }
  const heat = document.createElement('script')
  heat.src = 'https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js'
  heat.onload = callback
  document.head.appendChild(heat)
}

export function loadGoogleMaps(apiKey, callback) {
  if (!apiKey) {
    callback(null)
    return
  }
  if (window.google?.maps) {
    callback(window.google.maps)
    return
  }
  const id = 'google-maps-script'
  if (document.getElementById(id)) {
    const t = setInterval(() => {
      if (window.google?.maps) {
        clearInterval(t)
        callback(window.google.maps)
      }
    }, 100)
    return
  }
  const script = document.createElement('script')
  script.id = id
  script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=visualization`
  script.async = true
  script.onload = () => callback(window.google.maps)
  script.onerror = () => callback(null)
  document.head.appendChild(script)
}
