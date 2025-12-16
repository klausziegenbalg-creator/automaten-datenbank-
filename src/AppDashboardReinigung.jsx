import { useEffect, useState, useMemo, useCallback } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebase';
import { useNavigate } from 'react-router-dom';

const colors = {
  bg: '#f5f7fb',
  card: '#ffffff',
  border: '#e0e4f0',
  primary: '#1976d2',
  primaryDark: '#1565c0',
  textMain: '#1f2933',
  textMuted: '#6b7280',
  danger: '#dc2626',
  success: '#16a34a',
  warning: '#f59e0b',
};

const AUFGABENFELDER = [
  { key: 'zuckeraufgefuellt', label: 'Zucker aufgefüllt' },
  { key: 'wasseraufgefuellt', label: 'Wasser aufgefüllt' },
  { key: 'staebeaufgefuellt', label: 'Stäbe aufgefüllt' },
  { key: 'zuckerfachgereinigt', label: 'Zuckerfach gereinigt' },
  { key: 'faechergereinigt', label: 'Alle Fächer gereinigt' },
  { key: 'abwasserentleert', label: 'Abwasser entleert' },
  { key: 'produktionsraumgereinigt', label: 'Produktionsraum gereinigt' },
  { key: 'messergereinigt', label: 'Messer/Rädchen gereinigt' },
  { key: 'roboterarmgereinigt', label: 'Roboterarm gereinigt' },
  { key: 'siebgereinigt', label: 'Sieb oben gereinigt' },
  { key: 'auffangschalegereinigt', label: 'Auffangschale gereinigt' },
  { key: 'aufbewahrungaufgeraeumt', label: 'Aufbewahrungsfach aufgeräumt' },
  { key: 'automataussengereinigt', label: 'Automat außen gereinigt' },
  { key: 'scheibengereinigt', label: 'Scheiben gereinigt' },
  { key: 'brennerkopfgereinigt', label: 'Brennerkopf gereinigt' },
  { key: 'duesegereinigt', label: 'Düse hinter Brennerkopf gereinigt' },
  { key: 'befehutungstest', label: 'Befeuchtungstest' },
  { key: 'reinigungstest', label: 'Reinigungstest' },
  { key: 'neuerstabgenommen', label: 'neuen Stab genommen' },
  { key: 'roboterarm90grad', label: 'Roboterarm im 90° Winkel' }
];

function ermittleOffeneAufgaben(protokoll) {
  const offen = AUFGABENFELDER
    .filter(a => !protokoll[a.key] && protokoll[a.key] !== undefined && protokoll[a.key] !== null)
    .map(a => a.label);
  return offen.length ? offen.join(', ') : 'Alle erledigt';
}

function getWeekKeyFromDate(date) {
  const d = new Date(date.getTime());
  const year = d.getFullYear();
  const oneJan = new Date(year, 0, 1);
  const dayOfYear = Math.floor((d - oneJan) / 86400000) + 1;
  const week = Math.ceil(dayOfYear / 7);
  return `${year}-W${week.toString().padStart(2, '0')}`;
}

function normalizeCode(raw) {
  if (!raw) return '';
  return raw.replace(/CT-/, 'CT').trim();
}

function AppDashboardReinigung() {
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(false);
  const [datum, setDatum] = useState(new Date().toISOString().split('T')[0]);
  const [stadtFilter, setStadtFilter] = useState('Alle Städte');
  const [centerFilter, setCenterFilter] = useState('Alle Center');
  const [search, setSearch] = useState('');
  
  const [automaten, setAutomaten] = useState([]);
  const [codeToIdMap, setCodeToIdMap] = useState({});
  const [protokolle, setProtokolle] = useState([]);
  const [wartungselementeMap, setWartungselementeMap] = useState({});
  const [wochenMap, setWochenMap] = useState({});
  const [wartungsprotokolle, setWartungsprotokolle] = useState([]);
  const [wartungsAnsicht, setWartungsAnsicht] = useState('tag');
  const [sortierungProtokolle, setSortierungProtokolle] = useState({ feld: 'center', richtung: 1 });

  // **WICHTIG: Automaten IMMER laden** - unabhängig von Filtern
  const ladeAutomaten = useCallback(async () => {
    try {
      const automatenSnap = await getDocs(collection(db, 'Automatenbestand'));
      const alleAutomaten = automatenSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAutomaten(alleAutomaten);

      const map = {};
      alleAutomaten.forEach(a => {
        const raw = a.maschinenCode || a.automatCode || a.Automat;
        const code = normalizeCode(raw);
        if (code) map[code] = a.id;
      });
      setCodeToIdMap(map);
    } catch (err) {
      console.error('Fehler beim Laden der Automaten:', err);
    }
  }, []);

  // **Haupt-Ladefunktion - NUR Protokolle + Wartung**
  const ladeDashboard = useCallback(async () => {
    setLoading(true);
    try {
      // Automaten IMMER separat laden
      await ladeAutomaten();

      // Wartungselemente
      const wartSnap = await getDocs(collection(db, 'Wartungselemente'));
      const wartMap = {};
      wartSnap.forEach(doc => {
        wartMap[doc.id] = doc.data();
      });
      setWartungselementeMap(wartMap);

      // Reinigungsprotokolle MIT Filter
      const [start, end] = getStartEndOfDay(datum);
      const reinigSnap = await getDocs(query(
        collection(db, 'reinigungen'),
        where('datum', '>=', start),
        where('datum', '<', end)
      ));
      let reinigData = reinigSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      if (stadtFilter !== 'Alle Städte') {
        reinigData = reinigData.filter(p => p.stadt === stadtFilter);
      }
      if (centerFilter !== 'Alle Center') {
        reinigData = reinigData.filter(p => p.center === centerFilter);
      }
      setProtokolle(reinigData);

      // Wochenwartung
      await ladeWochenWartung(new Date(datum));

      // Wartungsprotokolle
      const wartungsProtSnap = await getDocs(collection(db, 'Wartungsprotokolle'));
      let wartProt = wartungsProtSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const zielDatumStr = new Date(datum).toLocaleDateString('de-DE');
      wartProt = wartProt.filter(p => p.datumDerDurchfuehrung === zielDatumStr);
      
      if (stadtFilter !== 'Alle Städte') {
        wartProt = wartProt.filter(p => 
          p.standort?.toLowerCase().includes(stadtFilter.toLowerCase())
        );
      }
      setWartungsprotokolle(wartProt);

    } catch (err) {
      alert(`Fehler beim Laden: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [datum, stadtFilter, centerFilter, wartungsAnsicht, ladeAutomaten]);

  function getStartEndOfDay(dateStr) {
    const d = new Date(dateStr);
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
    const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0);
    return [start, end];
  }

  async function ladeWochenWartung(datumObj) {
    const map = {};
    if (wartungsAnsicht === 'tag' || wartungsAnsicht === 'woche') {
      const weekKey = getWeekKeyFromDate(datumObj);
      const snap = await getDocs(query(
        collection(db, 'wochenWartung'),
        where('woche', '==', weekKey)
      ));
      snap.forEach(doc => {
        const d = doc.data();
        map[d.automatCode] = buildWochenInfo(d);
      });
    } else {
      const year = datumObj.getFullYear();
      const month = datumObj.getMonth();
      const startDate = new Date(year, month, 1);
      const endDate = new Date(year, month + 1, 1);
      const snap = await getDocs(query(
        collection(db, 'wochenWartung'),
        where('startedAt', '>=', startDate),
        where('startedAt', '<', endDate)
      ));
      snap.forEach(doc => {
        const d = doc.data();
        map[d.automatCode] = buildWochenInfo(d);
      });
    }
    setWochenMap(map);
  }

  function buildWochenInfo(d) {
    let doneDate = null;
    const tasksRaw = d.tasks;
    const tasks = {};
    Object.entries(tasksRaw).forEach(([id, t]) => {
      const done = !!t.done;
      const doneAt = (t.doneAt && typeof t.doneAt.toDate === 'function') ? t.doneAt.toDate() : null;
      tasks[id] = { done, doneAt };
      if (done && doneAt && !doneDate) doneDate = doneAt;
    });
    if (!doneDate && d.startedAt && typeof d.startedAt.toDate === 'function') {
      doneDate = d.startedAt.toDate();
    }
    return { status: d.status || 'offen', doneDate, tasks };
  }

  // **DROPDOWN OPTIONEN - JETZT mit Debug**
  const staedte = useMemo(() => {
    console.log('Städte berechnet:', automaten.length, 'Automaten');
    const set = new Set();
    automaten.forEach(a => {
      if (a.stadt) set.add(a.stadt);
    });
    const result = Array.from(set).sort();
    console.log('Verfügbare Städte:', result);
    return result;
  }, [automaten]);

  const centerOptions = useMemo(() => {
    const gefilterte = stadtFilter === 'Alle Städte' ? 
      automaten : 
      automaten.filter(a => a.stadt === stadtFilter);
    const set = new Set();
    gefilterte.forEach(a => {
      if (a.center) set.add(a.center);
    });
    const result = Array.from(set).sort();
    console.log(`Center für ${stadtFilter}:`, result);
    return result;
  }, [automaten, stadtFilter]);

  // Rest der useMemos bleibt gleich...
  const protokolleGefiltert = useMemo(() => {
    const feld = sortierungProtokolle.feld;
    const dir = sortierungProtokolle.richtung;
    let liste = [...protokolle];
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      liste = liste.filter(p =>
        p.automatCode?.toLowerCase().includes(s) ||
        p.mitarbeiter?.toLowerCase().includes(s) ||
        p.center?.toLowerCase().includes(s)
      );
    }
    liste.sort((a, b) => {
      let va, vb;
      if (feld === 'center') {
        va = `${a.stadt || ''}${a.center || ''}`;
        vb = `${b.stadt || ''}${b.center || ''}`;
      } else if (feld === 'datum') {
        va = a.datum ? a.datum.toDate() : new Date(0);
        vb = b.datum ? b.datum.toDate() : new Date(0);
      } else {
        va = a[feld] || '';
        vb = b[feld] || '';
      }
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
    return liste;
  }, [protokolle, sortierungProtokolle, search]);

  const totalAutomatenImFilter = useMemo(() => {
    let liste = automaten;
    if (stadtFilter !== 'Alle Städte') liste = liste.filter(a => a.stadt === stadtFilter);
    if (centerFilter !== 'Alle Center') liste = liste.filter(a => a.center === centerFilter);
    return liste.filter(a => (a.maschinenCode || a.automatCode || a.Automat)?.length).length;
  }, [automaten, stadtFilter, centerFilter]);

  const abdeckungProzent = useMemo(() => {
    if (!totalAutomatenImFilter) return 0;
    const uniqueAutomatenMitProtokoll = new Set(protokolle.map(p => normalizeCode(p.automatCode)));
    return Math.round((uniqueAutomatenMitProtokoll.size / totalAutomatenImFilter) * 100);
  }, [protokolle, totalAutomatenImFilter]);

  const fehlendeAutomaten = useMemo(() => {
    const erledigte = new Set(protokolle.map(p => normalizeCode(p.automatCode)));
    let liste = automaten;
    if (stadtFilter !== 'Alle Städte') liste = liste.filter(a => a.stadt === stadtFilter);
    if (centerFilter !== 'Alle Center') liste = liste.filter(a => a.center === centerFilter);
    return liste.filter(a => {
      const code = normalizeCode(a.maschinenCode || a.automatCode || a.Automat);
      return code && !erledigte.has(code);
    });
  }, [automaten, protokolle, stadtFilter, centerFilter]);

  const wartungsSummary = useMemo(() => {
    let erledigt = 0, teilweise = 0, total = 0;
    automaten.forEach(a => {
      const code = normalizeCode(a.maschinenCode || a.automatCode || a.Automat);
      if (!code) return;
      total++;
      const info = wochenMap[code];
      if (!info) return;
      if (info.status === 'erledigt') erledigt++;
      else if (info.status === 'teilweise') teilweise++;
    });
    return { erledigt, teilweise, total };
  }, [automaten, wochenMap]);

  // **useEffect - lädt BEI JEDER Filteränderung**
  useEffect(() => {
    ladeDashboard();
  }, [ladeDashboard]);

  function handleSort(feld) {
    setSortierungProtokolle(prev => {
      if (prev.feld === feld) return { feld, richtung: prev.richtung * -1 };
      return { feld, richtung: 1 };
    });
  }

  function exportCSV() {
    const d = datum;
    let csv = 'Automat,Stadt,Center,Datum,Mitarbeiter,Auffälligkeiten,"Nicht erledigte Aufgaben",Wochenwartung\n';
    protokolleGefiltert.forEach(p => {
      const offen = ermittleOffeneAufgaben(p);
      let wwText = '';
      const normCode = normalizeCode(p.automatCode);
      if (wochenMap[normCode]) {
        const info = wochenMap[normCode];
        if (info.status === 'erledigt') {
          const dt = info.doneDate ? info.doneDate.toLocaleDateString('de-DE') : '';
          wwText = `Erledigt ${dt ? 'am ' + dt : ''}`;
        } else if (info.status === 'teilweise') {
          wwText = 'Teilweise erledigt';
        } else {
          wwText = 'Offen (nicht durchgeführt)';
        }
      }
      csv += `"${p.automatCode || ''}","${p.stadt || ''}","${p.center || ''}",${p.datum ? p.datum.toDate().toLocaleDateString('de-DE') : ''},"${p.mitarbeiter || ''}","${(p.auffälligkeiten || '').replace(/"/g, '""')}","${offen.replace(/"/g, '""')}","${wwText.replace(/"/g, '""')}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `protokolle_${d}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function kpiColor(value) {
    if (value >= 90) return colors.success;
    if (value >= 75) return colors.warning;
    return colors.danger;
  }

  const datumObj = new Date(datum);
  const weekKey = getWeekKeyFromDate(datumObj);
  const monthName = datumObj.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });

  return (
    <div style={{ maxWidth: '1600px', margin: '0 auto', padding: '12px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '16px' }}>
        Dashboard Reinigung & Wartung
      </h1>

      {/* Filter - mit Debug-Info */}
      <div style={{ background: colors.card, borderRadius: '16px', padding: '16px', marginBottom: '16px', boxShadow: '0 2px 8px rgba(15,23,42,0.05)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '140px' }}>
            <label style={{ fontSize: '12px', color: colors.textMuted }}>Datum</label>
            <input type="date" value={datum} onChange={e => setDatum(e.target.value)} 
              style={{ padding: '6px 10px', borderRadius: '8px', border: `1px solid ${colors.border}`, fontSize: '13px' }} 
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '160px' }}>
            <label style={{ fontSize: '12px', color: colors.textMuted }}>Stadt ({staedte.length})</label>
            <select value={stadtFilter} 
              onChange={e => {
                console.log('Stadt geändert zu:', e.target.value);
                setStadtFilter(e.target.value);
                setCenterFilter('Alle Center');
              }} 
              style={{ padding: '6px 10px', borderRadius: '8px', border: `1px solid ${colors.border}`, fontSize: '13px' }}
            >
              <option>Alle Städte</option>
              {staedte.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '180px' }}>
            <label style={{ fontSize: '12px', color: colors.textMuted }}>Center ({centerOptions.length})</label>
            <select value={centerFilter} 
              onChange={e => {
                console.log('Center geändert zu:', e.target.value);
                setCenterFilter(e.target.value);
              }} 
              style={{ padding: '6px 10px', borderRadius: '8px', border: `1px solid ${colors.border}`, fontSize: '13px' }}
            >
              <option>Alle Center</option>
              {centerOptions.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '220px' }}>
            <label style={{ fontSize: '12px', color: colors.textMuted }}>Suche</label>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} 
              placeholder="z.B. CT-0307, Alaa, Herold..." 
              style={{ padding: '6px 10px', borderRadius: '8px', border: `1px solid ${colors.border}`, fontSize: '13px' }} 
            />
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
            <button onClick={ladeDashboard} disabled={loading}
              style={{ padding: '8px 14px', borderRadius: '999px', border: 'none', background: colors.primary, color: '#fff', fontSize: '13px', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? 'Lade...' : 'Aktualisieren'}
            </button>
            <button onClick={exportCSV} style={{ padding: '8px 14px', borderRadius: '999px', border: `1px solid ${colors.border}`, background: '#fff', fontSize: '13px', cursor: 'pointer' }}>
              CSV Export
            </button>
          </div>
        </div>
        {/* DEBUG INFO */}
        {process.env.NODE_ENV === 'development' && (
          <div style={{ marginTop: '8px', fontSize: '11px', color: colors.textMuted }}>
            Debug: {automaten.length} Automaten, {protokolle.length} Protokolle | Stadt: {stadtFilter}, Center: {centerFilter}
          </div>
        )}
      </div>

      {/* REST DES CODES bleibt IDENTISCH - KPI, Tabellen etc. */}
      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', fontSize: '16px' }}>Lade Daten...</div>
      ) : (
        // Hier kommen alle KPI-Karten, Tabellen etc. - identisch wie vorher
        <div>{/* ... gesamter Rest bleibt gleich ... */}</div>
      )}
    </div>
  );
}

export default AppDashboardReinigung;


