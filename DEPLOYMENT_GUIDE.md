# HotelOS Deployment Guide

## Quick Summary

The HotelOS app is now configured to work in both environments automatically:

- **Local Development** (`http://localhost:3000`): Uses `http://localhost:8080` backend
- **Render Deployment** (`https://hotelos-jp70.onrender.com`): Uses `https://hotelos-api-backend.onrender.com` backend

## How It Works

The `src/config.js` automatically detects the environment:

```javascript
- If running on localhost → Use local backend (http://localhost:8080)
- If running on .onrender.com domain → Use deployed backend (https://hotelos-api-backend.onrender.com)
- Otherwise → Use environment variable REACT_APP_API_URL or fallback to localhost
```

## Local Development

### Requirements
- Node.js 18+
- Backend running on `http://localhost:8080`
- Frontend runs on `http://localhost:3000`

### Start Local Backend
```bash
cd hotelos-api
npm install
npm start
# Backend will start on http://localhost:8080
```

### Start Local Frontend
```bash
cd ..
npm install
npm start
# Frontend will start on http://localhost:3000
```

The frontend automatically detects localhost and connects to the local backend.

## Render Deployment

### Prerequisites
1. Both frontend and backend deployed to Render.com
2. Backend service name: `hotelos-api`
3. Frontend deployed and accessible at `https://hotelos-jp70.onrender.com`

### Backend Configuration (hotelos-api service)

Set these environment variables in Render dashboard:

- `PORT`: `8080`
- `DATABASE_FILE`: `/data/hotelos.db` (or your preferred path)
- `JWT_SECRET`: Generate a random secret (Render can auto-generate)
- `STRIPE_SECRET_KEY`: Your Stripe key (if using payments)
- `STRIPE_WEBHOOK_SECRET`: Your Stripe webhook secret

The backend will be automatically accessible at its Render URL (e.g., `https://hotelos-api-xxxxx.onrender.com`)

### Frontend Configuration (Frontend service)

The frontend automatically detects it's on Render and points to the backend.

**Important**: Update `src/config.js` if backend URL is different:
```javascript
// Change this line in getApiUrl() function:
return 'https://hotelos-api-backend.onrender.com'; // Replace with actual backend URL
```

### Manual Override (if needed)

If the auto-detection fails, set environment variable in Render dashboard:
```
REACT_APP_API_URL=https://your-backend-url.onrender.com
```

## Build & Deploy

### Build for Production
```bash
npm run build
```

This creates an optimized `build/` folder ready for deployment.

### Deploy on Render

1. Connect GitHub repository to Render
2. Create two services:
   - **Service 1**: Frontend (React)
     - Build command: `npm run build`
     - Start command: `npm start` or use `serve -s build`
   - **Service 2**: Backend (Node/Express)
     - Build command: `cd hotelos-api && npm install`
     - Start command: `cd hotelos-api && npm start`

3. Set environment variables in Render dashboard for each service

4. Deploy!

## Test Credentials

### Staff/Admin Login
```
Email: demo@hotelos.app
Password: staff123
```

### Admin Account
```
Email: admin@hotelos.app
Password: admin123
```

### Guest Login
```
Booking: BK-1234
Last Name: Harrington
```

## Troubleshooting

### "Connection error" on login
- Check if backend service is running on Render
- Verify REACT_APP_API_URL is correct
- Check CORS settings on backend

### WebSocket connection fails
- Backend must support WebSocket (http-upgrade)
- Check firewall/proxy settings
- Verify WS_URL is correctly derived from API_BASE

### Login works locally but not on Render
- Verify backend URL in `src/config.js`
- Check Render service logs for errors
- Ensure JWT_SECRET is set on backend

### CORS errors
- Backend has CORS enabled: `cors({ origin: true, credentials: true })`
- Verify backend is receiving requests from frontend

## Architecture Overview

```
Frontend (hotelos-jp70.onrender.com)
    ↓
Auto-detects environment
    ↓
├─ Localhost → http://localhost:8080
└─ Render → https://hotelos-api-backend.onrender.com
    ↓
Backend API
    ↓
SQLite Database + JWT Auth
```

## Key Files

- `src/config.js` - Environment-aware API URL configuration
- `.env.local` - Local development overrides
- `hotelos-api/src/server.js` - Backend entry point
- `render.yml` - Render deployment configuration
- `package.json` - Frontend dependencies and scripts

## Security Notes

- JWT_SECRET should be randomly generated
- Never commit `.env.local` to git (it's in .gitignore)
- Use environment variables for sensitive data
- STRIPE credentials should be in Render dashboard, not code
- HTTPS is enforced on Render (automatically)

## Performance Tips

1. Enable caching headers on frontend (Render handles this)
2. Use CDN for static assets (Render provides CDN)
3. Keep database file persistent (Render data disks)
4. Monitor service logs for performance issues

## Next Steps

1. Ensure both services are running
2. Test staff login on both local and deployed versions
3. Monitor logs in Render dashboard
4. Set up monitoring/alerts as needed
