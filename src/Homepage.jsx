import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import useAuthStore from './stores/useAuthStore';
import { API_BASE } from './config';
import { getRouteForRole, normalizeRole } from './utils/roles';

export default function Homepage() {
  const [loginType, setLoginType] = useState('guest'); // 'guest' or 'staff'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [bookingNumber, setBookingNumber] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);
  const [showLogin, setShowLogin] = useState(false);

  const { login } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const shouldShowLogin = params.get('login') === '1';
    const shouldLogout = params.get('logout') === '1';

    if (shouldLogout) {
      localStorage.removeItem('hotelos_user');
      localStorage.removeItem('hotelos_token');
      setShowLogin(true);
      navigate('/', { replace: true });
      return;
    }

    if (shouldShowLogin) {
      setShowLogin(true);
      return;
    }

    try {
      const savedUser = JSON.parse(localStorage.getItem('hotelos_user') || 'null');
      const role = normalizeRole(savedUser?.role);
      const token = localStorage.getItem('hotelos_token');
      const route = getRouteForRole(role);

      if (token && route) {
        navigate(route, { replace: true });
      } else if (token && role) {
        localStorage.removeItem('hotelos_user');
        localStorage.removeItem('hotelos_token');
      }
    } catch {
      localStorage.removeItem('hotelos_user');
      localStorage.removeItem('hotelos_token');
    }
  }, [location.search, navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    const endpoint = loginType === 'staff' ? '/api/login' : '/api/auth/guest-login';
    const body = loginType === 'staff' 
      ? { email, password } 
      : { bookingNumber, lastName };

    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      const data = await res.json();
      if (res.ok) {
        const loggedInUser = login(data.user, data.token);
        const role = loggedInUser?.role;
        const route = getRouteForRole(role);
        toast.success(`Welcome, ${data.user.name}!`);
        setShowLogin(false);
        setEmail('');
        setPassword('');
        setBookingNumber('');
        setLastName('');

        if (route) window.location.replace(route);
        else toast.error(`Unsupported role: ${role || 'unknown'}`);
      } else {
        toast.error(data.error || 'Login failed');
      }
    } catch (err) {
      toast.error('Connection error');
    }
    setLoading(false);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.2 } }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { duration: 0.8, ease: "easeOut" } }
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
                      url('https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1920&q=80');
          background-size: cover;
          background-position: center;
          z-index: -1;
        }

        .content-box { max-width: 900px; text-align: center; z-index: 1; }
        
        .login-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.8);
          backdrop-filter: blur(10px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2000;
        }

        .login-card {
          background: #0e1117;
          border: 1px solid #f5a623;
          border-radius: 24px;
          padding: 40px;
          width: 400px;
          box-shadow: 0 20px 50px rgba(0,0,0,0.5);
        }

        .login-tabs { display: flex; gap: 10px; margin-bottom: 30px; }
        .tab {
          flex: 1;
          padding: 10px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
          text-align: center;
          transition: all 0.2s;
          border: 1px solid rgba(255,255,255,0.1);
          color: #8892a4;
        }
        .tab.active { background: #f5a623; color: #090b0f; border-color: #f5a623; }

        .input-group { margin-bottom: 20px; text-align: left; }
        .input-group label { display: block; font-size: 12px; color: #8892a4; margin-bottom: 8px; text-transform: uppercase; }
        input {
          width: 100%;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.1);
          padding: 12px;
          border-radius: 8px;
          color: #fff;
          font-family: inherit;
        }

        .login-btn {
          width: 100%;
          background: #f5a623;
          color: #090b0f;
          border: none;
          padding: 14px;
          border-radius: 50px;
          font-weight: 700;
          cursor: pointer;
          margin-top: 10px;
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

        .cta-btn {
          padding: 1.2rem 3rem;
          font-size: 1.1rem;
          background: #f5a623;
          color: #090b0f;
          border-radius: 50px;
          text-decoration: none;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          display: inline-block;
          box-shadow: 0 10px 30px rgba(245, 166, 35, 0.3);
          border: none;
        }

        .cta-btn:hover {
          transform: translateY(-5px);
          box-shadow: 0 15px 40px rgba(245, 166, 35, 0.5);
        }

        footer { padding: 6rem 2rem; text-align: center; border-top: 1px solid rgba(255,255,255,0.05); }
        .footer-logo { font-family: 'Playfair Display', serif; font-size: 2rem; color: #f5a623; margin-bottom: 1rem; display: block; }
      `}</style>

      <section className="hero-section">
        <motion.div 
          className="hero-bg"
          initial={{ scale: 1.2, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 2, ease: "easeOut" }}
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
          
          <motion.p className="hero-description" variants={itemVariants} style={{ fontSize: '1.2rem', color: '#8892a4', marginBottom: '3rem' }}>
            A multi-agent AI orchestrator that manages every facet of your hotel — from revenue maximization to maintenance dispatch, acting with perfect autonomy.
          </motion.p>
          
          <motion.div variants={itemVariants}>
            <button onClick={() => setShowLogin(true)} className="cta-btn">
              Enter The Cockpit →
            </button>
          </motion.div>
        </motion.div>
      </section>

      <AnimatePresence>
        {showLogin && (
          <motion.div 
            className="login-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div 
              className="login-card"
              initial={{ scale: 0.8, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, y: 20 }}
            >
              <div className="login-tabs">
                <div className={`tab ${loginType === 'guest' ? 'active' : ''}`} onClick={() => setLoginType('guest')}>Guest Login</div>
                <div className={`tab ${loginType === 'staff' ? 'active' : ''}`} onClick={() => setLoginType('staff')}>Staff / Admin</div>
              </div>

              <form onSubmit={handleLogin}>
                {loginType === 'staff' ? (
                  <>
                    <div className="input-group">
                      <label>Email Address</label>
                      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="demo@hotelos.app" required />
                    </div>
                    <div className="input-group">
                      <label>Password</label>
                      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="input-group">
                      <label>Booking Confirmation</label>
                      <input type="text" value={bookingNumber} onChange={(e) => setBookingNumber(e.target.value)} placeholder="BK-1234" required />
                    </div>
                    <div className="input-group">
                      <label>Last Name</label>
                      <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Harrington" required />
                    </div>
                  </>
                )}

                <button type="submit" className="login-btn" disabled={loading}>
                  {loading ? 'Authenticating...' : 'Login to HotelOS'}
                </button>
                
                <button 
                  type="button" 
                  onClick={() => setShowLogin(false)} 
                  style={{ width: '100%', background: 'transparent', border: 'none', color: '#8892a4', marginTop: 16, cursor: 'pointer', fontSize: 13 }}
                >
                  Cancel
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <footer>
        <span className="footer-logo">HotelOS</span>
        <p style={{ color: "#8892a4", maxWidth: "600px", margin: "0 auto 2rem" }}>
          Empowering modern hotels with agentic intelligence. 
          Built for the future of hospitality.
        </p>
      </footer>
    </div>
  );
}
