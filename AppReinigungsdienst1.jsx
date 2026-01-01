import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  setDoc,
} from "firebase/firestore";
import { db } from "./firebase";

const colors = {
  card: "#ffffff",
  border: "#e0e4f0",
  primary: "#1976d2",
  textMain: "#1f2933",
  textMuted: "#6b7280",
  danger: "#e53935",
  ok: "#2e7d32",
};

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function pickFirst(obj, keys, fallback = "") {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return fallback;
}

function Card({ title, right, children }) {
  return (
    <section
      style={{
        background: colors.card,
        borderRadius: 16,
        border: `1px solid ${colors.border}`,
        boxShadow: "0 10px 30px rgba(15,23,42,0.06)",
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: colors.textMain }}>{title}</h3>
        {right}
      </div>
      {children}
    </section>
  );
}

function Divider() {
  return <div style={{ height: 1, background: colors.border, width: "100%" }} />;
}

function Input({ label, value, onChange, placeholder, type = "text", disabled }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minWidth: 180 }}>
      <span style={{ fontSize: 12, fontWeight: 800, color: colors.textMuted }}>{label}</span>
      <input
        type={type}
        value={value || ""}
        disabled={disabled}
        placeholder={placeholder || ""}
        onChange={(e) => onChange(e.target.value)}
        style={{
          height: 36,
          padding: "0 12px",
          borderRadius: 12,
          border: `1px solid ${colors.border}`,
          outline: "none",
          fontSize: 13,
          background: disabled ? "#f3f4f6" : "#fff",
        }}
      />
    </label>
  );
}

function Select({ label, value, onChange, options, disabled }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minWidth: 180 }}>
      <span style={{ fontSize: 12, fontWeight: 800, color: colors.textMuted }}>{label}</span>
      <select
        value={value ?? ""}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        style={{
          height: 36,
          padding: "0 12px",
          borderRadius: 12,
          border: `1px solid ${colors.border}`,
          outline: "none",
          fontSize: 13,
          background: disabled ? "#f3f4f6" : "#fff",
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      >
        {options.map((o) => (
          <option key={String(o.value)} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Button({ children, onClick, variant = "primary", disabled, title }) {
  const styles = {
    primary: { background: colors.primary, color: "#fff", border: `1px solid ${colors.primary}` },
    ghost: { background: "#fff", color: colors.textMain, border: `1px solid ${colors.border}` },
    ok: { background: colors.ok, color: "#fff", border: `1px solid ${colors.ok}` },
    danger: { background: colors.danger, color: "#fff", border: `1px solid ${colors.danger}` },
  };
  return (
    <button
      disabled={disabled}
      title={title || ""}
      onClick={onClick}
      style={{
        height: 36,
        padding: "0 12px",
        borderRadius: 12,
        fontWeight: 900,
        fontSize: 13,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.7 : 1,
        ...styles[variant],
      }}
    >
      {children}
    </button>
  );
}

function statusLabel(v) {
  const x = (v || "pool").toLowerCase();
  if (x === "aktiv") return "Aktiv";
  if (x === "pausiert" || x === "pause") return "Pause";
  if (x === "beendet") return "Beendet";
  return "Pool";
}

export default function AppReinigungsdienst() {
  // -------------------------
  // Data
  // -------------------------
  const [teams, setTeams] = useState([]);
  const [selected, setSelected] = useState(null);

  const [standorte, setStandorte] = useState([]);
  const [standorteLoading, setStandorteLoading] = useState(true);
  const [standorteError, setStandorteError] = useState(null);

  const [automatenbestand, setAutomatenbestand] = useState([]);
  const [automatenLoading, setAutomatenLoading] = useState(true);
  const [automatenError, setAutomatenError] = useState(null);

  const [assignments, setAssignments] = useState([]); // team_assignments für ausgewähltes Team

  // -------------------------
  // UI
  // -------------------------
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("alle");
  const [panel, setPanel] = useState("view"); // view | create | edit | assignStandort | assignAutomaten

  const [savingTeam, setSavingTeam] = useState(false);
  const [saveError, setSaveError] = useState(null);

  // Team form
  const [form, setForm] = useState({
    name: "",
    status: "pool",
    startDate: "",
    endDate: "",
    leader: { name: "", phone: "", email: "", status: "pool" },
    members: [],
    notes: "",
  });

  // Standort-Zuordnung
  const [assignStandortId, setAssignStandortId] = useState("");
  const [assignStartDate, setAssignStartDate] = useState(todayISO());
  const [assignReason, setAssignReason] = useState("");

  // Automaten-Zuordnung: Stadt -> Standort -> Automaten
  const [cityFilter, setCityFilter] = useState("");
  const [standortFilterId, setStandortFilterId] = useState("");
  const [automatSearch, setAutomatSearch] = useState("");
  const [assigneeByAutomatId, setAssigneeByAutomatId] = useState({});
  const [savingByAutomatId, setSavingByAutomatId] = useState({}); // { [automatId]: true/false }

  function resetMessages() {
    setSaveError(null);
  }

  function openView() {
    setPanel("view");
    resetMessages();
  }

  function loadFormFromSelected(t) {
    const leader = t?.leader || {};
    setForm({
      name: t?.name || "",
      status: t?.status || "pool",
      startDate: t?.startDate || "",
      endDate: t?.endDate || "",
      leader: {
        name: leader?.name || t?.teamleiter || "",
        phone: leader?.phone || "",
        email: leader?.email || "",
        status: leader?.status || t?.status || "pool",
      },
      members: safeArray(t?.members).map((m) => ({
        name: m?.name || "",
        phone: m?.phone || "",
        email: m?.email || "",
        status: m?.status || "pool",
      })),
      notes: t?.notes || "",
    });
  }

  // -------------------------
  // Teams live
  // -------------------------
  useEffect(() => {
    const q = query(collection(db, "teams"), orderBy("name", "asc"));
    return onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setTeams(rows);

        if (!selected && rows.length) {
          const first = rows[0];
          setSelected(first);
          loadFormFromSelected(first);
          setPanel("view");
          return;
        }

        if (selected) {
          const fresh = rows.find((r) => r.id === selected.id) || null;
          if (fresh) {
            setSelected(fresh);
            if (panel === "view") loadFormFromSelected(fresh);
          }
        }
      },
      (err) => {
        console.error("Teams onSnapshot:", err);
        setSaveError(err?.message || String(err));
      }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panel]);

  // -------------------------
  // Standorte load
  // -------------------------
  useEffect(() => {
    async function loadStandorte() {
      try {
        setStandorteLoading(true);
        setStandorteError(null);
        const snap = await getDocs(collection(db, "Standorte"));
        setStandorte(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error("Standorte laden:", err);
        setStandorteError(err?.message || String(err));
      } finally {
        setStandorteLoading(false);
      }
    }
    loadStandorte();
  }, []);

  // -------------------------
  // Automatenbestand LIVE
  // -------------------------
  useEffect(() => {
    const q = query(collection(db, "Automatenbestand"), orderBy("standortId", "asc"));
    setAutomatenLoading(true);
    setAutomatenError(null);

    return onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setAutomatenbestand(rows);
        setAutomatenLoading(false);
      },
      (err) => {
        console.error("Automatenbestand onSnapshot:", err);
        setAutomatenError(err?.message || String(err));
        setAutomatenLoading(false);
      }
    );
  }, []);

  // -------------------------
  // Assignments live for selected team
  // -------------------------
  useEffect(() => {
    if (!selected?.id) {
      setAssignments([]);
      return;
    }

    const q = query(collection(db, "team_assignments"), orderBy("updatedAt", "desc"));
    return onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setAssignments(rows.filter((r) => r.teamId === selected.id));
      },
      (err) => {
        console.error("Assignments onSnapshot:", err);
      }
    );
  }, [selected?.id]);

  // -------------------------
  // Aktiver Standort (wie bisher: 1 Einsatz)
  // -------------------------
  const currentStandortAssignment = useMemo(
    () => assignments.find((a) => a.entityType === "standort" && !a.endDate) || null,
    [assignments]
  );

  const currentStandort = useMemo(() => {
    if (!currentStandortAssignment?.entityId) return null;
    return standorte.find((s) => s.id === currentStandortAssignment.entityId) || null;
  }, [currentStandortAssignment?.entityId, standorte]);

  // -------------------------
  // Filter Teams
  // -------------------------
  const filteredTeams = useMemo(() => {
    const s = (search || "").trim().toLowerCase();
    return teams
      .filter((t) => {
        if (filterStatus !== "alle" && (t.status || "pool") !== filterStatus) return false;
        if (!s) return true;
        const leaderName = (t?.leader?.name || t?.teamleiter || "").toLowerCase();
        const name = (t?.name || "").toLowerCase();
        return name.includes(s) || leaderName.includes(s);
      })
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "de"));
  }, [teams, search, filterStatus]);

  // -------------------------
  // “Aktive Standorte” = Standorte, wo mindestens ein Automat steht
  // -------------------------
  const standortIdsMitAutomat = useMemo(() => {
    const set = new Set();
    automatenbestand.forEach((a) => {
      if (a?.standortId) set.add(a.standortId);
    });
    return set;
  }, [automatenbestand]);

  const standorteMitAutomaten = useMemo(() => {
    return standorte.filter((s) => standortIdsMitAutomat.has(s.id));
  }, [standorte, standortIdsMitAutomat]);

  // -------------------------
  // Stadt-Auswahl: nur Städte mit aktiven Automaten
  // Stadt-Feld in Standorte heißt bei euch: standort (klein)
  // -------------------------
  const cityOptions = useMemo(() => {
    const set = new Set();
    standorteMitAutomaten.forEach((s) => {
      const city = String(s?.standort || "").trim();
      if (city) set.add(city);
    });
    const list = Array.from(set).sort((a, b) => a.localeCompare(b, "de"));
    return [{ value: "", label: "— Stadt wählen —" }, ...list.map((v) => ({ value: v, label: v }))];
  }, [standorteMitAutomaten]);

  const standortOptionsByCity = useMemo(() => {
    const list = standorteMitAutomaten
      .filter((s) => (!cityFilter ? true : String(s?.standort || "").trim() === cityFilter))
      .map((s) => ({ value: s.id, label: `${s.centername || "—"} · ${s.standort || "—"}` }))
      .sort((a, b) => a.label.localeCompare(b.label, "de"));
    return [{ value: "", label: "— Standort wählen —" }, ...list];
  }, [standorteMitAutomaten, cityFilter]);

  useEffect(() => {
    setStandortFilterId("");
  }, [cityFilter]);

  const automatenForSelectedStandort = useMemo(() => {
    if (!standortFilterId) return [];
    const s = (automatSearch || "").trim().toLowerCase();
    const list = automatenbestand.filter((a) => a?.standortId === standortFilterId);

    if (!s) return list;

    return list.filter((a) => {
      const code = pickFirst(a, ["maschinenCode", "automatCode", "code", "Automat"], "").toLowerCase();
      const name = pickFirst(a, ["name", "bezeichnung"], "").toLowerCase();
      return code.includes(s) || name.includes(s) || String(a.id).toLowerCase().includes(s);
    });
  }, [automatenbestand, standortFilterId, automatSearch]);

  // -------------------------
  // Assignee Optionen
  // -------------------------
  const assigneeOptions = useMemo(() => {
    const leaderName = (selected?.leader?.name || selected?.teamleiter || "").trim() || "Teamleiter";
    const opts = [{ value: "leader", label: `Teamleiter: ${leaderName}` }];

    safeArray(selected?.members).forEach((m, idx) => {
      const n = (m?.name || "").trim();
      if (n) opts.push({ value: `member:${idx}`, label: `Mitarbeiter: ${n}` });
    });

    return opts;
  }, [selected]);

  function resolveAssignee(key) {
    if (key === "leader") {
      return {
        cleaningAssigneeType: "leader",
        cleaningAssigneeName: (selected?.leader?.name || selected?.teamleiter || "").trim(),
      };
    }
    if (key && key.startsWith("member:")) {
      const idx = Number(key.split(":")[1]);
      const m = safeArray(selected?.members)[idx] || {};
      return {
        cleaningAssigneeType: "member",
        cleaningAssigneeName: (m?.name || "").trim(),
        cleaningAssigneeMemberIndex: Number.isFinite(idx) ? idx : null,
      };
    }
    return { cleaningAssigneeType: null, cleaningAssigneeName: "" };
  }

  // -------------------------
  // Team CRUD (wie gehabt)
  // -------------------------
  async function createTeam() {
    const name = (form.name || "").trim();
    const leaderName = (form.leader?.name || "").trim();
    if (!name) return setSaveError("Bitte Team-Name eingeben.");
    if (!leaderName) return setSaveError("Bitte Teamleiter Name eingeben.");

    try {
      setSavingTeam(true);
      setSaveError(null);

      const payload = {
        name,
        status: form.status || "pool",
        startDate: form.startDate || "",
        endDate: form.endDate || "",
        leader: {
          name: leaderName,
          phone: (form.leader?.phone || "").trim(),
          email: (form.leader?.email || "").trim(),
          status: form.leader?.status || form.status || "pool",
        },
        members: safeArray(form.members).map((m) => ({
          name: (m?.name || "").trim(),
          phone: (m?.phone || "").trim(),
          email: (m?.email || "").trim(),
          status: m?.status || "pool",
        })),
        notes: (form.notes || "").trim(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const ref = await addDoc(collection(db, "teams"), payload);

      const newTeam = { id: ref.id, ...payload };
      setSelected(newTeam);
      loadFormFromSelected(newTeam);
      setPanel("view");
    } catch (err) {
      console.error("Team anlegen:", err);
      setSaveError(err?.message || String(err));
    } finally {
      setSavingTeam(false);
    }
  }

  async function saveTeam() {
    if (!selected?.id) return;

    const name = (form.name || "").trim();
    const leaderName = (form.leader?.name || "").trim();
    if (!name) return setSaveError("Bitte Team-Name eingeben.");
    if (!leaderName) return setSaveError("Bitte Teamleiter Name eingeben.");

    try {
      setSavingTeam(true);
      setSaveError(null);

      const payload = {
        name,
        status: form.status || "pool",
        startDate: form.startDate || "",
        endDate: form.endDate || "",
        leader: {
          name: leaderName,
          phone: (form.leader?.phone || "").trim(),
          email: (form.leader?.email || "").trim(),
          status: form.leader?.status || form.status || "pool",
        },
        members: safeArray(form.members).map((m) => ({
          name: (m?.name || "").trim(),
          phone: (m?.phone || "").trim(),
          email: (m?.email || "").trim(),
          status: m?.status || "pool",
        })),
        notes: (form.notes || "").trim(),
        updatedAt: serverTimestamp(),
      };

      await updateDoc(doc(db, "teams", selected.id), payload);
      setPanel("view");
    } catch (err) {
      console.error("Team speichern:", err);
      setSaveError(err?.message || String(err));
    } finally {
      setSavingTeam(false);
    }
  }

  function startCreate() {
    resetMessages();
    setPanel("create");
    setSelected(null);
    setForm({
      name: "",
      status: "pool",
      startDate: "",
      endDate: "",
      leader: { name: "", phone: "", email: "", status: "pool" },
      members: [],
      notes: "",
    });
  }

  function startEdit() {
    if (!selected) return;
    resetMessages();
    loadFormFromSelected(selected);
    setPanel("edit");
  }

  function addMemberRow() {
    setForm((prev) => ({
      ...prev,
      members: [...safeArray(prev.members), { name: "", phone: "", email: "", status: "pool" }],
    }));
  }

  function removeMemberRow(idx) {
    setForm((prev) => {
      const next = [...safeArray(prev.members)];
      next.splice(idx, 1);
      return { ...prev, members: next };
    });
  }

  function updateMember(idx, patch) {
    setForm((prev) => {
      const next = [...safeArray(prev.members)];
      next[idx] = { ...next[idx], ...patch };
      return { ...prev, members: next };
    });
  }

  // -------------------------
  // Standort zuordnen (1 aktiver Einsatz)
  // -------------------------
  const standortOptionsForAssign = useMemo(() => {
    const list = standorteMitAutomaten
      .map((s) => ({ value: s.id, label: `${s.centername || "—"} · ${s.standort || "—"}` }))
      .sort((a, b) => a.label.localeCompare(b.label, "de"));
    return [{ value: "", label: "Bitte wählen…" }, ...list];
  }, [standorteMitAutomaten]);

  async function assignTeamToStandort() {
    if (!selected?.id) return;
    if (!assignStandortId || !assignStartDate) {
      setSaveError("Bitte Standort und Startdatum wählen.");
      return;
    }

    const ziel = standorte.find((s) => s.id === assignStandortId);
    if (!ziel) {
      setSaveError("Standort nicht gefunden.");
      return;
    }

    try {
      setSavingTeam(true);
      setSaveError(null);

      if (currentStandortAssignment?.id) {
        await updateDoc(doc(db, "team_assignments", currentStandortAssignment.id), {
          endDate: assignStartDate,
          reason: (assignReason || "").trim() || "Umgehängt",
          updatedAt: serverTimestamp(),
        });
      }

      await addDoc(collection(db, "team_assignments"), {
        teamId: selected.id,
        entityType: "standort",
        entityId: ziel.id,
        startDate: assignStartDate,
        endDate: null,
        reason: (assignReason || "").trim() || "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await updateDoc(doc(db, "teams", selected.id), {
        status: "aktiv",
        updatedAt: serverTimestamp(),
      });

      await updateDoc(doc(db, "Standorte", ziel.id), {
        currentTeamId: selected.id,
        updatedAt: serverTimestamp(),
      });

      openView();
    } catch (err) {
      console.error("Zuordnen fehlgeschlagen:", err);
      setSaveError(err?.message || String(err));
    } finally {
      setSavingTeam(false);
    }
  }

  // -------------------------
  // Automat -> Mitarbeiter speichern
  // FIX: pro Automat eigener Assignment-Doc (teamId__automatId)
  // + zusätzlich Update in Automatenbestand
  // -------------------------
  async function saveAutomatAssignee(automat) {
    if (!selected?.id) return;
    if (!automat?.id) return;

    const key = assigneeByAutomatId[automat.id] || "leader";
    const ass = resolveAssignee(key);

    if (!ass.cleaningAssigneeName) {
      setSaveError("Bitte einen gültigen Zuständigen wählen.");
      return;
    }

    const assignmentId = `${selected.id}__${automat.id}`;

    try {
      setSaveError(null);
      setSavingByAutomatId((p) => ({ ...p, [automat.id]: true }));

      // 1) Saubere Zuordnung in team_assignments (eindeutig pro Team+Automat)
      await setDoc(
        doc(db, "team_assignments", assignmentId),
        {
          teamId: selected.id,
          entityType: "automat",
          entityId: automat.id,
          standortId: automat?.standortId || null,
          // für späteres Reporting / Übersicht:
          city: cityFilter || null,
          centername: automat?.centername || null,

          ...ass,

          // Abrechnung weiterhin über TL:
          teamLeaderName: (selected?.leader?.name || selected?.teamleiter || "").trim(),
          teamName: selected?.name || "",

          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );

      // 2) Zusätzlich im Automatenbestand speichern (damit überall klar ist “wer reinigt”)
      await updateDoc(doc(db, "Automatenbestand", automat.id), {
        cleaningTeamId: selected.id,
        cleaningTeamName: selected?.name || "",
        cleaningTeamLeaderName: (selected?.leader?.name || selected?.teamleiter || "").trim(),
        ...ass,
        cleaningAssignedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error("Automat-Zuordnung speichern:", err);
      setSaveError(err?.message || String(err));
    } finally {
      setSavingByAutomatId((p) => ({ ...p, [automat.id]: false }));
    }
  }

  return (
    <div style={{ fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif" }}>
      <div style={{ display: "grid", gridTemplateColumns: "420px 1fr", gap: 12 }}>
        {/* LEFT */}
        <Card
          title="Reinigungsdienst – Teams"
          right={
            <div style={{ display: "flex", gap: 8 }}>
              <Button variant="ghost" onClick={startCreate} disabled={savingTeam}>
                + Team
              </Button>
            </div>
          }
        >
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Input label="Suche" value={search} onChange={setSearch} placeholder="Team / Teamleiter…" />
            <Select
              label="Status"
              value={filterStatus}
              onChange={setFilterStatus}
              options={[
                { value: "alle", label: "Alle" },
                { value: "pool", label: "Pool" },
                { value: "aktiv", label: "Aktiv" },
                { value: "pausiert", label: "Pause" },
                { value: "beendet", label: "Beendet" },
              ]}
            />
          </div>

          <Divider />

          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: "72vh", overflow: "auto" }}>
            {filteredTeams.length === 0 ? (
              <div style={{ color: colors.textMuted, fontSize: 13 }}>Keine Teams gefunden.</div>
            ) : (
              filteredTeams.map((t) => {
                const active = selected?.id === t.id;
                const leaderName = t?.leader?.name || t?.teamleiter || "—";
                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      setSelected(t);
                      loadFormFromSelected(t);
                      setPanel("view");
                      setSaveError(null);
                    }}
                    style={{
                      textAlign: "left",
                      borderRadius: 14,
                      border: `1px solid ${active ? colors.primary : colors.border}`,
                      background: active ? "#eef2ff" : "#fff",
                      padding: 12,
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ fontWeight: 900, color: colors.textMain, fontSize: 13 }}>{t.name || "—"}</div>
                    <div style={{ marginTop: 6, fontSize: 12, color: colors.textMuted, fontWeight: 800 }}>
                      Teamleiter: <span style={{ color: colors.textMain, fontWeight: 900 }}>{leaderName}</span>
                    </div>
                    <div style={{ marginTop: 4, fontSize: 12, color: colors.textMuted, fontWeight: 800 }}>
                      Status: <span style={{ color: colors.textMain, fontWeight: 900 }}>{statusLabel(t.status)}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </Card>

        {/* RIGHT */}
        <Card
          title={selected ? `Team: ${selected.name || "—"}` : "Team anlegen"}
          right={
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {panel === "view" ? (
                <>
                  <Button variant="ghost" disabled={!selected} onClick={startEdit}>
                    Bearbeiten
                  </Button>
                  <Button variant="primary" disabled={!selected} onClick={() => setPanel("assignStandort")}>
                    Standort zuordnen
                  </Button>
                  <Button variant="ghost" disabled={!selected} onClick={() => setPanel("assignAutomaten")}>
                    Automaten zuteilen
                  </Button>
                </>
              ) : (
                <Button variant="ghost" onClick={openView}>
                  Zurück
                </Button>
              )}
            </div>
          }
        >
          {saveError ? (
            <div
              style={{
                border: `1px solid ${colors.danger}`,
                background: "#ffebee",
                color: colors.danger,
                borderRadius: 12,
                padding: 10,
                fontWeight: 900,
                fontSize: 13,
              }}
            >
              {saveError}
            </div>
          ) : null}

          {standorteError ? <div style={{ color: colors.danger, fontWeight: 900 }}>Standorte: {standorteError}</div> : null}
          {automatenError ? <div style={{ color: colors.danger, fontWeight: 900 }}>Automatenbestand: {automatenError}</div> : null}

          {/* VIEW */}
          {panel === "view" && selected ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Card title="Übersicht">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <div style={{ color: colors.textMuted, fontWeight: 900, fontSize: 12 }}>Teamleiter</div>
                    <div style={{ marginTop: 6, fontWeight: 900, color: colors.textMain }}>
                      {selected?.leader?.name || selected?.teamleiter || "—"}
                    </div>
                    <div style={{ marginTop: 4, color: colors.textMuted, fontWeight: 800, fontSize: 12 }}>
                      Status: {statusLabel(selected.status)}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: colors.textMuted, fontWeight: 900, fontSize: 12 }}>Mitglieder</div>
                    <div style={{ marginTop: 6, fontWeight: 900, color: colors.textMain }}>
                      {safeArray(selected.members).filter((m) => (m?.name || "").trim()).length}
                    </div>
                    <div style={{ marginTop: 4, color: colors.textMuted, fontWeight: 800, fontSize: 12 }}>
                      Aktiver Standort: {currentStandort ? "ja" : "nein"}
                    </div>
                  </div>
                </div>
              </Card>

              <Card title="Aktueller Standort">
                {currentStandort ? (
                  <div style={{ fontWeight: 900, color: colors.textMain }}>
                    {currentStandort.centername || "—"} · {currentStandort.standort || "—"}
                  </div>
                ) : (
                  <div style={{ color: colors.textMuted, fontSize: 13 }}>Kein aktiver Standort zugeordnet.</div>
                )}
              </Card>
            </div>
          ) : null}

          {/* CREATE */}
          {panel === "create" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Card
                title="Neues Team"
                right={
                  <Button variant="ok" disabled={savingTeam} onClick={createTeam}>
                    {savingTeam ? "…" : "Team anlegen"}
                  </Button>
                }
              >
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <Input label="Teamname" value={form.name} onChange={(v) => setForm((p) => ({ ...p, name: v }))} />
                  <Select
                    label="Status"
                    value={form.status}
                    onChange={(v) => setForm((p) => ({ ...p, status: v }))}
                    options={[
                      { value: "pool", label: "Pool" },
                      { value: "aktiv", label: "Aktiv" },
                      { value: "pausiert", label: "Pause" },
                      { value: "beendet", label: "Beendet" },
                    ]}
                  />
                  <Input label="Startdatum" type="date" value={form.startDate} onChange={(v) => setForm((p) => ({ ...p, startDate: v }))} />
                </div>

                <Divider />

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <Input label="Teamleiter Name" value={form.leader?.name} onChange={(v) => setForm((p) => ({ ...p, leader: { ...p.leader, name: v } }))} />
                  <Input label="Telefon" value={form.leader?.phone} onChange={(v) => setForm((p) => ({ ...p, leader: { ...p.leader, phone: v } }))} />
                  <Input label="E-Mail" value={form.leader?.email} onChange={(v) => setForm((p) => ({ ...p, leader: { ...p.leader, email: v } }))} />
                </div>

                <Divider />

                <Card title="Mitarbeiter" right={<Button variant="ghost" onClick={addMemberRow}>+ Mitarbeiter</Button>}>
                  {safeArray(form.members).length === 0 ? (
                    <div style={{ color: colors.textMuted, fontSize: 13 }}>Keine Mitarbeiter.</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {safeArray(form.members).map((m, idx) => (
                        <div
                          key={idx}
                          style={{
                            border: `1px solid ${colors.border}`,
                            borderRadius: 12,
                            padding: 10,
                            display: "flex",
                            gap: 10,
                            flexWrap: "wrap",
                            alignItems: "flex-end",
                          }}
                        >
                          <Input label="Name" value={m.name} onChange={(v) => updateMember(idx, { name: v })} />
                          <Input label="Telefon" value={m.phone} onChange={(v) => updateMember(idx, { phone: v })} />
                          <Input label="E-Mail" value={m.email} onChange={(v) => updateMember(idx, { email: v })} />
                          <Button variant="danger" onClick={() => removeMemberRow(idx)}>
                            Entfernen
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </Card>
            </div>
          ) : null}

          {/* EDIT */}
          {panel === "edit" && selected ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Card
                title="Team bearbeiten"
                right={
                  <Button variant="ok" disabled={savingTeam} onClick={saveTeam}>
                    {savingTeam ? "…" : "Speichern"}
                  </Button>
                }
              >
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <Input label="Teamname" value={form.name} onChange={(v) => setForm((p) => ({ ...p, name: v }))} />
                  <Select
                    label="Status"
                    value={form.status}
                    onChange={(v) => setForm((p) => ({ ...p, status: v }))}
                    options={[
                      { value: "pool", label: "Pool" },
                      { value: "aktiv", label: "Aktiv" },
                      { value: "pausiert", label: "Pause" },
                      { value: "beendet", label: "Beendet" },
                    ]}
                  />
                  <Input label="Startdatum" type="date" value={form.startDate} onChange={(v) => setForm((p) => ({ ...p, startDate: v }))} />
                  <Input label="Enddatum" type="date" value={form.endDate} onChange={(v) => setForm((p) => ({ ...p, endDate: v }))} />
                </div>

                <Divider />

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <Input label="Teamleiter Name" value={form.leader?.name} onChange={(v) => setForm((p) => ({ ...p, leader: { ...p.leader, name: v } }))} />
                  <Input label="Telefon" value={form.leader?.phone} onChange={(v) => setForm((p) => ({ ...p, leader: { ...p.leader, phone: v } }))} />
                  <Input label="E-Mail" value={form.leader?.email} onChange={(v) => setForm((p) => ({ ...p, leader: { ...p.leader, email: v } }))} />
                </div>
              </Card>
            </div>
          ) : null}

          {/* ASSIGN STANDORT */}
          {panel === "assignStandort" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Card
                title="Standort zuordnen (nur Standorte mit Automaten)"
                right={
                  <Button variant="ok" disabled={savingTeam || standorteLoading || automatenLoading} onClick={assignTeamToStandort}>
                    {savingTeam ? "…" : "Zuordnen"}
                  </Button>
                }
              >
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <Select label="Standort" value={assignStandortId} onChange={setAssignStandortId} options={standortOptionsForAssign} disabled={standorteLoading || automatenLoading} />
                  <Input label="Startdatum" type="date" value={assignStartDate} onChange={setAssignStartDate} />
                </div>
                <div style={{ marginTop: 10 }}>
                  <Input label="Grund (optional)" value={assignReason} onChange={setAssignReason} placeholder="z. B. Umgehängt…" />
                </div>
              </Card>
            </div>
          ) : null}

          {/* ASSIGN AUTOMATEN */}
          {panel === "assignAutomaten" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Card title="Automaten zuteilen (Stadt → Standort → Automat)">
                {!selected ? (
                  <div style={{ color: colors.textMuted, fontSize: 13 }}>Bitte erst ein Team wählen.</div>
                ) : automatenLoading || standorteLoading ? (
                  <div style={{ color: colors.textMuted, fontSize: 13 }}>Lade Daten…</div>
                ) : (
                  <>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <Select
                        label="Stadt"
                        value={cityFilter}
                        onChange={setCityFilter}
                        options={cityOptions}
                        disabled={automatenLoading || standorteLoading}
                      />
                      <Select
                        label="Standort (nur aktive in Stadt)"
                        value={standortFilterId}
                        onChange={setStandortFilterId}
                        options={standortOptionsByCity}
                        disabled={!cityFilter}
                      />
                      <Input
                        label="Suche Automat"
                        value={automatSearch}
                        onChange={setAutomatSearch}
                        placeholder="Code / Name / ID…"
                        disabled={!standortFilterId}
                      />
                    </div>

                    <Divider />

                    {!standortFilterId ? (
                      <div style={{ color: colors.textMuted, fontSize: 13 }}>Bitte zuerst eine Stadt und einen Standort wählen.</div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: "62vh", overflow: "auto" }}>
                        {automatenForSelectedStandort.length === 0 ? (
                          <div style={{ color: colors.textMuted, fontSize: 13 }}>
                            Keine Automaten im Automatenbestand für diesen Standort gefunden.
                          </div>
                        ) : (
                          automatenForSelectedStandort.map((a) => {
                            const label = pickFirst(a, ["maschinenCode", "automatCode", "Automat", "name", "bezeichnung"], a.id);
                            const key = assigneeByAutomatId[a.id] || "leader";
                            const savingThis = !!savingByAutomatId[a.id];

                            const currentAssignee =
                              a.cleaningAssigneeName
                                ? `${a.cleaningAssigneeType === "member" ? "Mitarbeiter" : "Teamleiter"}: ${a.cleaningAssigneeName}`
                                : "—";

                            return (
                              <div
                                key={a.id}
                                style={{
                                  border: `1px solid ${colors.border}`,
                                  borderRadius: 12,
                                  padding: 10,
                                  display: "flex",
                                  gap: 10,
                                  flexWrap: "wrap",
                                  alignItems: "flex-end",
                                  justifyContent: "space-between",
                                }}
                              >
                                <div style={{ minWidth: 260 }}>
                                  <div style={{ fontWeight: 900, color: colors.textMain, fontSize: 13 }}>{label}</div>
                                  <div style={{ marginTop: 4, fontSize: 12, fontWeight: 800, color: colors.textMuted }}>
                                    ID: {a.id}
                                  </div>
                                  <div style={{ marginTop: 4, fontSize: 12, fontWeight: 800, color: colors.textMuted }}>
                                    aktuell: <span style={{ color: colors.textMain }}>{currentAssignee}</span>
                                  </div>
                                </div>

                                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
                                  <Select
                                    label="Zuständig"
                                    value={key}
                                    onChange={(v) => setAssigneeByAutomatId((p) => ({ ...p, [a.id]: v }))}
                                    options={assigneeOptions}
                                    disabled={savingThis}
                                  />
                                  <Button variant="ok" disabled={savingThis} onClick={() => saveAutomatAssignee(a)}>
                                    {savingThis ? "Speichere…" : "Speichern"}
                                  </Button>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </>
                )}
              </Card>
            </div>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
