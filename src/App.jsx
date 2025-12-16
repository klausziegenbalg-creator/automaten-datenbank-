// App.jsx
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  useLocation,
} from "react-router-dom";
import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "./firebase";
import AppStandorte from "./AppStandorte";
import AppAutomaten from "./AppAutomaten";
import AppKontakte from "./AppKontakte";
import Login from "./Login";
import AppDashboardReinigung from "./AppDashboardReinigung";

const colors = {
  bg: "#f5f7fb",
  card: "#ffffff",
  border: "#e0e4f0",
  primary: "#1976d2",
  primaryDark: "#1565c0",
  textMain: "#1f2933",
  textMuted: "#6b7280",
};

const HEADER_HEIGHT = 88;

function AppShell() {
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser || null);
      setLoadingAuth(false);
    });

    return () => unsub();
  }, []);

  const tabs = [
    { to: "/standorte", label: "Standorte" },
    { to: "/automaten", label: "Automaten" },
    { to: "/kontakte", label: "Kontakte" },
    { to: "/dashboard-reinigung", label: "Dashboard Reinigung" }, // NEU
  ];

  if (loadingAuth) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily:
            '"Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        Anmeldung wird geprüft…
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: colors.bg,
        fontFamily:
          '"Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        color: colors.textMain,
      }}
    >
      {/* Fester Top‑Header */}
      <header
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: HEADER_HEIGHT,
          padding: "0 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: colors.card,
          borderBottom: `1px solid ${colors.border}`,
          boxShadow: "0 4px 12px rgba(15,23,42,0.08)",
          zIndex: 1000,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: colors.primary,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontSize: 18,
              fontWeight: 700,
            }}
          >
            A
          </div>
          <div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 600,
                letterSpacing: 0.2,
              }}
            >
              Automaten Verwaltung
            </div>
            <div
              style={{
                fontSize: 11,
                color: colors.textMuted,
              }}
            >
              Standorte · Automaten · Kontakte · Dashboard
            </div>
          </div>
        </div>

        <nav
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "#eef2ff",
            padding: 4,
            borderRadius: 999,
          }}
        >
          {tabs.map((tab) => {
            const active = location.pathname.startsWith(tab.to);
            return (
              <Link
                key={tab.to}
                to={tab.to}
                style={{
                  textDecoration: "none",
                  fontSize: 13,
                  padding: "6px 14px",
                  borderRadius: 999,
                  color: active ? "#ffffff" : colors.textMuted,
                  background: active ? colors.primary : "transparent",
                  fontWeight: active ? 600 : 500,
                  transition: "background 0.15s, color 0.15s",
                }}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>

        {/* Rechts kleiner User + Logout */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              fontSize: 12,
              color: colors.textMuted,
              maxWidth: 150,
              textOverflow: "ellipsis",
              overflow: "hidden",
              whiteSpace: "nowrap",
            }}
            title={user?.email || ""}
          >
            {user?.email}
          </span>
          <button
            onClick={() => signOut(auth)}
            style={{
              fontSize: 12,
              padding: "4px 10px",
              borderRadius: 999,
              border: `1px solid ${colors.border}`,
              background: "#fff",
              cursor: "pointer",
            }}
          >
            Logout
          </button>
        </div>
      </header>

      {/* Inhaltsbereich unter dem festen Header */}
      <main
        style={{
          paddingTop: HEADER_HEIGHT + 12,
          minHeight: `calc(100vh - ${HEADER_HEIGHT + 12}px)`,
          boxSizing: "border-box",
          paddingInline: 12,
        }}
      >
        <Routes>
          <Route path="/standorte" element={<AppStandorte />} />
          <Route path="/automaten" element={<AppAutomaten />} />
          <Route path="/automaten/:automatId" element={<AppAutomaten />} />
          <Route path="/kontakte" element={<AppKontakte />} />
          <Route
            path="/dashboard-reinigung"
            element={<AppDashboardReinigung />}
          />
          <Route path="*" element={<AppStandorte />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppShell />
    </Router>
  );
}

export default App;
