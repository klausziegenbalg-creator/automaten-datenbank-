// AppAutomaten.jsx

import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  addDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import { useParams, useNavigate } from "react-router-dom";

const colors = {
  bg: "#f5f7fb",
  card: "#ffffff",
  border: "#e0e4f0",
  primary: "#1976d2",
  primaryDark: "#1565c0",
  textMain: "#1f2933",
  textMuted: "#6b7280",
  tableHeader: "#e3f2fd",
  tableRowHover: "#f1f5ff",
  danger: "#e53935",
};

function AppAutomaten() {
  const { automatId } = useParams();
  const navigate = useNavigate();

  const [standorte, setStandorte] = useState([]);
  const [standorteLoading, setStandorteLoading] = useState(true);
  const [standorteError, setStandorteError] = useState(null);

  const [automaten, setAutomaten] = useState([]);
  const [automatenLoading, setAutomatenLoading] = useState(false);
  const [automatenError, setAutomatenError] = useState(null);

  const [automatenSearch, setAutomatenSearch] = useState("");

  const [selectedAutomat, setSelectedAutomat] = useState(null);

  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const [kontakte, setKontakte] = useState([]);
  const [kontakteLoading, setKontakteLoading] = useState(false);
  const [kontakteError, setKontakteError] = useState(null);

  const [wochenWartungen, setWochenWartungen] = useState([]);
  const [wartungsProtokolle, setWartungsProtokolle] = useState([]);
  const [wartungLoading, setWartungLoading] = useState(false);
  const [wartungError, setWartungError] = useState(null);

  // Standorte laden
  useEffect(() => {
    async function loadStandorte() {
      try {
        setStandorteLoading(true);
        const snap = await getDocs(collection(db, "Standorte"));
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setStandorte(items);
      } catch (err) {
        console.error("Standorte laden:", err);
        setStandorteError(err.message);
      } finally {
        setStandorteLoading(false);
      }
    }
    loadStandorte();
  }, []);

  // Automaten laden + ggf. aus URL wählen
  useEffect(() => {
    async function loadAutomaten() {
      try {
        setAutomatenLoading(true);
        const snap = await getDocs(collection(db, "Automatenbestand"));
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setAutomaten(items);

        let initial = null;
        if (automatId) {
          initial = items.find((a) => a.id === automatId) || null;
        }
        if (!initial && items.length > 0) {
          initial = items[0];
        }
        if (initial) {
          setSelectedAutomat(initial);
          setFormData(initial);
        }
      } catch (err) {
        console.error("Automaten laden:", err);
        setAutomatenError(err.message);
      } finally {
        setAutomatenLoading(false);
      }
    }
    loadAutomaten();
  }, [automatId]);

  // Bei Automatwechsel: Kontakte + Wartung laden
  useEffect(() => {
    async function loadKontakte() {
      if (!selectedAutomat || !selectedAutomat.standortId) {
        setKontakte([]);
        return;
      }
      try {
        setKontakteLoading(true);
        setKontakteError(null);
        const snap = await getDocs(collection(db, "Kontakte"));
        const items = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((k) => k.standortId === selectedAutomat.standortId);
        setKontakte(items);
      } catch (err) {
        console.error("Kontakte laden:", err);
        setKontakteError(err.message);
      } finally {
        setKontakteLoading(false);
      }
    }

    async function loadWartung() {
      if (!selectedAutomat || !selectedAutomat.maschinenCode) {
        setWochenWartungen([]);
        setWartungsProtokolle([]);
        return;
      }
      try {
        setWartungLoading(true);
        setWartungError(null);

        const wwSnap = await getDocs(collection(db, "wochenWartung"));
        const wwItems = wwSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((w) => w.automatCode === selectedAutomat.maschinenCode);

        const wpSnap = await getDocs(collection(db, "Wartungsprotokolle"));
        const wpItems = wpSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((p) => p.automatCode === selectedAutomat.maschinenCode);

        setWochenWartungen(wwItems);
        setWartungsProtokolle(wpItems);
      } catch (err) {
        console.error("Wartung laden:", err);
        setWartungError(err.message);
      } finally {
        setWartungLoading(false);
      }
    }

    if (selectedAutomat) {
      setFormData({ ...selectedAutomat });
      setEditMode(false);
      setSaveError(null);
      loadKontakte();
      loadWartung();
    } else {
      setFormData({});
      setKontakte([]);
      setWochenWartungen([]);
      setWartungsProtokolle([]);
    }
  }, [selectedAutomat]);

  // Speichern
  async function handleSave() {
    if (!selectedAutomat) return;
    try {
      setSaving(true);
      setSaveError(null);

      const ref = doc(db, "Automatenbestand", selectedAutomat.id);
      const { id, ...rest } = formData;
      await updateDoc(ref, rest);

      const updatedList = automaten.map((a) =>
        a.id === selectedAutomat.id ? { ...a, ...rest } : a
      );
      setAutomaten(updatedList);

      const updatedAutomat = { ...selectedAutomat, ...rest };
      setSelectedAutomat(updatedAutomat);

      setEditMode(false);
    } catch (err) {
      console.error("Speichern fehlgeschlagen:", err);
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // Neuer Automat
  async function handleNewAutomat() {
    try {
      setSaving(true);
      setSaveError(null);

      const basis = {
        standortId: null,
        centername: "",
        standort: "",
        maschinenCode: "",
        model: "",
        seriennummer: "",
        hersteller: "",
        besitzerName: "",
        mobilfunkkarteNummerUndArt: "",
        kaufdatum: "",
      };

      const ref = await addDoc(collection(db, "Automatenbestand"), basis);
      const neu = { id: ref.id, ...basis };

      setAutomaten((prev) => [...prev, neu]);
      setSelectedAutomat(neu);
      setFormData(neu);
      setEditMode(true);
    } catch (err) {
      console.error("Neuen Automaten anlegen fehlgeschlagen:", err);
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // Automat löschen
  async function handleDeleteAutomat() {
    if (!selectedAutomat) return;
    const sicher = window.confirm(
      `Automat "${selectedAutomat.maschinenCode || selectedAutomat.id}" wirklich löschen?`
    );
    if (!sicher) return;

    try {
      setSaving(true);
      setSaveError(null);

      await deleteDoc(doc(db, "Automatenbestand", selectedAutomat.id));

      const rest = automaten.filter((a) => a.id !== selectedAutomat.id);
      setAutomaten(rest);
      if (rest.length > 0) {
        setSelectedAutomat(rest[0]);
        setFormData(rest[0]);
      } else {
        setSelectedAutomat(null);
        setFormData({});
      }
    } catch (err) {
      console.error("Automat löschen fehlgeschlagen:", err);
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // Filter
  const gefilterteAutomaten = automaten.filter((a) => {
    const q = automatenSearch.trim().toLowerCase();
    if (!q) return true;
    const text =
      (a.maschinenCode || "") +
      " " +
      (a.model || "") +
      " " +
      (a.seriennummer || "") +
      " " +
      (a.centername || "") +
      " " +
      (a.standort || "");
    return text.toLowerCase().includes(q);
  });

  if (standorteLoading || automatenLoading) {
    return (
      <div
        style={{
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily:
            '"Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          background: colors.bg,
          color: colors.textMuted,
        }}
      >
        Daten werden geladen...
      </div>
    );
  }

  if (standorteError || automatenError) {
    return (
      <div
        style={{
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily:
            '"Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          background: colors.bg,
        }}
      >
        <div
          style={{
            background: colors.card,
            padding: 24,
            borderRadius: 12,
            boxShadow: "0 10px 30px rgba(15,23,42,0.12)",
            color: colors.danger,
          }}
        >
          Fehler: {standorteError || automatenError}
        </div>
      </div>
    );
  }

  const selectedStandort =
    selectedAutomat && selectedAutomat.standortId
      ? standorte.find((s) => s.id === selectedAutomat.standortId) || null
      : null;

  return (
    <div
      style={{
        height: "100%", // hier angepasst
        display: "flex",
        fontFamily:
          '"Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        background: colors.bg,
        color: colors.textMain,
        padding: 12,
        boxSizing: "border-box",
        gap: 12,
      }}
    >
      {/* linke Spalte: Automatenliste */}
      <div
        style={{
          width: "42%",
          display: "flex",
          flexDirection: "column",
          background: colors.card,
          borderRadius: 16,
          boxShadow: "0 10px 30px rgba(15,23,42,0.08)",
          border: `1px solid ${colors.border}`,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "14px 16px",
            borderBottom: `1px solid ${colors.border}`,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
            }}
          >
            <div>
              <h1
                style={{
                  margin: 0,
                  fontSize: 20,
                  fontWeight: 600,
                  letterSpacing: 0.2,
                }}
              >
                Automaten
              </h1>
              <span
                style={{
                  fontSize: 12,
                  color: colors.textMuted,
                }}
              >
                {automaten.length} Automaten
              </span>
            </div>
          </div>
          <input
            placeholder="Automat oder Standort suchen..."
            style={{
              width: "100%",
              padding: "6px 10px",
              boxSizing: "border-box",
              fontSize: 13,
              borderRadius: 999,
              border: `1px solid ${colors.border}`,
              outline: "none",
            }}
            value={automatenSearch}
            onChange={(e) => setAutomatenSearch(e.target.value)}
          />
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 13,
            }}
          >
            <thead>
              <tr style={{ background: colors.tableHeader }}>
                <th
                  style={{
                    textAlign: "left",
                    padding: "8px 12px",
                    fontWeight: 600,
                    color: colors.textMuted,
                    borderBottom: `1px solid ${colors.border}`,
                  }}
                >
                  Maschine
                </th>
                <th
                  style={{
                    textAlign: "left",
                    padding: "8px 12px",
                    fontWeight: 600,
                    color: colors.textMuted,
                    borderBottom: `1px solid ${colors.border}`,
                  }}
                >
                  Standort
                </th>
              </tr>
            </thead>
            <tbody>
              {gefilterteAutomaten.map((a) => {
                const isActive = selectedAutomat && selectedAutomat.id === a.id;
                return (
                  <tr
                    key={a.id}
                    onClick={() => {
                      setSelectedAutomat(a);
                      setEditMode(false);
                      setSaveError(null);
                    }}
                    style={{
                      cursor: "pointer",
                      background: isActive ? "#dbeafe" : "transparent",
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.backgroundColor =
                          colors.tableRowHover;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.backgroundColor = "transparent";
                      }
                    }}
                  >
                    <td
                      style={{
                        padding: "6px 12px",
                        borderBottom: `1px solid ${colors.border}`,
                      }}
                    >
                      {a.maschinenCode || "(ohne Code)"}
                    </td>
                    <td
                      style={{
                        padding: "6px 12px",
                        borderBottom: `1px solid ${colors.border}`,
                      }}
                    >
                      {a.standortId
                        ? `${a.centername || ""} · ${a.standort || ""}`
                        : "Lager / kein Standort"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* rechte Spalte: Automaten-Details */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {!selectedAutomat ? (
          <div
            style={{
              flex: 1,
              background: colors.card,
              borderRadius: 16,
              border: `1px solid ${colors.border}`,
              boxShadow: "0 10px 30px rgba(15,23,42,0.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: colors.textMuted,
            }}
          >
            Bitte links einen Automaten auswählen.
          </div>
        ) : (
          <>
            {/* Kopfbereich */}
            <div
              style={{
                background: colors.card,
                borderRadius: 16,
                border: `1px solid ${colors.border}`,
                boxShadow: "0 10px 30px rgba(15,23,42,0.08)",
                padding: 16,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 600,
                    marginBottom: 4,
                  }}
                >
                  Automat {selectedAutomat.maschinenCode || "(neu)"}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: colors.textMuted,
                  }}
                >
                  {selectedStandort
                    ? `${selectedStandort.centername} · ${selectedStandort.standort}`
                    : "Lager / keinem Standort zugeordnet"}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={handleNewAutomat}
                  disabled={saving}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 999,
                    border: "none",
                    background: "#2e7d32",
                    color: "#ffffff",
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: "pointer",
                  }}
                >
                  Neuer Automat
                </button>
                <button
                  onClick={handleDeleteAutomat}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 999,
                    border: "none",
                    background: "#c62828",
                    color: "#ffffff",
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: "pointer",
                  }}
                  disabled={saving}
                >
                  Löschen
                </button>
                {!editMode ? (
                  <button
                    onClick={() => setEditMode(true)}
                    style={{
                      padding: "6px 14px",
                      borderRadius: 999,
                      border: "none",
                      background: colors.primary,
                      color: "#ffffff",
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: "pointer",
                    }}
                  >
                    Bearbeiten
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      style={{
                        padding: "6px 14px",
                        borderRadius: 999,
                        border: "none",
                        background: colors.primary,
                        color: "#ffffff",
                        fontSize: 13,
                        fontWeight: 500,
                        cursor: "pointer",
                      }}
                    >
                      {saving ? "Speichern..." : "Speichern"}
                    </button>
                    <button
                      onClick={() => {
                        setEditMode(false);
                        setFormData(selectedAutomat);
                        setSaveError(null);
                      }}
                      style={{
                        padding: "6px 14px",
                        borderRadius: 999,
                        border: `1px solid ${colors.border}`,
                        background: "#ffffff",
                        color: colors.textMuted,
                        fontSize: 13,
                        fontWeight: 500,
                        cursor: "pointer",
                      }}
                    >
                      Abbrechen
                    </button>
                  </>
                )}
              </div>
            </div>

            {saveError && (
              <div
                style={{
                  background: "#ffebee",
                  borderRadius: 12,
                  padding: 10,
                  fontSize: 13,
                  color: colors.danger,
                }}
              >
                {saveError}
              </div>
            )}

            {/* Standort-Zuordnung */}
            <Card title="Standort‑Zuordnung">
              <div
                style={{
                  border: `1px solid ${colors.border}`,
                  borderRadius: 12,
                  padding: 12,
                }}
              >
                {editMode ? (
                  <>
                    <div style={{ marginBottom: 8 }}>
                      <label
                        style={{ fontSize: 12, color: colors.textMuted }}
                      >
                        Zugeordneter Standort
                      </label>
                      <select
                        style={{
                          width: "100%",
                          padding: "6px 8px",
                          boxSizing: "border-box",
                          marginTop: 4,
                          borderRadius: 8,
                          border: `1px solid ${colors.border}`,
                          fontSize: 13,
                        }}
                        value={formData.standortId || ""}
                        onChange={(e) => {
                          const value = e.target.value || null;
                          const ziel = standorte.find((s) => s.id === value);
                          setFormData((prev) => ({
                            ...prev,
                            standortId: value,
                            centername: ziel ? ziel.centername : "",
                            standort: ziel ? ziel.standort : "",
                          }));
                        }}
                        disabled={standorteLoading}
                      >
                        <option value="">Lager / kein Standort</option>
                        {standorte.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.centername} · {s.standort}
                          </option>
                        ))}
                      </select>
                    </div>
                    <p
                      style={{
                        fontSize: 12,
                        color: colors.textMuted,
                        marginTop: 4,
                      }}
                    >
                      Wird ein Standort gewählt, werden{" "}
                      <strong>centername</strong> und <strong>standort</strong>{" "}
                      im Automaten automatisch gesetzt.
                    </p>
                  </>
                ) : (
                  <p style={{ fontSize: 14, margin: 0 }}>
                    {selectedAutomat.standortId
                      ? `${selectedAutomat.centername || "—"} · ${
                          selectedAutomat.standort || "—"
                        }`
                      : "Lager / keinem Standort zugeordnet"}
                  </p>
                )}
              </div>
            </Card>

            {/* Automat-Details */}
            <Card title="Automat">
              <div
                style={{
                  border: `1px solid ${colors.border}`,
                  borderRadius: 12,
                  padding: 12,
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 16,
                }}
              >
                <FieldOrInfo
                  editMode={editMode}
                  label="Maschinen-Code"
                  field="maschinenCode"
                  formData={formData}
                  setFormData={setFormData}
                />
                <FieldOrInfo
                  editMode={editMode}
                  label="Seriennummer"
                  field="seriennummer"
                  formData={formData}
                  setFormData={setFormData}
                />
                <FieldOrInfo
                  editMode={editMode}
                  label="Modell"
                  field="model"
                  formData={formData}
                  setFormData={setFormData}
                />
                <FieldOrInfo
                  editMode={editMode}
                  label="Hersteller"
                  field="hersteller"
                  formData={formData}
                  setFormData={setFormData}
                />
                <FieldOrInfo
                  editMode={editMode}
                  label="Besitzer"
                  field="besitzerName"
                  formData={formData}
                  setFormData={setFormData}
                />
                <FieldOrInfo
                  editMode={editMode}
                  label="Mobilfunkkarte"
                  field="mobilfunkkarteNummerUndArt"
                  formData={formData}
                  setFormData={setFormData}
                />
                <FieldOrInfo
                  editMode={editMode}
                  label="Kaufdatum"
                  field="kaufdatum"
                  formData={formData}
                  setFormData={setFormData}
                />
              </div>
            </Card>

            {/* Kontakte am Standort */}
            <Card title="Kontakte am Standort">
              <div
                style={{
                  border: `1px solid ${colors.border}`,
                  borderRadius: 12,
                  padding: 12,
                }}
              >
                {!selectedAutomat.standortId && (
                  <p style={{ fontSize: 14, margin: 0 }}>
                    Dieser Automat hat keinen Standort, daher keine Kontakte.
                  </p>
                )}
                {selectedAutomat.standortId && (
                  <>
                    {kontakteLoading && (
                      <p style={{ fontSize: 14, margin: 0 }}>
                        Kontakte werden geladen...
                      </p>
                    )}
                    {kontakteError && (
                      <p
                        style={{
                          color: colors.danger,
                          fontSize: 14,
                          margin: 0,
                        }}
                      >
                        Fehler beim Laden der Kontakte: {kontakteError}
                      </p>
                    )}
                    {!kontakteLoading &&
                      !kontakteError &&
                      kontakte.length === 0 && (
                        <p style={{ fontSize: 14, margin: 0 }}>
                          Keine Kontakte für diesen Standort gefunden.
                        </p>
                      )}
                    {!kontakteLoading &&
                      !kontakteError &&
                      kontakte.length > 0 && (
                        <table
                          style={{
                            width: "100%",
                            borderCollapse: "collapse",
                            fontSize: 13,
                          }}
                        >
                          <thead>
                            <tr style={{ background: colors.tableHeader }}>
                              <th
                                style={{
                                  textAlign: "left",
                                  padding: "4px 6px",
                                  borderBottom: `1px solid ${colors.border}`,
                                }}
                              >
                                Name
                              </th>
                              <th
                                style={{
                                  textAlign: "left",
                                  padding: "4px 6px",
                                  borderBottom: `1px solid ${colors.border}`,
                                }}
                              >
                                Position
                              </th>
                              <th
                                style={{
                                  textAlign: "left",
                                  padding: "4px 6px",
                                  borderBottom: `1px solid ${colors.border}`,
                                }}
                              >
                                Telefon
                              </th>
                              <th
                                style={{
                                  textAlign: "left",
                                  padding: "4px 6px",
                                  borderBottom: `1px solid ${colors.border}`,
                                }}
                              >
                                Mobil
                              </th>
                              <th
                                style={{
                                  textAlign: "left",
                                  padding: "4px 6px",
                                  borderBottom: `1px solid ${colors.border}`,
                                }}
                              >
                                E‑Mail
                              </th>
                              <th
                                style={{
                                  textAlign: "left",
                                  padding: "4px 6px",
                                  borderBottom: `1px solid ${colors.border}`,
                                }}
                              >
                                Aktion
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {kontakte.map((k) => (
                              <tr key={k.id}>
                                <td
                                  style={{
                                    padding: "4px 6px",
                                    borderBottom: `1px solid ${colors.border}`,
                                  }}
                                >
                                  {k.nameAp || "—"}
                                </td>
                                <td
                                  style={{
                                    padding: "4px 6px",
                                    borderBottom: `1px solid ${colors.border}`,
                                  }}
                                >
                                  {k.apPosition || "—"}
                                </td>
                                <td
                                  style={{
                                    padding: "4px 6px",
                                    borderBottom: `1px solid ${colors.border}`,
                                  }}
                                >
                                  {k.telefonnummerAp ||
                                    k.telefonHaustechnik ||
                                    "—"}
                                </td>
                                <td
                                  style={{
                                    padding: "4px 6px",
                                    borderBottom: `1px solid ${colors.border}`,
                                  }}
                                >
                                  {k.apMobilnummer || k.telefonSecurity || "—"}
                                </td>
                                <td
                                  style={{
                                    padding: "4px 6px",
                                    borderBottom: `1px solid ${colors.border}`,
                                  }}
                                >
                                  {k.eMailAp || k.eMailSecurity || "—"}
                                </td>
                                <td
                                  style={{
                                    padding: "4px 6px",
                                    borderBottom: `1px solid ${colors.border}`,
                                  }}
                                >
                                  <button
                                    onClick={() =>
                                      navigate(
                                        `/kontakte?kontaktId=${encodeURIComponent(
                                          k.id
                                        )}`
                                      )
                                    }
                                    style={{
                                      padding: "4px 10px",
                                      borderRadius: 999,
                                      border: "none",
                                      background: colors.primary,
                                      color: "#fff",
                                      fontSize: 12,
                                      fontWeight: 500,
                                      cursor: "pointer",
                                    }}
                                  >
                                    Zu Kontakt
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                  </>
                )}
              </div>
            </Card>

            {/* Checkheft / Wartungen */}
            <Card title="Checkheft / Wartungen">
              <div
                style={{
                  border: `1px solid ${colors.border}`,
                  borderRadius: 12,
                  padding: 12,
                }}
              >
                {wartungLoading && (
                  <p style={{ fontSize: 14, margin: 0 }}>
                    Wartungsdaten werden geladen...
                  </p>
                )}
                {wartungError && (
                  <p
                    style={{
                      color: colors.danger,
                      fontSize: 14,
                      margin: 0,
                    }}
                  >
                    Fehler beim Laden der Wartungsdaten: {wartungError}
                  </p>
                )}
                {!wartungLoading && !wartungError && (
                  <>
                    <WartungsAmpel
                      wochenWartungen={wochenWartungen}
                      wartungsProtokolle={wartungsProtokolle}
                    />

                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 24,
                        marginTop: 12,
                      }}
                    >
                      <div style={{ minWidth: 260, flex: 1 }}>
                        <h4 style={{ marginTop: 0 }}>
                          Kurzfristig (Wochenwartung)
                        </h4>
                        {wochenWartungen.length === 0 ? (
                          <p style={{ margin: 0, fontSize: 13 }}>
                            Keine Wochenwartungen gefunden.
                          </p>
                        ) : (
                          <table
                            style={{
                              width: "100%",
                              borderCollapse: "collapse",
                              fontSize: 13,
                            }}
                          >
                            <thead>
                              <tr style={{ background: colors.tableHeader }}>
                                <th
                                  style={{
                                    textAlign: "left",
                                    padding: "4px 6px",
                                    borderBottom: `1px solid ${colors.border}`,
                                  }}
                                >
                                  Woche
                                </th>
                                <th
                                  style={{
                                    textAlign: "left",
                                    padding: "4px 6px",
                                    borderBottom: `1px solid ${colors.border}`,
                                  }}
                                >
                                  Status
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {wochenWartungen
                                .slice()
                                .sort((a, b) =>
                                  (a.woche || "").localeCompare(
                                    b.woche || ""
                                  )
                                )
                                .map((w) => (
                                  <tr key={w.id}>
                                    <td
                                      style={{
                                        padding: "4px 6px",
                                        borderBottom: `1px solid ${colors.border}`,
                                      }}
                                    >
                                      {w.woche || "—"}
                                    </td>
                                    <td
                                      style={{
                                        padding: "4px 6px",
                                        borderBottom: `1px solid ${colors.border}`,
                                      }}
                                    >
                                      {w.status || "—"}
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        )}
                      </div>

                      <div style={{ minWidth: 260, flex: 1 }}>
                        <h4 style={{ marginTop: 0 }}>
                          Langfristig (Wartungsprotokolle)
                        </h4>
                        {wartungsProtokolle.length === 0 ? (
                          <p style={{ margin: 0, fontSize: 13 }}>
                            Keine Wartungsprotokolle vorhanden.
                          </p>
                        ) : (
                          <table
                            style={{
                              width: "100%",
                              borderCollapse: "collapse",
                              fontSize: 13,
                            }}
                          >
                            <thead>
                              <tr style={{ background: colors.tableHeader }}>
                                <th
                                  style={{
                                    textAlign: "left",
                                    padding: "4px 6px",
                                    borderBottom: `1px solid ${colors.border}`,
                                  }}
                                >
                                  Durchführung
                                </th>
                                <th
                                  style={{
                                    textAlign: "left",
                                    padding: "4px 6px",
                                    borderBottom: `1px solid ${colors.border}`,
                                  }}
                                >
                                  Bezeichnung
                                </th>
                                <th
                                  style={{
                                    textAlign: "left",
                                    padding: "4px 6px",
                                    borderBottom: `1px solid ${colors.border}`,
                                  }}
                                >
                                  Nächste Fälligkeit
                                </th>
                                <th
                                  style={{
                                    textAlign: "left",
                                    padding: "4px 6px",
                                    borderBottom: `1px solid ${colors.border}`,
                                  }}
                                >
                                  Name
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {wartungsProtokolle
                                .slice()
                                .sort((a, b) =>
                                  (a.datumDerDurchfuhrung || "").localeCompare(
                                    b.datumDerDurchfuhrung || ""
                                  )
                                )
                                .map((p) => (
                                  <tr key={p.id}>
                                    <td
                                      style={{
                                        padding: "4px 6px",
                                        borderBottom: `1px solid ${colors.border}`,
                                      }}
                                    >
                                      {p.datumDerDurchfuhrung || "—"}
                                    </td>
                                    <td
                                      style={{
                                        padding: "4px 6px",
                                        borderBottom: `1px solid ${colors.border}`,
                                      }}
                                    >
                                      {p.bezeichnung || "—"}
                                    </td>
                                    <td
                                      style={{
                                        padding: "4px 6px",
                                        borderBottom: `1px solid ${colors.border}`,
                                      }}
                                    >
                                      {p.nachsteFalligkeit || "—"}
                                    </td>
                                    <td
                                      style={{
                                        padding: "4px 6px",
                                        borderBottom: `1px solid ${colors.border}`,
                                      }}
                                    >
                                      {p.name || "—"}
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

function Card({ title, children }) {
  return (
    <section
      style={{
        background: colors.card,
        borderRadius: 16,
        border: `1px solid ${colors.border}`,
        boxShadow: "0 10px 30px rgba(15,23,42,0.06)",
        padding: 16,
      }}
    >
      <h3
        style={{
          marginTop: 0,
          marginBottom: 10,
          fontSize: 15,
          fontWeight: 600,
        }}
      >
        {title}
      </h3>
      {children}
    </section>
  );
}

function FieldOrInfo({ editMode, label, field, formData, setFormData }) {
  const value = formData[field];
  if (!editMode) {
    return (
      <div style={{ minWidth: 200, marginBottom: 8 }}>
        <div style={{ fontSize: 12, color: colors.textMuted }}>{label}</div>
        <div style={{ fontSize: 14 }}>{value || "—"}</div>
      </div>
    );
  }
  return (
    <div style={{ minWidth: 200, marginBottom: 8 }}>
      <div style={{ fontSize: 12, color: colors.textMuted }}>{label}</div>
      <input
        style={{
          fontSize: 14,
          padding: "4px 6px",
          width: "100%",
          boxSizing: "border-box",
          borderRadius: 8,
          border: `1px solid ${colors.border}`,
          outline: "none",
        }}
        value={value || ""}
        onChange={(e) =>
          setFormData((prev) => ({
            ...prev,
            [field]: e.target.value,
          }))
        }
      />
    </div>
  );
}

// WartungsAmpel & Hilfsfunktionen bleiben wie gehabt
function berechneWartungsAmpel(wochenWartungen, wartungsProtokolle) {
  let kurzfristOk = true;
  let langfristOk = true;

  wochenWartungen.forEach((w) => {
    if (w.status && String(w.status).toLowerCase() === "offen") {
      kurzfristOk = false;
    }
  });

  const heute = new Date();
  wartungsProtokolle.forEach((p) => {
    if (!p.nachsteFalligkeit) return;
    const parts = String(p.nachsteFalligkeit).split(".");
    if (parts.length === 3) {
      const [tag, monat, jahr] = parts;
      const yearNumber =
        jahr.length === 2 ? 2000 + Number(jahr) : Number(jahr);
      const date = new Date(yearNumber, Number(monat) - 1, Number(tag));
      if (!isNaN(date.getTime()) && date < heute) {
        langfristOk = false;
      }
    }
  });

  if (kurzfristOk && langfristOk) return "ok";
  if (!kurzfristOk && !langfristOk) return "beides_offen";
  if (!kurzfristOk) return "kurzfristig_offen";
  if (!langfristOk) return "langfristig_offen";
  return "unbekannt";
}

function ampelTextUndFarbe(status) {
  switch (status) {
    case "ok":
      return {
        text: "Alle Pflichtwartungen aktuell erfüllt",
        bg: "#e8f5e9",
        fg: "#2e7d32",
      };
    case "kurzfristig_offen":
      return {
        text: "Kurzfristige Wartungen (Wochenwartung) offen",
        bg: "#fff3e0",
        fg: "#ef6c00",
      };
    case "langfristig_offen":
      return {
        text: "Langfristige Wartungen fällig oder überfällig",
        bg: "#fff3e0",
        fg: "#ef6c00",
      };
    case "beides_offen":
      return {
        text: "Kurz- und langfristige Wartungen offen/fällig",
        bg: "#ffebee",
        fg: "#c62828",
      };
    default:
      return {
        text: "Wartungsstatus unbekannt",
        bg: "#eeeeee",
        fg: "#424242",
      };
  }
}

function WartungsAmpel({ wochenWartungen, wartungsProtokolle }) {
  const status = berechneWartungsAmpel(wochenWartungen, wartungsProtokolle);
  const { text, bg, fg } = ampelTextUndFarbe(status);

  return (
    <div
      style={{
        padding: "8px 12px",
        borderRadius: 6,
        background: bg,
        color: fg,
        fontSize: 14,
        fontWeight: 500,
        marginBottom: 8,
      }}
    >
      {text}
    </div>
  );
}

export default AppAutomaten;
