# Quick Start - HotelOS Login Testing

## Running the Application

### Terminal 1: API Server
```bash
cd c:\Users\oumar\HotelOS\hotelos-api
npm start
# Should start on http://localhost:8080
```

### Terminal 2: React Dev Server
```bash
cd c:\Users\oumar\HotelOS
npm start
# Should start on http://localhost:3001
```

## Quick Test Checklist

### ✅ Staff Login Works
```
1. Go to http://localhost:3001
2. Click "Enter The Cockpit →"
3. Select "Staff / Admin" tab
4. Email: demo@hotelos.app
5. Password: staff123
6. Click "Login to HotelOS"
   → Should go to http://localhost:3001/dashboard
   → Should NOT refresh the page
   → Sidebar should show: Home, Map, Agents, Chat, Tasks
```

### ✅ Admin Login Works  
```
1. Go to http://localhost:3001
2. Click "Enter The Cockpit →"
3. Select "Staff / Admin" tab
4. Email: admin@hotelos.app
5. Password: admin123
6. Click "Login to HotelOS"
   → Should go to http://localhost:3001/admin
   → Sidebar should show: Overview, Revenue, Reviews, Departments, System, Issues, Agents, Manager Dashboard
```

### ✅ Admin Can Access Manager Dashboard
```
1. While on admin interface
2. Click "Manager Dashboard" tab
   → Should navigate to http://localhost:3001/dashboard
   → Sidebar should still show admin tabs
   → "Manager Dashboard" tab should be highlighted
```

### ✅ Navigation Works Without Refresh
```
1. While logged in as staff
2. Click on different tabs
   → URL should change
   → Active tab should highlight
   → Page should NOT refresh
```

## Troubleshooting

### "Connection error" on login
- Check if API server is running on port 8080
- Check network tab in DevTools for 400/500 errors

### Page shows blank/black screen
- Check browser console for JavaScript errors
- Try hard refresh: Ctrl+Shift+R

### Sidebar tabs not showing
- Open DevTools → Console
- Check `localStorage.getItem('hotelos_user')` for user role
- Verify user.role is either 'staff' or 'admin'

### Keyboard shortcuts don't work
- Make sure page focus is on the window (click on page first)
- Check DevTools → Console for errors

## Key Points

| Feature | Status | Notes |
|---------|--------|-------|
| Staff login | ✅ Works | No page refresh |
| Admin login | ✅ Works | Shows admin interface |
| Manager Dashboard tab | ✅ Added | Visible to admins only |
| Navigation | ✅ Works | Uses React Router, no refresh |
| localStorage | ✅ Persists | Survives page reload |
| Active tab highlighting | ✅ Fixed | Correct highlighting on all routes |

## Commands to Remember

```bash
# Hard refresh browser
Ctrl + Shift + R

# Check localStorage
// In browser console:
JSON.parse(localStorage.getItem('hotelos_user'))

# Keyboard shortcuts  
Ctrl+H  → Home
Ctrl+M  → Map  
Ctrl+A  → Agents
Ctrl+T  → Tasks
```
