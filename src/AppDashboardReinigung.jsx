import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  query,
  where
} from "firebase/firestore";
import { db } from "./firebase";
import { useAuth } from "./AuthContext";

export default function AppDashboardReinigung() {
  const { user, userMeta } = useAuth(); // userMeta = users/{uid}
  const userRole = userMeta?.role || null;
  const userCity = userMeta?.stadt || null;

  const isTeamleiter = userRole === "Teamleiter";
  const isPrivileged = ["Admin", "Supervisor", "Owner"].includes(userRole);

  const [loading, setLoading] = useState(true);

  // KPIs
  const [fehlendeProtokolle, setFehlendeProtokolle] = useState(0);
  const [offeneReinigungen, setOffeneReinigungen] = useState(0);
  const [kritischBestand, setKritischBestand] = useState(0);
  const [wochenwartungOffen, setWochenwartungOffen] = useState(0);
  const [bestellungenOffen, setBestellungenOffen] = useState(0);

  // Tabellen
  const [automaten, setAutomaten] = useState([]);

  // 🔒 WICHTIG: Dashboard lädt ERST, wenn Rolle + Stadt bekannt sind
  const canLoadDashboard = useMemo(() => {
    if (!user || !userMeta) return false;
    if (isTeamleiter && !userCity) return false;
    return true;
  }, [user, userMeta, isTeamleiter, userCity]);

  useEffect(() => {
    if (!canLoadDashboard) return;

    let cancelled = false;

    async function loadDashboard() {
      setLoading(true);

      try {
        // ===============================
        // 🔹 REINIGUNGEN
        // ===============================
        {
          const q = isTeamleiter
            ? query(
                collection(db, "reinigungen"),
                where("stadt", "==", userCity)
              )
            : query(collection(db, "reinigungen"));

          const snap = await getDocs(q);
          if (cancelled) return;

          let fehlend = 0;
          let offen = 0;

          snap.forEach(doc => {
            const d = doc.data();
            if (!d.protokollVorhanden) fehlend++;
            if (d.offen === true) offen++;
          });

          setFehlendeProtokolle(fehlend);
          setOffeneReinigungen(offen);
        }

        // ===============================
        // 🔹 WOCHENWARTUNG
        // ===============================
        {
          const q = isTeamleiter
            ? query(
                collection(db, "wochenWartung"),
                where("stadt", "==", userCity),
                where("offen", "==", true)
              )
            : query(
                collection(db, "wochenWartung"),
                where("offen", "==", true)
              );

          const snap = await getDocs(q);
          if (cancelled) return;
          setWochenwartungOffen(snap.size);
        }

        // ===============================
        // 🔹 BESTELLUNGEN
        // ===============================
        {
          const q = isTeamleiter
            ? query(
                collection(db, "bestellungen"),
                where("stadt", "==", userCity),
                where("status", "==", "offen")
              )
            : query(
                collection(db, "bestellungen"),
                where("status", "==", "offen")
              );

          const snap = await getDocs(q);
          if (cancelled) return;
          setBestellungenOffen(snap.size);
        }

        // ===============================
        // 🔹 AUTOMATEN (Tabelle)
        // ===============================
        {
          const q = isTeamleiter
            ? query(
                collection(db, "automaten"),
                where("stadt", "==", userCity)
              )
            : query(collection(db, "automaten"));

          const snap = await getDocs(q);
          if (cancelled) return;

          const list = [];
          snap.forEach(doc => {
            list.push({ id: doc.id, ...doc.data() });
          });

          setAutomaten(list);
        }

        // ===============================
        // 🔒 AUTOMATENBESTAND
        // ===============================
        // ❗ Teamleiter lädt DAS NICHT
        if (isTeamleiter) {
          setKritischBestand(0);
        } else {
          const snap = await getDocs(collection(db, "Automatenbestand"));
          if (cancelled) return;

          let kritisch = 0;
          snap.forEach(doc => {
            const d = doc.data();
            if (d.zucker < 1 || d.staebe < 1) kritisch++;
          });

          setKritischBestand(kritisch);
        }
      } catch (err) {
        // 🔇 Für Teamleiter KEIN Popup mehr
        if (!isTeamleiter) {
          alert("Fehler beim Laden: Missing or insufficient permissions.");
        }
        console.warn("DashboardReinigung load warning:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadDashboard();
    return () => {
      cancelled = true;
    };
  }, [canLoadDashboard, isTeamleiter, isPrivileged, userCity]);

  if (!canLoadDashboard || loading) {
    return <div style={{ padding: 24 }}>Lade Dashboard…</div>;
  }

  return (
    <div>
      {/* KPIs */}
      <div className="kpi-grid">
        <div className="kpi">
          <strong>Fehlende Protokolle</strong>
          <div>{fehlendeProtokolle}</div>
        </div>
        <div className="kpi">
          <strong>Offene Reinigungen</strong>
          <div>{offeneReinigungen}</div>
        </div>
        <div className="kpi">
          <strong>Kritisch (Bestände)</strong>
          <div>{kritischBestand}</div>
        </div>
        <div className="kpi">
          <strong>Wochenwartung (offen)</strong>
          <div>{wochenwartungOffen}</div>
        </div>
        <div className="kpi">
          <strong>Bestellungen (offen)</strong>
          <div>{bestellungenOffen}</div>
        </div>
      </div>

      {/* Tabelle */}
      <table className="table">
        <thead>
          <tr>
            <th>Automat</th>
            <th>Center</th>
            <th>Stadt</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {automaten.map(a => (
            <tr key={a.id}>
              <td>{a.code}</td>
              <td>{a.center}</td>
              <td>{a.stadt}</td>
              <td>{a.status || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
