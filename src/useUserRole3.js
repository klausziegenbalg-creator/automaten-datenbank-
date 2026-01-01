import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";
import { onAuthStateChanged, getAuth } from "firebase/auth";

export function useUserRole() {
  const [user, setUser] = useState(null);
  const [rolle, setRolle] = useState(null);
  const [stadt, setStadt] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getAuth();

    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setRolle(null);
        setStadt(null);
        setLoading(false);
        return;
      }

      setUser(firebaseUser);

      try {
        setLoading(true);

        // ✅ FIX: users (klein) statt Users
        const userRef = doc(db, "users", firebaseUser.uid);
        const snap = await getDoc(userRef);

        if (!snap.exists()) {
          setRolle(null);
          setStadt(null);
          return;
        }

        const data = snap.data() || {};

        // ✅ FIX: role statt rolle (Fallback bleibt)
        setRolle(data.role ?? data.rolle ?? null);
        setStadt(data.stadt ?? null);
      } catch (e) {
        console.error("Fehler beim Laden des User-Dokuments:", e);
        setRolle(null);
        setStadt(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  return { user, rolle, stadt, loading };
}
