import { useState } from 'react'
import OrderForm from './components/OrderForm'
import AdminDashboard from './components/AdminDashboard'
import DriverView from './components/DriverView'

export default function App() {
  const [view, setView] = useState('citizen')
  const [orderCount, setOrderCount] = useState(0)

  return (
    <div className="app">
      <nav>
        <h1>💧 Neer Seva — Bengaluru Water Delivery</h1>
        <button
          className={view === 'citizen' ? 'active' : ''}
          onClick={() => setView('citizen')}
        >
          🏠 Book Water
        </button>
        <button
          className={view === 'admin' ? 'active' : ''}
          onClick={() => setView('admin')}
        >
          ⚙ Admin
        </button>
        <button
          className={view === 'driver' ? 'active' : ''}
          onClick={() => setView('driver')}
        >
          🚛 Driver
        </button>
      </nav>

      <div className="page">
        {view === 'citizen' && (
          <OrderForm onOrderPlaced={() => setOrderCount(c => c + 1)} />
        )}
        {view === 'admin' && (
          <AdminDashboard key={orderCount} />
        )}
        {view === 'driver' && (
          <DriverView />
        )}
      </div>
    </div>
  )
}