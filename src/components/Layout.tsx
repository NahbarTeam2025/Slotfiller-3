import { useState, useEffect } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, Users, Settings, LogOut, Calendar, Clock, Sun, Moon, Menu, X, Zap, StickyNote, Bell, ChevronLeft, ChevronRight } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { logOut, db } from "../firebase";
import { handleFirestoreError, OperationType } from "../lib/firestore-errors";
import { doc, onSnapshot, collection, query, where } from "firebase/firestore";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Modal } from "./ui/modal";
import { Button } from "./ui/button";

export function Layout() {
  const { user, businessId } = useAuth();
  const navigate = useNavigate();
  const [businessName, setBusinessName] = useState("SlotFiller");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved === 'dark';
    return document.documentElement.classList.contains('dark');
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved === 'true';
  });

  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', isSidebarCollapsed.toString());
  }, [isSidebarCollapsed]);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    } else if (savedTheme === 'light') {
      setIsDarkMode(false);
      document.documentElement.classList.remove('dark');
    }
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!businessId) return;
    const unsub = onSnapshot(doc(db, "businesses", businessId), (docSnap) => {
      if (docSnap.exists() && docSnap.data().name) {
        setBusinessName(docSnap.data().name);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `businesses/${businessId}`);
    });
    return () => unsub();
  }, [businessId]);

  useEffect(() => {
    if (!businessId) return;
    const q = query(
      collection(db, `businesses/${businessId}/notifications`),
      where("read", "==", false)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      setUnreadNotifications(snapshot.size);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `businesses/${businessId}/notifications`);
    });
    return () => unsub();
  }, [businessId]);

  const handleLogout = async () => {
    await logOut();
    navigate("/login");
  };

  return (
    <div className="flex h-screen bg-white dark:bg-slate-950 transition-colors duration-300">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between px-4 z-50">
        <div className="flex items-center gap-2">
          <div className="bg-accent p-1.5 rounded-lg shadow-sm">
            <Zap className="h-5 w-5 text-deep-blue fill-deep-blue" />
          </div>
          <span className="font-black tracking-tight text-brand-blue uppercase text-sm">SlotFiller</span>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => {
              if (window.location.pathname === '/notes') {
                navigate('/');
              } else {
                navigate('/notes');
              }
            }}
            className="p-2 text-gray-600 dark:text-gray-400"
          >
            <StickyNote className="h-6 w-6" />
          </button>
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 text-gray-600 dark:text-gray-400"
          >
            {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Sidebar (Desktop) */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-800 flex flex-col transition-all duration-300 lg:translate-x-0 lg:static
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        ${isSidebarCollapsed ? 'lg:w-20' : 'lg:w-64'}
      `}>
        <div className={`p-6 ${isSidebarCollapsed ? 'flex flex-col items-center' : ''}`}>
          <div className={`mb-4 flex items-center gap-2 ${isSidebarCollapsed ? 'justify-center' : ''}`}>
            <div className="bg-accent p-1.5 rounded-lg shadow-lg shadow-accent/20 shrink-0">
              <Zap className="h-4 w-4 text-deep-blue fill-deep-blue" />
            </div>
            {!isSidebarCollapsed && <span className="text-xs font-black tracking-[0.2em] text-brand-blue uppercase">SlotFiller</span>}
          </div>
          {!isSidebarCollapsed && (
            <>
              <h1 className="text-2xl font-bold text-deep-blue dark:text-white tracking-tight">{businessName}</h1>
              <div className="text-xs font-bold text-gray-400 dark:text-gray-500 mt-2 uppercase tracking-widest">
                {format(currentTime, "dd.MM.yyyy - HH:mm", { locale: de })} Uhr
              </div>
            </>
          )}
        </div>
        
        <nav className={`flex-1 px-4 space-y-2 mt-4 ${isSidebarCollapsed ? 'flex flex-col items-center' : ''}`}>
          <NavLink
            to="/"
            onClick={() => setIsMobileMenuOpen(false)}
            title={isSidebarCollapsed ? "Übersicht" : ""}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${isSidebarCollapsed ? 'justify-center w-12' : ''} ${
                isActive 
                  ? "bg-indigo-50 dark:bg-indigo-900/20 text-deep-blue dark:text-accent border-l-4 border-accent" 
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-deep-blue dark:hover:text-white"
              }`
            }
          >
            <LayoutDashboard className="h-5 w-5 shrink-0" />
            {!isSidebarCollapsed && <span>Übersicht</span>}
          </NavLink>
          <NavLink
            to="/calendar"
            onClick={() => setIsMobileMenuOpen(false)}
            title={isSidebarCollapsed ? "Kalender" : ""}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${isSidebarCollapsed ? 'justify-center w-12' : ''} ${
                isActive 
                  ? "bg-indigo-50 dark:bg-indigo-900/20 text-deep-blue dark:text-accent border-l-4 border-accent" 
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-deep-blue dark:hover:text-white"
              }`
            }
          >
            <Calendar className="h-5 w-5 shrink-0" />
            {!isSidebarCollapsed && <span>Kalender</span>}
          </NavLink>
          <NavLink
            to="/notifications"
            onClick={() => setIsMobileMenuOpen(false)}
            title={isSidebarCollapsed ? "Benachrichtigungen" : ""}
            className={({ isActive }) =>
              `flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition-all ${isSidebarCollapsed ? 'justify-center w-12' : ''} ${
                isActive 
                  ? "bg-indigo-50 dark:bg-indigo-900/20 text-deep-blue dark:text-accent border-l-4 border-accent" 
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-deep-blue dark:hover:text-white"
              }`
            }
          >
            <div className="flex items-center gap-3">
              <Bell className="h-5 w-5 shrink-0" />
              {!isSidebarCollapsed && <span>Benachrichtigungen</span>}
            </div>
            {!isSidebarCollapsed && unreadNotifications > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                {unreadNotifications}
              </span>
            )}
            {isSidebarCollapsed && unreadNotifications > 0 && (
              <div className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full" />
            )}
          </NavLink>
          <NavLink
            to="/clients"
            onClick={() => setIsMobileMenuOpen(false)}
            title={isSidebarCollapsed ? "Kunden" : ""}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${isSidebarCollapsed ? 'justify-center w-12' : ''} ${
                isActive 
                  ? "bg-indigo-50 dark:bg-indigo-900/20 text-deep-blue dark:text-accent border-l-4 border-accent" 
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-deep-blue dark:hover:text-white"
              }`
            }
          >
            <Users className="h-5 w-5 shrink-0" />
            {!isSidebarCollapsed && <span>Kunden</span>}
          </NavLink>
          <NavLink
            to="/notes"
            onClick={() => setIsMobileMenuOpen(false)}
            title={isSidebarCollapsed ? "Notizen" : ""}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${isSidebarCollapsed ? 'justify-center w-12' : ''} ${
                isActive 
                  ? "bg-indigo-50 dark:bg-indigo-900/20 text-deep-blue dark:text-accent border-l-4 border-accent" 
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-deep-blue dark:hover:text-white"
              }`
            }
          >
            <StickyNote className="h-5 w-5 shrink-0" />
            {!isSidebarCollapsed && <span>Notizen</span>}
          </NavLink>
          <NavLink
            to="/settings"
            onClick={() => setIsMobileMenuOpen(false)}
            title={isSidebarCollapsed ? "Einstellungen" : ""}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${isSidebarCollapsed ? 'justify-center w-12' : ''} ${
                isActive 
                  ? "bg-indigo-50 dark:bg-indigo-900/20 text-deep-blue dark:text-accent border-l-4 border-accent" 
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-deep-blue dark:hover:text-white"
              }`
            }
          >
            <Settings className="h-5 w-5 shrink-0" />
            {!isSidebarCollapsed && <span>Einstellungen</span>}
          </NavLink>
        </nav>

        <div className={`p-4 border-t border-gray-200 dark:border-slate-800 space-y-2 ${isSidebarCollapsed ? 'flex flex-col items-center' : ''}`}>
          <button 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="hidden lg:flex items-center gap-3 px-4 py-3 w-full text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-lg transition-colors text-sm font-bold"
            title={isSidebarCollapsed ? "Menü aufklappen" : "Menü zuklappen"}
          >
            {isSidebarCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
            {!isSidebarCollapsed && <span>Menü zuklappen</span>}
          </button>
          <button 
            onClick={() => setIsDarkMode(!isDarkMode)}
            className={`flex items-center gap-3 px-4 py-3 w-full text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-lg transition-colors text-sm font-bold ${isSidebarCollapsed ? 'justify-center w-12' : ''}`}
            title={isSidebarCollapsed ? (isDarkMode ? 'Light Mode' : 'Dark Mode') : ""}
          >
            {isDarkMode ? <Sun className="h-5 w-5 shrink-0" /> : <Moon className="h-5 w-5 shrink-0" />}
            {!isSidebarCollapsed && <span>{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>}
          </button>
          <button 
            onClick={() => setIsLogoutModalOpen(true)} 
            className={`flex items-center gap-3 px-4 py-3 w-full text-gray-600 dark:text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-colors text-sm font-bold ${isSidebarCollapsed ? 'justify-center w-12' : ''}`}
            title={isSidebarCollapsed ? "Ausloggen" : ""}
          >
            <LogOut className="h-5 w-5 shrink-0" />
            {!isSidebarCollapsed && <span>Ausloggen</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-h-0 pt-16 lg:pt-0 lg:h-screen lg:overflow-hidden">
        <div className="h-full overflow-y-auto scrollbar-hide">
          <Outlet />
        </div>
      </main>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <Modal isOpen={isLogoutModalOpen} onClose={() => setIsLogoutModalOpen(false)} title="Ausloggen">
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">Sind Sie sicher, dass Sie sich ausloggen möchten?</p>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1 dark:border-slate-700 dark:text-white" onClick={() => setIsLogoutModalOpen(false)}>Abbrechen</Button>
            <Button className="flex-1 bg-red-500 text-white hover:bg-red-600 font-bold" onClick={handleLogout}>Ausloggen</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
