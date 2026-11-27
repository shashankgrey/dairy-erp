import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardLayout from './components/DashboardLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import CustomerProfile from './pages/CustomerProfile';
import Products from './pages/Products';
import Billing from './pages/Billing';
import Suppliers from './pages/Suppliers';
import SupplierProfile from './pages/SupplierProfile';
import Reminders from './pages/Reminders';
import DailyReport from './pages/DailyReport';
import { FEATURES } from './lib/features';
import Settings from './pages/Settings';

function Protected({ children }) {
  return (
    <ProtectedRoute>
      <DashboardLayout>{children}</DashboardLayout>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Protected><Dashboard /></Protected>} />
            <Route path="/customers" element={<Protected><Customers /></Protected>} />
            <Route path="/customers/:id" element={<Protected><CustomerProfile /></Protected>} />
            <Route path="/products" element={<Protected><Products /></Protected>} />
            <Route path="/billing" element={<Protected><Billing /></Protected>} />
            {/* Daily Entry is replaced by Billing; old links land there. */}
            <Route path="/purchases" element={<Navigate to="/billing" replace />} />
            {FEATURES.suppliers && <Route path="/suppliers" element={<Protected><Suppliers /></Protected>} />}
            {FEATURES.suppliers && <Route path="/suppliers/:id" element={<Protected><SupplierProfile /></Protected>} />}
            <Route path="/reminders" element={<Protected><Reminders /></Protected>} />
            <Route path="/reports" element={<Protected><DailyReport /></Protected>} />
            <Route path="/settings" element={<Protected><Settings /></Protected>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}