import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { Layout } from "./components/Layout";
import { ScrollToTop } from "./components/ScrollToTop";

// Code splitting for routes
const Login = lazy(() => import("./pages/Login").then(m => ({ default: m.Login })));
const Dashboard = lazy(() => import("./pages/Dashboard").then(m => ({ default: m.Dashboard })));
const Clients = lazy(() => import("./pages/Clients").then(m => ({ default: m.Clients })));
const Settings = lazy(() => import("./pages/Settings").then(m => ({ default: m.Settings })));
const Notes = lazy(() => import("./pages/Notes").then(m => ({ default: m.Notes })));
const Onboarding = lazy(() => import("./pages/Onboarding").then(m => ({ default: m.Onboarding })));
const Calendar = lazy(() => import("./pages/Calendar").then(m => ({ default: m.Calendar })));
const Notifications = lazy(() => import("./pages/Notifications").then(m => ({ default: m.Notifications })));

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, businessId, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/login" />;
  if (!businessId) return <Navigate to="/onboarding" />;

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Suspense fallback={null}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="calendar" element={<Calendar />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="clients" element={<Clients />} />
          <Route path="notes" element={<Notes />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <ScrollToTop />
          <main id="main-content">
            <AppRoutes />
          </main>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
