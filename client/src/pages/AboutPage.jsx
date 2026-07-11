import PublicNavbar from '../components/PublicNavbar';
import PublicFooter from '../components/PublicFooter';
import './LandingPage.css';

export default function AboutPage() {
  return (
    <div className="landing">
      <div className="landing-bg">
        <div className="landing-orb landing-orb-1"></div>
        <div className="landing-orb landing-orb-2"></div>
        <div className="landing-grid"></div>
      </div>
      <PublicNavbar />
      
      <section className="landing-section" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '85vh', padding: '40px 24px' }}>
        <div className="section-content" style={{ margin: 0, width: '100%' }}>
          <h2>About</h2>
          <p>
            PRISM is a modern, reliable API monitoring tool designed for developers who need deep observability into their endpoints.
            Born out of a personal student project to solve real-world uptime tracking challenges, PRISM provides real-time health checks,
            latency analytics, and incident replays—all wrapped in a clean, intuitive interface.
          </p>
          
          <h3 style={{ marginTop: '32px', marginBottom: '20px', fontSize: '20px', color: 'var(--text-primary)' }}>Technical Architecture</h3>
          <p style={{ marginBottom: '20px' }}>
            Under the hood, PRISM leverages a robust, modern tech stack designed for high throughput and reliability:
          </p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'left' }}>
            <div style={{ padding: '16px', background: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>Node.js Worker Threads</strong>
              <span style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>Offloads the heavy lifting of concurrent API pinging, ensuring the main server thread never blocks during mass health checks.</span>
            </div>
            
            <div style={{ padding: '16px', background: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>WebSockets (Socket.io)</strong>
              <span style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>Enables real-time, bi-directional communication to push live incident alerts directly to your dashboard the millisecond an endpoint fails.</span>
            </div>
            
            <div style={{ padding: '16px', background: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>React & Vite</strong>
              <span style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>Provides a lightning-fast, modular frontend experience that renders complex latency metrics smoothly.</span>
            </div>
            
            <div style={{ padding: '16px', background: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>MongoDB</strong>
              <span style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>A flexible NoSQL database to efficiently store, index, and query vast amounts of time-series latency metrics.</span>
            </div>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
