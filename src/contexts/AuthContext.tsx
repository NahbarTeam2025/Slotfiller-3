import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  businessId: string | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, businessId: null, loading: true });

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setLoading(true);
        try {
          // Check if business exists for this user
          // We'll use the user's UID as the businessId for simplicity
          const businessRef = doc(db, 'businesses', currentUser.uid);
          const businessSnap = await getDoc(businessRef);
          if (businessSnap.exists()) {
            setBusinessId(currentUser.uid);
          } else {
            setBusinessId(null);
          }
        } catch (error) {
          console.error("Error fetching business data:", error);
          setBusinessId(null);
        }
        setUser(currentUser);
        setLoading(false);
      } else {
        setUser(null);
        setBusinessId(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, businessId, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
