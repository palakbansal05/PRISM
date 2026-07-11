import { Link } from 'react-router-dom';

export default function PublicNavbar() {
  return (
    <nav className="landing-nav">
      <div className="landing-nav-brand">
        <Link to="/welcome" style={{ textDecoration: 'none', color: 'inherit' }}>
          <span>PRISM</span>
        </Link>
      </div>
      
      <div className="landing-nav-center">
        <Link to="/about" className="nav-link-item">About</Link>
        <Link to="/why" className="nav-link-item">Why I Built It</Link>
      </div>

      <div className="landing-nav-links">
        <Link to="/login" className="nav-link-login">Sign In</Link>
        <Link to="/register" className="nav-link-register">Get Started</Link>
      </div>
    </nav>
  );
}
