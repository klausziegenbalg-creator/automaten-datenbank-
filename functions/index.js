// functions/index.js

const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

/**
 * Quelle der Wahrheit für Center/Stadt:
 * Automatenbestand.automatCode -> (centername, standort)
 */
async function getBestand(automatCode) {
  const snap = await db
    .collection("Automatenbestand")
    .where("automatCode", "==", automatCode)
    .limit(1)
    .get();

  if (snap.empty) return null;
  return snap.docs[0].data();
}

/**
 * Spiegelziel: collection "automaten"
 * Match-Key: automaten.automatCode
 * Felder: automatCode, center, stadt, leitung, currentTeamId
 */
async function upsertAutomatenMirror({ automatCode, leitung, center, stadt, currentTeamId }) {
  const snap = await db
    .collection("automaten")
    .where("automatCode", "==", automatCode)
    .get();

  const payload = {
    automatCode: automatCode,
    center: center ?? "",
    stadt: stadt ?? "",
    leitung: leitung ?? "",
    currentTeamId: currentTeamId ?? null, // ✅ NEU
    // mitarbeiter wird später per zweitem Trigger gespiegelt
    // mitarbeiter: ...
  };

  if (snap.empty) {
    await db.collection("automaten").add(payload);
    return;
  }

  // Falls es mehrere Spiegel-Dokumente gibt (sollte nicht, kann aber vorkommen),
  // updaten wir alle konsistent.
  const batch = db.batch();
  snap.docs.forEach((doc) => batch.set(doc.ref, payload, { merge: true }));
  await batch.commit();
}

/**
 * Regel: pro automatCode max. 1 aktive Zuordnung.
 * Aktiv = validTo == null
 * Beim Aktivieren eines neuen Eintrags schließen wir alle anderen aktiven.
 */
async function closeOtherActives(automatCode, keepId) {
  const snap = await db
    .collection("reinigungsdienst_automaten")
    .where("automatCode", "==", automatCode)
    .where("validTo", "==", null)
    .get();

  if (snap.empty) return;

  const now = admin.firestore.Timestamp.now();
  const batch = db.batch();

  snap.docs.forEach((doc) => {
    if (doc.id === keepId) return;
    batch.update(doc.ref, {
      validTo: now,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  await batch.commit();
}

/**
 * Holt die aktuell aktive Zuordnung (validTo == null).
 * Nach unserer Regel sollte das max. 1 Treffer sein.
 */
async function getActiveAssignment(automatCode) {
  const snap = await db
    .collection("reinigungsdienst_automaten")
    .where("automatCode", "==", automatCode)
    .where("validTo", "==", null)
    .limit(1)
    .get();

  if (snap.empty) return null;

  return snap.docs[0].data();
}

/**
 * ✅ NEU:
 * Setzt currentTeamId im Automatenbestand (alle Docs mit diesem automatCode).
 */
async function updateAutomatenbestandTeam(automatCode, teamId) {
  const snap = await db
    .collection("Automatenbestand")
    .where("automatCode", "==", automatCode)
    .get();

  if (snap.empty) return;

  const batch = db.batch();
  snap.docs.forEach((d) => {
    batch.update(d.ref, {
      currentTeamId: teamId ?? null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });
  await batch.commit();
}

/**
 * ✅ NEU:
 * Setzt currentTeamId in Standorte anhand des Feldes standortId.
 * (Wichtig: Doc-ID in Standorte ist NICHT zwingend standortId, deshalb where().)
 */
async function updateStandorteTeamByStandortId(standortId, teamId) {
  if (!standortId) return;

  const snap = await db
    .collection("Standorte")
    .where("standortId", "==", standortId)
    .get();

  if (snap.empty) return;

  const batch = db.batch();
  snap.docs.forEach((d) => {
    batch.set(
      d.ref,
      {
        currentTeamId: teamId ?? null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });
  await batch.commit();
}

/**
 * Firestore Trigger:
 * - hält Zuordnungen konsistent (nur 1 aktiv pro automatCode)
 * - spiegelt nach "automaten" die Felder: leitung, center, stadt, currentTeamId
 * - setzt currentTeamId in Automatenbestand + Standorte
 *
 * Region: EU (Frankfurt) -> europe-west3
 */
exports.syncAutomatenFromReinigungsdienst = onDocumentWritten(
  {
    region: "europe-west3",
    document: "reinigungsdienst_automaten/{docId}",
  },
  async (event) => {

    const before = event.data?.before?.data() || null;
    const after = event.data?.after?.data() || null;

    // automatCode aus before/after
    const automatCode = after?.automatCode || before?.automatCode;
    if (!automatCode) return;

    // Wenn nachher aktiv (validTo null) => andere aktive schließen
    // Hinweis: validTo muss wirklich "null" sein für aktiv.
    if (after && after.validTo === null) {
      await closeOtherActives(automatCode, event.params.docId);
    }

    // Aktive Zuordnung bestimmen (kann null sein)
    const active = await getActiveAssignment(automatCode);

    // Center/Stadt aus Automatenbestand holen (Quelle der Wahrheit)
    const bestand = await getBestand(automatCode);
    const center = bestand?.centername ?? "";
    const stadt = bestand?.standort ?? "";

    // ✅ NEU: teamId aus aktiver Zuordnung (muss in reinigungsdienst_automaten stehen)
    const teamId = active?.teamId ?? null;

    // leitung aus aktiver Zuordnung oder leer (unzugeordnet)
    const leitung = active?.teamleiter ?? "";

    // Spiegeln nach "automaten"
    await upsertAutomatenMirror({
      automatCode,
      leitung,
      center,
      stadt,
      currentTeamId: teamId,
    });

    // ✅ NEU: Automatenbestand markieren
    await updateAutomatenbestandTeam(automatCode, teamId);

    // ✅ NEU: Standorte markieren (über standortId aus Automatenbestand)
    const standortId = bestand?.standortId ?? null;
    await updateStandorteTeamByStandortId(standortId, teamId);
  }
);

/**
 * PIN-Login (für öffentliche HTML-Seite):
 * - Client meldet sich zuerst anonym an (Firebase Auth).
 * - Client ruft verifyPin({pin}) als Callable Function auf.
 * - Bei Erfolg geben wir ein Custom Token mit Claim { pin_ok: true } zurück.
 * - Client macht signInWithCustomToken(token) und darf dann schreiben (Rules prüfen pin_ok).
 */
exports.verifyPin = onCall({ region: "europe-west3" }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Bitte zuerst (anonym) anmelden.");
  }

  const pinRaw = request.data && request.data.pin != null ? String(request.data.pin) : "";
  const pin = pinRaw.trim();
  if (!pin) {
    throw new HttpsError("invalid-argument", "PIN fehlt.");
  }
  if (pin.length > 20) {
    throw new HttpsError("invalid-argument", "PIN ungültig.");
  }

  const snap = await db
    .collection("pins")
    .where("pin", "==", pin)
    .limit(1)
    .get();

  if (snap.empty) {
    // bewusst generisch
    throw new HttpsError("permission-denied", "PIN falsch.");
  }

  const pinDoc = snap.docs[0].data() || {};
  const name = pinDoc.name != null ? String(pinDoc.name).trim() : "";

  // erlaubte Städte: staedte[] oder stadt
  let cities = [];
  if (Array.isArray(pinDoc.staedte)) {
    cities = pinDoc.staedte.map((c) => String(c).trim()).filter(Boolean);
  } else if (pinDoc.stadt != null) {
    const s = String(pinDoc.stadt).trim();
    if (s) cities = [s];
  }

  // Token für die aktuelle uid ausstellen
  const uid = request.auth.uid;
  const additionalClaims = {
    pin_ok: true,
    pin_name: name,
    pin_cities: cities,
  };

  const token = await admin.auth().createCustomToken(uid, additionalClaims);

  return {
    token,
    user: {
      name,
      staedte: cities,
    },
  };
});
