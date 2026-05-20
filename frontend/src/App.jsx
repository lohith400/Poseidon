import { useState, useEffect } from 'react'
import OrderForm from './components/OrderForm'
import AdminDashboard from './components/AdminDashboard'
import DriverView from './components/DriverView'
import { login, clearAuth, getProfile, getToken } from './lib/api'

const ROLES = [
  { id: 'citizen', label: 'Citizen', icon: '🏠', desc: 'Book water delivery' },
  { id: 'driver', label: 'Driver', icon: '🚛', desc: 'Live route & GPS' },
  { id: 'admin', label: 'Admin', icon: '🌊', desc: 'Crisis & operations' },
]

function LoginWaves() {
  return (
    <div className="login-waves" aria-hidden="true">
      <svg className="wave-3" viewBox="0 0 1440 320" preserveAspectRatio="none">
        <path
          fill="rgba(255,255,255,0.15)"
          d="M0,192L48,181.3C96,171,192,149,288,154.7C384,160,480,192,576,186.7C672,181,768,139,864,128C960,117,1056,139,1152,149.3C1248,160,1344,160,1392,160L1440,160L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
        />
      </svg>
      <svg className="wave-2" viewBox="0 0 1440 320" preserveAspectRatio="none">
        <path
          fill="rgba(255,255,255,0.25)"
          d="M0,224L48,213.3C96,203,192,181,288,181.3C384,181,480,203,576,208C672,213,768,203,864,186.7C960,171,1056,149,1152,154.7C1248,160,1344,192,1392,208L1440,224L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
        />
      </svg>
      <svg className="wave-1" viewBox="0 0 1440 320" preserveAspectRatio="none">
        <path
          fill="rgba(240,253,250,0.9)"
          d="M0,256L48,245.3C96,235,192,213,288,218.7C384,224,480,256,576,250.7C672,245,768,203,864,192C960,181,1056,203,1152,213.3C1248,224,1344,224,1392,224L1440,224L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
        />
      </svg>
    </div>
  )
}

export default function App() {
  const [currentRole, setCurrentRole] = useState(null)
  const [currentUser, setCurrentUser] = useState(null)
  const [selectedRole, setSelectedRole] = useState('citizen')
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [driverHubId, setDriverHubId] = useState(null)

  useEffect(() => {
    const profile = getProfile()
    if (profile && getToken()) {
      setCurrentRole(profile.role)
      setCurrentUser(profile.display_name || profile.username)
      if (profile.hub_id) setDriverHubId(profile.hub_id)
    }
  }, [])

  function pickRole(role) {
    setSelectedRole(role)
    setLoginError('')
    setUsername(role)
    setPassword('')
  }

  async function doLogin() {
    setLoginError('')
    setLoginLoading(true)
    try {
      const data = await login(username.trim(), password)
      setCurrentRole(data.role)
      setCurrentUser(data.display_name || username)
      if (data.hub_id) setDriverHubId(data.hub_id)
    } catch (err) {
      setLoginError(err.message || 'Login failed')
    } finally {
      setLoginLoading(false)
    }
  }

  function logout() {
    clearAuth()
    setCurrentRole(null)
    setCurrentUser(null)
    setUsername('')
    setPassword('')
    setSelectedRole('citizen')
  }

  const roleLabels = { citizen: 'Citizen', driver: 'Driver', admin: 'Admin' }

  if (currentRole) {
    return (
      <div id="app">
        <nav className="topnav">
          <div className="nav-brand">Poseidon</div>
          <div className="nav-actions">
            <span className="nav-user">{currentUser}</span>
            <span className={`nav-role-badge role-${currentRole}`}>{roleLabels[currentRole]}</span>
            <button type="button" className="btn-logout" onClick={logout}>Sign Out</button>
          </div>
        </nav>
        {currentRole === 'citizen' && <OrderForm userName={currentUser} />}
        {currentRole === 'driver' && <DriverView driverName={currentUser} defaultHubId={driverHubId} />}
        {currentRole === 'admin' && <AdminDashboard />}
      </div>
    )
  }

  const activeRole = ROLES.find(r => r.id === selectedRole)

  return (
    <div id="app">
      <div id="login-screen">
        <LoginWaves />
        <div className="login-content">
          <div className="login-hero">
            <div className="logo-mark" aria-hidden="true">💧</div>
            <div className="logo">POSEIDON</div>
            <p className="tagline">Bengaluru Water Crisis Platform</p>
            <p className="tagline-sub">Forecast · Dispatch · Live reservoir intelligence</p>
          </div>

          <div className="role-selector">
            {ROLES.map(role => (
              <div
                key={role.id}
                className={`role-card ${role.id}${selectedRole === role.id ? ' selected' : ''}`}
                onClick={() => pickRole(role.id)}
                onKeyDown={e => e.key === 'Enter' && pickRole(role.id)}
                role="button"
                tabIndex={0}
              >
                <span className="role-icon">{role.icon}</span>
                <span className="role-name">{role.label}</span>
                <span className="role-desc">{role.desc}</span>
              </div>
            ))}
          </div>

          <div className="login-form-wrap">
            <div className="login-box">
              <h2>Sign in as {activeRole?.label}</h2>
              <div className="form-group">
                <label>Username</label>
                <input
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && doLogin()}
                  placeholder={selectedRole}
                  autoComplete="username"
                />
              </div>
              <div className="form-group">
                <label>Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && doLogin()}
                  autoComplete="current-password"
                />
                <div className="hint-text">Demo password: {selectedRole}123</div>
              </div>
              {loginError && <div className="alert alert-error">{loginError}</div>}
              <button
                type="button"
                className={`btn btn-${selectedRole} btn-full`}
                onClick={doLogin}
                disabled={loginLoading}
              >
                {loginLoading ? 'Signing in…' : 'Enter the platform'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
