import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithGoogle } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";

export function Login() {
  const { user, businessId, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      if (businessId) {
        navigate("/");
      } else {
        navigate("/onboarding");
      }
    }
  }, [user, businessId, loading, navigate]);

  if (loading) return null;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 dark:bg-black p-4 sm:p-0">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-card-dark p-6 sm:p-10 shadow-xl text-center border border-gray-100 dark:border-slate-800">
        <h1 className="text-4xl font-bold text-deep-blue dark:text-white tracking-tight mb-2">SlotFiller</h1>
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-10">Kein Termin bleibt leer.</p>
        
        <div className="bg-gray-50 dark:bg-slate-800/50 p-6 sm:p-8 rounded-xl border border-gray-100 dark:border-slate-800 mb-8">
          <h2 className="text-lg font-medium text-deep-blue dark:text-white mb-2">Willkommen</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Verwalte deine freien Zeitfenster.</p>
          <Button onClick={signInWithGoogle} className="w-full bg-deep-blue dark:bg-accent text-white dark:text-deep-blue hover:bg-gray-800 dark:hover:bg-accent-hover" size="lg">
            <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Mit Google anmelden
          </Button>
        </div>
        
        <p className="text-xs text-gray-400 dark:text-gray-500">© 2026 SLOTFILLER SYSTEMS</p>
      </div>
    </div>
  );
}
