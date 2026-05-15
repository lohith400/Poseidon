import { useState, useEffect } from 'react'
import OrderForm from './components/OrderForm'
import AdminDashboard from './components/AdminDashboard'
import DriverView from './components/DriverView'

const API = 'http://localhost:8000'

export default function App() {
  const [currentRole, setCurrentRole] = useState(null)
  const [currentUser, setCurrentUser] = useState(null)
  const [selectedRole, setSelectedRole] = useState('citizen')
  const [loginError, setLoginError] = useState('')

  // Citizen fields
  const [citizenName, setCitizenName] = useState('')
  const [citizenPass, setCitizenPass] = useState('')
  // Driver fields
  const [driverName, setDriverName] = useState('')
  const [driverHubId, setDriverHubId] = useState(null)
  const [driverPass, setDriverPass] = useState('')
  // Admin fields
  const [adminUser, setAdminUser] = useState('')
  const [adminPass, setAdminPass] = useState('')

  // Hubs fetched live from the real DB (replaces the old hardcoded HUB_OPTIONS)
  const [hubOptions, setHubOptions] = useState([])

  useEffect(() => {
    fetch(`${API}/hubs`)
      .then(r => r.json())
      .then(data => {
        setHubOptions(data)
        if (data.length > 0) setDriverHubId(data[0].id)
      })
      .catch(() => {})
  }, [])

  function pickRole(role) {
    setSelectedRole(role)
    setLoginError('')
  }

  function doLogin() {
    setLoginError('')
    if (selectedRole === 'citizen') {
      if (!citizenName.trim()) { setLoginError('Please enter your name.'); return }
      if (citizenPass !== 'citizen123') { setLoginError('Incorrect password. Hint: citizen123'); return }
      setCurrentUser(citizenName.trim())
    } else if (selectedRole === 'driver') {
      if (!driverName.trim()) { setLoginError('Please enter your name.'); return }
      if (driverPass !== 'driver123') { setLoginError('Incorrect password. Hint: driver123'); return }
      setCurrentUser(driverName.trim())
    } else {
      if (!adminUser.trim()) { setLoginError('Please enter admin username.'); return }
      if (adminPass !== 'admin123') { setLoginError('Incorrect password. Hint: admin123'); return }
      setCurrentUser(adminUser.trim())
    }
    setCurrentRole(selectedRole)
  }

  function logout() {
    setCurrentRole(null)
    setCurrentUser(null)
    setCitizenName(''); setCitizenPass('')
    setDriverName(''); setDriverPass('')
    setAdminUser(''); setAdminPass('')
    setSelectedRole('citizen')
    setLoginError('')
  }

  const roleLabels = { citizen: '🏠 Citizen', driver: '🚛 Driver', admin: '⚙️ Admin' }

  // ─── Authenticated View ───
  if (currentRole) {
    return (
      <div id="app">
        <nav className="topnav">
          <div className="nav-brand">Poseidon 💧</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span className="nav-user">{currentUser}</span>
            <span className={`nav-role-badge role-${currentRole}`}>
              {roleLabels[currentRole]}
            </span>
            <button className="btn-logout" onClick={logout}>Sign Out</button>
          </div>
        </nav>

        {currentRole === 'citizen' && <OrderForm userName={currentUser} />}
        {currentRole === 'driver'  && <DriverView driverName={currentUser} defaultHubId={driverHubId} />}
        {currentRole === 'admin'   && <AdminDashboard />}
      </div>
    )
  }

  // ─── Login Screen ───
  return (
    <div id="app">
      <div id="login-screen">

        <div className="login-hero">
          <div className="logo">POSEIDON</div>
          <p>Water Tanker Delivery — Bengaluru Smart Routing</p>
        </div>

        {/* Role Picker */}
        <div className="role-selector">
          <div
            className={`role-card citizen${selectedRole === 'citizen' ? ' selected' : ''}`}
            onClick={() => pickRole('citizen')}
          >
            <div className="role-icon">🏠</div>
            <div className="role-name">Citizen</div>
            <div className="role-desc">Book water delivery</div>
          </div>
          <div
            className={`role-card driver${selectedRole === 'driver' ? ' selected' : ''}`}
            onClick={() => pickRole('driver')}
          >
            <div className="role-icon">🚛</div>
            <div className="role-name">Driver</div>
            <div className="role-desc">View your route</div>
          </div>
          <div
            className={`role-card admin${selectedRole === 'admin' ? ' selected' : ''}`}
            onClick={() => pickRole('admin')}
          >
            <div className="role-icon">⚙️</div>
            <div className="role-name">Admin</div>
            <div className="role-desc">Manage operations</div>
          </div>
        </div>

        {/* Login Form */}
        <div className="login-form-wrap">
          <div className="login-box">
            <h2>
              Sign in as{' '}
              {selectedRole === 'citizen' ? 'Citizen' : selectedRole === 'driver' ? 'Driver' : 'Admin'}
            </h2>

            {/* Citizen Fields */}
            {selectedRole === 'citizen' && (
              <>
                <div className="form-group">
                  <label>Full Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Ravi Kumar"
                    value={citizenName}
                    onChange={e => setCitizenName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && doLogin()}
                  />
                </div>
                <div className="form-group">
                  <label>Password</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={citizenPass}
                    onChange={e => setCitizenPass(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && doLogin()}
                  />
                  <div className="hint-text">Demo password: citizen123</div>
                </div>
              </>
            )}

            {/* Driver Fields */}
            {selectedRole === 'driver' && (
              <>
                <div className="form-group">
                  <label>Driver Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Ramesh"
                    value={driverName}
                    onChange={e => setDriverName(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Assigned Hub</label>
                  <select
                    value={driverHubId ?? ''}
                    onChange={e => setDriverHubId(parseInt(e.target.value))}
                  >
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
                  <label>Password</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={driverPass}
                    onChange={e => setDriverPass(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && doLogin()}
                  />
                  <div className="hint-text">Demo password: driver123</div>
                </div>
              </>
            )}

            {/* Admin Fields */}
            {selectedRole === 'admin' && (
              <>
                <div className="form-group">
                  <label>Admin Username</label>
                  <input
                    type="text"
                    placeholder="admin"
                    value={adminUser}
                    onChange={e => setAdminUser(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Password</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={adminPass}
                    onChange={e => setAdminPass(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && doLogin()}
                  />
                  <div className="hint-text">Demo password: admin123</div>
                </div>
              </>
            )}

            {loginError && (
              <div className="alert alert-error">⚠ {loginError}</div>
            )}

            <button
              className={`btn btn-${selectedRole} btn-full`}
              onClick={doLogin}
            >
              Sign In →
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}