import { Link } from 'react-router-dom';

export default function Homepage() {
  return (
    <div className="homepage">
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          background: #090b0f;
          color: #e8eaf0;
          font-family: 'DM Sans', system-ui, -apple-system, 'Segoe UI', sans-serif;
        }
        h1 {
          font-size: clamp(2.5rem, 8vw, 4rem);
          font-weight: 700;
          background: linear-gradient(135deg, #f5a623 0%, #e2b87a 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
        .container { max-width: 1280px; margin: 0 auto; padding: 0 1.5rem; }
        .hero { padding: 5rem 0 4rem; text-align: center; }
        .btn {
          padding: 0.8rem 1.8rem;
          border-radius: 40px;
          font-weight: 600;
          text-decoration: none;
          transition: all 0.2s;
          display: inline-block;
        }
        .btn-primary {
          background: #f5a623;
          color: #090b0f;
        }
        .btn-primary:hover {
          background: #e0910f;
          transform: scale(1.02);
        }
        .cta-buttons { margin-top: 2rem; display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap; }
        footer { text-align: center; padding: 3rem 1.5rem; color: #4e5ae6; font-size: 0.8rem; }
      `}</style>

      <div className="container">
        <div className="hero">
          <h1>HotelOS<br />The Autonomous Hotel Brain</h1>
          <p style={{ color: "#8892a4", marginTop: "1.5rem" }}>
            An AI-powered multi-agent system that runs hotel operations in real time - predicting needs, preventing issues, and acting autonomously.
          </p>
          <div className="cta-buttons">
            <Link to="/dashboard/map" className="btn btn-primary">
              Launch Hotel Map →
            </Link>
          </div>
        </div>
      </div>

      <footer>
        <p>HotelOS — Autonomous Hotel Brain | Built for the April Agentic Mini Hack</p>
        <p style={{ marginTop: "0.5rem" }}>Open source under MIT · Empowering independent hotels & communities</p>
      </footer>
    </div>
  );
}