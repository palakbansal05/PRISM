import PublicNavbar from '../components/PublicNavbar';
import PublicFooter from '../components/PublicFooter';
import './LandingPage.css';

export default function WhyPage() {
  return (
    <div className="landing">
      <div className="landing-bg">
        <div className="landing-orb landing-orb-2"></div>
        <div className="landing-orb landing-orb-3"></div>
        <div className="landing-grid"></div>
      </div>
      <PublicNavbar />
      
      <section className="landing-section" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '85vh', padding: '40px 24px' }}>
        <div className="section-content" style={{ margin: 0, width: '100%' }}>
          <h2>Why I Built It</h2>
          <p style={{ marginBottom: '16px' }}>
            It started at a hackathon. My project had been working flawlessly all night. But the exact moment I stood in front of the judging panel to give the final demo, <strong>the API silently crashed</strong>.
          </p>
          <p style={{ marginBottom: '16px' }}>
            I was left awkwardly refreshing a broken page, desperately trying to explain to the judges that <em>"it was working just a minute ago!"</em>
          </p>
          <p>
            That frustrating, all-too-familiar feeling is why I built PRISM. I wanted to create a tool for myself and my fellow developers so we never have to guess if our backend is alive. PRISM gives you the absolute confidence to showcase your project to anyone, at any time, knowing exactly what's happening under the hood.
          </p>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
