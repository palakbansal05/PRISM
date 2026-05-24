import { Link } from 'react-router-dom';
import './LandingPage.css';

export default function LandingPage() {
  return (
    <div className="landing">
      {/* Animated background */}
      <div className="landing-bg">
        <div className="landing-orb landing-orb-1"></div>
        <div className="landing-orb landing-orb-2"></div>
        <div className="landing-orb landing-orb-3"></div>
        <div className="landing-grid"></div>
      </div>

      {/* Navigation */}
      <nav className="landing-nav">
        <div className="landing-nav-brand">
          <div className="nav-prism-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="url(#navGrad)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <defs>
                <linearGradient id="navGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#FFFFFF" />
                  <stop offset="100%" stopColor="#00B4D8" />
                </linearGradient>
              </defs>
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </div>
          <span>PRISM</span>
        </div>
        <div className="landing-nav-links">
          <Link to="/login" className="nav-link-login">Sign In</Link>
          <Link to="/register" className="nav-link-register">Get Started</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="landing-hero">
        <div className="hero-badge">
          <span className="hero-badge-dot"></span>
          Reliable API Monitoring
        </div>

        <h1 className="hero-title">
          <span className="hero-title-prism">PRISM</span>
        </h1>
        <p className="hero-fullform">
          <span className="ff-letter">P</span>roactive{' '}
          <span className="ff-letter">R</span>equest{' '}
          <span className="ff-letter">I</span>nspection &{' '}
          <span className="ff-letter">S</span>tatus{' '}
          <span className="ff-letter">M</span>onitor
        </p>

        <p className="hero-description">
          Monitor your APIs in real-time. Track uptime, latency percentiles, 
          and replay failed requests instantly. Get notified before your users 
          even notice an outage.
        </p>

        <div className="hero-cta">
          <Link to="/register" className="cta-primary">
            Start Monitoring
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </Link>
          <Link to="/login" className="cta-secondary">
            Sign In
          </Link>
        </div>
      </section>

      {/* Code Snippet Section */}
      <section className="landing-snippet">
        <div className="snippet-container">
          <div className="snippet-header">
            <span className="dot red"></span>
            <span className="dot amber"></span>
            <span className="dot green"></span>
            <span className="snippet-title">health-check.js</span>
          </div>
          <pre className="snippet-code">
            <code>
<span className="code-keyword">const</span> endpoint = <span className="code-string">'https://api.yourdomain.com/v1/health'</span>;<br/>
<span className="code-keyword">const</span> result = <span className="code-keyword">await</span> monitor.ping(endpoint);<br/>
<br/>
<span className="code-keyword">if</span> (!result.success) {'{'}<br/>
{'  '}alert.trigger(<span className="code-string">'Endpoint Down!'</span>, result.latencyMs);<br/>
{'  '}incident.record(result.error);<br/>
{'}'} <span className="code-keyword">else</span> {'{'}<br/>
{'  '}metrics.recordLatency(result.latencyMs);<br/>
{'}'}<br/>
            </code>
          </pre>
        </div>
      </section>

      {/* Features */}
      <section className="landing-features">
        <div className="feature-card">
          <div className="feature-icon cyan">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          </div>
          <h3>Real-Time Monitoring</h3>
          <p>Ping your endpoints at configurable intervals. Track every request with full headers, body, and latency data.</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon purple">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <h3>Latency Percentiles</h3>
          <p>Visualize p50, p95, and p99 latency trends with interactive charts. Catch performance regressions instantly.</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon red">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </div>
          <h3>Incident Replay</h3>
          <p>Click any failed request to replay it live. See the diff between then and now — status codes, latency, and response.</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon amber">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
          </div>
          <h3>Email Alerts</h3>
          <p>Get instant notifications via Resend when an endpoint goes down or recovers. Never miss a disruption.</p>
        </div>
      </section>

      <footer className="landing-footer">
        <p>Built for teams who need fast, reliable observability.</p>
      </footer>
    </div>
  );
}
