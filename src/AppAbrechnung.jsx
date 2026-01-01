// AppAbrechnung.jsx
// ✅ Version: Hellblaues Theme + Accordion pro Teamleiter + PDF gut lesbar
// ✅ Normalisierung gegen Leerzeichen/NBSP-Dopplungen
// ✅ NUR lokal: Buttons/Felder nicht mehr "schwarz" in Abrechnung
// ✅ PDF-Button mit Bild-Icon (public/pdf.png)

import { useEffect, useMemo, useState } from "react";
import { collection, doc, getDocs, query, setDoc, serverTimestamp, where } from "firebase/firestore";
import { db } from "./firebase";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// -------------------- Design (Hellblau) --------------------
const colors = {
  bg: "#cfe3ff",        // Markierungs-Blau
  bgSoft: "#eaf2ff",    // noch heller für Verlauf

  card: "#ffffff",
  cardSoft: "#f7fbff",

  border: "rgba(15, 23, 42, 0.12)",

  primary: "#2563eb",
  primarySoft: "rgba(37,99,235,0.12)",

  textMain: "#0f172a",
  textMuted: "rgba(15, 23, 42, 0.65)",

  success: "#16a34a",
  warning: "#d97706",
  danger: "#dc2626",

  tableHead: "#eff6ff",
  rowAlt: "#f8fbff",
};

// -------------------- Helpers --------------------
function normText(v) {
  if (v == null) return "";
  return String(v).replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim();
}
function normalizeCode(raw) {
  return normText(raw);
}
function getMonthRange(dateObj) {
  const y = dateObj.getFullYear();
  const m = dateObj.getMonth();
  return { start: new Date(y, m, 1), end: new Date(y, m + 1, 1) };
}
function money(n) {
  return `${Number(n || 0).toFixed(2)} €`;
}

function Pill({ children, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: `1px solid ${colors.border}`,
        background: active ? colors.primary : "#ffffff",
        color: active ? "#fff" : colors.textMain,
        padding: "7px 12px",
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

function StatCard({ title, value, sub }) {
  return (
    <div
      style={{
        fontFamily: '"Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      background: colors.card,
        border: `1px solid ${colors.border}`,
        borderRadius: 16,
        padding: 12,
        boxShadow: "0 12px 25px rgba(0,0,0,0.10)",
        minWidth: 220,
        flex: "1 1 220px",
      }}
    >
      <div style={{ color: colors.textMuted, fontWeight: 900, fontSize: 12 }}>{title}</div>
      <div style={{ color: colors.textMain, fontWeight: 950, fontSize: 22, marginTop: 6 }}>{value}</div>
      {sub ? <div style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>{sub}</div> : null}
    </div>
  );
}

function IconBadge({ ok, label }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px",
        borderRadius: 999,
        border: `1px solid ${colors.border}`,
        background: ok ? "rgba(22,163,74,0.12)" : "rgba(217,119,6,0.12)",
        color: ok ? colors.success : colors.warning,
        fontWeight: 900,
        fontSize: 12,
        whiteSpace: "nowrap",
      }}
      title={label}
    >
      <span style={{ fontSize: 14, lineHeight: 1 }}>{ok ? "✔" : "—"}</span>
      {label}
    </span>
  );
}

// -------------------- PDF Export (Lesbar) --------------------
function exportPdf({ monthLabel, mode, byTL, total, grundSatz }) {
  const docPdf = new jsPDF({ unit: "pt", format: "a4" });

  const title =
    mode === "zwischen"
      ? `Zwischenabrechnung (15.) – ${monthLabel}`
      : `Monatsabrechnung – ${monthLabel}`;

  docPdf.setFont("helvetica", "bold");
  docPdf.setFontSize(16);
  docPdf.text(title, 40, 48);

  docPdf.setFont("helvetica", "normal");
  docPdf.setFontSize(10);
  docPdf.text(`Erstellt am: ${new Date().toLocaleString("de-DE")}`, 40, 66);

  if (mode === "zwischen") {
    docPdf.setFontSize(10);
    docPdf.text(
      `Hinweis: Zwischenabrechnung enthält nur 50% der Automaten und nur ${money(
        grundSatz
      )} Grundbetrag pro Automat. Boni werden am Monatsende ausgezahlt.`,
      40,
      84
    );
  }

  let y = mode === "zwischen" ? 102 : 86;

  const teamleiterNames = Array.from(byTL.keys()).sort((a, b) => a.localeCompare(b, "de"));

  for (const tl of teamleiterNames) {
    const rows = (byTL.get(tl) || []).sort((a, b) => a.automatCode.localeCompare(b.automatCode));
    const sumTl = rows.reduce((s, r) => s + r.summe, 0);

    docPdf.setFont("helvetica", "bold");
    docPdf.setFontSize(12);
    docPdf.text(`Teamleiter: ${tl}`, 40, y);
    y += 10;

    autoTable(docPdf, {
      startY: y,
      margin: { left: 40, right: 40 },
      head: [["Automat", "Center", "Stadt", "Grund", "Bonus Wochen", "Bonus Montag", "Summe"]],
      body: rows.map((r) => [
        r.automatCode,
        r.center || "",
        r.stadt || "",
        money(r.grund),
        money(r.bonusWochen),
        money(r.bonusMontag),
        money(r.summe),
      ]),
      theme: "grid",
      styles: {
        font: "helvetica",
        fontSize: 9,
        textColor: [0, 0, 0],
        cellPadding: 6,
        lineColor: [220, 220, 220],
        lineWidth: 0.5,
      },
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontStyle: "bold",
      },
      alternateRowStyles: {
        fillColor: [245, 246, 248],
      },
    });

    y = (docPdf.lastAutoTable?.finalY || y) + 14;

    docPdf.setFont("helvetica", "bold");
    docPdf.setFontSize(11);
    docPdf.setTextColor(0);
    docPdf.text(`Zwischensumme ${tl}: ${money(sumTl)}`, 40, y);
    y += 20;

    const pageSize = docPdf.internal.pageSize;
    const pageHeight = pageSize.height ? pageSize.height : pageSize.getHeight();
    if (y > pageHeight - 120) {
      docPdf.addPage();
      y = 48;
    }
  }

  docPdf.setFont("helvetica", "bold");
  docPdf.setFontSize(13);
  docPdf.setTextColor(0);
  docPdf.text(`Gesamtsumme: ${money(total)}`, 40, y);

  const filename =
    mode === "zwischen"
      ? `Zwischenabrechnung_15_${monthLabel}`.replaceAll(" ", "_") + ".pdf"
      : `Monatsabrechnung_${monthLabel}`.replaceAll(" ", "_") + ".pdf";

  docPdf.save(filename);
}

// -------------------- Component --------------------
export default function AppAbrechnung() {
  const [loading, setLoading] = useState(false);

  const [datum, setDatum] = useState(new Date().toISOString().split("T")[0]);
  const [mode, setMode] = useState("monat"); // "monat" | "zwischen"

  const [stadtFilter, setStadtFilter] = useState("Alle Städte");
  const [centerFilter, setCenterFilter] = useState("Alle Center");
  const [teamleiterFilter, setTeamleiterFilter] = useState("ALLE");
  const [search, setSearch] = useState("");

  const [automaten, setAutomaten] = useState([]);
  const [wartungselementeMap, setWartungselementeMap] = useState({});
  const [wochenDocs, setWochenDocs] = useState([]);
  const [abrechnungFlags, setAbrechnungFlags] = useState({});

  const [openTL, setOpenTL] = useState({});
  const [expandedAutomat, setExpandedAutomat] = useState({});

  async function loadAll() {
    setLoading(true);
    try {
      const aSnap = await getDocs(collection(db, "automaten"));
      const aList = aSnap.docs.map((d) => {
        const data = d.data() || {};
        return {
          id: d.id,
          ...data,
          automatCode: normalizeCode(data.automatCode || data.Automat),
          stadt: normText(data.stadt),
          center: normText(data.center),
          leitung: normText(data.leitung),
          leiter: normText(data.leiter),
        };
      });
      setAutomaten(aList);

      const weSnap = await getDocs(collection(db, "Wartungselemente"));
      const weMap = {};
      weSnap.forEach((ds) => (weMap[ds.id] = ds.data()));
      setWartungselementeMap(weMap);

      const dObj = new Date(datum);
      const { start, end } = getMonthRange(dObj);

      const wwSnap = await getDocs(
        query(collection(db, "wochenWartung"), where("startedAt", ">=", start), where("startedAt", "<", end))
      );
      const wwList = wwSnap.docs.map((ds) => {
        const data = ds.data() || {};
        return { id: ds.id, ...data, automatCode: normalizeCode(data.automatCode), woche: normText(data.woche) };
      });
      setWochenDocs(wwList);

      const fSnap = await getDocs(collection(db, "abrechnungFlags"));
      const fMap = {};
      fSnap.forEach((ds) => {
        const d = ds.data() || {};
        const key = `${normText(d.woche)}__${normalizeCode(d.automatCode)}`;
        fMap[key] = d;
      });
      setAbrechnungFlags(fMap);
    } catch (e) {
      alert(`Fehler beim Laden: ${e?.message || String(e)}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datum]);

  function isWochenwartungTaskId(id) {
    return String(wartungselementeMap?.[id]?.typ || "") === "Wochenwartung";
  }

  function isWeekComplete(wwDoc) {
    const tasks = wwDoc?.tasks || {};
    const ids = Object.keys(tasks).filter(isWochenwartungTaskId);
    if (ids.length === 0) return false;
    return ids.every((id) => tasks[id]?.done === true);
  }

  async function setMontagFlag({ woche, automatCode, value }) {
    const code = normalizeCode(automatCode);
    const w = normText(woche);
    const id = `${w}__${code}`;

    await setDoc(
      doc(db, "abrechnungFlags", id),
      { woche: w, automatCode: code, montagPuenktlich: !!value, updatedAt: serverTimestamp() },
      { merge: true }
    );

    setAbrechnungFlags((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || {}), woche: w, automatCode: code, montagPuenktlich: !!value },
    }));
  }

  const staedte = useMemo(() => {
    const s = new Set();
    automaten.forEach((a) => a.stadt && s.add(a.stadt));
    return Array.from(s).sort((a, b) => a.localeCompare(b, "de"));
  }, [automaten]);

  const centerOptions = useMemo(() => {
    const basis = stadtFilter !== "Alle Städte" ? automaten.filter((a) => a.stadt === stadtFilter) : automaten;
    const s = new Set();
    basis.forEach((a) => a.center && s.add(a.center));
    return Array.from(s).sort((a, b) => a.localeCompare(b, "de"));
  }, [automaten, stadtFilter]);

  const teamleiterOptions = useMemo(() => {
    const s = new Set();
    automaten.forEach((a) => {
      const tl = normText(a.leitung || a.leiter);
      if (tl) s.add(tl);
    });
    return Array.from(s).sort((a, b) => a.localeCompare(b, "de"));
  }, [automaten]);

  const abrechnung = useMemo(() => {
    const dObj = new Date(datum);
    const monthLabel = dObj.toLocaleDateString("de-DE", { month: "long", year: "numeric" });

    let basis = automaten
      .map((a) => ({
        automatCode: normalizeCode(a.automatCode || a.Automat),
        stadt: normText(a.stadt),
        center: normText(a.center),
        teamleiter: normText(a.leitung || a.leiter),
      }))
      .filter((x) => x.automatCode && x.teamleiter);

    if (stadtFilter !== "Alle Städte") basis = basis.filter((x) => x.stadt === stadtFilter);
    if (centerFilter !== "Alle Center") basis = basis.filter((x) => x.center === centerFilter);
    if (teamleiterFilter !== "ALLE") basis = basis.filter((x) => x.teamleiter === teamleiterFilter);

    if (search.trim()) {
      const s = normText(search).toLowerCase();
      basis = basis.filter((x) => {
        return (
          x.automatCode.toLowerCase().includes(s) ||
          x.center.toLowerCase().includes(s) ||
          x.stadt.toLowerCase().includes(s) ||
          x.teamleiter.toLowerCase().includes(s)
        );
      });
    }

    if (mode === "zwischen") {
      const sorted = [...basis].sort((a, b) => a.automatCode.localeCompare(b.automatCode));
      const half = Math.ceil(sorted.length / 2);
      basis = sorted.slice(0, half);
    }

    const byAutomat = new Map();
    for (const ww of wochenDocs || []) {
      const code = normalizeCode(ww.automatCode);
      if (!code) continue;
      const list = byAutomat.get(code) || [];
      list.push(ww);
      byAutomat.set(code, list);
    }

    const grundSatz = mode === "zwischen" ? 200 : 400;

    const lines = basis.map((a) => {
      const weeks = byAutomat.get(a.automatCode) || [];
      const grund = grundSatz;

      let bonusWochen = 0;
      let bonusMontag = 0;

      if (mode === "monat") {
        if (weeks.length > 0 && weeks.every(isWeekComplete)) bonusWochen = 50;

        if (weeks.length > 0) {
          const ok = weeks.every((w) => {
            const key = `${normText(w.woche)}__${a.automatCode}`;
            return abrechnungFlags?.[key]?.montagPuenktlich === true;
          });
          if (ok) bonusMontag = 50;
        }
      }

      const summe = grund + bonusWochen + bonusMontag;
      const weeksSorted = [...weeks].sort((x, y) => String(x.woche || "").localeCompare(String(y.woche || "")));

      const alleWochenOk = weeks.length > 0 && weeks.every(isWeekComplete);
      const alleMontagOk =
        weeks.length > 0 &&
        weeks.every((w) => abrechnungFlags?.[`${normText(w.woche)}__${a.automatCode}`]?.montagPuenktlich === true);

      return { ...a, grund, bonusWochen, bonusMontag, summe, weeks: weeksSorted, alleWochenOk, alleMontagOk };
    });

    const byTL = new Map();
    for (const l of lines) {
      const tl = normText(l.teamleiter);
      if (!byTL.has(tl)) byTL.set(tl, []);
      byTL.get(tl).push(l);
    }

    const total = lines.reduce((s, x) => s + x.summe, 0);

    return {
      monthLabel,
      lines,
      byTL,
      total,
      grundSatz,
      automatenCount: lines.length,
      teamleiterCount: byTL.size,
    };
  }, [datum, mode, automaten, wochenDocs, abrechnungFlags, wartungselementeMap, stadtFilter, centerFilter, teamleiterFilter, search]);

  useEffect(() => {
    const names = Array.from(abrechnung.byTL.keys()).sort((a, b) => a.localeCompare(b, "de"));
    if (names.length === 0) return;
    setOpenTL((prev) => {
      if (Object.keys(prev).length > 0) return prev;
      return { [names[0]]: true };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abrechnung.byTL]);

  return (
    <div
      style={{
        background: `linear-gradient(180deg, ${colors.bg} 0%, ${colors.bgSoft} 100%)`,
        minHeight: "100%",
        padding: 12,
        boxSizing: "border-box",
        color: colors.textMain,
      }}
    >
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        {/* Controls */}
        <div
          style={{
            background: colors.card,
            border: `1px solid ${colors.border}`,
            borderRadius: 18,
            padding: 12,
            boxShadow: "0 16px 32px rgba(0,0,0,0.12)",
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={{ fontWeight: 950, letterSpacing: 0.3, fontSize: 16 }}>Abrechnung</div>

            <div style={{ display: "flex", gap: 6, background: colors.primarySoft, padding: 4, borderRadius: 999 }}>
              <Pill active={mode === "monat"} onClick={() => setMode("monat")}>
                Monatsabrechnung
              </Pill>
              <Pill active={mode === "zwischen"} onClick={() => setMode("zwischen")}>
                Zwischen (15.)
              </Pill>
            </div>

            {/* Felder in Abrechnung: bewusst hell (kein "schwarz") */}
            <input
              type="date"
              value={datum}
              onChange={(e) => setDatum(e.target.value)}
              style={{
                border: `1px solid ${colors.border}`,
                borderRadius: 12,
                padding: "8px 10px",
                fontSize: 13,
                background: "#ffffff",
                color: colors.textMain,
              }}
              title="Wähle ein Datum im gewünschten Monat"
            />

            <select
              value={stadtFilter}
              onChange={(e) => {
                setStadtFilter(e.target.value);
                setCenterFilter("Alle Center");
              }}
              style={{
                border: `1px solid ${colors.border}`,
                borderRadius: 12,
                padding: "8px 10px",
                fontSize: 13,
                background: "#ffffff",
                color: colors.textMain,
              }}
            >
              <option>Alle Städte</option>
              {staedte.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>

            <select
              value={centerFilter}
              onChange={(e) => setCenterFilter(e.target.value)}
              style={{
                border: `1px solid ${colors.border}`,
                borderRadius: 12,
                padding: "8px 10px",
                fontSize: 13,
                background: "#ffffff",
                color: colors.textMain,
              }}
            >
              <option>Alle Center</option>
              {centerOptions.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>

            <select
              value={teamleiterFilter}
              onChange={(e) => setTeamleiterFilter(e.target.value)}
              style={{
                border: `1px solid ${colors.border}`,
                borderRadius: 12,
                padding: "8px 10px",
                fontSize: 13,
                background: "#ffffff",
                color: colors.textMain,
              }}
            >
              <option value="ALLE">Alle Teamleiter</option>
              {teamleiterOptions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>

            <input
              placeholder="Suche…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                border: `1px solid ${colors.border}`,
                borderRadius: 12,
                padding: "8px 10px",
                fontSize: 13,
                width: 320,
                maxWidth: "90vw",
                background: "#ffffff",
                color: colors.textMain,
              }}
            />
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={loadAll}
              style={{
                border: `1px solid ${colors.border}`,
                background: loading ? colors.primarySoft : "#ffffff",
                color: colors.textMain,
                borderRadius: 12,
                padding: "8px 12px",
                fontSize: 13,
                fontWeight: 950,
                cursor: loading ? "default" : "pointer",
              }}
              disabled={loading}
            >
              {loading ? "Lade…" : "Neu laden"}
            </button>

            <button
              type="button"
              onClick={() =>
                exportPdf({
                  monthLabel: abrechnung.monthLabel,
                  mode,
                  byTL: abrechnung.byTL,
                  total: abrechnung.total,
                  grundSatz: abrechnung.grundSatz,
                })
              }
              style={{
                border: `1px solid ${colors.border}`,
                background: colors.primary,
                color: "#fff",
                borderRadius: 12,
                padding: "8px 12px",
                fontSize: 13,
                fontWeight: 950,
                cursor: "pointer",
              }}
              title="PDF exportieren"
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <img src="/pdf.png" alt="PDF" style={{ width: 18, height: 18, display: "block" }} />
                PDF exportieren
              </span>
            </button>
          </div>
        </div>

        {/* KPI */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
          <StatCard title="Zeitraum" value={abrechnung.monthLabel} sub={mode === "zwischen" ? "Zwischenabrechnung (15.)" : "Monatsabrechnung"} />
          <StatCard title="Grundbetrag pro Automat" value={money(abrechnung.grundSatz)} sub={mode === "zwischen" ? "Halbe Grundpauschale" : "Voll"} />
          <StatCard title="Automaten" value={String(abrechnung.automatenCount)} sub={`Teamleiter: ${abrechnung.teamleiterCount}`} />
          <StatCard title="Gesamtsumme" value={money(abrechnung.total)} sub={mode === "monat" ? "inkl. Boni (wenn erfüllt)" : "ohne Boni"} />
        </div>

        {/* Accordion */}
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
          {Array.from(abrechnung.byTL.keys())
            .sort((a, b) => a.localeCompare(b, "de"))
            .map((tl) => {
              const rows = (abrechnung.byTL.get(tl) || []).sort((a, b) => a.automatCode.localeCompare(b.automatCode));
              const sumTl = rows.reduce((s, r) => s + r.summe, 0);

              const isOpen = !!openTL[tl];

              return (
                <div
                  key={tl}
                  style={{
                    background: colors.card,
                    border: `1px solid ${colors.border}`,
                    borderRadius: 18,
                    overflow: "hidden",
                    boxShadow: "0 16px 32px rgba(0,0,0,0.10)",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setOpenTL((p) => ({ ...p, [tl]: !p[tl] }))}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "12px 12px",
                      background: isOpen ? colors.primarySoft : "transparent",
                      border: "none",
                      color: colors.textMain,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                      <div style={{ fontWeight: 950, fontSize: 14 }}>
                        {isOpen ? "▼" : "▶"} {tl}
                      </div>
                      <div style={{ color: colors.textMuted, fontWeight: 900, fontSize: 12 }}>
                        Automaten: {rows.length}
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <div style={{ color: colors.textMuted, fontWeight: 900, fontSize: 12 }}>Summe</div>
                      <div style={{ fontWeight: 950, fontSize: 14 }}>{money(sumTl)}</div>
                    </div>
                  </button>

                  {isOpen ? (
                    <div style={{ padding: 12, borderTop: `1px solid ${colors.border}` }}>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "160px 1fr 140px 140px",
                          gap: 10,
                          padding: "10px 10px",
                          borderRadius: 14,
                          background: colors.tableHead,
                          border: `1px solid ${colors.border}`,
                          color: colors.textMuted,
                          fontWeight: 950,
                          fontSize: 12,
                        }}
                      >
                        <div>Automat</div>
                        <div>Center / Stadt</div>
                        <div style={{ textAlign: "right" }}>Status</div>
                        <div style={{ textAlign: "right" }}>Summe</div>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                        {rows.map((r, idx) => {
                          const key = `${tl}__${r.automatCode}`;
                          const expanded = !!expandedAutomat[key];

                          return (
                            <div
                              key={key}
                              style={{
                                border: `1px solid ${colors.border}`,
                                borderRadius: 16,
                                overflow: "hidden",
                                background: idx % 2 === 0 ? "transparent" : colors.rowAlt,
                              }}
                            >
                              <button
                                type="button"
                                onClick={() => setExpandedAutomat((p) => ({ ...p, [key]: !p[key] }))}
                                style={{
                                  width: "100%",
                                  textAlign: "left",
                                  padding: "10px 10px",
                                  background: "transparent",
                                  border: "none",
                                  color: colors.textMain,
                                  cursor: "pointer",
                                  display: "grid",
                                  gridTemplateColumns: "160px 1fr 140px 140px",
                                  gap: 10,
                                  alignItems: "center",
                                }}
                              >
                                <div style={{ fontWeight: 950 }}>
                                  {expanded ? "▼" : "▶"} {r.automatCode}
                                </div>

                                <div style={{ color: colors.textMuted, fontWeight: 850 }}>
                                  {r.center || "—"} <span style={{ opacity: 0.6 }}>·</span> {r.stadt || "—"}
                                </div>

                                <div style={{ textAlign: "right", display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
                                  {mode === "monat" ? (
                                    <>
                                      <IconBadge ok={r.alleWochenOk} label="Bonus Wochen" />
                                      <IconBadge ok={r.alleMontagOk} label="Bonus Montag" />
                                    </>
                                  ) : (
                                    <span style={{ color: colors.textMuted, fontWeight: 900 }}>—</span>
                                  )}
                                </div>

                                <div style={{ textAlign: "right", fontWeight: 950 }}>{money(r.summe)}</div>
                              </button>

                              {expanded ? (
                                <div
                                  style={{
                                    borderTop: `1px solid ${colors.border}`,
                                    padding: 10,
                                    background: "rgba(255,255,255,0.02)",
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 10,
                                  }}
                                >
                                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                                    <StatCard title="Grund" value={money(r.grund)} />
                                    <StatCard title="Bonus Wochen" value={money(r.bonusWochen)} sub="Nur Monatsende" />
                                    <StatCard title="Bonus Montag" value={money(r.bonusMontag)} sub="Nur Monatsende" />
                                    <StatCard title="Summe" value={money(r.summe)} />
                                  </div>

                                  <div
                                    style={{
                                      background: colors.tableHead,
                                      border: `1px solid ${colors.border}`,
                                      borderRadius: 16,
                                      padding: 10,
                                    }}
                                  >
                                    <div style={{ fontWeight: 950, marginBottom: 8 }}>Wochen im Monat</div>
                                    {r.weeks.length === 0 ? (
                                      <div style={{ color: colors.textMuted, fontWeight: 850 }}>
                                        Keine Wochenwartung-Daten in diesem Monat gefunden.
                                      </div>
                                    ) : (
                                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                                        {r.weeks.map((w) => {
                                          const weekKey = normText(w.woche);
                                          const flagKey = `${weekKey}__${r.automatCode}`;
                                          const montagChecked = abrechnungFlags?.[flagKey]?.montagPuenktlich === true;
                                          const weekOk = isWeekComplete(w);

                                          return (
                                            <div
                                              key={flagKey}
                                              style={{
                                                border: `1px solid ${colors.border}`,
                                                borderRadius: 14,
                                                padding: 10,
                                                minWidth: 220,
                                                background: "rgba(37,99,235,0.10)",
                                              }}
                                            >
                                              <div style={{ fontWeight: 950, marginBottom: 8 }}>{weekKey}</div>

                                              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                                                <IconBadge ok={weekOk} label="Wochenwartung komplett" />
                                              </div>

                                              <div style={{ marginTop: 10 }}>
                                                {mode === "zwischen" ? (
                                                  <div style={{ color: colors.textMuted, fontWeight: 850 }}>
                                                    Checkbox deaktiviert (Zwischenabrechnung)
                                                  </div>
                                                ) : (
                                                  <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 900, cursor: "pointer" }}>
                                                    <input
                                                      type="checkbox"
                                                      checked={montagChecked}
                                                      onChange={(e) =>
                                                        setMontagFlag({
                                                          woche: weekKey,
                                                          automatCode: r.automatCode,
                                                          value: e.target.checked,
                                                        })
                                                      }
                                                    />
                                                    Montag pünktlich (Entleeren + Zucker)
                                                  </label>
                                                )}
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>

                      <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
                        <div
                          style={{
                            border: `1px solid ${colors.border}`,
                            background: colors.tableHead,
                            padding: "10px 12px",
                            borderRadius: 14,
                            fontWeight: 950,
                            color: colors.textMain,
                          }}
                        >
                          Zwischensumme {tl}: {money(sumTl)}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
        </div>

        <div style={{ marginTop: 14, color: colors.textMuted, fontSize: 12, fontWeight: 800 }}>
          Monatsabrechnung: 400 € + ggf. Boni. Zwischenabrechnung (15.): 200 € (halbe Grundpauschale), 50% der Automaten, keine Boni.
        </div>
      </div>
    </div>
  );
}
