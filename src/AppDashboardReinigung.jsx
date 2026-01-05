// AppDashboardReinigung.jsx
// Komplette Datei – BESTELLUNGEN: erledigte werden aus der Tabelle ausgeblendet
// ✅ Kachel zählt nur OFFENE Bestellungen
// ✅ Tabelle zeigt nur OFFENE Bestellungen
// ✅ "Erledigt" Button bleibt (setzt erledigt=true, erledigtAm, status="erledigt")

import { useEffect, useMemo, useRef, useState } from "react";
import { collection, doc, getDoc, getDocs, query, updateDoc, where } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { getAuth } from "firebase/auth";
import { db } from "./firebase";

const colors = {
  bg: "#f5f7fb",
  card: "#ffffff",
  border: "#e0e4f0",
  primary: "#1976d2",
  textMain: "#1f2933",
  textMuted: "#6b7280",
  danger: "#dc2626",
  success: "#16a34a",
  warning: "#f59e0b",
  tabBg: "#eef2ff",
  soft: "#fafbff",
};

const REINIGUNG_TASKS = [
  { key: "zucker_aufgefuellt", label: "Zucker aufgefüllt" },
  { key: "wasser_aufgefuellt", label: "Wasser aufgefüllt" },
  { key: "staebe_aufgefuellt", label: "Stäbe aufgefüllt" },
  { key: "zuckerfach_gereinigt", label: "Zuckerfach gereinigt" },
  { key: "faecher_gereinigt", label: "Alle Fächer gereinigt" },
  { key: "abwasser_entleert", label: "Abwasser entleert" },
  { key: "produktionsraum_gereinigt", label: "Produktionsraum gereinigt" },
  { key: "messer_gereinigt", label: "Messer/Rädchen gereinigt" },
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
  { key: "neuer_stab_genommen", label: "Neuen Stab genommen" },
  { key: "roboterarm_90grad", label: "Roboterarm im 90° Winkel" },
];

function normalizeCode(raw) {
  if (!raw) return "";
  return String(raw).trim();
}

function toDateSafe(v) {
  if (!v) return null;
  if (typeof v?.toDate === "function") return v.toDate();
  if (v instanceof Date) return v;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function formatDateDE(d) {
  if (!d) return "—";
  try {
    return d.toLocaleDateString("de-DE");
  } catch {
    return "—";
  }
}

function getStartEndOfDay(dateStr) {
  const d = new Date(dateStr);
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0);
  return { start, end };
}

function getWeekKeyFromDate(date) {
  const d = new Date(date.getTime());
  const year = d.getFullYear();
  const oneJan = new Date(year, 0, 1);
  const dayOfYear = Math.floor((d - oneJan) / 86400000) + 1;
  const week = Math.ceil(dayOfYear / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

function getWeekRange(date) {
  const d = new Date(date);
  const day = d.getDay() === 0 ? 7 : d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - day + 1);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { start: monday, end: sunday };
}

function offeneReinigungAufgabenListe(protokoll) {
  if (!protokoll) return [];
  return REINIGUNG_TASKS.filter((t) => protokoll[t.key] !== true).map((t) => t.label);
}

function kpiToneCoverage(v) {
  if (v >= 90) return "good";
  if (v >= 75) return "warn";
  return "bad";
}

function statusBadge(status) {
  if (status === "OK") return { bg: "#dcfce7", fg: colors.success, text: "OK" };
  if (status === "OFFEN") return { bg: "#fef3c7", fg: colors.warning, text: "OFFEN" };
  return { bg: "#fee2e2", fg: colors.danger, text: "FEHLT" };
}

function Card({ title, value, sub, tone = "neutral", onClick, hint }) {
  const toneColor =
    tone === "good"
      ? colors.success
      : tone === "warn"
      ? colors.warning
      : tone === "bad"
      ? colors.danger
      : colors.textMain;

  const clickable = typeof onClick === "function";

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        textAlign: "left",
        width: "100%",
        background: colors.card,
        border: `1px solid ${colors.border}`,
        borderRadius: 18,
        padding: 14,
        boxShadow: "0 10px 25px rgba(15,23,42,0.06)",
        minHeight: 92,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        cursor: clickable ? "pointer" : "default",
        transition: "transform 120ms ease, border-color 120ms ease",
      }}
      onMouseEnter={(e) => {
        if (!clickable) return;
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.borderColor = "#c7d2fe";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.borderColor = colors.border;
      }}
    >
      <div style={{ fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Helvetica, Arial, sans-serif",
    display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <div style={{ fontSize: 12, color: colors.textMuted, fontWeight: 800 }}>{title}</div>
        {hint ? (
          <span style={{ fontSize: 11, color: colors.textMuted, fontWeight: 800, whiteSpace: "nowrap" }}>
            {hint}
          </span>
        ) : null}
      </div>

      <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: 0.2, color: toneColor }}>{value}</div>
      <div style={{ fontSize: 12, color: colors.textMuted }}>{sub}</div>
    </button>
  );
}

function Pill({ children, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        border: `1px solid ${colors.border}`,
        background: active ? colors.primary : "#fff",
        color: active ? "#fff" : colors.textMuted,
        padding: "6px 12px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: active ? 900 : 800,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function Chip({ label, tone = "neutral", onRemove }) {
  const bg =
    tone === "bad" ? "#fee2e2" : tone === "warn" ? "#fef3c7" : tone === "good" ? "#dcfce7" : "#eef2ff";
  const fg =
    tone === "bad"
      ? colors.danger
      : tone === "warn"
      ? colors.warning
      : tone === "good"
      ? colors.success
      : colors.primary;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        background: bg,
        color: fg,
        padding: "6px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 900,
        border: `1px solid ${colors.border}`,
      }}
    >
      {label}
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          style={{
            border: "none",
            background: "transparent",
            cursor: "pointer",
            fontWeight: 900,
            color: fg,
            lineHeight: 1,
          }}
          aria-label="Filter entfernen"
          title="Filter entfernen"
        >
          ×
        </button>
      ) : null}
    </span>
  );
}

function SectionTitle({ title, right }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
      <div style={{ fontWeight: 900, color: colors.textMain }}>{title}</div>
      {right ? <div>{right}</div> : null}
    </div>
  );
}

function MiniList({ title, items, tone }) {
  const bg =
    tone === "bad" ? "#fee2e2" : tone === "warn" ? "#fef3c7" : tone === "good" ? "#dcfce7" : "#eef2ff";
  const fg =
    tone === "bad"
      ? colors.danger
      : tone === "warn"
      ? colors.warning
      : tone === "good"
      ? colors.success
      : colors.primary;

  return (
    <div
      style={{
        flex: 1,
        minWidth: 260,
        background: "#fff",
        border: `1px solid ${colors.border}`,
        borderRadius: 14,
        padding: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ fontWeight: 900 }}>{title}</div>
        <span
          style={{
            padding: "4px 10px",
            borderRadius: 999,
            background: bg,
            color: fg,
            fontWeight: 900,
            fontSize: 12,
            border: `1px solid ${colors.border}`,
          }}
        >
          {items.length}
        </span>
      </div>
      {items.length === 0 ? (
        <div style={{ color: colors.textMuted, fontSize: 12 }}>—</div>
      ) : (
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {items.map((x) => (
            <li key={x} style={{ marginBottom: 4, fontSize: 13 }}>
              {x}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------- BESTELLUNGEN helpers ----------
const ORDER_LABELS = [
  { key: "zucker_blau", label: "Zucker blau" },
  { key: "zucker_gelb", label: "Zucker gelb" },
  { key: "zucker_gruen", label: "Zucker grün" },
  { key: "zucker_rot", label: "Zucker rot" },
  { key: "zucker_weinrot", label: "Zucker weinrot" },
  { key: "zucker_weiss", label: "Zucker weiß" },
  { key: "staebe", label: "Stäbe" },
  { key: "entkalker", label: "Entkalker" }, // optional später
];

function pickFirst(obj, keys) {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return null;
}

function normalizeOrderItems(order) {
  const itemsObj = order?.items || order?.positionen || order?.artikel || {};
  const getVal = (k) => {
    const direct = order?.[k];
    const nested = itemsObj?.[k];
    const v = nested ?? direct;
    const num = Number(v);
    if (Number.isFinite(num)) return num;
    if (typeof v === "boolean") return v ? 1 : 0;
    return 0;
  };
  const out = {};
  for (const it of ORDER_LABELS) out[it.key] = getVal(it.key);
  return out;
}

function renderOrderItems(items) {
  const parts = [];
  for (const it of ORDER_LABELS) {
    const v = Number(items?.[it.key] ?? 0);
    if (v > 0) parts.push(`${it.label}: ${v}`);
  }
  return parts.length ? parts.join(" · ") : "—";
}

function isOrderDone(order) {
  const erledigt = !!(order?.erledigt || order?.delivered);
  const status = String(order?.status || "").toLowerCase().trim();
  return erledigt || status === "erledigt" || status === "delivered" || status === "done";
}

export default function AppDashboardReinigung() {
  const navigate = useNavigate();
  
  // ------------------------------------------------------------
  // Teamleiter: Rolle + Stadt aus users/{uid} laden
  // ------------------------------------------------------------
  useEffect(() => {
    (async () => {
      try {
        const auth = getAuth();
        const u = auth.currentUser;
        if (!u) {
          setMyRole(null);
          setMyCity(null);
          return;
        }

        const snap = await getDoc(doc(db, "users", u.uid));
        const data = snap.exists() ? snap.data() : null;

        const role = data?.role ?? data?.rolle ?? null;
        const city = data?.stadt ?? null;

        setMyRole(role);
        setMyCity(city || null);

        if (role === "Teamleiter" && city) {
          setStadtFilter(city);
          setCenterFilter("Alle Center");
        }
      } catch (err) {
        console.error("Fehler beim Laden der Teamleiter-Stadt:", err);
        setMyRole(null);
        setMyCity(null);
      } finally {
        setUserMetaLoaded(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
const tableAnchorRef = useRef(null);
  const [myRole, setMyRole] = useState(null);
  const [myCity, setMyCity] = useState(null);
  const [userMetaLoaded, setUserMetaLoaded] = useState(false);



  const [loading, setLoading] = useState(false);
  const [busyOrderId, setBusyOrderId] = useState(null);

  const [activeTab, setActiveTab] = useState("reinigung"); // reinigung | bestaende | woche | reparaturen | bestellungen
  const [wartungsAnsicht, setWartungsAnsicht] = useState("woche"); // woche | monat

  const [datum, setDatum] = useState(new Date().toISOString().split("T")[0]);
  const [stadtFilter, setStadtFilter] = useState("Alle Städte");
  const [centerFilter, setCenterFilter] = useState("Alle Center");
  const [search, setSearch] = useState("");

  const [reinigungStatusFilter, setReinigungStatusFilter] = useState("ALLE"); // ALLE | FEHLT | OFFEN | OK
  const [bestandFilter, setBestandFilter] = useState("ALLE"); // ALLE | KRITISCH
  const [wartungFilter, setWartungFilter] = useState("ALLE"); // ALLE | OFFEN

  const [automaten, setAutomaten] = useState([]);
  const [codeToIdMap, setCodeToIdMap] = useState({});

  const [reinigungen, setReinigungen] = useState([]);
  const [wochenMap, setWochenMap] = useState({});
  const [wartungselementeMap, setWartungselementeMap] = useState({});
  const [wartungsprotokolle, setWartungsprotokolle] = useState([]);

  const [bestellungen, setBestellungen] = useState([]);

  const [expandedReinigung, setExpandedReinigung] = useState({});
  const [expandedWoche, setExpandedWoche] = useState({});

  useEffect(() => {
    setReinigungStatusFilter("ALLE");
    setBestandFilter("ALLE");
    setWartungFilter("ALLE");
    setExpandedReinigung({});
    setExpandedWoche({});
  }, [datum, stadtFilter, centerFilter]);

  function scrollToTables() {
    requestAnimationFrame(() => {
      tableAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function resetQuickFilters() {
    setReinigungStatusFilter("ALLE");
    setBestandFilter("ALLE");
    setWartungFilter("ALLE");
  }

  function gotoAutomatByCode(code) {
    const id = codeToIdMap[code];
    if (id) navigate(`/automaten/${id}`);
    else alert(`Kein Mapping gefunden für Automat-Code: ${code}`);
  }

  function buildWochenInfo(d) {
    const tasksRaw = d.tasks || {};
    const tasks = {};
    Object.entries(tasksRaw).forEach(([id, t]) => {
      tasks[id] = { done: !!t?.done, doneAt: toDateSafe(t?.doneAt) };
    });
    return { status: d.status || "offen", tasks, ...d };
  }

  function tasksToList(tasksObj) {
    const erledigt = [];
    const offen = [];
    Object.entries(tasksObj || {}).forEach(([id, t]) => {
      const wart = wartungselementeMap[id];
      const name = wart?.bezeichnung ? wart.bezeichnung : id;
      if (t?.done) erledigt.push(name);
      else offen.push(name);
    });
    erledigt.sort((a, b) => a.localeCompare(b));
    offen.sort((a, b) => a.localeCompare(b));
    return { erledigt, offen };
  }

  async function ladeWochenWartung(datumObj) {
    const map = {};
    const weekKey = getWeekKeyFromDate(datumObj);
    const { start: wStart, end: wEnd } = getWeekRange(datumObj);

    if (wartungsAnsicht === "woche") {
      let snap = await getDocs(
        myRole === "Teamleiter" && myCity
          ? query(collection(db, "wochenWartung"), where("woche", "==", weekKey), where("stadt", "==", myCity))
          : query(collection(db, "wochenWartung"), where("woche", "==", weekKey))
      );

      if (snap.empty) {
        snap = await getDocs(
          myRole === "Teamleiter" && myCity
            ? query(
                collection(db, "wochenWartung"),
                where("startedAt", ">=", wStart),
                where("startedAt", "<=", wEnd),
                where("stadt", "==", myCity)
              )
            : query(
                collection(db, "wochenWartung"),
                where("startedAt", ">=", wStart),
                where("startedAt", "<=", wEnd)
              )
        );
      }

      snap.forEach((docSnap) => {
        const d = docSnap.data();
        const code = normalizeCode(d?.automatCode);
        if (code) map[code] = buildWochenInfo(d);
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

      snap.forEach((docSnap) => {
        const d = docSnap.data();
        const code = normalizeCode(d?.automatCode);
        if (code) map[code] = buildWochenInfo(d);
      });
    }

    setWochenMap(map);
  }

  async function ladeBestellungen() {
    const snap = await getDocs(
      myRole === "Teamleiter" && myCity
        ? query(collection(db, "bestellungen"), where("stadt", "==", myCity))
        : collection(db, "bestellungen")
    );
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    data.sort((a, b) => {
      const da = toDateSafe(pickFirst(a, ["createdAt", "erstelltAm", "datum", "date"])) || new Date(0);
      const dbb = toDateSafe(pickFirst(b, ["createdAt", "erstelltAm", "datum", "date"])) || new Date(0);
      return dbb - da;
    });

    setBestellungen(data);
  }

  async function setBestellungErledigt(order) {
    if (!order?.id) return;
    if (myRole === "Teamleiter") {
      alert("Teamleiter hat nur Leserechte.");
      return;
    }
    try {
      setBusyOrderId(order.id);
      const ref = doc(db, "bestellungen", order.id);
      await updateDoc(ref, {
        erledigt: true,
        erledigtAm: new Date(),
        status: "erledigt",
      });

      // UI sofort aktualisieren => verschwindet aus Tabelle (weil gefiltert)
      setBestellungen((prev) =>
        prev.map((o) =>
          o.id === order.id ? { ...o, erledigt: true, erledigtAm: new Date(), status: "erledigt" } : o
        )
      );
    } catch (err) {
      alert(`Konnte nicht auf erledigt setzen: ${err?.message || String(err)}\n\nHinweis: Firestore Rules müssen update erlauben.`);
    } finally {
      setBusyOrderId(null);
    }
  }

  async function ladeDashboard() {
    setLoading(true);

    // Teamleiter: ohne geladene Stadt nichts laden (sonst würden unscoped Queries an Firestore gehen).
    if (myRole === "Teamleiter" && !myCity) {
      setLoading(false);
      return;
    }

    try {
      const automatenSnap = await getDocs(collection(db, "automaten"));
      const alleAutomaten = automatenSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setAutomaten(alleAutomaten);

      const bestandSnap = await getDocs(
        myRole === "Teamleiter" && myCity
          ? query(collection(db, "Automatenbestand"), where("stadt", "==", myCity))
          : collection(db, "Automatenbestand")
      );
      const bestand = bestandSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const mapCodeToId = {};
      bestand.forEach((a) => {
        const code = normalizeCode(a.maschinenCode || a.automatCode || a.Automat);
        if (code) mapCodeToId[code] = a.id;
      });
      setCodeToIdMap(mapCodeToId);

      const wartSnap = await getDocs(collection(db, "Wartungselemente"));
      const wartMap = {};
      wartSnap.forEach((docSnap) => (wartMap[docSnap.id] = docSnap.data()));
      setWartungselementeMap(wartMap);

      const { start, end } = getStartEndOfDay(datum);
      let qReinigung = query(collection(db, "reinigungen"), where("datum", ">=", start), where("datum", "<", end));
      if (myRole === "Teamleiter" && myCity) qReinigung = query(qReinigung, where("stadt", "==", myCity));
      else if (stadtFilter !== "Alle Städte") qReinigung = query(qReinigung, where("stadt", "==", stadtFilter));
      if (centerFilter !== "Alle Center") qReinigung = query(qReinigung, where("center", "==", centerFilter));

      const reinigSnap = await getDocs(qReinigung);
      setReinigungen(reinigSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

      await ladeWochenWartung(new Date(datum));

      const wartungsProtSnap = await getDocs(
        myRole === "Teamleiter" && myCity
          ? query(collection(db, "Wartungsprotokolle"), where("stadt", "==", myCity))
          : collection(db, "Wartungsprotokolle")
      );
      let wartProt = wartungsProtSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      const { start: wStart, end: wEnd } = getWeekRange(new Date(datum));
      wartProt = wartProt.filter((p) => {
        const ds = p.datumDerDurchfuhrung;
        if (!ds) return false;
        const [tag, mon, jahr] = String(ds).split(".");
        if (!tag || !mon || !jahr) return false;
        const pd = new Date(parseInt(jahr, 10), parseInt(mon, 10) - 1, parseInt(tag, 10));
        return pd >= wStart && pd <= wEnd;
      });
      setWartungsprotokolle(wartProt);

      await ladeBestellungen();
    } catch (err) {
      alert(`Fehler beim Laden: ${err?.message || String(err)}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Für Teamleiter erst laden, wenn Rolle+Stadt aus users/{uid} bekannt sind.
    if (!userMetaLoaded) return;
    if (myRole === "Teamleiter" && !myCity) return;

    ladeDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datum, stadtFilter, centerFilter, wartungsAnsicht, myRole, myCity, userMetaLoaded]);

  const staedte = useMemo(() => {
    const set = new Set();
    automaten.forEach((a) => a.stadt && set.add(a.stadt));
    return Array.from(set).sort();
  }, [automaten]);

  const centerOptions = useMemo(() => {
    const basis = stadtFilter !== "Alle Städte" ? automaten.filter((a) => a.stadt === stadtFilter) : automaten;
    const set = new Set();
    basis.forEach((a) => a.center && set.add(a.center));
    return Array.from(set).sort();
  }, [automaten, stadtFilter]);

  const automatenImFilter = useMemo(() => {
    let list = [...automaten];
    if (stadtFilter !== "Alle Städte") list = list.filter((a) => a.stadt === stadtFilter);
    if (centerFilter !== "Alle Center") list = list.filter((a) => a.center === centerFilter);

    if (search.trim()) {
      const s = search.trim().toLowerCase();
      list = list.filter((a) => {
        const code = (a.automatCode || a.Automat || "").toLowerCase();
        const center = (a.center || "").toLowerCase();
        const stadt = (a.stadt || "").toLowerCase();
        const leiter = (a.leiter || a.leitung || "").toLowerCase();
        const mitarb = (a.mitarbeiter || "").toLowerCase();
        return code.includes(s) || center.includes(s) || stadt.includes(s) || leiter.includes(s) || mitarb.includes(s);
      });
    }
    return list;
  }, [automaten, stadtFilter, centerFilter, search]);

  const protokollByCode = useMemo(() => {
    const map = {};
    reinigungen.forEach((p) => {
      const code = normalizeCode(p.automatCode || p.Automat);
      if (!code) return;
      const created = toDateSafe(p.erstelltAm) || toDateSafe(p.datum) || new Date(0);
      if (!map[code]) map[code] = { ...p, __sortDate: created };
      else {
        const prev = map[code].__sortDate || new Date(0);
        if (created > prev) map[code] = { ...p, __sortDate: created };
      }
    });
    Object.keys(map).forEach((k) => {
      const { __sortDate, ...rest } = map[k];
      map[k] = rest;
    });
    return map;
  }, [reinigungen]);

  const rowsReinigungAll = useMemo(() => {
    return automatenImFilter
      .map((a) => {
        const code = normalizeCode(a.automatCode || a.Automat);
        if (!code) return null;

        const p = protokollByCode[code] || null;

        if (!p) {
          return { code, stadt: a.stadt || "", center: a.center || "", status: "FEHLT", offene: [], offeneCount: 0, note: "" };
        }

        const offene = offeneReinigungAufgabenListe(p);
        const status = offene.length === 0 ? "OK" : "OFFEN";
        return {
          code,
          stadt: p.stadt || a.stadt || "",
          center: p.center || a.center || "",
          status,
          offene,
          offeneCount: offene.length,
          note: p?.bemerkung || p?.bemerkungen || p?.auffaelligkeiten || "",
        };
      })
      .filter(Boolean);
  }, [automatenImFilter, protokollByCode]);

  const rowsReinigung = useMemo(() => {
    if (reinigungStatusFilter === "ALLE") return rowsReinigungAll;
    return rowsReinigungAll.filter((r) => r.status === reinigungStatusFilter);
  }, [rowsReinigungAll, reinigungStatusFilter]);

  const totalAutomatenImFilter = useMemo(() => automatenImFilter.filter((a) => (a.automatCode || a.Automat || "").length > 0).length, [automatenImFilter]);

  const abdeckungProzent = useMemo(() => {
    if (!totalAutomatenImFilter) return 0;
    const unique = new Set(reinigungen.map((p) => normalizeCode(p.automatCode || p.Automat)).filter(Boolean));
    return Math.round((unique.size / totalAutomatenImFilter) * 100);
  }, [reinigungen, totalAutomatenImFilter]);

  const fehlendeAutomaten = useMemo(() => rowsReinigungAll.filter((r) => r.status === "FEHLT"), [rowsReinigungAll]);
  const offeneReinigungen = useMemo(() => rowsReinigungAll.filter((r) => r.status === "OFFEN"), [rowsReinigungAll]);

  const bestaendeHeuteAll = useMemo(() => {
    const map = {};
    reinigungen.forEach((p) => {
      const code = normalizeCode(p.automatCode || p.Automat);
      if (!code) return;

      const staebe = Number(p.staebe ?? 0);
      const zuckerValues = [
        Number(p["zucker_blau"] ?? 0),
        Number(p["zucker_gelb"] ?? 0),
        Number(p["zucker_gruen"] ?? 0),
        Number(p["zucker_rot"] ?? 0),
        Number(p["zucker_weinrot"] ?? 0),
        Number(p["zucker_weiss"] ?? 0),
      ];
      const minZucker = zuckerValues.length ? Math.min(...zuckerValues) : 0;
      map[code] = { code, stadt: p.stadt || "", center: p.center || "", staebe, minZucker };
    });
    return Object.values(map);
  }, [reinigungen]);

  function ampelToneForBestand(b) {
    if (b.staebe < 1) return "bad";
    if (b.minZucker < 1) return "bad";
    if (b.minZucker < 1.5) return "warn";
    return "good";
  }

  const kritischCount = useMemo(() => bestaendeHeuteAll.filter((b) => ampelToneForBestand(b) === "bad").length, [bestaendeHeuteAll]);

  const rowsBestaendeAll = useMemo(() => {
    const list = [...bestaendeHeuteAll];
    list.sort((a, b) => {
      const prio = { bad: 0, warn: 1, good: 2 };
      const ta = ampelToneForBestand(a);
      const tb = ampelToneForBestand(b);
      if (prio[ta] !== prio[tb]) return prio[ta] - prio[tb];
      if (a.staebe !== b.staebe) return a.staebe - b.staebe;
      return a.minZucker - b.minZucker;
    });
    return list;
  }, [bestaendeHeuteAll]);

  const rowsBestaende = useMemo(() => {
    if (bestandFilter === "KRITISCH") return rowsBestaendeAll.filter((b) => ampelToneForBestand(b) === "bad");
    return rowsBestaendeAll;
  }, [rowsBestaendeAll, bestandFilter]);

  const rowsWocheAll = useMemo(() => {
    return automatenImFilter
      .map((a) => {
        const code = normalizeCode(a.automatCode || a.Automat);
        if (!code) return null;

        const info = wochenMap[code] || null;
        const { erledigt, offen } = tasksToList(info?.tasks || {});
        const status = info?.status ? String(info.status) : "Kein Eintrag";

        return { code, stadt: a.stadt || "", center: a.center || "", status, erledigt, offen, offenCount: offen.length, erledigtCount: erledigt.length };
      })
      .filter(Boolean);
  }, [automatenImFilter, wochenMap, wartungselementeMap]);

  const rowsWoche = useMemo(() => {
    if (wartungFilter === "OFFEN") return rowsWocheAll.filter((r) => r.offenCount > 0);
    return rowsWocheAll;
  }, [rowsWocheAll, wartungFilter]);

  const wochenKpi = useMemo(() => {
    const total = rowsWocheAll.length;
    const offen = rowsWocheAll.filter((r) => r.offenCount > 0).length;
    return { total, offen };
  }, [rowsWocheAll]);

  const reparaturenCount = useMemo(() => wartungsprotokolle.length, [wartungsprotokolle]);

  // ✅ Tabelle soll erledigte NICHT anzeigen => hier filtern wir sie weg
  const offeneBestellungenRows = useMemo(() => {
    const s = search.trim().toLowerCase();

    return (bestellungen || [])
      .map((o) => {
        const created = toDateSafe(pickFirst(o, ["createdAt", "erstelltAm", "datum", "date"])) || null;
        const stadt = String(pickFirst(o, ["stadt", "city"]) || "").trim();
        const standort = String(pickFirst(o, ["standort", "center", "location"]) || "").trim();

        const besteller =
          pickFirst(o, ["besteller", "bestelltVon", "userName", "name"]) ||
          pickFirst(o, ["userEmail", "email"]) ||
          (o?.user && (o.user.name || o.user.email)) ||
          "";

        const items = normalizeOrderItems(o);
        const itemsText = renderOrderItems(items);
        const done = isOrderDone(o);

        return { id: o.id, created, stadt, standort, besteller: String(besteller || "").trim(), itemsText, done, raw: o };
      })
      .filter((r) => {
        if (r.done) return false; // ✅ erledigte raus
        if (stadtFilter !== "Alle Städte" && r.stadt && r.stadt !== stadtFilter) return false;
        if (centerFilter !== "Alle Center" && r.standort && r.standort !== centerFilter) return false;
        if (!s) return true;
        const hay = `${r.id} ${r.stadt} ${r.standort} ${r.besteller} ${r.itemsText}`.toLowerCase();
        return hay.includes(s);
      });
  }, [bestellungen, stadtFilter, centerFilter, search]);

  const offeneBestellungenCount = useMemo(() => offeneBestellungenRows.length, [offeneBestellungenRows]);

  const activeChips = useMemo(() => {
    const chips = [];
    if (reinigungStatusFilter !== "ALLE") {
      chips.push({
        label: `Reinigung: ${reinigungStatusFilter}`,
        tone: reinigungStatusFilter === "FEHLT" ? "bad" : reinigungStatusFilter === "OFFEN" ? "warn" : "good",
        remove: () => setReinigungStatusFilter("ALLE"),
      });
    }
    if (bestandFilter === "KRITISCH") chips.push({ label: "Bestände: nur kritisch", tone: "bad", remove: () => setBestandFilter("ALLE") });
    if (wartungFilter === "OFFEN") chips.push({ label: "Wochenwartung: nur offen", tone: "warn", remove: () => setWartungFilter("ALLE") });
    return chips;
  }, [reinigungStatusFilter, bestandFilter, wartungFilter]);

  const datumObj = new Date(datum);
  const weekKey = getWeekKeyFromDate(datumObj);
  const monthName = datumObj.toLocaleDateString("de-DE", { month: "long", year: "numeric" });

  return (
    <div style={{ background: colors.bg, minHeight: "100%", padding: 12, boxSizing: "border-box" }}>
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        {/* Top bar */}
        <div
          style={{
            background: colors.card,
            border: `1px solid ${colors.border}`,
            borderRadius: 16,
            padding: 12,
            boxShadow: "0 10px 25px rgba(15,23,42,0.06)",
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={{ fontWeight: 900, letterSpacing: 0.2 }}>Dashboard Reinigung</div>

            <div style={{ display: "flex", gap: 6, background: colors.tabBg, padding: 4, borderRadius: 999 }}>
              <Pill active={wartungsAnsicht === "woche"} onClick={() => setWartungsAnsicht("woche")}>
                Woche ({weekKey})
              </Pill>
              <Pill active={wartungsAnsicht === "monat"} onClick={() => setWartungsAnsicht("monat")}>
                Monat ({monthName})
              </Pill>
            </div>

            <input
              type="date"
              value={datum}
              onChange={(e) => setDatum(e.target.value)}
              style={{ border: `1px solid ${colors.border}`, borderRadius: 10, padding: "8px 10px", fontSize: 13, background: "#fff" }}
            />

            <select
              value={stadtFilter}
              onChange={(e) => {
                setStadtFilter(e.target.value);
                setCenterFilter("Alle Center");
              }}
              style={{ border: `1px solid ${colors.border}`, borderRadius: 10, padding: "8px 10px", fontSize: 13, background: "#fff" }}
            >
              <option>Alle Städte</option>
              {staedte.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>

            <select
              value={centerFilter}
              onChange={(e) => setCenterFilter(e.target.value)}
              style={{ border: `1px solid ${colors.border}`, borderRadius: 10, padding: "8px 10px", fontSize: 13, background: "#fff" }}
            >
              <option>Alle Center</option>
              {centerOptions.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>

            <input
              placeholder="Suche (… / Besteller / Artikel)…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ border: `1px solid ${colors.border}`, borderRadius: 10, padding: "8px 10px", fontSize: 13, width: 320, maxWidth: "90vw", background: "#fff" }}
            />
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={resetQuickFilters}
              style={{ border: `1px solid ${colors.border}`, background: "#fff", borderRadius: 12, padding: "8px 12px", fontSize: 13, fontWeight: 900, cursor: "pointer" }}
              title="Status-/Kritisch-Filter zurücksetzen"
            >
              Reset Filter
            </button>

            <button
              type="button"
              onClick={ladeDashboard}
              style={{ border: `1px solid ${colors.border}`, background: loading ? "#f3f4f6" : "#fff", borderRadius: 12, padding: "8px 12px", fontSize: 13, fontWeight: 900, cursor: loading ? "default" : "pointer" }}
              disabled={loading}
            >
              {loading ? "Lade…" : "Neu laden"}
            </button>
          </div>
        </div>

        {/* KPI Grid */}
        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
          <Card
            title="Abdeckung (Protokoll vorhanden)"
            value={`${abdeckungProzent}%`}
            sub={`${reinigungen.length} Protokolle · ${totalAutomatenImFilter} Automaten im Filter`}
            tone={kpiToneCoverage(abdeckungProzent)}
            hint="Klick: alle"
            onClick={() => {
              setActiveTab("reinigung");
              setReinigungStatusFilter("ALLE");
              scrollToTables();
            }}
          />

          <Card
            title="Fehlende Protokolle"
            value={fehlendeAutomaten.length}
            sub="Automaten ohne Eintrag am Tag"
            tone={fehlendeAutomaten.length ? "bad" : "good"}
            hint="Klick: FEHLT"
            onClick={() => {
              setActiveTab("reinigung");
              setReinigungStatusFilter("FEHLT");
              scrollToTables();
            }}
          />

          <Card
            title="Offene Reinigungen"
            value={offeneReinigungen.length}
            sub="Protokoll da, aber Aufgaben fehlen"
            tone={offeneReinigungen.length ? "warn" : "good"}
            hint="Klick: OFFEN"
            onClick={() => {
              setActiveTab("reinigung");
              setReinigungStatusFilter("OFFEN");
              scrollToTables();
            }}
          />

          <Card
            title="Kritisch (Bestände)"
            value={kritischCount}
            sub="Stäbe < 1 oder Zucker < 1"
            tone={kritischCount ? "bad" : "good"}
            hint="Klick: nur kritisch"
            onClick={() => {
              setActiveTab("bestaende");
              setBestandFilter("KRITISCH");
              scrollToTables();
            }}
          />

          <Card
            title="Wochenwartung (offen)"
            value={wochenKpi.offen}
            sub={`${wochenKpi.offen} von ${wochenKpi.total} Automaten mit offenen Punkten`}
            tone={wochenKpi.offen > 0 ? "warn" : "good"}
            hint="Klick: nur offen"
            onClick={() => {
              setActiveTab("woche");
              setWartungFilter("OFFEN");
              scrollToTables();
            }}
          />

          <Card
            title="Reparaturen (Woche)"
            value={reparaturenCount}
            sub="Wartungsprotokolle im Wochenfenster"
            tone={reparaturenCount > 0 ? "warn" : "good"}
            hint="Klick: Tabelle"
            onClick={() => {
              setActiveTab("reparaturen");
              scrollToTables();
            }}
          />

          {/* ✅ Bestellungen: zählt nur offen */}
          <Card
            title="Bestellungen (offen)"
            value={offeneBestellungenCount}
            sub="Nur offene Bestellungen werden angezeigt"
            tone={offeneBestellungenCount > 0 ? "warn" : "good"}
            hint="Klick: Tabelle"
            onClick={() => {
              setActiveTab("bestellungen");
              scrollToTables();
            }}
          />
        </div>

        {/* Tabs */}
        <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Pill active={activeTab === "reinigung"} onClick={() => setActiveTab("reinigung")}>
            Reinigung
          </Pill>
          <Pill active={activeTab === "bestaende"} onClick={() => setActiveTab("bestaende")}>
            Bestände / Ampel
          </Pill>
          <Pill active={activeTab === "woche"} onClick={() => setActiveTab("woche")}>
            Wochenwartung
          </Pill>
          <Pill active={activeTab === "reparaturen"} onClick={() => setActiveTab("reparaturen")}>
            Reparaturen
          </Pill>
          <Pill active={activeTab === "bestellungen"} onClick={() => setActiveTab("bestellungen")}>
            Bestellungen
          </Pill>
        </div>

        {activeChips.length > 0 ? (
          <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {activeChips.map((c) => (
              <Chip key={c.label} label={c.label} tone={c.tone} onRemove={c.remove} />
            ))}
          </div>
        ) : null}

        <div ref={tableAnchorRef} style={{ height: 1 }} />

        {/* Content */}
        <div style={{ marginTop: 12 }}>
          {/* Reinigung */}
          {activeTab === "reinigung" && (
            <div style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 16, overflowX: "auto", boxShadow: "0 10px 25px rgba(15,23,42,0.06)" }}>
              <table style={{ width: "100%", minWidth: 980, borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#e3f2fd" }}>
                    <th style={{ textAlign: "center", padding: "10px 10px", color: colors.textMuted, fontWeight: 900, width: 44 }}>▾</th>
                    <th style={{ textAlign: "left", padding: "10px 12px", color: colors.textMuted, fontWeight: 900, whiteSpace: "nowrap" }}>Automat</th>
                    <th style={{ textAlign: "left", padding: "10px 12px", color: colors.textMuted, fontWeight: 900, whiteSpace: "nowrap" }}>Center</th>
                    <th style={{ textAlign: "left", padding: "10px 12px", color: colors.textMuted, fontWeight: 900, whiteSpace: "nowrap" }}>Stadt</th>
                    <th style={{ textAlign: "left", padding: "10px 12px", color: colors.textMuted, fontWeight: 900, whiteSpace: "nowrap" }}>Status</th>
                    <th style={{ textAlign: "right", padding: "10px 12px", color: colors.textMuted, fontWeight: 900, whiteSpace: "nowrap" }}>Offen</th>
                    <th style={{ textAlign: "left", padding: "10px 12px", color: colors.textMuted, fontWeight: 900, whiteSpace: "nowrap" }}>Aktion</th>
                  </tr>
                </thead>
                <tbody>
                  {rowsReinigung.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: 14, color: colors.textMuted }}>Keine Daten (oder Filter zu streng).</td>
                    </tr>
                  ) : (
                    rowsReinigung.map((r) => {
                      const expanded = !!expandedReinigung[r.code];
                      const badge = statusBadge(r.status);
                      return (
                        <>
                          <tr
                            key={r.code}
                            onClick={() => setExpandedReinigung((p) => ({ ...p, [r.code]: !p[r.code] }))}
                            style={{ cursor: "pointer" }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5ff")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                          >
                            <td style={{ padding: "10px 10px", borderBottom: `1px solid ${colors.border}`, textAlign: "center" }}>
                              <span style={{ fontWeight: 900, color: colors.textMuted }}>{expanded ? "▾" : "▸"}</span>
                            </td>
                            <td style={{ padding: "10px 12px", borderBottom: `1px solid ${colors.border}`, fontWeight: 900, whiteSpace: "nowrap" }}>{r.code}</td>
                            <td style={{ padding: "10px 12px", borderBottom: `1px solid ${colors.border}` }}>{r.center || "—"}</td>
                            <td style={{ padding: "10px 12px", borderBottom: `1px solid ${colors.border}` }}>{r.stadt || "—"}</td>
                            <td style={{ padding: "10px 12px", borderBottom: `1px solid ${colors.border}` }}>
                              <span style={{ padding: "4px 10px", borderRadius: 999, background: badge.bg, color: badge.fg, fontWeight: 900, fontSize: 12, whiteSpace: "nowrap" }}>
                                {badge.text}
                              </span>
                            </td>
                            <td style={{ padding: "10px 12px", borderBottom: `1px solid ${colors.border}`, textAlign: "right", fontWeight: 900 }}>
                              {r.status === "OFFEN" ? r.offeneCount : r.status === "FEHLT" ? "—" : 0}
                            </td>
                            <td style={{ padding: "10px 12px", borderBottom: `1px solid ${colors.border}` }}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  gotoAutomatByCode(r.code);
                                }}
                                style={{ border: `1px solid ${colors.border}`, background: "#fff", borderRadius: 10, padding: "6px 10px", fontSize: 12, fontWeight: 900, cursor: "pointer", whiteSpace: "nowrap" }}
                              >
                                Automat öffnen
                              </button>
                            </td>
                          </tr>
                          {expanded ? (
                            <tr key={`${r.code}-details`}>
                              <td colSpan={7} style={{ padding: 12, borderBottom: `1px solid ${colors.border}`, background: colors.soft }}>
                                <SectionTitle title={`Details – ${r.code}`} />
                                {r.status === "FEHLT" ? (
                                  <div style={{ color: colors.danger, fontWeight: 900 }}>Kein Reinigungsprotokoll für diesen Tag gefunden.</div>
                                ) : (
                                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                                    <MiniList title="Offen (Reinigung)" items={r.offene} tone={r.offene.length ? "warn" : "good"} />
                                    <MiniList
                                      title="Erledigt (Reinigung)"
                                      items={REINIGUNG_TASKS.map((t) => t.label).filter((lbl) => !r.offene.includes(lbl))}
                                      tone={r.offene.length === 0 ? "good" : "neutral"}
                                    />
                                  </div>
                                )}
                                {r.note ? (
                                  <div style={{ marginTop: 10, color: colors.textMuted }}>
                                    <b>Notiz:</b> {String(r.note)}
                                  </div>
                                ) : null}
                              </td>
                            </tr>
                          ) : null}
                        </>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Bestände */}
          {activeTab === "bestaende" && (
            <div style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 16, overflowX: "auto", boxShadow: "0 10px 25px rgba(15,23,42,0.06)" }}>
              <table style={{ width: "100%", minWidth: 920, borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#e3f2fd" }}>
                    <th style={{ textAlign: "left", padding: "10px 12px", color: colors.textMuted, fontWeight: 900 }}>Automat</th>
                    <th style={{ textAlign: "left", padding: "10px 12px", color: colors.textMuted, fontWeight: 900 }}>Stadt</th>
                    <th style={{ textAlign: "left", padding: "10px 12px", color: colors.textMuted, fontWeight: 900 }}>Center</th>
                    <th style={{ textAlign: "right", padding: "10px 12px", color: colors.textMuted, fontWeight: 900 }}>Stäbe</th>
                    <th style={{ textAlign: "right", padding: "10px 12px", color: colors.textMuted, fontWeight: 900 }}>Zucker (min)</th>
                    <th style={{ textAlign: "left", padding: "10px 12px", color: colors.textMuted, fontWeight: 900 }}>Ampel</th>
                  </tr>
                </thead>
                <tbody>
                  {rowsBestaende.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: 14, color: colors.textMuted }}>Keine Bestandsdaten für den Tag.</td>
                    </tr>
                  ) : (
                    rowsBestaende.map((r) => {
                      const tone = ampelToneForBestand(r);
                      const bg = tone === "bad" ? "#fee2e2" : tone === "warn" ? "#fef3c7" : "#dcfce7";
                      const fg = tone === "bad" ? colors.danger : tone === "warn" ? colors.warning : colors.success;
                      const text = tone === "bad" ? "KRITISCH" : tone === "warn" ? "ACHTUNG" : "OK";
                      return (
                        <tr
                          key={r.code}
                          onClick={() => gotoAutomatByCode(r.code)}
                          style={{ cursor: "pointer" }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5ff")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                        >
                          <td style={{ padding: "10px 12px", borderBottom: `1px solid ${colors.border}`, fontWeight: 900, whiteSpace: "nowrap" }}>{r.code}</td>
                          <td style={{ padding: "10px 12px", borderBottom: `1px solid ${colors.border}` }}>{r.stadt || "—"}</td>
                          <td style={{ padding: "10px 12px", borderBottom: `1px solid ${colors.border}` }}>{r.center || "—"}</td>
                          <td style={{ padding: "10px 12px", borderBottom: `1px solid ${colors.border}`, textAlign: "right", fontWeight: 900, color: r.staebe < 1 ? colors.danger : colors.success }}>{r.staebe}</td>
                          <td style={{ padding: "10px 12px", borderBottom: `1px solid ${colors.border}`, textAlign: "right", fontWeight: 900, color: r.minZucker < 1 ? colors.danger : r.minZucker < 1.5 ? colors.warning : colors.success }}>
                            {Number(r.minZucker).toFixed(1)}
                          </td>
                          <td style={{ padding: "10px 12px", borderBottom: `1px solid ${colors.border}` }}>
                            <span style={{ padding: "4px 10px", borderRadius: 999, background: bg, color: fg, fontWeight: 900, fontSize: 12 }}>{text}</span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Wochenwartung */}
          {activeTab === "woche" && (
            <div style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 16, overflowX: "auto", boxShadow: "0 10px 25px rgba(15,23,42,0.06)" }}>
              <table style={{ width: "100%", minWidth: 980, borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#e3f2fd" }}>
                    <th style={{ textAlign: "center", padding: "10px 10px", color: colors.textMuted, fontWeight: 900, width: 44 }}>▾</th>
                    <th style={{ textAlign: "left", padding: "10px 12px", color: colors.textMuted, fontWeight: 900, whiteSpace: "nowrap" }}>Automat</th>
                    <th style={{ textAlign: "left", padding: "10px 12px", color: colors.textMuted, fontWeight: 900, whiteSpace: "nowrap" }}>Center</th>
                    <th style={{ textAlign: "left", padding: "10px 12px", color: colors.textMuted, fontWeight: 900, whiteSpace: "nowrap" }}>Stadt</th>
                    <th style={{ textAlign: "left", padding: "10px 12px", color: colors.textMuted, fontWeight: 900, whiteSpace: "nowrap" }}>Status</th>
                    <th style={{ textAlign: "right", padding: "10px 12px", color: colors.textMuted, fontWeight: 900, whiteSpace: "nowrap" }}>Offen</th>
                    <th style={{ textAlign: "right", padding: "10px 12px", color: colors.textMuted, fontWeight: 900, whiteSpace: "nowrap" }}>Erledigt</th>
                    <th style={{ textAlign: "left", padding: "10px 12px", color: colors.textMuted, fontWeight: 900, whiteSpace: "nowrap" }}>Aktion</th>
                  </tr>
                </thead>
                <tbody>
                  {rowsWoche.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: 14, color: colors.textMuted }}>Keine Wochenwartung gefunden (oder Filter zu streng).</td>
                    </tr>
                  ) : (
                    rowsWoche.map((r) => {
                      const expanded = !!expandedWoche[r.code];
                      const warn = r.offenCount > 0;
                      return (
                        <>
                          <tr
                            key={r.code}
                            onClick={() => setExpandedWoche((p) => ({ ...p, [r.code]: !p[r.code] }))}
                            style={{ cursor: "pointer" }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5ff")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                          >
                            <td style={{ padding: "10px 10px", borderBottom: `1px solid ${colors.border}`, textAlign: "center" }}>
                              <span style={{ fontWeight: 900, color: colors.textMuted }}>{expanded ? "▾" : "▸"}</span>
                            </td>
                            <td style={{ padding: "10px 12px", borderBottom: `1px solid ${colors.border}`, fontWeight: 900, whiteSpace: "nowrap" }}>{r.code}</td>
                            <td style={{ padding: "10px 12px", borderBottom: `1px solid ${colors.border}` }}>{r.center || "—"}</td>
                            <td style={{ padding: "10px 12px", borderBottom: `1px solid ${colors.border}` }}>{r.stadt || "—"}</td>
                            <td style={{ padding: "10px 12px", borderBottom: `1px solid ${colors.border}`, fontWeight: 800 }}>{r.status || "—"}</td>
                            <td style={{ padding: "10px 12px", borderBottom: `1px solid ${colors.border}`, textAlign: "right", fontWeight: 900, color: warn ? colors.warning : colors.success }}>{r.offenCount}</td>
                            <td style={{ padding: "10px 12px", borderBottom: `1px solid ${colors.border}`, textAlign: "right", fontWeight: 900, color: r.erledigtCount > 0 ? colors.success : colors.textMuted }}>{r.erledigtCount}</td>
                            <td style={{ padding: "10px 12px", borderBottom: `1px solid ${colors.border}` }}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  gotoAutomatByCode(r.code);
                                }}
                                style={{ border: `1px solid ${colors.border}`, background: "#fff", borderRadius: 10, padding: "6px 10px", fontSize: 12, fontWeight: 900, cursor: "pointer", whiteSpace: "nowrap" }}
                              >
                                Automat öffnen
                              </button>
                            </td>
                          </tr>
                          {expanded ? (
                            <tr key={`${r.code}-details`}>
                              <td colSpan={8} style={{ padding: 12, borderBottom: `1px solid ${colors.border}`, background: colors.soft }}>
                                <SectionTitle title={`Wochenwartung Details – ${r.code}`} />
                                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                                  <MiniList title="Offen (Wochenwartung)" items={r.offen} tone={r.offen.length ? "warn" : "good"} />
                                  <MiniList title="Erledigt (Wochenwartung)" items={r.erledigt} tone={r.erledigt.length ? "good" : "neutral"} />
                                </div>
                              </td>
                            </tr>
                          ) : null}
                        </>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Reparaturen */}
          {activeTab === "reparaturen" && (
            <div style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 16, overflowX: "auto", boxShadow: "0 10px 25px rgba(15,23,42,0.06)" }}>
              <table style={{ width: "100%", minWidth: 920, borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#e3f2fd" }}>
                    <th style={{ textAlign: "left", padding: "10px 12px", color: colors.textMuted, fontWeight: 900, whiteSpace: "nowrap" }}>Datum</th>
                    <th style={{ textAlign: "left", padding: "10px 12px", color: colors.textMuted, fontWeight: 900, whiteSpace: "nowrap" }}>Automat</th>
                    <th style={{ textAlign: "left", padding: "10px 12px", color: colors.textMuted, fontWeight: 900, whiteSpace: "nowrap" }}>Typ</th>
                    <th style={{ textAlign: "left", padding: "10px 12px", color: colors.textMuted, fontWeight: 900 }}>Beschreibung</th>
                  </tr>
                </thead>
                <tbody>
                  {wartungsprotokolle.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ padding: 14, color: colors.textMuted }}>Keine Reparaturen im Wochenfenster.</td>
                    </tr>
                  ) : (
                    wartungsprotokolle.map((r) => (
                      <tr
                        key={r.id}
                        onClick={() => gotoAutomatByCode(normalizeCode(r.automatCode))}
                        style={{ cursor: "pointer" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5ff")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <td style={{ padding: "10px 12px", borderBottom: `1px solid ${colors.border}`, whiteSpace: "nowrap" }}>{r.datumDerDurchfuhrung || "—"}</td>
                        <td style={{ padding: "10px 12px", borderBottom: `1px solid ${colors.border}`, fontWeight: 900, whiteSpace: "nowrap" }}>{r.automatCode || "—"}</td>
                        <td style={{ padding: "10px 12px", borderBottom: `1px solid ${colors.border}`, whiteSpace: "nowrap" }}>{r.typ || "—"}</td>
                        <td style={{ padding: "10px 12px", borderBottom: `1px solid ${colors.border}` }}>{r.beschreibung || r.bemerkung || "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* ✅ Bestellungen: zeigt NUR offene */}
          {activeTab === "bestellungen" && (
            <div style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 16, overflowX: "auto", boxShadow: "0 10px 25px rgba(15,23,42,0.06)" }}>
              <table style={{ width: "100%", minWidth: 1100, borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#e3f2fd" }}>
                    <th style={{ textAlign: "left", padding: "10px 12px", color: colors.textMuted, fontWeight: 900, whiteSpace: "nowrap" }}>Datum</th>
                    <th style={{ textAlign: "left", padding: "10px 12px", color: colors.textMuted, fontWeight: 900, whiteSpace: "nowrap" }}>Stadt</th>
                    <th style={{ textAlign: "left", padding: "10px 12px", color: colors.textMuted, fontWeight: 900, whiteSpace: "nowrap" }}>Standort / Center</th>
                    <th style={{ textAlign: "left", padding: "10px 12px", color: colors.textMuted, fontWeight: 900, whiteSpace: "nowrap" }}>Besteller</th>
                    <th style={{ textAlign: "left", padding: "10px 12px", color: colors.textMuted, fontWeight: 900 }}>Artikel</th>
                    <th style={{ textAlign: "left", padding: "10px 12px", color: colors.textMuted, fontWeight: 900, whiteSpace: "nowrap" }}>Aktion</th>
                  </tr>
                </thead>
                <tbody>
                  {offeneBestellungenRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: 14, color: colors.textMuted }}>Keine offenen Bestellungen gefunden.</td>
                    </tr>
                  ) : (
                    offeneBestellungenRows.map((r) => (
                      <tr key={r.id} onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5ff")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                        <td style={{ padding: "10px 12px", borderBottom: `1px solid ${colors.border}`, whiteSpace: "nowrap" }}>{formatDateDE(r.created)}</td>
                        <td style={{ padding: "10px 12px", borderBottom: `1px solid ${colors.border}`, whiteSpace: "nowrap" }}>{r.stadt || "—"}</td>
                        <td style={{ padding: "10px 12px", borderBottom: `1px solid ${colors.border}`, whiteSpace: "nowrap" }}>{r.standort || "—"}</td>
                        <td style={{ padding: "10px 12px", borderBottom: `1px solid ${colors.border}`, whiteSpace: "nowrap" }}>{r.besteller || "—"}</td>
                        <td style={{ padding: "10px 12px", borderBottom: `1px solid ${colors.border}` }}>{r.itemsText}</td>
                        <td style={{ padding: "10px 12px", borderBottom: `1px solid ${colors.border}`, whiteSpace: "nowrap" }}>
                          <button
                            type="button"
                            onClick={() => setBestellungErledigt(r.raw)}
                            disabled={busyOrderId === r.id}
                            style={{ border: `1px solid ${colors.border}`, background: busyOrderId === r.id ? "#f3f4f6" : "#fff", borderRadius: 10, padding: "6px 10px", fontSize: 12, fontWeight: 900, cursor: busyOrderId === r.id ? "default" : "pointer" }}
                          >
                            {busyOrderId === r.id ? "Speichere…" : "Erledigt"}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              <div style={{ padding: 10, color: colors.textMuted, fontSize: 12 }}>
                Erledigte Bestellungen werden automatisch aus der Liste entfernt.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
