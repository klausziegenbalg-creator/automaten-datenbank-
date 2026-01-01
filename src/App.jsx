import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  useLocation,
  Navigate,
} from "react-router-dom";
import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { getDoc, doc } from "firebase/firestore";

import { auth } from "./firebase";
import { db } from "./firebase";

import AppLayout from "./AppLayout";

import AppStandorte from "./AppStandorte";
import AppAutomaten from "./AppAutomaten";
import AppKontakte from "./AppKontakte";
import AppReinigungsdienst from "./AppReinigungsdienst";
import AppDashboardReinigung from "./AppDashboardReinigung";
import AppAbrechnung from "./AppAbrechnung";
import Login from "./Login";

const HEADER_HEIGHT = 88;

function AppShell() {
  const location = useLocation();

  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  const [userRole, setUserRole] = useState(null);
  const [loadingRole, setLoadingRole] = useState(true);

  // ----------------------------------------
  // Auth + Rolle laden
  // ----------------------------------------
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser || null);
      setLoadingAuth(false);

      if (!firebaseUser) {
        setUserRole(null);
        setLoadingRole(false);
        return;
      }

      try {
        setLoadingRole(true);

        // ✅ FIX: users (klein) statt Users
        const snap = await getDoc(doc(db, "users", firebaseUser.uid));
        const data = snap.exists() ? snap.data() : null;

        // ✅ FIX: role statt rolle (Fallback bleibt, falls alte Docs existieren)
        const rolle = data?.role ?? data?.rolle ?? null;
        setUserRole(rolle);
      } catch (err) {
        console.error("Fehler beim Laden der User-Rolle:", err);
        setUserRole(null);
      } finally {
        setLoadingRole(false);
      }
    });

    return () => unsub();
  }, []);

  // ----------------------------------------
  // Loading
  // ----------------------------------------
  if (loadingAuth || loadingRole) {
    return <div style={{ padding: 40, fontSize: 18 }}>Lade Anwendung…</div>;
  }

  if (!user) {
    return <Login />;
  }

  // ----------------------------------------
  // Navigation Tabs (rollenbasiert)
  // ----------------------------------------
  const isPrivileged = userRole === "Admin" || userRole === "Supervisor" || userRole === "Owner";

  const tabs = isPrivileged
    ? [
        { to: "/standorte", label: "Standorte" },
        { to: "/automaten", label: "Automaten" },
        { to: "/kontakte", label: "Kontakte" },
        { to: "/reinigungsdienst", label: "Reinigungsdienst" },
        { to: "/dashboard-reinigung", label: "Dashboard Reinigung" },
        { to: "/abrechnung", label: "Abrechnung" },
      ]
    : [{ to: "/dashboard-reinigung", label: "Dashboard Reinigung" }];

  // ----------------------------------------
  // Route Guard
  // ----------------------------------------
  function RequireRoles({ allow, children }) {
    if (!userRole) return <Navigate to="/dashboard-reinigung" replace />;
    if (allow.includes(userRole)) return children;
    return <Navigate to="/dashboard-reinigung" replace />;
  }

  // ----------------------------------------
  // Render
  // ----------------------------------------
  return (
    <AppLayout>
      {/* Header */}
      <header
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: HEADER_HEIGHT,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
          background: "#fff",
          borderBottom: "1px solid #ddd",
          zIndex: 1000,
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 18 }}>
          Digitales Bordbuch
          <div style={{ fontSize: 12, fontWeight: 400 }}>
            Rolle: {userRole ?? "—"}
          </div>
        </div>

        <nav style={{ display: "flex", gap: 8 }}>
          {tabs.map((tab) => {
            const active = location.pathname.startsWith(tab.to);
            return (
              <Link
                key={tab.to}
                to={tab.to}
                style={{
                  padding: "6px 12px",
                  borderRadius: 6,
                  textDecoration: "none",
                  fontWeight: 600,
                  background: active ? "#1976d2" : "#eee",
                  color: active ? "#fff" : "#333",
                }}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>

        <button
          onClick={() => signOut(auth)}
          style={{
            padding: "6px 12px",
            borderRadius: 6,
            border: "1px solid #ccc",
            background: "#fafafa",
            cursor: "pointer",
          }}
        >
          Logout
        </button>
      </header>

      {/* Main */}
      <main style={{ paddingTop: HEADER_HEIGHT + 16, paddingInline: 16 }}>
        <Routes>
          {/* Dashboard immer erlaubt */}
          <Route path="/dashboard-reinigung" element={<AppDashboardReinigung />} />

          {/* Admin + Supervisor (+ Owner) */}
          <Route
            path="/standorte"
            element={
              <RequireRoles allow={["Admin", "Supervisor", "Owner"]}>
                <AppStandorte />
              </RequireRoles>
            }
          />
          <Route
            path="/automaten"
            element={
              <RequireRoles allow={["Admin", "Supervisor", "Owner"]}>
                <AppAutomaten />
              </RequireRoles>
            }
          />
          <Route
            path="/automaten/:automatId"
            element={
              <RequireRoles allow={["Admin", "Supervisor", "Owner"]}>
                <AppAutomaten />
              </RequireRoles>
            }
          />
          <Route
            path="/kontakte"
            element={
              <RequireRoles allow={["Admin", "Supervisor", "Owner"]}>
                <AppKontakte />
              </RequireRoles>
            }
          />
          <Route
            path="/reinigungsdienst"
            element={
              <RequireRoles allow={["Admin", "Supervisor", "Owner"]}>
                <AppReinigungsdienst />
              </RequireRoles>
            }
          />
          <Route
            path="/abrechnung"
            element={
              <RequireRoles allow={["Admin", "Supervisor", "Owner"]}>
                <AppAbrechnung />
              </RequireRoles>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/dashboard-reinigung" replace />} />
        </Routes>
      </main>
    </AppLayout>
  );
}

export default function App() {
  return (
    <Router>
      <AppShell />
    </Router>
  );
}
