import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { Layout } from "./components/Layout";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { Clients } from "./pages/Clients";
import { Settings } from "./pages/Settings";
import { Notes } from "./pages/Notes";
import { Onboarding } from "./pages/Onboarding";
import { Calendar } from "./pages/Calendar";
import { Notifications } from "./pages/Notifications";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, businessId, loading } = useAuth();

  if (loading) return <div className="flex h-screen items-center justify-center">Laden...</div>;
  if (!user) return <Navigate to="/login" />;
  if (!businessId) return <Navigate to="/onboarding" />;

  return <>{children}</>;
}

function AppRoutes() {
  return (
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
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
