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
                  new Set(
                    protokolle.map((p) => normalizeCode(p.automatCode) || "")
                  ).size
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
                Wartung (aktuelle{" "}
                {wartungsAnsicht === "monat" ? "Monat" : "Woche"})
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

          {/* Hauptbereich */}
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
                      const normCode = normalizeCode(p.automatCode);
                      let wwText = "–";
                      if (wochenMap && normCode && wochenMap[normCode]) {
                        const info = wochenMap[normCode];
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
                              onClick={() => {
                                const id = codeToIdMap[normCode];
                                if (id) {
                                  navigate(`/automaten/${id}`);
                                } else {
                                  alert(
                                    `Kein Automat mit Code ${p.automatCode} im Automatenbestand gefunden.`
                                  );
                                }
                              }}
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
                          {a.maschinenCode || a.automatCode || a.Automat}
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
                      const code = normalizeCode(
                        a.maschinenCode || a.automatCode || a.Automat
                      );
                      if (!code) return null;
                      const info = wochenMap[code];
                      const zeitraumText =
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
                          <td style={{ padding: "6px 8px" }}>
                            {a.maschinenCode || a.automatCode || a.Automat}
                          </td>
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
                    {wartungsprotokolle.map((w) => {
                      const normCode = normalizeCode(w.automatCode);
                      return (
                        <tr key={w.id}>
                          <td style={{ padding: "6px 8px" }}>
                            {w.automatCode}
                          </td>
                          <td style={{ padding: "6px 8px" }}>{w.standort}</td>
                          <td style={{ padding: "6px 8px" }}>{w.bezeichnung}</td>
                          <td style={{ padding: "6px 8px" }}>{w.name}</td>
                          <td style={{ padding: "6px 8px" }}>
                            {w.nachsteFaelligkeit || "–"}
                          </td>
                          <td style={{ padding: "6px 8px" }}>
                            <button
                              type="button"
                              onClick={() => {
                                const id = codeToIdMap[normCode];
                                if (id) {
                                  navigate(`/automaten/${id}`);
                                } else {
                                  alert(
                                    `Kein Automat mit Code ${w.automatCode} im Automatenbestand gefunden.`
                                  );
                                }
                              }}
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







