// AppDashboardReinigung.jsx
import { useEffect, useState, useMemo } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "./firebase";
import { useNavigate } from "react-router-dom";

const colors = {
  bg: "#f5f7fb",
  card: "#ffffff",
  border: "#e0e4f0",
  primary: "#1976d2",
  primaryDark: "#1565c0",
  textMain: "#1f2933",
  textMuted: "#6b7280",
  danger: "#dc2626",
  success: "#16a34a",
  warning: "#f59e0b",
};

const AUFGABEN_FELDER = [
  { key: "zucker_aufgefuellt", label: "Zucker aufgefüllt" },
  { key: "wasser_aufgefuellt", label: "Wasser aufgefüllt" },
  { key: "staebe_aufgefuellt", label: "Stäbe aufgefüllt" },
  { key: "zuckerfach_gereinigt", label: "Zuckerfach gereinigt" },
  { key: "faecher_gereinigt", label: "Alle Fächer gereinigt" },
  { key: "abwasser_entleert", label: "Abwasser entleert" },
  { key: "produktionsraum_gereinigt", label: "Produktionsraum gereinigt" },
  { key: "messer_gereinigt", label: "Messer + Rädchen gereinigt" },
  { key: "roboterarm_gereinigt", label: "Roboterarm gereinigt" },
  { key: "sieb_gereinigt", label: "Sieb oben gereinigt" },
  { key: "auffangschale_gereinigt", label: "Auffangschale gereinigt" },
  { key: "aufbewahrung_aufgeraeumt", label: "Aufbewahrungsfach aufgeräumt" },
  { key: "automat_aussen_gereinigt", label: "Automat außen gereinigt" },
  { key: "scheiben_gereinigt", label: "Scheiben gereinigt" },
  { key: "brennerkopf_gereinigt", label: "Brennerkopf gereinigt" },
  { key: "duese_gereinigt", label: "Düse hinter Brennerkopf gereinigt" },
  { key: "befeuchtungstest", label: "Befeuchtungstest" },
  { key: "reinigungstest", label: "Reinigungstest" },
  { key: "neuer_stab_genommen", label: "neuen Stab genommen" },
  { key: "roboterarm_90grad", label: "Roboterarm im 90° Winkel" },
];

function ermittleOffeneAufgaben(protokoll) {
  const offen = AUFGABEN_FELDER
    .filter(
      (a) =>
        protokoll[a.key] === false ||
        protokoll[a.key] === undefined ||
        protokoll[a.key] === null
    )
    .map((a) => a.label);
  return offen.length ? offen.join(", ") : "Alle erledigt";
}

function getWeekKeyFromDate(date) {
  const d = new Date(date.getTime());
  const year = d.getFullYear();
  const oneJan = new Date(year, 0, 1);
  const dayOfYear = Math.floor((d - oneJan) / 86400000) + 1;
  const week = Math.ceil(dayOfYear / 7);
  return `${year}-W${week.toString().padStart(2, "0")}`;
}

function AppDashboardReinigung() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);

  const [datum, setDatum] = useState(() =>
    new Date().toISOString().split("T")[0]
  );
  const [stadtFilter, setStadtFilter] = useState("Alle Städte");
  const [centerFilter, setCenterFilter] = useState("Alle Center");
  const [search, setSearch] = useState("");

  const [automaten, setAutomaten] = useState([]);
  const [protokolle, setProtokolle] = useState([]);
  const [wartungselementeMap, setWartungselementeMap] = useState({});
  const [wochenMap, setWochenMap] = useState({});
  const [wartungsprotokolle, setWartungsprotokolle] = useState([]);

  const [wartungsAnsicht, setWartungsAnsicht] = useState("tag"); // tag | woche | monat

  const [sortierungProtokolle, setSortierungProtokolle] = useState({
    feld: "center",
    richtung: 1,
  });

  // Hilfsfunktionen zum Datum
  function getStartEndOfDay(dateStr) {
    const d = new Date(dateStr);
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
    const end = new Date(
      d.getFullYear(),
      d.getMonth(),
      d.getDate() + 1,
      0,
      0,
      0
    );
    return { start, end };
  }

  // Daten laden
  async function ladeDashboard() {
    setLoading(true);
    try {
      // Automaten
      const automatenSnap = await getDocs(collection(db, "automaten"));
      const alleAutomaten = automatenSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      setAutomaten(alleAutomaten);

      // Wartungselemente
      const wartSnap = await getDocs(collection(db, "Wartungselemente"));
      const wartMap = {};
      wartSnap.forEach((doc) => {
        wartMap[doc.id] = doc.data();
      });
      setWartungselementeMap(wartMap);

      // Reinigungsprotokolle nach Datum + Stadt + Center
      const { start, end } = getStartEndOfDay(datum);

      let reinigQuery = query(
        collection(db, "reinigungen"),
        where("datum", ">=", start),
        where("datum", "<", end)
      );

      // Stadt/Center-Filter clientseitig anwenden (einfacher)
      const reinigSnap = await getDocs(reinigQuery);
      let reinigData = reinigSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      if (stadtFilter !== "Alle Städte") {
        reinigData = reinigData.filter((p) => p.stadt === stadtFilter);
      }
      if (centerFilter !== "Alle Center") {
        reinigData = reinigData.filter((p) => p.center === centerFilter);
      }

      setProtokolle(reinigData);

      // Wochenwartung
      await ladeWochenWartung(new Date(datum));

      // Wartungsprotokolle (Checkheft) – Datum als String "DD.MM.YYYY"
      const wartungsProtSnap = await getDocs(
        collection(db, "Wartungsprotokolle")
      );
      let wartProt = wartungsProtSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      const zielDatumStr = new Date(datum).toLocaleDateString("de-DE");
      wartProt = wartProt.filter((p) => p.datumDerDurchfuehrung === zielDatumStr);

      if (stadtFilter !== "Alle Städte") {
        wartProt = wartProt.filter(
          (p) => (p.standort || "").toLowerCase().includes(stadtFilter.toLowerCase())
        );
      }

      setWartungsprotokolle(wartProt);
    } catch (err) {
      alert("Fehler beim Laden des Dashboards: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function ladeWochenWartung(datumObj) {
    const map = {};
    if (wartungsAnsicht === "tag" || wartungsAnsicht === "woche") {
      const weekKey = getWeekKeyFromDate(datumObj);
      const snap = await getDocs(
        query(collection(db, "wochenWartung"), where("woche", "==", weekKey))
      );
      snap.forEach((doc) => {
        const d = doc.data();
        map[d.automatCode] = buildWochenInfo(d);
      });
    } else {
      const year = datumObj.getFullYear();
      const month = datumObj.getMonth();
      const startDate = new Date(year, month, 1);
      const endDate = new Date(year, month + 1, 1);
      const snap = await getDocs(
        query(
          collection(db, "wochenWartung"),
          where("startedAt", ">=", startDate),
          where("startedAt", "<", endDate)
        )
      );
      snap.forEach((doc) => {
        const d = doc.data();
        map[d.automatCode] = buildWochenInfo(d);
      });
    }
    setWochenMap(map);
  }

  function buildWochenInfo(d) {
    let doneDate = null;
    const tasksRaw = d.tasks || {};
    const tasks = {};

    Object.entries(tasksRaw).forEach(([id, t]) => {
      const done = !!t.done;
      const doneAt =
        t.doneAt && typeof t.doneAt.toDate === "function"
          ? t.doneAt.toDate()
          : null;
      tasks[id] = { done, doneAt };
      if (done && doneAt) {
        if (!doneDate || doneAt < doneDate) {
          doneDate = doneAt;
        }
      }
    });

    if (!doneDate && d.startedAt && typeof d.startedAt.toDate === "function") {
      doneDate = d.startedAt.toDate();
    }

    return {
      status: d.status || "offen",
      doneDate,
      tasks,
    };
  }

  // Filteroptionen aus Automaten
  const staedte = useMemo(() => {
    const set = new Set();
    automaten.forEach((a) => {
      if (a.stadt) set.add(a.stadt);
    });
    return Array.from(set).sort();
  }, [automaten]);

  const centerOptions = useMemo(() => {
    const gefilterte =
      stadtFilter === "Alle Städte"
        ? automaten
        : automaten.filter((a) => a.stadt === stadtFilter);
    const set = new Set();
    gefilterte.forEach((a) => {
      if (a.center) set.add(a.center);
    });
    return Array.from(set).sort();
  }, [automaten, stadtFilter]);

  // Protokolle sortiert + Suche
  const protokolleGefiltert = useMemo(() => {
    const feld = sortierungProtokolle.feld;
    const dir = sortierungProtokolle.richtung;

    let liste = [...protokolle];

    if (search.trim()) {
      const s = search.trim().toLowerCase();
      liste = liste.filter(
        (p) =>
          (p.automatCode || "").toLowerCase().includes(s) ||
          (p.mitarbeiter || "").toLowerCase().includes(s) ||
          (p.center || "").toLowerCase().includes(s)
      );
    }

    liste.sort((a, b) => {
      let va;
      let vb;
      if (feld === "center") {
        va = (a.stadt || "") + " " + (a.center || "");
        vb = (b.stadt || "") + " " + (b.center || "");
      } else if (feld === "datum") {
        va = a.datum ? a.datum.toDate() : new Date(0);
        vb = b.datum ? b.datum.toDate() : new Date(0);
      } else {
        va = a[feld] || "";
        vb = b[feld] || "";
      }
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });

    return liste;
  }, [protokolle, sortierungProtokolle, search]);

  function handleSort(feld) {
    setSortierungProtokolle((prev) => {
      if (prev.feld === feld) {
        return { feld, richtung: prev.richtung * -1 };
      }
      return { feld, richtung: 1 };
    });
  }

  // Kennzahlen
  const totalAutomatenImFilter = useMemo(() => {
    let liste = automaten;
    if (stadtFilter !== "Alle Städte") {
      liste = liste.filter((a) => a.stadt === stadtFilter);
    }
    if (centerFilter !== "Alle Center") {
      liste = liste.filter((a) => a.center === centerFilter);
    }
    return liste.filter((a) => a.automatCode || a.Automat).length;
  }, [automaten, stadtFilter, centerFilter]);

  const abdeckungProzent = useMemo(() => {
    if (!totalAutomatenImFilter) return 0;
    const uniqueAutomatenMitProtokoll = new Set(
      protokolle.map((p) => p.automatCode)
    );
    return Math.round(
      (uniqueAutomatenMitProtokoll.size / totalAutomatenImFilter) * 100
    );
  }, [protokolle, totalAutomatenImFilter]);

  // Fehlende Automaten
  const fehlendeAutomaten = useMemo(() => {
    const erledigte = new Set(protokolle.map((p) => p.automatCode));
    let liste = automaten;
    if (stadtFilter !== "Alle Städte") {
      liste = liste.filter((a) => a.stadt === stadtFilter);
    }
    if (centerFilter !== "Alle Center") {
      liste = liste.filter((a) => a.center === centerFilter);
    }
    return liste.filter((a) => {
      const code = a.automatCode || a.Automat;
      return code && !erledigte.has(code);
    });
  }, [automaten, protokolle, stadtFilter, centerFilter]);

  // Wartungsübersicht-Zahlen
  const wartungsSummary = useMemo(() => {
    let erledigt = 0;
    let teilweise = 0;
    let total = 0;

    automaten.forEach((a) => {
      const code = a.automatCode || a.Automat;
      if (!code) return;
      total++;
      const info = wochenMap[code];
      if (!info) return;
      if (info.status === "erledigt") erledigt++;
      else if (info.status === "teilweise") teilweise++;
    });

    return { erledigt, teilweise, total };
  }, [automaten, wochenMap]);

  useEffect(() => {
    ladeDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datum, stadtFilter, centerFilter, wartungsAnsicht]);

  // CSV-Export
  function exportCSV() {
    const d = datum;
    let csv =
      "Automat,Stadt,Center,Datum,Mitarbeiter,Auffälligkeiten,Nicht erledigte Aufgaben,Wochenwartung\n";
    protokolleGefiltert.forEach((p) => {
      const offen = ermittleOffeneAufgaben(p);

      let wwText = "–";
      if (wochenMap && p.automatCode && wochenMap[p.automatCode]) {
        const info = wochenMap[p.automatCode];
        if (info.status === "erledigt") {
          const dt = info.doneDate
            ? info.doneDate.toLocaleDateString("de-DE")
            : "";
          wwText = `Erledigt${dt ? " am " + dt : ""}`;
        } else if (info.status === "teilweise") {
          wwText = "Teilweise erledigt";
        } else {
          wwText = "Offen / nicht durchgeführt";
        }
      }

      csv += `"${p.automatCode || ""}","${p.stadt || ""}","${
        p.center || ""
      }",` +
        `"${p.datum ? p.datum.toDate().toLocaleDateString("de-DE") : ""}",` +
        `"${p.mitarbeiter || ""}",` +
        `"${(p.auffaelligkeiten || "").replace(/"/g, '""')}",` +
        `"${offen.replace(/"/g, '""')}",` +
        `"${wwText.replace(/"/g, '""')}"\n`;
    });

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `protokolle_${d}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Hilfsfunktionen für Farben
  function kpiColor(value) {
    if (value >= 90) return colors.success;
    if (value >= 75) return colors.warning;
    return colors.danger;
  }

  const datumObj = new Date(datum);
  const weekKey = getWeekKeyFromDate(datumObj);
  const monthName = datumObj.toLocaleDateString("de-DE", {
    month: "long",
    year: "numeric",
  });

  return (
    <div
      style={{
        maxWidth: 1600,
        margin: "0 auto",
        padding: 12,
      }}
    >
      <h1
        style={{
          fontSize: 24,
          fontWeight: 600,
          marginBottom: 16,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span>📊 Dashboard Reinigung & Wartung</span>
      </h1>

      {/* Filter / Kopfbereich */}
      <div
        style={{
          background: colors.card,
          borderRadius: 16,
          padding: 16,
          marginBottom: 16,
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "center",
          boxShadow: "0 2px 8px rgba(15,23,42,0.05)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 12, color: colors.textMuted }}>
            Datum
          </label>
          <input
            type="date"
            value={datum}
            onChange={(e) => setDatum(e.target.value)}
            style={{
              padding: "6px 10px",
              borderRadius: 8,
              border: `1px solid ${colors.border}`,
              fontSize: 13,
            }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 12, color: colors.textMuted }}>
            Stadt
          </label>
          <select
            value={stadtFilter}
            onChange={(e) => {
              setStadtFilter(e.target.value);
              setCenterFilter("Alle Center");
            }}
            style={{
              padding: "6px 10px",
              borderRadius: 8,
              border: `1px solid ${colors.border}`,
              fontSize: 13,
              minWidth: 160,
            }}
          >
            <option>Alle Städte</option>
            {staedte.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 12, color: colors.textMuted }}>
            Center
          </label>
          <select
            value={centerFilter}
            onChange={(e) => setCenterFilter(e.target.value)}
            style={{
              padding: "6px 10px",
              borderRadius: 8,
              border: `1px solid ${colors.border}`,
              fontSize: 13,
              minWidth: 180,
            }}
          >
            <option>Alle Center</option>
            {centerOptions.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 12, color: colors.textMuted }}>
            Suche (Automat / Mitarbeiter / Center)
          </label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="z.B. CT-0307, Alaa, Herold..."
            style={{
              padding: "6px 10px",
              borderRadius: 8,
              border: `1px solid ${colors.border}`,
              fontSize: 13,
              minWidth: 220,
            }}
          />
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button
            onClick={ladeDashboard}
            style={{
              padding: "8px 14px",
              borderRadius: 999,
              border: "none",
              background: colors.primary,
              color: "#fff",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            🔄 Aktualisieren
          </button>
          <button
            onClick={exportCSV}
            style={{
              padding: "8px 14px",
              borderRadius: 999,
              border: `1px solid ${colors.border}`,
              background: "#fff",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            📥 CSV Export
          </button>
        </div>
      </div>

      {loading ? (
        <div
          style={{
            padding: 40,
            textAlign: "center",
            fontSize: 16,
          }}
        >
          Lade Daten…
        </div>
      ) : (
        <>
          {/* KPI-Karten */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
              gap: 16,
              marginBottom: 20,
            }}
          >
            <div
              style={{
                background: colors.card,
                borderRadius: 16,
                padding: 16,
                boxShadow: "0 2px 8px rgba(15,23,42,0.05)",
              }}
            >
              <div
                style={{ fontSize: 13, color: colors.textMuted, marginBottom: 4 }}
              >
                Heute erfasste Automaten
              </div>
              <div
                style={{ fontSize: 32, fontWeight: 700, color: colors.primary }}
              >
                {
                  new Set(protokolle.map((p) => p.automatCode || "")).size
                }
              </div>
              <div style={{ fontSize: 12, color: colors.textMuted }}>
                von {totalAutomatenImFilter} Automaten im Filter
              </div>
            </div>

            <div
              style={{
                background: colors.card,
                borderRadius: 16,
                padding: 16,
                boxShadow: "0 2px 8px rgba(15,23,42,0.05)",
              }}
            >
              <div
                style={{ fontSize: 13, color: colors.textMuted, marginBottom: 4 }}
              >
                Abdeckung
              </div>
              <div
                style={{
                  fontSize: 32,
                  fontWeight: 700,
                  color: kpiColor(abdeckungProzent),
                }}
              >
                {abdeckungProzent}%
              </div>
              <div style={{ fontSize: 12, color: colors.textMuted }}>
                Anteil der Automaten mit Tagesprotokoll
              </div>
            </div>

            <div
              style={{
                background: colors.card,
                borderRadius: 16,
                padding: 16,
                boxShadow: "0 2px 8px rgba(15,23,42,0.05)",
              }}
            >
              <div
                style={{ fontSize: 13, color: colors.textMuted, marginBottom: 4 }}
              >
                Wartung (aktuelle {wartungsAnsicht === "monat"
                  ? "Monat"
                  : "Woche"}
                )
              </div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 600,
                  marginBottom: 4,
                }}
              >
                {wartungsSummary.erledigt} von {wartungsSummary.total} erledigt
              </div>
              {wartungsSummary.teilweise > 0 && (
                <div style={{ fontSize: 12, color: colors.textMuted }}>
                  {wartungsSummary.teilweise} teilweise erledigt
                </div>
              )}
              <div
                style={{
                  marginTop: 8,
                  display: "flex",
                  gap: 6,
                  flexWrap: "wrap",
                }}
              >
                <button
                  type="button"
                  onClick={() => setWartungsAnsicht("tag")}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 999,
                    border:
                      wartungsAnsicht === "tag"
                        ? `1px solid ${colors.primary}`
                        : `1px solid ${colors.border}`,
                    background:
                      wartungsAnsicht === "tag" ? colors.primary : "#fff",
                    color: wartungsAnsicht === "tag" ? "#fff" : colors.textMuted,
                    fontSize: 11,
                    cursor: "pointer",
                  }}
                >
                  Tag
                </button>
                <button
                  type="button"
                  onClick={() => setWartungsAnsicht("woche")}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 999,
                    border:
                      wartungsAnsicht === "woche"
                        ? `1px solid ${colors.primary}`
                        : `1px solid ${colors.border}`,
                    background:
                      wartungsAnsicht === "woche" ? colors.primary : "#fff",
                    color:
                      wartungsAnsicht === "woche" ? "#fff" : colors.textMuted,
                    fontSize: 11,
                    cursor: "pointer",
                  }}
                >
                  Woche
                </button>
                <button
                  type="button"
                  onClick={() => setWartungsAnsicht("monat")}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 999,
                    border:
                      wartungsAnsicht === "monat"
                        ? `1px solid ${colors.primary}`
                        : `1px solid ${colors.border}`,
                    background:
                      wartungsAnsicht === "monat" ? colors.primary : "#fff",
                    color:
                      wartungsAnsicht === "monat" ? "#fff" : colors.textMuted,
                    fontSize: 11,
                    cursor: "pointer",
                  }}
                >
                  Monat
                </button>
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: colors.textMuted,
                  marginTop: 4,
                }}
              >
                {wartungsAnsicht === "monat"
                  ? monthName
                  : `Kalenderwoche ${weekKey}`}
              </div>
            </div>
          </div>

          {/* Hauptbereich: links Protokolle, rechts Wartungen / Hinweise */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0,2.2fr) minmax(0,1.4fr)",
              gap: 16,
            }}
          >
            {/* Linke Spalte: Reinigungsprotokolle */}
            <div>
              <h3 style={{ marginBottom: 8, fontSize: 16 }}>
                📋 Protokolle pro Automat & Tag
              </h3>
              <div
                style={{
                  borderRadius: 16,
                  overflow: "hidden",
                  boxShadow: "0 2px 8px rgba(15,23,42,0.05)",
                  background: colors.card,
                }}
              >
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: 12,
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        background: colors.primary,
                        color: "#fff",
                      }}
                    >
                      <th
                        onClick={() => handleSort("automatCode")}
                        style={{
                          padding: "8px 10px",
                          textAlign: "left",
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                        }}
                      >
                        Automat
                      </th>
                      <th
                        onClick={() => handleSort("center")}
                        style={{
                          padding: "8px 10px",
                          textAlign: "left",
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                        }}
                      >
                        Stadt / Center
                      </th>
                      <th
                        onClick={() => handleSort("datum")}
                        style={{
                          padding: "8px 10px",
                          textAlign: "left",
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                        }}
                      >
                        Datum
                      </th>
                      <th
                        onClick={() => handleSort("mitarbeiter")}
                        style={{
                          padding: "8px 10px",
                          textAlign: "left",
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                        }}
                      >
                        Mitarbeiter
                      </th>
                      <th
                        style={{
                          padding: "8px 10px",
                          textAlign: "left",
                          whiteSpace: "nowrap",
                        }}
                      >
                        Auffälligkeiten
                      </th>
                      <th
                        style={{
                          padding: "8px 10px",
                          textAlign: "left",
                          whiteSpace: "nowrap",
                        }}
                      >
                        Nicht erledigte Aufgaben
                      </th>
                      <th
                        style={{
                          padding: "8px 10px",
                          textAlign: "left",
                          whiteSpace: "nowrap",
                        }}
                      >
                        Wochenwartung
                      </th>
                      <th
                        style={{
                          padding: "8px 10px",
                          textAlign: "left",
                          whiteSpace: "nowrap",
                        }}
                      >
                        Details
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {protokolleGefiltert.map((p) => {
                      let wwText = "–";
                      if (wochenMap && p.automatCode && wochenMap[p.automatCode]) {
                        const info = wochenMap[p.automatCode];
                        if (info.status === "erledigt") {
                          const dt = info.doneDate
                            ? info.doneDate.toLocaleDateString("de-DE")
                            : "";
                          wwText = `Erledigt${dt ? " am " + dt : ""}`;
                        } else if (info.status === "teilweise") {
                          wwText = "Teilweise erledigt";
                        } else {
                          wwText = "Offen / nicht durchgeführt";
                        }
                      }

                      return (
                        <tr
                          key={p.id}
                          style={{
                            borderBottom: `1px solid ${colors.border}`,
                          }}
                        >
                          <td style={{ padding: "6px 10px", whiteSpace: "nowrap" }}>
                            {p.automatCode}
                          </td>
                          <td style={{ padding: "6px 10px" }}>
                            {p.stadt} / {p.center}
                          </td>
                          <td style={{ padding: "6px 10px", whiteSpace: "nowrap" }}>
                            {p.datum
                              ? p.datum.toDate().toLocaleDateString("de-DE")
                              : ""}
                          </td>
                          <td style={{ padding: "6px 10px" }}>{p.mitarbeiter}</td>
                          <td style={{ padding: "6px 10px", maxWidth: 200 }}>
                            {p.auffaelligkeiten || "–"}
                          </td>
                          <td style={{ padding: "6px 10px", maxWidth: 250 }}>
                            {ermittleOffeneAufgaben(p)}
                          </td>
                          <td style={{ padding: "6px 10px" }}>{wwText}</td>
                          <td style={{ padding: "6px 10px" }}>
                            <button
                              type="button"
                              onClick={() =>
                                navigate(`/automaten/${p.automatCode}`)
                              }
                              style={{
                                padding: "4px 8px",
                                borderRadius: 999,
                                border: `1px solid ${colors.border}`,
                                background: "#fff",
                                fontSize: 11,
                                cursor: "pointer",
                              }}
                            >
                              Automat öffnen
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {protokolleGefiltert.length === 0 && (
                      <tr>
                        <td
                          colSpan={8}
                          style={{
                            padding: 12,
                            textAlign: "center",
                            fontSize: 13,
                            color: colors.textMuted,
                          }}
                        >
                          Keine Protokolle für diesen Filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Fehlende Protokolle */}
              <h3 style={{ marginTop: 20, marginBottom: 8, fontSize: 16 }}>
                🚨 Fehlende Protokolle am Tag
              </h3>
              <div
                style={{
                  borderRadius: 16,
                  overflow: "hidden",
                  boxShadow: "0 2px 8px rgba(15,23,42,0.05)",
                  background: colors.card,
                }}
              >
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: 12,
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        background: "#fee2e2",
                        color: "#991b1b",
                      }}
                    >
                      <th style={{ padding: "6px 10px", textAlign: "left" }}>
                        Automat
                      </th>
                      <th style={{ padding: "6px 10px", textAlign: "left" }}>
                        Stadt
                      </th>
                      <th style={{ padding: "6px 10px", textAlign: "left" }}>
                        Center
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {fehlendeAutomaten.map((a) => (
                      <tr key={a.id}>
                        <td style={{ padding: "6px 10px" }}>
                          {a.automatCode || a.Automat}
                        </td>
                        <td style={{ padding: "6px 10px" }}>{a.stadt}</td>
                        <td style={{ padding: "6px 10px" }}>{a.center}</td>
                      </tr>
                    ))}
                    {fehlendeAutomaten.length === 0 && (
                      <tr>
                        <td
                          colSpan={3}
                          style={{
                            padding: 10,
                            textAlign: "center",
                            fontSize: 12,
                            color: colors.textMuted,
                          }}
                        >
                          Für alle Automaten liegt heute ein Protokoll vor.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Rechte Spalte: Wartung + Wartungsprotokolle */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div
                style={{
                  background: colors.card,
                  borderRadius: 16,
                  padding: 12,
                  boxShadow: "0 2px 8px rgba(15,23,42,0.05)",
                  maxHeight: 350,
                  overflow: "auto",
                }}
              >
                <h3 style={{ marginBottom: 8, fontSize: 15 }}>
                  🛠️ Wartungsübersicht
                </h3>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: 11,
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        background: "#e5e7eb",
                        color: "#111827",
                      }}
                    >
                      <th style={{ padding: "6px 8px", textAlign: "left" }}>
                        Automat
                      </th>
                      <th style={{ padding: "6px 8px", textAlign: "left" }}>
                        Stadt / Center
                      </th>
                      <th style={{ padding: "6px 8px", textAlign: "left" }}>
                        Zeitraum
                      </th>
                      <th style={{ padding: "6px 8px", textAlign: "left" }}>
                        Status
                      </th>
                      <th style={{ padding: "6px 8px", textAlign: "left" }}>
                        Datum
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {automaten.map((a) => {
                      const code = a.automatCode || a.Automat;
                      if (!code) return null;
                      const info = wochenMap[code];

                      let zeitraumText =
                        wartungsAnsicht === "monat" ? monthName : weekKey;

                      let statusText = "Kein Eintrag";
                      let datumText = "–";

                      if (info) {
                        statusText = info.status || "offen";
                        datumText = info.doneDate
                          ? info.doneDate.toLocaleDateString("de-DE")
                          : "–";
                      }

                      let bg = "#ffffff";
                      if (statusText.startsWith("erledigt")) {
                        bg = "#e8f5e9";
                      } else if (statusText === "teilweise") {
                        bg = "#fff7ed";
                      } else if (
                        statusText === "Kein Eintrag" ||
                        statusText === "offen" ||
                        statusText === "Offen / nicht durchgeführt"
                      ) {
                        bg = "#fef2f2";
                      }

                      return (
                        <tr key={a.id} style={{ background: bg }}>
                          <td style={{ padding: "6px 8px" }}>{code}</td>
                          <td style={{ padding: "6px 8px" }}>
                            {a.stadt} / {a.center}
                          </td>
                          <td style={{ padding: "6px 8px" }}>{zeitraumText}</td>
                          <td style={{ padding: "6px 8px" }}>{statusText}</td>
                          <td style={{ padding: "6px 8px" }}>{datumText}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div
                style={{
                  background: colors.card,
                  borderRadius: 16,
                  padding: 12,
                  boxShadow: "0 2px 8px rgba(15,23,42,0.05)",
                  maxHeight: 300,
                  overflow: "auto",
                }}
              >
                <h3 style={{ marginBottom: 8, fontSize: 15 }}>
                  🔧 Wartungsarbeiten am Tag
                </h3>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: 11,
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        background: "#e5e7eb",
                        color: "#111827",
                      }}
                    >
                      <th style={{ padding: "6px 8px", textAlign: "left" }}>
                        Automat
                      </th>
                      <th style={{ padding: "6px 8px", textAlign: "left" }}>
                        Standort
                      </th>
                      <th style={{ padding: "6px 8px", textAlign: "left" }}>
                        Maßnahme
                      </th>
                      <th style={{ padding: "6px 8px", textAlign: "left" }}>
                        Mitarbeiter
                      </th>
                      <th style={{ padding: "6px 8px", textAlign: "left" }}>
                        Nächste Fälligkeit
                      </th>
                      <th style={{ padding: "6px 8px", textAlign: "left" }}>
                        Details
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {wartungsprotokolle.map((w) => (
                      <tr key={w.id}>
                        <td style={{ padding: "6px 8px" }}>{w.automatCode}</td>
                        <td style={{ padding: "6px 8px" }}>{w.standort}</td>
                        <td style={{ padding: "6px 8px" }}>{w.bezeichnung}</td>
                        <td style={{ padding: "6px 8px" }}>{w.name}</td>
                        <td style={{ padding: "6px 8px" }}>
                          {w.nachsteFaelligkeit || "–"}
                        </td>
                        <td style={{ padding: "6px 8px" }}>
                          <button
                            type="button"
                            onClick={() =>
                              navigate(`/automaten/${w.automatCode}`)
                            }
                            style={{
                              padding: "4px 8px",
                              borderRadius: 999,
                              border: `1px solid ${colors.border}`,
                              background: "#fff",
                              fontSize: 11,
                              cursor: "pointer",
                            }}
                          >
                            Automat öffnen
                          </button>
                        </td>
                      </tr>
                    ))}
                    {wartungsprotokolle.length === 0 && (
                      <tr>
                        <td
                          colSpan={6}
                          style={{
                            padding: 10,
                            textAlign: "center",
                            fontSize: 12,
                            color: colors.textMuted,
                          }}
                        >
                          Keine Wartungsarbeiten für diesen Tag gefunden.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default AppDashboardReinigung;
