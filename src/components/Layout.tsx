import { useState, useEffect } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, Users, Settings, LogOut, Calendar, Clock, Menu, X, CalendarDays, StickyNote, Bell, ChevronLeft, ChevronRight } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
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
  const { isDarkMode } = useTheme();
  const navigate = useNavigate();
  const [businessName, setBusinessName] = useState("SlotFiller");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved === 'true';
  });

  const isEffectiveCollapsed = isSidebarCollapsed && !isMobileMenuOpen;

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
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-deep-blue border-b border-white/10 flex items-center justify-between px-4 z-50">
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 text-white/70 hover:text-white"
          >
            {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
          <div className="p-1.5 rounded-lg shrink-0">
            <CalendarDays className="h-5 w-5 text-accent" />
          </div>
          <span className="font-black tracking-tight text-white uppercase text-sm font-display">SlotFiller</span>
        </div>
        <div className="flex items-center gap-2">
        </div>
      </div>

      {/* Sidebar (Desktop) */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 bg-deep-blue border-r border-white/10 flex flex-col transition-all duration-300 lg:translate-x-0 lg:relative overflow-hidden
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        w-64 ${isEffectiveCollapsed ? 'lg:w-20' : 'lg:w-64'}
      `}>
        {/* Decorative Eye-catcher */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-10">
          <div className="absolute -bottom-24 -right-24 w-80 h-80 rounded-full bg-accent blur-[100px]" />
          <div className="absolute bottom-12 -left-12 w-64 h-64 rounded-full bg-white blur-[80px]" />
          <svg className="absolute bottom-0 left-0 w-full h-48 text-white/10" viewBox="0 0 1440 320" preserveAspectRatio="none">
            <path fill="currentColor" d="M0,160L48,176C96,192,192,224,288,224C384,224,480,192,576,165.3C672,139,768,117,864,128C960,139,1056,181,1152,197.3C1248,213,1344,203,1392,197.3L1440,192L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
          </svg>
        </div>

        <div className={`p-6 ${isEffectiveCollapsed ? 'flex flex-col items-center' : ''} relative z-10`}>
          <div className={`mb-4 flex items-center gap-2 ${isEffectiveCollapsed ? 'justify-center' : ''}`}>
            <div className="p-1.5 rounded-lg shadow-lg shadow-accent/20 shrink-0">
              <CalendarDays className="h-4 w-4 text-accent" />
            </div>
            {!isEffectiveCollapsed && <span className="text-xs font-black tracking-[0.2em] text-white uppercase transition-opacity duration-300 font-display">SlotFiller</span>}
          </div>
          {!isEffectiveCollapsed && (
            <div className="transition-opacity duration-300">
              <h1 className="text-2xl font-bold text-white tracking-tight">{businessName}</h1>
              <div className="text-xs font-bold text-gray-400 mt-2 uppercase tracking-widest whitespace-nowrap overflow-hidden">
                {format(currentTime, "dd.MM.yyyy - HH:mm", { locale: de })} Uhr
              </div>
            </div>
          )}
        </div>
        
        <nav className={`flex-1 px-4 space-y-2 mt-4 relative z-10 ${isEffectiveCollapsed ? 'flex flex-col items-center' : ''}`}>
          <NavLink
            to="/"
            onClick={() => setIsMobileMenuOpen(false)}
            title={isEffectiveCollapsed ? "Übersicht" : ""}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${isEffectiveCollapsed ? 'justify-center w-12' : ''} ${
                isActive 
                  ? "bg-white/10 text-white border-l-4 border-accent" 
                  : "text-gray-400 hover:bg-white/5 hover:text-white"
              }`
            }
          >
            <LayoutDashboard className="h-5 w-5 shrink-0" />
            <span className={cn(
              "transition-all duration-300 whitespace-nowrap overflow-hidden",
              isEffectiveCollapsed ? "w-0 opacity-0 invisible" : "w-auto opacity-100 visible ml-3 delay-150"
            )}>
              Übersicht
            </span>
          </NavLink>
          <NavLink
            to="/calendar"
            onClick={() => setIsMobileMenuOpen(false)}
            title={isEffectiveCollapsed ? "Kalender" : ""}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${isEffectiveCollapsed ? 'justify-center w-12' : ''} ${
                isActive 
                  ? "bg-white/10 text-white border-l-4 border-accent" 
                  : "text-gray-400 hover:bg-white/5 hover:text-white"
              }`
            }
          >
            <Calendar className="h-5 w-5 shrink-0" />
            <span className={cn(
              "transition-all duration-300 whitespace-nowrap overflow-hidden",
              isEffectiveCollapsed ? "w-0 opacity-0 invisible" : "w-auto opacity-100 visible ml-3 delay-150"
            )}>
              Kalender
            </span>
          </NavLink>
          <NavLink
            to="/clients"
            onClick={() => setIsMobileMenuOpen(false)}
            title={isEffectiveCollapsed ? "Kunden" : ""}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${isEffectiveCollapsed ? 'justify-center w-12' : ''} ${
                isActive 
                  ? "bg-white/10 text-white border-l-4 border-accent" 
                  : "text-gray-400 hover:bg-white/5 hover:text-white"
              }`
            }
          >
            <Users className="h-5 w-5 shrink-0" />
            <span className={cn(
              "transition-all duration-300 whitespace-nowrap overflow-hidden",
              isEffectiveCollapsed ? "w-0 opacity-0 invisible" : "w-auto opacity-100 visible ml-3 delay-150"
            )}>
              Kunden
            </span>
          </NavLink>
          <NavLink
            to="/notifications"
            onClick={() => setIsMobileMenuOpen(false)}
            title={isEffectiveCollapsed ? "Benachrichtigungen" : ""}
            className={({ isActive }) =>
              `flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition-all ${isEffectiveCollapsed ? 'justify-center w-12' : ''} ${
                isActive 
                  ? "bg-white/10 text-white border-l-4 border-accent" 
                  : "text-gray-400 hover:bg-white/5 hover:text-white"
              }`
            }
          >
            <div className="flex items-center gap-3">
              <Bell className="h-5 w-5 shrink-0" />
              <span className={cn(
                "transition-all duration-300 whitespace-nowrap overflow-hidden",
                isEffectiveCollapsed ? "w-0 opacity-0 invisible" : "w-auto opacity-100 visible ml-3 delay-150"
              )}>
                Benachrichtigungen
              </span>
            </div>
            {!isEffectiveCollapsed && unreadNotifications > 0 && (
              <span className="bg-accent text-deep-blue text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                {unreadNotifications}
              </span>
            )}
            {isEffectiveCollapsed && unreadNotifications > 0 && (
              <div className="absolute top-2 right-2 w-2 h-2 bg-accent rounded-full" />
            )}
          </NavLink>
          <NavLink
            to="/notes"
            onClick={() => setIsMobileMenuOpen(false)}
            title={isEffectiveCollapsed ? "Notizen" : ""}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${isEffectiveCollapsed ? 'justify-center w-12' : ''} ${
                isActive 
                  ? "bg-white/10 text-white border-l-4 border-accent" 
                  : "text-gray-400 hover:bg-white/5 hover:text-white"
              }`
            }
          >
            <StickyNote className="h-5 w-5 shrink-0" />
            <span className={cn(
              "transition-all duration-300 whitespace-nowrap overflow-hidden",
              isEffectiveCollapsed ? "w-0 opacity-0 invisible" : "w-auto opacity-100 visible ml-3 delay-150"
            )}>
              Notizen
            </span>
          </NavLink>
          <NavLink
            to="/settings"
            onClick={() => setIsMobileMenuOpen(false)}
            title={isEffectiveCollapsed ? "Einstellungen" : ""}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${isEffectiveCollapsed ? 'justify-center w-12' : ''} ${
                isActive 
                  ? "bg-white/10 text-white border-l-4 border-accent" 
                  : "text-gray-400 hover:bg-white/5 hover:text-white"
              }`
            }
          >
            <Settings className="h-5 w-5 shrink-0" />
            <span className={cn(
              "transition-all duration-300 whitespace-nowrap overflow-hidden",
              isEffectiveCollapsed ? "w-0 opacity-0 invisible" : "w-auto opacity-100 visible ml-3 delay-150"
            )}>
              Einstellungen
            </span>
          </NavLink>
        </nav>

        <div className={`p-4 border-t border-white/10 space-y-2 relative z-10 ${isEffectiveCollapsed ? 'flex flex-col items-center' : ''}`}>
          <button 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="hidden lg:flex items-center gap-3 px-4 py-3 w-full text-gray-400 hover:bg-white/5 hover:text-white rounded-lg transition-colors text-sm font-bold"
            title={isEffectiveCollapsed ? "Menü aufklappen" : "Menü zuklappen"}
          >
            {isEffectiveCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
            {!isEffectiveCollapsed && <span className="transition-opacity duration-300">Menü zuklappen</span>}
          </button>
          <button 
            onClick={() => setIsLogoutModalOpen(true)}
            className={`flex items-center gap-3 px-4 py-3 w-full text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors text-sm font-bold ${isEffectiveCollapsed ? 'justify-center w-12' : ''}`}
            title={isEffectiveCollapsed ? "Abmelden" : ""}
          >
            <LogOut className="h-5 w-5 shrink-0" />
            {!isEffectiveCollapsed && <span className="transition-opacity duration-300">Abmelden</span>}
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

      <Modal isOpen={isLogoutModalOpen} onClose={() => setIsLogoutModalOpen(false)} title="Abmelden">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Sind Sie sicher, dass Sie sich abmelden möchten?</p>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setIsLogoutModalOpen(false)}>Abbrechen</Button>
            <Button className="flex-1 bg-red-500 text-white hover:bg-red-600 font-bold" onClick={handleLogout}>Abmelden</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
