# HotelOS Test Credentials

## Staff / Admin Logins

### Admin Account
- **Email**: `admin@hotelos.app`
- **Password**: `admin123`
- **Role**: `admin`
- **Access**: Admin dashboard with all tabs + manager dashboard access

### Staff Account
- **Email**: `demo@hotelos.app`
- **Password**: `staff123`
- **Role**: `staff`
- **Access**: Manager dashboard with all staff features

## Guest Login

### Test Guest
- **Booking Confirmation**: `BK-1234`
- **Last Name**: `Harrington`
- **Role**: `guest`
- **Access**: Guest portal with requests, offers, bill, profile

## API Endpoints

### Authentication
- **POST** `/api/login` - Staff/Admin login
  - Body: `{ "email": "string", "password": "string" }`
  - Returns: `{ token: "jwt", user: { id, name, email, role } }`

- **POST** `/api/auth/guest-login` - Guest login
  - Body: `{ "bookingNumber": "string", "lastName": "string" }`
  - Returns: `{ token: "jwt", user: { id, name, role } }`

## Frontend Testing

### Staff Login Flow
1. Click "Enter The Cockpit" button
2. Select "Staff / Admin" tab
3. Enter email: `demo@hotelos.app`
4. Enter password: `staff123`
5. Click "Login to HotelOS"
6. ✅ Should navigate to `/dashboard` with Operations Cockpit view
7. ✅ Sidebar should show staff navigation (Home, Map, Agents, Chat, Tasks)
8. ✅ Should NOT refresh the page during login

### Admin Login Flow
1. Click "Enter The Cockpit" button
2. Select "Staff / Admin" tab
3. Enter email: `admin@hotelos.app`
4. Enter password: `admin123`
5. Click "Login to HotelOS"
6. ✅ Should navigate to `/admin` with Admin Overview
7. ✅ Sidebar should show admin navigation (Overview, Revenue, Reviews, Departments, System, Issues, Agents, Manager Dashboard)
8. ✅ "Manager Dashboard" tab should be available
9. ✅ Clicking "Manager Dashboard" should navigate to `/dashboard`
10. ✅ Clicking back to any admin tab (e.g., Agents) should navigate back without requiring browser back button

### Navigation Tests
- **Staff Dashboard Navigation**: Click between tabs (Map, Agents, Chat, Tasks) - should NOT refresh page
- **Admin Navigation**: Click between tabs - should NOT refresh page
- **Cross-Interface Navigation**: Click "Manager Dashboard" from admin, then click admin tab - should navigate smoothly
- **Keyboard Shortcuts**: 
  - Ctrl+H - Navigate to home
  - Ctrl+M - Navigate to map
  - Ctrl+A - Navigate to agents
  - Ctrl+T - Navigate to tasks
  - ✅ None of these should refresh the page

### Expected Issue Status
- ✅ Staff login page refresh: **FIXED** - Using React Router navigate() instead of window.location.href
- ✅ Admin interface shows Manager Dashboard tab: **FIXED** - Tab added to navigation
- ✅ Navigation between admin and manager dashboard: **FIXED** - All links use React Router
- ✅ Switching tabs without browser back button: **FIXED** - Proper routing configuration

## Storage
- User data stored in localStorage: `hotelos_user`
- Authentication token stored in localStorage: `hotelos_token`
- Both persist across page reloads (allowing authenticated state to persist)
