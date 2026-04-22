import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function Homepage() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { duration: 0.8, ease: "easeOut" }
    }
  };

  return (
    <div className="homepage">
      <style>{`
        .hero-section {
          position: relative;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          padding: 2rem;
        }

        .hero-bg {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: linear-gradient(to bottom, rgba(9, 11, 15, 0.4), rgba(9, 11, 15, 0.9)), 
                      url('/hero.png');
          background-size: cover;
          background-position: center;
          z-index: -1;
          transform: scale(1.1);
        }

        .animated-overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: radial-gradient(circle at 50% 50%, rgba(245, 166, 35, 0.05) 0%, transparent 70%);
          z-index: -1;
        }

        .content-box {
          max-width: 900px;
          text-align: center;
          z-index: 1;
        }

        .badge {
          display: inline-block;
          padding: 0.5rem 1.2rem;
          background: rgba(245, 166, 35, 0.1);
          color: #f5a623;
          border-radius: 100px;
          font-weight: 600;
          font-size: 0.85rem;
          margin-bottom: 1.5rem;
          border: 1px solid rgba(245, 166, 35, 0.2);
          letter-spacing: 1px;
          text-transform: uppercase;
        }

        h1 {
          font-family: 'Playfair Display', serif;
          font-size: clamp(3rem, 10vw, 5.5rem);
          line-height: 1.1;
          margin-bottom: 1.5rem;
          background: linear-gradient(135deg, #fff 0%, #a5a9b5 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }

        .hero-description {
          font-size: clamp(1.1rem, 3vw, 1.4rem);
          color: #8892a4;
          line-height: 1.6;
          margin-bottom: 3rem;
          max-width: 700px;
          margin-left: auto;
          margin-right: auto;
        }

        .cta-btn {
          padding: 1.2rem 3rem;
          font-size: 1.1rem;
          background: #f5a623;
          color: #090b0f;
          border-radius: 50px;
          text-decoration: none;
          font-weight: 700;
          transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          display: inline-block;
          box-shadow: 0 10px 30px rgba(245, 166, 35, 0.3);
        }

        .cta-btn:hover {
          transform: translateY(-5px);
          box-shadow: 0 15px 40px rgba(245, 166, 35, 0.5);
          background: #ffb53d;
        }

        .features-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 2rem;
          padding: 5rem 0;
          margin-top: -5rem;
        }

        .feature-card {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.05);
          padding: 2.5rem;
          border-radius: 24px;
          transition: all 0.4s ease;
          backdrop-filter: blur(10px);
        }

        .feature-card:hover {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(245, 166, 35, 0.3);
          transform: translateY(-10px);
        }

        .feature-icon {
          font-size: 2.5rem;
          margin-bottom: 1.5rem;
          display: block;
        }

        .feature-card h3 {
          font-size: 1.5rem;
          margin-bottom: 1rem;
          color: #fff;
        }

        .feature-card p {
          color: #8892a4;
          line-height: 1.6;
        }

        footer {
          padding: 6rem 2rem;
          text-align: center;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
        }

        .footer-logo {
          font-family: 'Playfair Display', serif;
          font-size: 2rem;
          color: #f5a623;
          margin-bottom: 1rem;
          display: block;
        }

        @media (max-width: 768px) {
          .hero-section {
            padding: 4rem 1.5rem;
          }
          .features-grid {
            grid-template-columns: 1fr;
            padding: 3rem 1rem;
          }
        }
      `}</style>

      <section className="hero-section">
        <motion.div 
          className="hero-bg"
          initial={{ scale: 1.2, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 2, ease: "easeOut" }}
        />
        <motion.div 
          className="animated-overlay"
          animate={{ 
            opacity: [0.3, 0.5, 0.3],
            scale: [1, 1.1, 1]
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        
        <motion.div 
          className="content-box"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.span className="badge" variants={itemVariants}>
            Autonomous Hospitality
          </motion.span>
          
          <motion.h1 variants={itemVariants}>
            HotelOS<br />The Digital Soul of Luxury
          </motion.h1>
          
          <motion.p className="hero-description" variants={itemVariants}>
            A multi-agent AI orchestrator that manages every facet of your hotel — from revenue maximization to maintenance dispatch, acting with perfect autonomy.
          </motion.p>
          
          <motion.div variants={itemVariants}>
            <Link to="/dashboard" className="cta-btn">
              Enter The Cockpit →
            </Link>
          </motion.div>
        </motion.div>
      </section>

      <div className="container" style={{ maxWidth: "1280px", margin: "0 auto", padding: "0 2rem" }}>
        <div className="features-grid">
          <motion.div 
            className="feature-card"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <span className="feature-icon">🧠</span>
            <h3>Autonomous Brain</h3>
            <p>Multiple AI agents coordinate in real-time to solve guest issues, manage staff tasks, and optimize operations without human intervention.</p>
          </motion.div>

          <motion.div 
            className="feature-card"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
          >
            <span className="feature-icon">📈</span>
            <h3>Revenue Engine</h3>
            <p>Our Revenue AI adjusts pricing, identifies upsell opportunities, and forecasts demand to ensure maximum profitability every night.</p>
          </motion.div>

          <motion.div 
            className="feature-card"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
          >
            <span className="feature-icon">🗺️</span>
            <h3>Digital Twin</h3>
            <p>A beautiful, real-time map of your hotel showing room status, guest needs, and agent activities in one interactive cockpit.</p>
          </motion.div>
        </div>
      </div>

      <footer>
        <span className="footer-logo">HotelOS</span>
        <p style={{ color: "#8892a4", maxWidth: "600px", margin: "0 auto 2rem" }}>
          Empowering modern hotels with agentic intelligence. 
          Built for the future of hospitality.
        </p>
        <div style={{ fontSize: "0.8rem", color: "#4e5ae6", opacity: 0.7 }}>
          &copy; 2026 HotelOS — April Agentic Hack Submission
        </div>
      </footer>
    </div>
  );
}