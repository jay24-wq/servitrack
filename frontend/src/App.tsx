import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import HomePage from './pages/public/HomePage';
import AboutPage from './pages/public/AboutPage';
import FaqPage from './pages/public/FaqPage';
import ServicesPage from './pages/public/ServicesPage';
import CapacityPage from './pages/public/CapacityPage';
import TrackingPage from './pages/public/TrackingPage';
import QuotationApprovalPage from './pages/public/QuotationApprovalPage';
import LoginPage from './pages/admin/LoginPage';
import RegisterPage from './pages/public/RegisterPage';
import DashboardPage from './pages/admin/DashboardPage';
import TechnicianDashboardPage from './pages/technician/TechnicianDashboardPage';
import TechnicianKanbanPage from './pages/technician/TechnicianKanbanPage';
import TechnicianInventoryPage from './pages/technician/TechnicianInventoryPage';
import TechnicianHistoryPage from './pages/technician/TechnicianHistoryPage';
import FrontdeskDashboardPage from './pages/frontdesk/FrontdeskDashboardPage';
import QueuePage from './pages/admin/QueuePage';
import TicketInputPage from './pages/admin/TicketInputPage';
import InventoryPage from './pages/admin/InventoryPage';
import StaffPage from './pages/admin/StaffPage';
import PaymentsPage from './pages/admin/PaymentsPage';
import ReportsPage from './pages/admin/ReportsPage';
import BookingCalendarPage from './pages/admin/BookingCalendarPage';
import SettingsPage from './pages/admin/SettingsPage';
import AccountSettingsPage from './pages/admin/AccountSettingsPage';
import CustomizationSettingsPage from './pages/admin/CustomizationSettingsPage';
import NotificationSettingsPage from './pages/admin/NotificationSettingsPage';
import WhatsAppSettingsPage from './pages/admin/WhatsAppSettingsPage';
import CustomizationProfilePage from './pages/admin/CustomizationProfilePage';
import OperationalSettingsPage from './pages/admin/OperationalSettingsPage';
import PaymentSettingsPage from './pages/admin/PaymentSettingsPage';
import PublicTrackingSettingsPage from './pages/admin/PublicTrackingSettingsPage';
import DashboardLayout from './components/admin/DashboardLayout';
import RequireRole from './components/auth/RequireRole';
import BookingPage from './pages/public/BookingPage';
import CourierPage from './pages/courier/CourierPage';
import CourierTaskDetailPage from './pages/courier/CourierTaskDetailPage';
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
        <Route path="/about" element={<AboutPage />} />
        <Route path="/faq" element={<FaqPage />} />
        <Route path="/layanan" element={<ServicesPage />} />
        <Route path="/kapasitas" element={<CapacityPage />} />
        <Route path="/tracking" element={<TrackingPage />} />
        <Route path="/quotation/approve/:token" element={<QuotationApprovalPage />} />
        <Route path="/booking" element={<BookingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/staff/login" element={<LoginPage portal="staff" />} />
        <Route path="/register" element={<RegisterPage />} />

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
            <RequireRole allow={['ADMIN', 'TEKNISI', 'FRONTDESK', 'KURIR']}>
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
        <Route
          path="/settings/account"
          element={
            <RequireRole allow={['ADMIN', 'FRONTDESK', 'TEKNISI', 'KURIR']}>
              <DashboardLayout>
                <AccountSettingsPage />
              </DashboardLayout>
            </RequireRole>
          }
        />
        <Route
          path="/settings"
          element={
            <RequireRole allow={['ADMIN']}>
              <DashboardLayout><Outlet /></DashboardLayout>
            </RequireRole>
          }
        >
          <Route index element={<SettingsPage />} />
          <Route path="appearance" element={<SettingsPage section="appearance" />} />
          <Route path="customization" element={<CustomizationSettingsPage />} />
          <Route path="customization/profile" element={<CustomizationProfilePage />} />
          <Route path="customization/operasional" element={<OperationalSettingsPage />} />
          <Route path="guide" element={<SettingsPage section="guide" />} />
          <Route path="notifications" element={<NotificationSettingsPage />} />
          <Route path="whatsapp" element={<WhatsAppSettingsPage />} />
          <Route path="payments" element={<PaymentSettingsPage />} />
          <Route path="public-tracking" element={<PublicTrackingSettingsPage />} />
          <Route path="*" element={<Navigate to="/settings" replace />} />
        </Route>

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
        <Route path="/technician/quotation" element={<Navigate to="/technician/kanban" replace />} />
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

        <Route path="/courier" element={<RequireRole allow={['KURIR']}><DashboardLayout><CourierPage /></DashboardLayout></RequireRole>} />
        <Route path="/courier/tasks/:id" element={<RequireRole allow={['KURIR']}><DashboardLayout><CourierTaskDetailPage /></DashboardLayout></RequireRole>} />
        <Route path="/courier/tasks" element={<RequireRole allow={['KURIR']}><DashboardLayout><CourierPage filter="tasks" /></DashboardLayout></RequireRole>} />
        <Route path="/courier/history" element={<RequireRole allow={['KURIR']}><DashboardLayout><CourierPage filter="history" /></DashboardLayout></RequireRole>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
