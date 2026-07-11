export default function PublicFooter() {
  return (
    <footer className="landing-footer">
      <div className="footer-content">
        <div className="footer-section brand-section">
          <h3>PRISM</h3>
          <p>Built for teams who need fast, reliable observability.</p>
        </div>
        
        <div className="footer-section links-section">
          <h3>Connect</h3>
          <div className="footer-links">
            <a href="https://github.com/palakbansal05/PRISM" target="_blank" rel="noreferrer">GitHub Repository</a>
            <a href="https://github.com/palakbansal05" target="_blank" rel="noreferrer">Creator GitHub</a>
            <a href="https://www.linkedin.com/in/palakbansal-05-/" target="_blank" rel="noreferrer">LinkedIn Profile</a>
          </div>
        </div>

        <div className="footer-section contact-section">
          <h3>Feedback</h3>
          <p>Have suggestions or found a bug? I'd love to hear from you.</p>
          <a href="https://mail.google.com/mail/?view=cm&fs=1&to=palakkb.05@gmail.com" target="_blank" rel="noreferrer" className="contact-btn">Contact Me</a>
        </div>
      </div>
    </footer>
  );
}
