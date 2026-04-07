import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Homepage from './Homepage';
import DashboardLayout from './DashboardLayout';
import DashboardHome from './pages/DashboardHome';
import HotelMapPage from './pages/HotelMapPage';
import AgentsPage from './pages/AgentsPage';
import ChatPage from './pages/ChatPage';
import TaskBoard from './pages/TaskBoard';
import GuestProfile from './pages/GuestProfile';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Homepage />} />
        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<DashboardHome />} />
          <Route path="map" element={<HotelMapPage />} />
          <Route path="agents" element={<AgentsPage />} />
          <Route path="chat" element={<ChatPage />} />
          <Route path="tasks" element={<TaskBoard />} />
          <Route path="guest/:name" element={<GuestProfile />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;