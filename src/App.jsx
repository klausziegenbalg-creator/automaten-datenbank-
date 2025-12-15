// App.jsx
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  useLocation,
} from "react-router-dom";
import AppStandorte from "./AppStandorte";
import AppAutomaten from "./AppAutomaten";
import AppKontakte from "./AppKontakte";

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

  const tabs = [
    { to: "/standorte", label: "Standorte" },
    { to: "/automaten", label: "Automaten" },
    { to: "/kontakte", label: "Kontakte" },
  ];

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
          height: HEADER_HEIGHT,              // höherer Kopf
          padding: "0 16px",
          display: "flex",
          alignItems: "center",               // vertikal mittig
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
              Standorte · Automaten · Kontakte
            </div>
          </div>
        </div>

        <nav
          style={{
            display: "flex",
            alignItems: "center",             // Navigation in der Mitte
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
      </header>

      {/* Inhaltsbereich unter dem festen Header, hier wird gescrollt */}
      <main
        style={{
          paddingTop: HEADER_HEIGHT + 12,      // Platz für Header
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
