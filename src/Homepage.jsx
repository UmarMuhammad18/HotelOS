// src/Homepage.jsx
export default function Homepage({ onLaunch }) {
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
        .grid-3 {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 2rem;
        }
        .card {
          background: #0e1117;
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 24px;
          padding: 1.8rem;
        }
        .card h3 { margin-bottom: 0.75rem; }
        .card p { color: #8892a4; }
        section { padding: 4rem 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .section-title { text-align: center; margin-bottom: 3rem; }
        .btn-outline {
          border: 1px solid rgba(245,166,35,0.5);
          color: #f5a623;
          background: transparent;
        }
        .cta-buttons { margin-top: 2rem; display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap; }
        footer { text-align: center; padding: 3rem 1.5rem; color: #4e5a6e; font-size: 0.8rem; }
      `}</style>

      <div className="container">
        <div className="hero">
          <h1>HotelOS<br />The Autonomous Hotel Brain</h1>
          <p style={{ color: "#8892a4", marginTop: "1.5rem" }}>
            An AI‑powered multi‑agent system that runs hotel operations in real time — predicting needs, preventing issues, and acting autonomously.
          </p>
          <div className="cta-buttons">
            <button type="button" className="btn btn-primary" onClick={onLaunch}>
              Launch Dashboard →
            </button>
          </div>
        </div>
      </div>

      <section>
        <div className="container">
          <div className="section-title">
            <h2>What makes HotelOS different?</h2>
            <p style={{ color: "#8892a4" }}>It doesn't just assist — it acts.</p>
          </div>
          <div className="grid-3">
            <div className="card">
              <h3>🤖🧠 True Agentic System</h3>
              <p>Orchestrator + specialised agents (Ops, Revenue, Guest Experience) that reason, use tools, and coordinate autonomously.</p>
            </div>
            <div className="card">
              <h3>⚡📊 Real‑time Decisions</h3>
              <p>Predictive intelligence prevents problems before they happen – from housekeeping bottlenecks to pricing optimisations.</p>
            </div>
            <div className="card">
              <h3>🌍♻️ Sustainability First</h3>
              <p>Energy optimisation, waste reduction, and local community integration — built for the future of hospitality.</p>
            </div>
          </div>
        </div>
      </section>

      <footer>
        <p>HotelOS — Autonomous Hotel Brain | Built for the April Agentic Mini Hack</p>
        <p style={{ marginTop: "0.5rem" }}>Open source under MIT · Empowering independent hotels & communities</p>
      </footer>
    </div>
  );
}