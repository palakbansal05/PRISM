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
          <span>PRISM</span>
        </div>
        
        <div className="landing-nav-center">
          <Link to="#about" className="nav-link-item">About Us</Link>
          <div className="nav-dropdown">
            <span className="nav-link-item">Why <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg></span>
          </div>
        </div>

        <div className="landing-nav-links">
          <Link to="/login" className="nav-link-login">Sign In</Link>
          <Link to="/register" className="nav-link-register">Get Started</Link>
        </div>
      </nav>

      {/* Hero Split Layout */}
      <section className="landing-hero-split">
        <div className="hero-left">
          <h1 className="hero-title-large">
            API <span className="highlight-underline">monitoring</span> and <br/>
            <span className="highlight-underline">insights</span> that put <br/>
            reliability at the frontier
          </h1>
        </div>
        <div className="hero-right">
          <div className="prism-network-animation" aria-label="API monitoring animation">
            <div className="prism-network-grid" aria-hidden="true"></div>

            <div className="prism-node-card prism-client-node">
              <span className="prism-node-icon">CLI</span>
              <strong>Client</strong>
              <small>register endpoint</small>
            </div>

            <div className="prism-node-card prism-prism-node">
              <span className="prism-mark">P</span>
              <strong>PRISM</strong>
              <small>stores endpoint</small>
            </div>

            <div className="prism-node-card prism-endpoint-node">
              <span className="prism-node-icon">API</span>
              <strong>Endpoint</strong>
              <small>/health ping</small>
              <span className="prism-warning-badge" aria-hidden="true">!</span>
            </div>

            <span className="prism-packet prism-register-packet">Endpoint</span>
            <span className="prism-packet prism-request-packet">Request</span>
            <span className="prism-packet prism-response-packet prism-good-response-packet">Good</span>
            <span className="prism-packet prism-request-packet prism-bad-request-packet">Request</span>
            <span className="prism-packet prism-response-packet prism-bad-response-packet">Bad</span>
            <span className="prism-packet prism-alert-packet">Email alert</span>
          </div>
          <div className="hero-cta-side">
            <Link to="/register" className="cta-primary">
              Start Monitoring
            </Link>
            <Link to="/login" className="cta-secondary">
              Sign In
            </Link>
          </div>
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
