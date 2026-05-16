import { useState, useEffect } from 'react'
import OrderForm from './components/OrderForm'
import AdminDashboard from './components/AdminDashboard'
import DriverView from './components/DriverView'
import { login, clearAuth, getProfile, getToken } from './lib/api'

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
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
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

  return (
    <div id="app">
      <div id="login-screen">
        <div className="login-hero">
          <div className="logo">POSEIDON</div>
          <p>Bengaluru Water Crisis Platform</p>
        </div>
        <div className="role-selector">
          {['citizen', 'driver', 'admin'].map(role => (
            <div
              key={role}
              className={`role-card ${role}${selectedRole === role ? ' selected' : ''}`}
              onClick={() => pickRole(role)}
              role="button"
              tabIndex={0}
            >
              <div className="role-name">{roleLabels[role]}</div>
            </div>
          ))}
        </div>
        <div className="login-form-wrap">
          <div className="login-box">
            <h2>Sign in as {roleLabels[selectedRole]}</h2>
            <div className="form-group">
              <label>Username</label>
              <input value={username} onChange={e => setUsername(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} />
              <div className="hint-text">Demo: {selectedRole}123</div>
            </div>
            {loginError && <div className="alert alert-error">{loginError}</div>}
            <button type="button" className={`btn btn-${selectedRole} btn-full`} onClick={doLogin} disabled={loginLoading}>
              {loginLoading ? 'Signing in…' : 'Sign In'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
