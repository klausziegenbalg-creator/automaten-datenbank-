// AppStandorte.jsx
import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  addDoc,
} from "firebase/firestore";
import { db, storage } from "./firebase";
import { useNavigate } from "react-router-dom";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";

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

function AppStandorte() {
  const [standorte, setStandorte] = useState([]);
  const [automaten, setAutomaten] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selected, setSelected] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const [neuesDokumentFile, setNeuesDokumentFile] = useState(null);
  const [neuesDokumentName, setNeuesDokumentName] = useState("");

  const [searchTerm, setSearchTerm] = useState("");

  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);

        const [standorteSnap, automatenSnap] = await Promise.all([
          getDocs(collection(db, "Standorte")),
          getDocs(collection(db, "Automatenbestand")),
        ]);

        const standorteItems = standorteSnap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            ...data,
            dokumente: Array.isArray(data.dokumente) ? data.dokumente : [],
          };
        });

        const automatenItems = automatenSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        setStandorte(standorteItems);
        setAutomaten(automatenItems);

        if (standorteItems.length > 0) {
          setSelected(standorteItems[0]);
          setFormData(standorteItems[0]);
        }
      } catch (err) {
        console.error("Daten laden:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  async function uploadFileAndGetURL(file, path) {
    if (!file) return null;
    const fileRef = ref(storage, path);
    const snapshot = await uploadBytes(fileRef, file);
    const url = await getDownloadURL(snapshot.ref);
    return url;
  }

  async function handleSave() {
    if (!selected) return;

    try {
      setSaving(true);
      setSaveError(null);

      const refDoc = doc(db, "Standorte", selected.id);
      const { id, ...rest } = formData;

      const aktuelleDokumente = Array.isArray(formData.dokumente)
        ? formData.dokumente
        : [];

      let neueDokumenteListe = [...aktuelleDokumente];

      if (neuesDokumentFile && neuesDokumentName.trim()) {
        const url = await uploadFileAndGetURL(
          neuesDokumentFile,
          `standorte/${selected.id}/dokumente/${Date.now()}_${
            neuesDokumentFile.name
          }`
        );
        if (url) {
          neueDokumenteListe = [
            ...aktuelleDokumente,
            {
              name: neuesDokumentName.trim(),
              url,
            },
          ];
        }
      }

      rest.dokumente = neueDokumenteListe;

      await updateDoc(refDoc, rest);

      const updated = standorte.map((s) =>
        s.id === selected.id ? { ...s, ...rest } : s
      );
      setStandorte(updated);
      setSelected((prev) => (prev ? { ...prev, ...rest } : prev));
      setFormData((prev) => ({ ...prev, ...rest }));
      setEditMode(false);
      setNeuesDokumentFile(null);
      setNeuesDokumentName("");
    } catch (err) {
      console.error("Standort speichern fehlgeschlagen:", err);
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteDokument(index, dok) {
    if (!selected) return;

    const ok = window.confirm(
      `Möchtest du das Dokument "${dok.name || ""}" wirklich löschen?`
    );
    if (!ok) return;

    try {
      setSaving(true);
      setSaveError(null);

      if (dok.url) {
        const fileRef = ref(storage, dok.url);
        await deleteObject(fileRef);
      }

      const aktuelle = Array.isArray(selected.dokumente)
        ? selected.dokumente
        : [];
      const neueListe = aktuelle.filter((_, i) => i !== index);

      const refDoc = doc(db, "Standorte", selected.id);
      await updateDoc(refDoc, { dokumente: neueListe });

      setSelected((prev) => (prev ? { ...prev, dokumente: neueListe } : prev));
      setFormData((prev) => ({ ...prev, dokumente: neueListe }));
      setStandorte((prev) =>
        prev.map((s) =>
          s.id === selected.id ? { ...s, dokumente: neueListe } : s
        )
      );
    } catch (err) {
      console.error("Dokument löschen fehlgeschlagen:", err);
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleNewStandort() {
    try {
      setSaving(true);
      setSaveError(null);

      const basis = {
        centername: "",
        standort: "",
        adresse: "",
        miethohe: "",
        nebenkosten: "",
        gesamtmiete: "",
        umsatzmiete: "",
        prozenteUmsatzmiete: "",
        vetragsbeginn: "",
        vertragsende: "",
        bemerkungen: "",
        dokumente: [],
      };

      const refDoc = await addDoc(collection(db, "Standorte"), basis);
      const neu = { id: refDoc.id, ...basis };

      setStandorte((prev) => [neu, ...prev]);
      setSelected(neu);
      setFormData(neu);
      setEditMode(true);
      setNeuesDokumentFile(null);
      setNeuesDokumentName("");
    } catch (err) {
      console.error("Neuen Standort anlegen fehlgeschlagen:", err);
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
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
        Lade Standorte...
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
          Fehler beim Laden der Daten: {error}
        </div>
      </div>
    );
  }

  const automatenAmStandort =
    selected && selected.id
      ? automaten.filter((a) => a.standortId === selected.id)
      : [];

  const dokumenteAmStandort =
    selected && Array.isArray(selected.dokumente)
      ? selected.dokumente
      : [];

  const gefilterteStandorte = standorte.filter((s) => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return true;
    const text =
      (s.centername || "") +
      " " +
      (s.standort || "") +
      " " +
      (s.adresse || "") +
      " " +
      (s.bemerkungen || "");
    return text.toLowerCase().includes(q);
  });

  return (
    <div
      style={{
        height: "100%",
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
      {/* linke Spalte: Standortliste */}
      <div
        style={{
          width: "40%",
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
                Standorte
              </h1>
              <span
                style={{
                  fontSize: 12,
                  color: colors.textMuted,
                }}
              >
                {standorte.length} Standorte
              </span>
            </div>
          </div>

          <input
            type="text"
            placeholder="Suche nach Center, Ort, Adresse..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              marginTop: 8,
              padding: "6px 10px",
              borderRadius: 999,
              border: `1px solid ${colors.border}`,
              fontSize: 13,
            }}
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
                  Center
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
                  Ort
                </th>
                <th
                  style={{
                    textAlign: "right",
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
              {gefilterteStandorte.map((s) => {
                const isActive = selected && selected.id === s.id;
                const count = automaten.filter(
                  (a) => a.standortId === s.id
                ).length;
                return (
                  <tr
                    key={s.id}
                    onClick={() => {
                      setSelected(s);
                      setFormData(s);
                      setEditMode(false);
                      setSaveError(null);
                      setNeuesDokumentFile(null);
                      setNeuesDokumentName("");
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
                      {s.centername}
                    </td>
                    <td
                      style={{
                        padding: "6px 12px",
                        borderBottom: `1px solid ${colors.border}`,
                      }}
                    >
                      {s.standort}
                    </td>
                    <td
                      style={{
                        padding: "6px 12px",
                        borderBottom: `1px solid ${colors.border}`,
                        textAlign: "right",
                      }}
                    >
                      {count}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {gefilterteStandorte.length === 0 && (
            <p
              style={{
                fontSize: 12,
                color: colors.textMuted,
                padding: "8px 12px",
              }}
            >
              Keine Standorte passend zur Suche.
            </p>
          )}
        </div>
      </div>

      {/* rechte Spalte */}
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
            Bitte links einen Standort auswählen.
          </div>
        ) : (
          <>
            {/* Kopf */}
            <div
              style={{
                background: colors.card,
                borderRadius: 16,
                border: `1px solid ${colors.border}`,
                boxShadow: "0 10px 30px rgba(15,23,42,0.08)",
                padding: 16,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: 18 }}>
                  {selected.centername} · {selected.standort}
                </h2>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  style={{
                    padding: "6px 14px",
                    borderRadius: 999,
                    border: "none",
                    background: "#2e7d32",
                    color: "#fff",
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: "pointer",
                  }}
                  onClick={handleNewStandort}
                  disabled={saving}
                >
                  Neuer Standort
                </button>
                <button
                  style={{
                    padding: "6px 14px",
                    borderRadius: 999,
                    border: "none",
                    background: colors.primary,
                    color: "#fff",
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: "pointer",
                  }}
                  onClick={() => navigate("/kontakte")}
                >
                  Kontakt für Standort anlegen
                </button>
                {!editMode ? (
                  <button
                    onClick={() => setEditMode(true)}
                    style={{
                      padding: "6px 14px",
                      borderRadius: 999,
                      border: `1px solid ${colors.border}`,
                      background: "#ffffff",
                      color: colors.textMain,
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
                        setNeuesDokumentFile(null);
                        setNeuesDokumentName("");
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
                Fehler beim Speichern: {saveError}
              </div>
            )}

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
                  label="Centername"
                  field="centername"
                  formData={formData}
                  setFormData={setFormData}
                />
                <FieldOrInfo
                  editMode={editMode}
                  label="Standort"
                  field="standort"
                  formData={formData}
                  setFormData={setFormData}
                />
                <FieldOrInfo
                  editMode={editMode}
                  label="Adresse"
                  field="adresse"
                  formData={formData}
                  setFormData={setFormData}
                />
              </div>
            </Card>

            {/* Miete / Vertrag + Dokumente */}
            <Card title="Miete / Vertrag">
              <div
                style={{
                  border: `1px solid ${colors.border}`,
                  borderRadius: 12,
                  padding: 12,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 16,
                  }}
                >
                  <FieldOrInfo
                    editMode={editMode}
                    label="Miete"
                    field="miethohe"
                    formData={formData}
                    setFormData={setFormData}
                  />
                  <FieldOrInfo
                    editMode={editMode}
                    label="Nebenkosten"
                    field="nebenkosten"
                    formData={formData}
                    setFormData={setFormData}
                  />
                  <FieldOrInfo
                    editMode={editMode}
                    label="Gesamtmiete"
                    field="gesamtmiete"
                    formData={formData}
                    setFormData={setFormData}
                  />
                  <FieldOrInfo
                    editMode={editMode}
                    label="Umsatzmiete"
                    field="umsatzmiete"
                    formData={formData}
                    setFormData={setFormData}
                  />
                  <FieldOrInfo
                    editMode={editMode}
                    label="% Umsatzmiete"
                    field="prozenteUmsatzmiete"
                    formData={formData}
                    setFormData={setFormData}
                  />
                  <FieldOrInfo
                    editMode={editMode}
                    label="Vertragsbeginn"
                    field="vetragsbeginn"
                    formData={formData}
                    setFormData={setFormData}
                  />
                  <FieldOrInfo
                    editMode={editMode}
                    label="Vertragsende"
                    field="vertragsende"
                    formData={formData}
                    setFormData={setFormData}
                  />
                </div>

                {editMode && (
                  <div
                    style={{
                      marginTop: 16,
                      paddingTop: 12,
                      borderTop: `1px solid ${colors.border}`,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        color: colors.textMuted,
                        marginBottom: 4,
                      }}
                    >
                      Neues Dokument hinzufügen
                    </div>
                    <input
                      type="text"
                      placeholder="Dokumentenname (z.B. Mietvertrag 2025)"
                      style={{
                        fontSize: 14,
                        padding: "4px 6px",
                        width: "100%",
                        boxSizing: "border-box",
                        marginBottom: 8,
                      }}
                      value={neuesDokumentName}
                      onChange={(e) => setNeuesDokumentName(e.target.value)}
                    />
                    <input
                      type="file"
                      onChange={(e) =>
                        setNeuesDokumentFile(e.target.files[0] || null)
                      }
                    />
                    <p
                      style={{
                        fontSize: 12,
                        color: colors.textMuted,
                        marginTop: 4,
                      }}
                    >
                      Das Dokument wird beim Speichern hochgeladen und zur Liste
                      hinzugefügt.
                    </p>
                  </div>
                )}

                <div
                  style={{
                    marginTop: 16,
                    paddingTop: 12,
                    borderTop: `1px solid ${colors.border}`,
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      color: colors.textMuted,
                      marginBottom: 4,
                    }}
                  >
                    Vorhandene Dokumente
                  </div>
                  {dokumenteAmStandort.length === 0 ? (
                    <p style={{ margin: 0 }}>Keine Dokumente hinterlegt.</p>
                  ) : (
                    <ul style={{ paddingLeft: 16, margin: 0 }}>
                      {dokumenteAmStandort.map((d, idx) => (
                        <li key={idx} style={{ marginBottom: 4 }}>
                          {d.name || "Ohne Namen"}{" "}
                          {d.url && (
                            <>
                              <a
                                href={d.url}
                                target="_blank"
                                rel="noreferrer"
                                style={{ marginLeft: 8 }}
                              >
                                Öffnen
                              </a>
                              <button
                                style={{ marginLeft: 8 }}
                                onClick={() => handleDeleteDokument(idx, d)}
                              >
                                Löschen
                              </button>
                            </>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </Card>

            {/* Bemerkungen */}
            <Card title="Bemerkungen">
              <div
                style={{
                  border: `1px solid ${colors.border}`,
                  borderRadius: 12,
                  padding: 12,
                }}
              >
                {editMode ? (
                  <textarea
                    style={{
                      width: "100%",
                      minHeight: 80,
                      boxSizing: "border-box",
                      padding: 8,
                      fontFamily: "inherit",
                      fontSize: 14,
                    }}
                    value={formData.bemerkungen || ""}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        bemerkungen: e.target.value,
                      }))
                    }
                  />
                ) : (
                  <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>
                    {selected.bemerkungen || "—"}
                  </p>
                )}
              </div>
            </Card>

            {/* Automaten an diesem Standort */}
            <Card title="Automaten an diesem Standort">
              <div
                style={{
                  border: `1px solid ${colors.border}`,
                  borderRadius: 12,
                  padding: 12,
                }}
              >
                {automatenAmStandort.length === 0 ? (
                  <p style={{ margin: 0 }}>
                    Keine Automaten diesem Standort zugeordnet.
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
                          Maschine
                        </th>
                        <th
                          style={{
                            textAlign: "left",
                            padding: "4px 6px",
                            borderBottom: `1px solid ${colors.border}`,
                          }}
                        >
                          Modell
                        </th>
                        <th
                          style={{
                            textAlign: "left",
                            padding: "4px 6px",
                            borderBottom: `1px solid ${colors.border}`,
                          }}
                        >
                          Seriennummer
                        </th>
                        <th
                          style={{
                            textAlign: "left",
                            padding: "4px 6px",
                            borderBottom: `1px solid ${colors.border}`,
                          }}
                        >
                          Details
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {automatenAmStandort.map((a) => (
                        <tr key={a.id}>
                          <td
                            style={{
                              padding: "4px 6px",
                              borderBottom: `1px solid ${colors.border}`,
                            }}
                          >
                            {a.maschinenCode || "—"}
                          </td>
                          <td
                            style={{
                              padding: "4px 6px",
                              borderBottom: `1px solid ${colors.border}`,
                            }}
                          >
                            {a.model || "—"}
                          </td>
                          <td
                            style={{
                              padding: "4px 6px",
                              borderBottom: `1px solid ${colors.border}`,
                            }}
                          >
                            {a.seriennummer || "—"}
                          </td>
                          <td
                            style={{
                              padding: "4px 6px",
                              borderBottom: `1px solid ${colors.border}`,
                            }}
                          >
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
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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

export default AppStandorte;
