import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Homepage from './Homepage';
import DashboardLayout from './DashboardLayout';
import DashboardHome from './pages/DashboardHome';
import HotelMapPage from './pages/HotelMapPage';
import AgentsPage from './pages/AgentsPage';
import ChatPage from './pages/ChatPage';
import TaskBoard from './pages/TaskBoard';
import GuestProfile from './pages/GuestProfile';

// Guest Pages
import GuestLayout from './layouts/GuestLayout';
import GuestHome from './pages/guest/GuestHome';
import GuestRequests from './pages/guest/GuestRequests';
import GuestOffers from './pages/guest/GuestOffers';
import GuestBill from './pages/guest/GuestBill';
import GuestProfilePage from './pages/guest/GuestProfile';

// Admin Pages
import AdminOverview from './pages/admin/AdminOverview';
import RevenueAnalytics from './pages/admin/RevenueAnalytics';
import ReviewsManager from './pages/admin/ReviewsManager';
import DepartmentOverview from './pages/admin/DepartmentOverview';
import SystemHealth from './pages/admin/SystemHealth';
import IssuesResolved from './pages/admin/IssuesResolved';

import { GuestProtectedRoute, AdminProtectedRoute, StaffProtectedRoute } from './components/RoleRoutes';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Homepage />} />
        
        {/* Guest Routes */}
        <Route element={<GuestProtectedRoute />}>
          <Route path="/guest" element={<GuestLayout />}>
            <Route path="home" element={<GuestHome />} />
            <Route path="requests" element={<GuestRequests />} />
            <Route path="offers" element={<GuestOffers />} />
            <Route path="bill" element={<GuestBill />} />
            <Route path="profile" element={<GuestProfilePage />} />
          </Route>
        </Route>

        {/* Admin Routes */}
        <Route element={<AdminProtectedRoute />}>
          <Route path="/admin" element={<DashboardLayout />}>
            <Route index element={<AdminOverview />} />
            <Route path="revenue" element={<RevenueAnalytics />} />
            <Route path="reviews" element={<ReviewsManager />} />
            <Route path="departments" element={<DepartmentOverview />} />
            <Route path="system" element={<SystemHealth />} />
            <Route path="issues" element={<IssuesResolved />} />
          </Route>
        </Route>

        {/* Staff / Dashboard Routes */}
        <Route element={<StaffProtectedRoute />}>
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<DashboardHome />} />
            <Route path="map" element={<HotelMapPage />} />
            <Route path="agents" element={<AgentsPage />} />
            <Route path="chat" element={<ChatPage />} />
            <Route path="tasks" element={<TaskBoard />} />
            <Route path="guest/:name" element={<GuestProfile />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;