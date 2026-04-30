# Role-Based Access Control (RBAC) in HotelOS

HotelOS now supports three distinct user roles: `guest`, `staff`, and `admin`. Each role has a specific set of permissions, interfaces, and API endpoints it can access.

## Roles Overview

1. **Guest (`guest`)**
   - **Interface**: Guest Platform (`/guest/*`)
   - **Capabilities**: View personalized hotel info, submit service requests, view and accept upgrade offers, view the current bill, update preferences, and request express checkout.
   - **Access Restriction**: Guests cannot access the main dashboard (`/dashboard`) or the admin panel (`/admin`).

2. **Staff (`staff`)**
   - **Interface**: Main Dashboard (`/dashboard/*`)
   - **Capabilities**: View the hotel map, interact with AI agents, participate in staff chat, and manage the task board.
   - **Access Restriction**: Staff cannot access the guest platform or the admin dashboard.

3. **Admin / General Manager (`admin`)**
   - **Interface**: Admin Dashboard (`/admin/*`) & Main Dashboard (`/dashboard/*`)
   - **Capabilities**: View high-level metrics (Revenue, Occupancy, ADR, RevPAR), respond to guest reviews, monitor department performance, and view system health. Admins also have full access to all staff tools.
   - **Access Restriction**: Admins have access to all internal tools but use a separate default landing page.

## Testing Flows

### 1. Guest Flow
To test the guest experience, you need to log in using a guest's booking confirmation and last name.
- **URL**: `http://localhost:3000/` (Homepage)
- **Action**: Click "Enter The Cockpit", select "Guest Login".
- **Credentials**:
  - The database seed script automatically generates booking confirmation numbers (format: `BK-XXXX`) for existing guests.
  - To find a valid booking number, query the `guests` table or look at the API response from `/api/guests` as an authenticated staff member.
  - *Example Demo Credentials*:
    - **Booking Confirmation**: `BK-XXXX` (Check DB or API)
    - **Last Name**: `Harrington`
- **Verification**: You should be redirected to `/guest/home`. The layout will be a clean, mobile-friendly interface without the sidebar. Try submitting a request or viewing offers.

### 2. Staff Flow
- **URL**: `http://localhost:3000/` (Homepage)
- **Action**: Click "Enter The Cockpit", select "Staff / Admin".
- **Credentials**:
  - **Email**: `demo@hotelos.app`
  - **Password**: `staff123`
- **Verification**: You should be redirected to `/dashboard`. Attempting to visit `/admin` will redirect you back to `/dashboard`.

### 3. Admin Flow
- **URL**: `http://localhost:3000/` (Homepage)
- **Action**: Click "Enter The Cockpit", select "Staff / Admin".
- **Credentials**:
  - **Email**: `admin@hotelos.app`
  - **Password**: `admin123`
- **Verification**: You should be redirected to `/admin` where you can see revenue charts and guest reviews. You can also navigate to the main dashboard tools via the sidebar or URL manipulation.

## Implementation Details
- **Database**: The original `staff_users` table was migrated to a unified `users` table with a `role` column. For guests, their `guest_id` links the user record to the `guests` table.
- **Authentication**: The login endpoints issue JWTs containing the user's role.
- **Middleware**: The `authorize(roles)` Express middleware protects API routes based on the JWT role payload.
- **Frontend Routing**: React Router and the `useRoleRedirect` hook handle conditional rendering and redirection to ensure users only see their permitted views.
