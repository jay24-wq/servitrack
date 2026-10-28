import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import HomePage from './pages/public/HomePage';
import ServicesPage from './pages/public/ServicesPage';
import CapacityPage from './pages/public/CapacityPage';
import TrackingPage from './pages/public/TrackingPage';
import LoginPage from './pages/admin/LoginPage';
import DashboardPage from './pages/admin/DashboardPage';
import TechnicianDashboardPage from './pages/technician/TechnicianDashboardPage';
import TechnicianKanbanPage from './pages/technician/TechnicianKanbanPage';
import TechnicianInventoryPage from './pages/technician/TechnicianInventoryPage';
import TechnicianQuotationPage from './pages/technician/TechnicianQuotationPage';
import TechnicianHistoryPage from './pages/technician/TechnicianHistoryPage';
import FrontdeskDashboardPage from './pages/frontdesk/FrontdeskDashboardPage';
import QueuePage from './pages/admin/QueuePage';
import TicketInputPage from './pages/admin/TicketInputPage';
import InventoryPage from './pages/admin/InventoryPage';
import StaffPage from './pages/admin/StaffPage';
import PaymentsPage from './pages/admin/PaymentsPage';
import ReportsPage from './pages/admin/ReportsPage';
import BookingCalendarPage from './pages/admin/BookingCalendarPage';
import DashboardLayout from './components/admin/DashboardLayout';
import RequireRole from './components/auth/RequireRole';
import BookingPage from './pages/public/BookingPage';
import { useBookingStore } from './store';

function ResetBookingDateOnExit() {
  const location = useLocation();

  useEffect(() => {
    const { preserveOnExit, setSelectedDate, setPreserveOnExit } = useBookingStore.getState();
    if (location.pathname !== '/booking') {
      if (!preserveOnExit) setSelectedDate(null);
      setPreserveOnExit(false);
    } else {
      setPreserveOnExit(false);
    }
  }, [location.pathname]);

  return null;
}

function App() {
  return (
    <BrowserRouter>
      <ResetBookingDateOnExit />
      <Routes>
        {/* Public */}
        <Route path="/" element={<HomePage />} />
        <Route path="/layanan" element={<ServicesPage />} />
        <Route path="/kapasitas" element={<CapacityPage />} />
        <Route path="/tracking" element={<TrackingPage />} />
        <Route path="/booking" element={<BookingPage />} />
        <Route path="/login" element={<LoginPage />} />

        {/* Admin / Staff area — ADMIN only */}
        <Route
          path="/dashboard"
          element={
            <RequireRole allow={['ADMIN']}>
              <DashboardLayout>
                <DashboardPage />
              </DashboardLayout>
            </RequireRole>
          }
        />
        <Route
          path="/queue"
          element={
            <RequireRole allow={['ADMIN', 'FRONTDESK']}>
              <DashboardLayout>
                <QueuePage />
              </DashboardLayout>
            </RequireRole>
          }
        />
        <Route
          path="/queue/new"
          element={
            <RequireRole allow={['ADMIN', 'FRONTDESK']}>
              <DashboardLayout>
                <TicketInputPage />
              </DashboardLayout>
            </RequireRole>
          }
        />
        <Route
          path="/inventory"
          element={
            <RequireRole allow={['ADMIN']}>
              <DashboardLayout>
                <InventoryPage />
              </DashboardLayout>
            </RequireRole>
          }
        />
        <Route
          path="/staff"
          element={
            <RequireRole allow={['ADMIN']}>
              <DashboardLayout>
                <StaffPage />
              </DashboardLayout>
            </RequireRole>
          }
        />
        <Route
          path="/payments"
          element={
            <RequireRole allow={['ADMIN', 'FRONTDESK']}>
              <DashboardLayout>
                <PaymentsPage />
              </DashboardLayout>
            </RequireRole>
          }
        />
        <Route
          path="/reports"
          element={
            <RequireRole allow={['ADMIN']}>
              <DashboardLayout>
                <ReportsPage />
              </DashboardLayout>
            </RequireRole>
          }
        />
        <Route
          path="/booking-calendar"
          element={
            <RequireRole allow={['ADMIN']}>
              <DashboardLayout>
                <BookingCalendarPage />
              </DashboardLayout>
            </RequireRole>
          }
        />

        {/* Technician area — TEKNISI only */}
        <Route
          path="/technician"
          element={
            <RequireRole allow={['TEKNISI']}>
              <DashboardLayout>
                <TechnicianDashboardPage />
              </DashboardLayout>
            </RequireRole>
          }
        />
        <Route
          path="/technician/kanban"
          element={
            <RequireRole allow={['TEKNISI']}>
              <DashboardLayout>
                <TechnicianKanbanPage />
              </DashboardLayout>
            </RequireRole>
          }
        />
        <Route
          path="/technician/inventory"
          element={
            <RequireRole allow={['TEKNISI']}>
              <DashboardLayout>
                <TechnicianInventoryPage />
              </DashboardLayout>
            </RequireRole>
          }
        />
        <Route
          path="/technician/quotation"
          element={
            <RequireRole allow={['TEKNISI']}>
              <DashboardLayout>
                <TechnicianQuotationPage />
              </DashboardLayout>
            </RequireRole>
          }
        />
        <Route
          path="/technician/history"
          element={
            <RequireRole allow={['TEKNISI']}>
              <DashboardLayout>
                <TechnicianHistoryPage />
              </DashboardLayout>
            </RequireRole>
          }
        />

        {/* Frontdesk / Kasir area — FRONTDESK only */}
        <Route
          path="/frontdesk"
          element={
            <RequireRole allow={['FRONTDESK']}>
              <DashboardLayout>
                <FrontdeskDashboardPage />
              </DashboardLayout>
            </RequireRole>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
