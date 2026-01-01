// AppLayout.jsx
import React from "react";

const colors = {
  bg: "#cfe3ff",     // dein Wunsch-Blau (Markierungs-Blau)
  bgSoft: "#eaf2ff",
};

export default function AppLayout({ children }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        background: `linear-gradient(180deg, ${colors.bg} 0%, ${colors.bgSoft} 100%)`,
        padding: 12,
        boxSizing: "border-box",
      }}
    >
      {children}
    </div>
  );
}
