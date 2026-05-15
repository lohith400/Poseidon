import "./Signup.css";

function Signup({ onSignIn }) {
  return (
    <div className="signup-page">

      {/* Ambient blobs */}
      <div className="blob blob1"></div>
      <div className="blob blob2"></div>
      <div className="blob blob3"></div>

      {/* Ripple rings */}
      <div className="ripple ripple1"></div>
      <div className="ripple ripple2"></div>
      <div className="ripple ripple3"></div>

      {/* Rising bubbles */}
      <div className="bubble b1"></div>
      <div className="bubble b2"></div>
      <div className="bubble b3"></div>
      <div className="bubble b4"></div>
      <div className="bubble b5"></div>

      {/* Animated wave */}
      <div className="wave-wrap">
        <svg viewBox="0 0 1440 80" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M0,40 C180,80 360,0 540,40 C720,80 900,0 1080,40 C1260,80 1440,0 1440,40 L1440,80 L0,80 Z"
            fill="rgba(14,165,233,0.08)"
          />
          <path
            d="M0,55 C200,20 400,70 600,45 C800,20 1000,65 1200,45 C1300,35 1380,50 1440,55 L1440,80 L0,80 Z"
            fill="rgba(14,165,233,0.05)"
          />
        </svg>
      </div>

      {/* Signup Card */}
      <div className="signup-card">

        <div className="card-accent-bar"></div>

        {/* Logo */}
        <div className="logo-row">
          <div className="logo-icon">
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C12 2 4 10.5 4 15.5C4 19.6 7.6 23 12 23C16.4 23 20 19.6 20 15.5C20 10.5 12 2 12 2Z" />
            </svg>
          </div>
          <div className="logo-text">
            <span className="logo-sub">Water Supply Management</span>
            <span className="logo-name">PROJECT <em>POSEIDON</em></span>
          </div>
          <span className="bwssb-chip">BWSSB</span>
        </div>

        <div className="card-heading">
          <h2>Create your account</h2>
        </div>
        <p className="card-desc">Register to access the water supply portal</p>

        {/* Form */}
        <form className="signup-form" onSubmit={e => e.preventDefault()}>

          <div className="input-group">
            <label>Registered Aadhar Number</label>
            <div className="input-wrap">
              <input type="text" placeholder="Enter Aadhar Number" />
            </div>
          </div>

          <div className="input-group">
            <label>Full Name</label>
            <div className="input-wrap">
              <input type="text" placeholder="Enter Full Name" />
            </div>
          </div>

          <div className="input-group">
            <label>Password</label>
            <div className="input-wrap">
              <input type="password" placeholder="Enter Password" />
            </div>
          </div>

          <div className="form-divider"></div>

          <div className="input-group">
            <label>Address</label>
            <div className="input-wrap">
              <textarea rows="3" placeholder="Enter Address"></textarea>
            </div>
          </div>

          <button type="submit">Create Account</button>

        </form>

        <p className="card-footer">
          Already registered?{' '}
          <span onClick={onSignIn} style={{ cursor: 'pointer' }}>
            Sign in here
          </span>
        </p>

      </div>
    </div>
  );
}

export default Signup;
