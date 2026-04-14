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
import { cn } from "../lib/utils";

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
    <div className="flex h-screen bg-white transition-colors duration-300">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 z-50">
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 text-gray-600"
          >
            {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
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
            className="p-2 text-gray-600"
          >
            <StickyNote className="h-6 w-6" />
          </button>
          <div className="w-8 h-8 rounded-full bg-deep-blue flex items-center justify-center text-white text-xs font-bold">
            {user?.email?.charAt(0).toUpperCase()}
          </div>
        </div>
      </div>

      {/* Sidebar (Desktop) */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 bg-white border-r border-gray-200 flex flex-col transition-all duration-300 lg:translate-x-0 lg:static
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        ${isSidebarCollapsed ? 'lg:w-20' : 'lg:w-64'}
      `}>
        <div className={`p-6 ${isSidebarCollapsed ? 'flex flex-col items-center' : ''}`}>
          <div className={`mb-4 flex items-center gap-2 ${isSidebarCollapsed ? 'justify-center' : ''}`}>
            <div className="bg-accent p-1.5 rounded-lg shadow-lg shadow-accent/20 shrink-0">
              <Zap className="h-4 w-4 text-deep-blue fill-deep-blue" />
            </div>
            {!isSidebarCollapsed && <span className="text-xs font-black tracking-[0.2em] text-brand-blue uppercase transition-opacity duration-300">SlotFiller</span>}
          </div>
          {!isSidebarCollapsed && (
            <div className="transition-opacity duration-300">
              <h1 className="text-2xl font-bold text-deep-blue tracking-tight">{businessName}</h1>
              <div className="text-xs font-bold text-gray-400 mt-2 uppercase tracking-widest whitespace-nowrap overflow-hidden">
                {format(currentTime, "dd.MM.yyyy - HH:mm", { locale: de })} Uhr
              </div>
            </div>
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
                  ? "bg-indigo-50 text-deep-blue border-l-4 border-accent" 
                  : "text-gray-600 hover:bg-gray-50 hover:text-deep-blue"
              }`
            }
          >
            <LayoutDashboard className="h-5 w-5 shrink-0" />
            <span className={cn(
              "transition-all duration-300 whitespace-nowrap overflow-hidden",
              isSidebarCollapsed ? "w-0 opacity-0 invisible" : "w-auto opacity-100 visible ml-3 delay-150"
            )}>
              Übersicht
            </span>
          </NavLink>
          <NavLink
            to="/calendar"
            onClick={() => setIsMobileMenuOpen(false)}
            title={isSidebarCollapsed ? "Kalender" : ""}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${isSidebarCollapsed ? 'justify-center w-12' : ''} ${
                isActive 
                  ? "bg-indigo-50 text-deep-blue border-l-4 border-accent" 
                  : "text-gray-600 hover:bg-gray-50 hover:text-deep-blue"
              }`
            }
          >
            <Calendar className="h-5 w-5 shrink-0" />
            <span className={cn(
              "transition-all duration-300 whitespace-nowrap overflow-hidden",
              isSidebarCollapsed ? "w-0 opacity-0 invisible" : "w-auto opacity-100 visible ml-3 delay-150"
            )}>
              Kalender
            </span>
          </NavLink>
          <NavLink
            to="/notifications"
            onClick={() => setIsMobileMenuOpen(false)}
            title={isSidebarCollapsed ? "Benachrichtigungen" : ""}
            className={({ isActive }) =>
              `flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition-all ${isSidebarCollapsed ? 'justify-center w-12' : ''} ${
                isActive 
                  ? "bg-indigo-50 text-deep-blue border-l-4 border-accent" 
                  : "text-gray-600 hover:bg-gray-50 hover:text-deep-blue"
              }`
            }
          >
            <div className="flex items-center gap-3">
              <Bell className="h-5 w-5 shrink-0" />
              <span className={cn(
                "transition-all duration-300 whitespace-nowrap overflow-hidden",
                isSidebarCollapsed ? "w-0 opacity-0 invisible" : "w-auto opacity-100 visible ml-3 delay-150"
              )}>
                Benachrichtigungen
              </span>
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
                  ? "bg-indigo-50 text-deep-blue border-l-4 border-accent" 
                  : "text-gray-600 hover:bg-gray-50 hover:text-deep-blue"
              }`
            }
          >
            <Users className="h-5 w-5 shrink-0" />
            <span className={cn(
              "transition-all duration-300 whitespace-nowrap overflow-hidden",
              isSidebarCollapsed ? "w-0 opacity-0 invisible" : "w-auto opacity-100 visible ml-3 delay-150"
            )}>
              Kunden
            </span>
          </NavLink>
          <NavLink
            to="/notes"
            onClick={() => setIsMobileMenuOpen(false)}
            title={isSidebarCollapsed ? "Notizen" : ""}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${isSidebarCollapsed ? 'justify-center w-12' : ''} ${
                isActive 
                  ? "bg-indigo-50 text-deep-blue border-l-4 border-accent" 
                  : "text-gray-600 hover:bg-gray-50 hover:text-deep-blue"
              }`
            }
          >
            <StickyNote className="h-5 w-5 shrink-0" />
            <span className={cn(
              "transition-all duration-300 whitespace-nowrap overflow-hidden",
              isSidebarCollapsed ? "w-0 opacity-0 invisible" : "w-auto opacity-100 visible ml-3 delay-150"
            )}>
              Notizen
            </span>
          </NavLink>
          <NavLink
            to="/settings"
            onClick={() => setIsMobileMenuOpen(false)}
            title={isSidebarCollapsed ? "Einstellungen" : ""}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${isSidebarCollapsed ? 'justify-center w-12' : ''} ${
                isActive 
                  ? "bg-indigo-50 text-deep-blue border-l-4 border-accent" 
                  : "text-gray-600 hover:bg-gray-50 hover:text-deep-blue"
              }`
            }
          >
            <Settings className="h-5 w-5 shrink-0" />
            <span className={cn(
              "transition-all duration-300 whitespace-nowrap overflow-hidden",
              isSidebarCollapsed ? "w-0 opacity-0 invisible" : "w-auto opacity-100 visible ml-3 delay-150"
            )}>
              Einstellungen
            </span>
          </NavLink>
        </nav>

        <div className={`p-4 border-t border-gray-200 space-y-2 ${isSidebarCollapsed ? 'flex flex-col items-center' : ''}`}>
          <button 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="hidden lg:flex items-center gap-3 px-4 py-3 w-full text-gray-600 hover:bg-gray-50 rounded-lg transition-colors text-sm font-bold"
            title={isSidebarCollapsed ? "Menü aufklappen" : "Menü zuklappen"}
          >
            {isSidebarCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
            {!isSidebarCollapsed && <span className="transition-opacity duration-300">Menü zuklappen</span>}
          </button>
          <button 
            onClick={() => setIsLogoutModalOpen(true)} 
            className={`flex items-center gap-3 px-4 py-3 w-full text-gray-600 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors text-sm font-bold ${isSidebarCollapsed ? 'justify-center w-12' : ''}`}
            title={isSidebarCollapsed ? "Ausloggen" : ""}
          >
            <LogOut className="h-5 w-5 shrink-0" />
            {!isSidebarCollapsed && <span className="transition-opacity duration-300">Ausloggen</span>}
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
          <p className="text-sm text-gray-600">Sind Sie sicher, dass Sie sich ausloggen möchten?</p>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setIsLogoutModalOpen(false)}>Abbrechen</Button>
            <Button className="flex-1 bg-red-500 text-white hover:bg-red-600 font-bold" onClick={handleLogout}>Ausloggen</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
