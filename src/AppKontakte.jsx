// AppKontakte.jsx

import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  addDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import { useNavigate, useSearchParams } from "react-router-dom";

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

function AppKontakte() {
  const [kontakte, setKontakte] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selected, setSelected] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const [standorte, setStandorte] = useState([]);
  const [standorteLoading, setStandorteLoading] = useState(true);

  const [automaten, setAutomaten] = useState([]);
  const [automatenLoading, setAutomatenLoading] = useState(true);

  const [search, setSearch] = useState("");

  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Standorte laden
  useEffect(() => {
    async function loadStandorte() {
      try {
        setStandorteLoading(true);
        const snap = await getDocs(collection(db, "Standorte"));
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setStandorte(items);
      } catch (err) {
        console.error("Standorte für Kontakte laden:", err);
      } finally {
        setStandorteLoading(false);
      }
    }
    loadStandorte();
  }, []);

  // Automaten laden
  useEffect(() => {
    async function loadAutomaten() {
      try {
        setAutomatenLoading(true);
        const snap = await getDocs(collection(db, "Automatenbestand"));
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setAutomaten(items);
      } catch (err) {
        console.error("Automatenbestand laden:", err);
      } finally {
        setAutomatenLoading(false);
      }
    }
    loadAutomaten();
  }, []);

  // Kontakte laden + kontaktId aus URL berücksichtigen
  useEffect(() => {
    async function loadKontakte() {
      try {
        setLoading(true);
        const snap = await getDocs(collection(db, "Kontakte"));
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setKontakte(items);

        const paramId = searchParams.get("kontaktId");
        let initial =
          (paramId && items.find((k) => k.id === paramId)) || items[0] || null;

        if (initial) {
          setSelected(initial);
          setFormData(initial);
        } else {
          setSelected(null);
          setFormData({});
        }
      } catch (err) {
        console.error("Kontakte laden:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadKontakte();
  }, [searchParams]);

  async function handleSave() {
    if (!formData.nameAp || !formData.nameAp.trim()) {
      setSaveError("Name darf nicht leer sein.");
      return;
    }

    try {
      setSaving(true);
      setSaveError(null);

      if (!selected || !selected.id) {
        const { id, ...rest } = formData;
        const ref = await addDoc(collection(db, "Kontakte"), rest);
        const neu = { id: ref.id, ...rest };
        setKontakte((prev) => [neu, ...prev]);
        setSelected(neu);
        setFormData(neu);
        setSearchParams({ kontaktId: neu.id });
      } else {
        const ref = doc(db, "Kontakte", selected.id);
        const { id, ...rest } = formData;
        await updateDoc(ref, rest);
        const updated = kontakte.map((k) =>
          k.id === selected.id ? { ...k, ...rest } : k
        );
        setKontakte(updated);
        const merged = { ...selected, ...rest };
        setSelected(merged);
        setFormData(merged);
      }

      setEditMode(false);
    } catch (err) {
      console.error("Kontakt speichern fehlgeschlagen:", err);
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleNewKontakt() {
    setSaveError(null);

    const basis = {
      id: null,
      nameAp: "",
      apPosition: "",
      telefonnummerAp: "",
      apMobilnummer: "",
      eMailAp: "",
      assistentName: "",
      assistentTelefon: "",
      assistentEmail: "",
      standortId: null,
      centername: "",
      standort: "",
      nameHaustechnik: "",
      telefonHaustechnik: "",
      nameSecurity: "",
      telefonSecurity: "",
      eMailSecurity: "",
    };

    setSelected(basis);
    setFormData(basis);
    setEditMode(true);
    setSearchParams({});
  }

  const filteredKontakte = kontakte.filter((k) => {
    if (!search.trim()) return true;
    const needle = search.toLowerCase();
    return (
      (k.nameAp || "").toLowerCase().includes(needle) ||
      (k.centername || "").toLowerCase().includes(needle) ||
      (k.standort || "").toLowerCase().includes(needle)
    );
  });

  function getAutomatenForKontakt(kontakt) {
    if (!kontakt?.standortId) return [];
    return automaten.filter((a) => a.standortId === kontakt.standortId);
  }

  if (loading) {
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
        Kontakte werden geladen...
      </div>
    );
  }

  if (error) {
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
          Fehler beim Laden der Kontakte: {error}
        </div>
      </div>
    );
  }

  const automatenSelected = getAutomatenForKontakt(selected);

  return (
    <div
      style={{
        height: "100%", // wichtig für Layout unter festem Header
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
      {/* linke Spalte: Kontaktliste */}
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
                Kontakte
              </h1>
              <span
                style={{
                  fontSize: 12,
                  color: colors.textMuted,
                }}
              >
                {kontakte.length} Einträge
              </span>
            </div>
          </div>
          <input
            placeholder="Suche nach Name, Center oder Standort"
            style={{
              width: "100%",
              padding: "6px 10px",
              boxSizing: "border-box",
              fontSize: 13,
              borderRadius: 999,
              border: `1px solid ${colors.border}`,
              outline: "none",
            }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
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
                  Name
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
                  Position
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
                  Center / Standort
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
                  Automaten
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredKontakte.map((k) => {
                const isActive = selected && selected.id === k.id;
                const autos = getAutomatenForKontakt(k);
                return (
                  <tr
                    key={k.id || "neu"}
                    onClick={() => {
                      setSelected(k);
                      setFormData(k);
                      setEditMode(false);
                      setSaveError(null);
                      if (k.id) {
                        setSearchParams({ kontaktId: k.id });
                      } else {
                        setSearchParams({});
                      }
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
                      {k.nameAp || "—"}
                    </td>
                    <td
                      style={{
                        padding: "6px 12px",
                        borderBottom: `1px solid ${colors.border}`,
                      }}
                    >
                      {k.apPosition || "—"}
                    </td>
                    <td
                      style={{
                        padding: "6px 12px",
                        borderBottom: `1px solid ${colors.border}`,
                      }}
                    >
                      {(k.centername || "—") + " · " + (k.standort || "—")}
                    </td>
                    <td
                      style={{
                        padding: "6px 12px",
                        borderBottom: `1px solid ${colors.border}`,
                      }}
                    >
                      {automatenLoading
                        ? "…"
                        : autos.length === 0
                        ? "Kein Automat"
                        : autos.length === 1
                        ? autos[0].maschinenCode || "1 Automat"
                        : `${autos.length} Automaten`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* rechte Spalte: Kontakt-Details */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {!selected ? (
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
            Bitte links einen Kontakt auswählen.
          </div>
        ) : (
          <>
            {/* Kopfbereich mit Buttons */}
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
                  {selected.nameAp || "Neuer Kontakt"}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: colors.textMuted,
                  }}
                >
                  {selected.apPosition || "Ohne Position"}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={handleNewKontakt}
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
                  Neuer Kontakt
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
                        setFormData(selected);
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

            {/* Automaten + Standort nebeneinander */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 1fr)",
                gap: 16,
                marginTop: 4,
              }}
            >
              {/* Automaten an diesem Standort */}
              <Card title="Automaten an diesem Standort">
                {automatenLoading ? (
                  <p style={{ fontSize: 14, color: colors.textMuted }}>
                    Automaten werden geladen…
                  </p>
                ) : automatenSelected.length === 0 ? (
                  <p style={{ fontSize: 14 }}>
                    Kein Automat an diesem Standort.
                  </p>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                    }}
                  >
                    {automatenSelected.map((a) => (
                      <div
                        key={a.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "6px 8px",
                          borderRadius: 8,
                          border: `1px solid ${colors.border}`,
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontSize: 14,
                              fontWeight: 500,
                            }}
                          >
                            {a.maschinenCode || "Automat ohne Code"}
                          </div>
                          <div
                            style={{
                              fontSize: 12,
                              color: colors.textMuted,
                            }}
                          >
                            {a.standort || ""}
                          </div>
                        </div>
                        <button
                          onClick={() => navigate(`/automaten/${a.id}`)}
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
                          Zum Automaten
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* Standort‑Zuordnung */}
              <Card title="Standort‑Zuordnung">
                {editMode ? (
                  <>
                    <div
                      style={{
                        marginBottom: 8,
                        border: `1px solid ${colors.border}`,
                        borderRadius: 12,
                        padding: 12,
                      }}
                    >
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
                        <option value="">– Kein Standort –</option>
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
                      automatisch gesetzt.
                    </p>
                  </>
                ) : (
                  <div
                    style={{
                      border: `1px solid ${colors.border}`,
                      borderRadius: 12,
                      padding: 12,
                      fontSize: 14,
                    }}
                  >
                    {selected.standortId
                      ? `${selected.centername || "—"} · ${
                          selected.standort || "—"
                        }`
                      : "Keinem Standort zugeordnet"}
                  </div>
                )}
              </Card>
            </div>

            {/* Stammdaten */}
            <Card title="Stammdaten">
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
                  label="Name"
                  field="nameAp"
                  formData={formData}
                  setFormData={setFormData}
                />
                <FieldOrInfo
                  editMode={editMode}
                  label="Position"
                  field="apPosition"
                  formData={formData}
                  setFormData={setFormData}
                />
                <FieldOrInfo
                  editMode={editMode}
                  label="Telefon"
                  field="telefonnummerAp"
                  formData={formData}
                  setFormData={setFormData}
                />
                <FieldOrInfo
                  editMode={editMode}
                  label="Mobil"
                  field="apMobilnummer"
                  formData={formData}
                  setFormData={setFormData}
                />
                <FieldOrInfo
                  editMode={editMode}
                  label="E‑Mail"
                  field="eMailAp"
                  formData={formData}
                  setFormData={setFormData}
                />
              </div>
            </Card>

            {/* Assistenz */}
            <Card title="Assistenz">
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
                  label="Assistent Name"
                  field="assistentName"
                  formData={formData}
                  setFormData={setFormData}
                />
                <FieldOrInfo
                  editMode={editMode}
                  label="Tel Assistent"
                  field="assistentTelefon"
                  formData={formData}
                  setFormData={setFormData}
                />
                <FieldOrInfo
                  editMode={editMode}
                  label="E‑Mail Assistent"
                  field="assistentEmail"
                  formData={formData}
                  setFormData={setFormData}
                />
              </div>
            </Card>

            {/* Haustechnik / Security */}
            <Card title="Haustechnik & Security">
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
                  label="Name Haustechnik"
                  field="nameHaustechnik"
                  formData={formData}
                  setFormData={setFormData}
                />
                <FieldOrInfo
                  editMode={editMode}
                  label="Telefon Haustechnik"
                  field="telefonHaustechnik"
                  formData={formData}
                  setFormData={setFormData}
                />
                <FieldOrInfo
                  editMode={editMode}
                  label="Name Security"
                  field="nameSecurity"
                  formData={formData}
                  setFormData={setFormData}
                />
                <FieldOrInfo
                  editMode={editMode}
                  label="Telefon Security"
                  field="telefonSecurity"
                  formData={formData}
                  setFormData={setFormData}
                />
                <FieldOrInfo
                  editMode={editMode}
                  label="E‑Mail Security"
                  field="eMailSecurity"
                  formData={formData}
                  setFormData={setFormData}
                />
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

export default AppKontakte;
