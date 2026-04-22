import { Routes, Route, Navigate } from 'react-router';
import { LoginPage } from './pages/Login';
import { DashboardPage } from './pages/Dashboard';
import { SalesPage } from './pages/Sales';
import { SaleDetailPage } from './pages/SaleDetail';
import { TrendsPage } from './pages/Trends';
import { ProtectedRoute } from './components/ProtectedRoute';
import { DashboardLayout } from './layouts/DashboardLayout';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/sales" element={<SalesPage />} />
          <Route path="/sales/:saleNumber" element={<SaleDetailPage />} />
          <Route path="/trends" element={<TrendsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
