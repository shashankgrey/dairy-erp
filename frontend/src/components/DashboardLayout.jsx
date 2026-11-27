import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, Package, ReceiptText, Truck, ChartNoAxesCombined, MessageSquare, Settings as SettingsIcon, Hand, Sun, Moon, Menu, X, LogOut } from 'lucide-react';
import { FEATURES } from '../lib/features';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/products', label: 'Products', icon: Package },
  { to: '/billing', label: 'Billing', icon: ReceiptText },
  ...(FEATURES.suppliers ? [{ to: '/suppliers', label: 'Suppliers', icon: Truck }] : []),
  { to: '/reminders', label: 'SMS Reminders', icon: MessageSquare },
  { to: '/reports', label: 'Reports', icon: ChartNoAxesCombined },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
];

export default function DashboardLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const { darkMode, setDarkMode, touchMode, setTouchMode } = useTheme();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="min-h-screen bg-bg-light dark:bg-bg-dark text-text-light dark:text-text-dark">
      {/* Sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 xl:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-surface-light dark:bg-surface-dark border-r border-border-light dark:border-border-dark
          transform transition-transform xl:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="h-16 flex items-center justify-between px-5 border-b border-border-light dark:border-border-dark">
          <span className="flex items-center gap-2 text-brand-500 dark:text-brand-400 leading-tight">
            <span className="text-2xl">🥛</span>
            <span>
              <span className="block font-bold">Sri Sai Esha</span>
              <span className="block text-xs font-medium">Dairy Products</span>
            </span>
          </span>
          <button className="xl:hidden p-2" onClick={() => setSidebarOpen(false)} aria-label="Close menu">
            <X size={20} />
          </button>
        </div>

        <nav className="p-3 space-y-1">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                ${isActive
                  ? 'bg-brand-500 text-white'
                  : 'text-muted-light dark:text-muted-dark hover:bg-brand-50 dark:hover:bg-white/5'}`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <div className="xl:pl-64">
        <header className="h-16 flex items-center justify-between px-4 sm:px-6 border-b border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark sticky top-0 z-20">
          <button className="xl:hidden p-2 -ml-2" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
            <Menu size={22} />
          </button>
          <span className="hidden sm:block xl:hidden ml-2 font-bold text-brand-500 dark:text-brand-400 truncate">Sri Sai Esha Dairy</span>

          <div className="flex items-center gap-3 ml-auto">
            <button
              onClick={() => setTouchMode(!touchMode)}
              className={`p-2 rounded-lg ${
                touchMode
                  ? 'bg-brand-50 dark:bg-brand-500/10 text-brand-500 dark:text-brand-400'
                  : 'hover:bg-brand-50 dark:hover:bg-white/5'
              }`}
              title={touchMode ? 'Touch mode is on (tap to switch back to compact)' : 'Switch to touch mode (larger buttons)'}
            >
              <Hand size={18} />
            </button>

            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-lg hover:bg-brand-50 dark:hover:bg-white/5"
              title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            <div className="flex items-center gap-2 pl-3 border-l border-border-light dark:border-border-dark">
              <div className="w-8 h-8 rounded-full bg-brand-500 text-white flex items-center justify-center text-sm font-semibold">
                {user?.name?.[0]?.toUpperCase() || '?'}
              </div>
              <span className="hidden sm:block text-sm font-medium">{user?.name}</span>
              <button
                onClick={handleLogout}
                className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-red-600"
                title="Log out"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </header>

        <main className="p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}