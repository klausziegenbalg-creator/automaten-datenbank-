// functions/index.js

const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

/**
 * Quelle der Wahrheit für Center/Stadt:
 * Automatenbestand.automatCode -> (centername, standort, standortId)
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
 * Fallback: Spiegel "automaten" (wird via syncAutomatenFromReinigungsdienst gepflegt)
 */
async function getAutomatMirror(automatCode) {
  const snap = await db
    .collection("automaten")
    .where("automatCode", "==", automatCode)
    .limit(1)
    .get();

  if (snap.empty) return null;
  return snap.docs[0].data();
}

/**
 * Zentrale Ableitung: stadt/center/standortId aus automatCode holen
 */
async function deriveLocationFromAutomatCode(automatCode) {
  if (!automatCode) return { stadt: "", center: "", standortId: null };

  const bestand = await getBestand(automatCode);
  if (bestand) {
    return {
      stadt: bestand.standort ?? "",
      center: bestand.centername ?? "",
      standortId: bestand.standortId ?? null,
    };
  }

  const mirror = await getAutomatMirror(automatCode);
  if (mirror) {
    return {
      stadt: mirror.stadt ?? "",
      center: mirror.center ?? "",
      standortId: mirror.standortId ?? null,
    };
  }

  return { stadt: "", center: "", standortId: null };
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
    currentTeamId: currentTeamId ?? null,
  };

  if (snap.empty) {
    await db.collection("automaten").add(payload);
    return;
  }

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
 * Setzt currentTeamId in Standorte anhand des Feldes standortId.
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

exports.syncAutomatenFromReinigungsdienst = onDocumentWritten(
  {
    region: "europe-west3",
    document: "reinigungsdienst_automaten/{docId}",
  },
  async (event) => {
    const before = event.data?.before?.data() || null;
    const after = event.data?.after?.data() || null;

    const automatCode = after?.automatCode || before?.automatCode;
    if (!automatCode) return;

    if (after && after.validTo === null) {
      await closeOtherActives(automatCode, event.params.docId);
    }

    const active = await getActiveAssignment(automatCode);

    const bestand = await getBestand(automatCode);
    const center = bestand?.centername ?? "";
    const stadt = bestand?.standort ?? "";

    const teamId = active?.teamId ?? null;
    const leitung = active?.teamleiter ?? "";

    await upsertAutomatenMirror({
      automatCode,
      leitung,
      center,
      stadt,
      currentTeamId: teamId,
    });

    await updateAutomatenbestandTeam(automatCode, teamId);

    const standortId = bestand?.standortId ?? null;
    await updateStandorteTeamByStandortId(standortId, teamId);
  }
);

/**
 * ✅ NEU: wochenWartung automatisch mit stadt/center anreichern.
 * Hintergrund: Teamleiter dürfen nur ihre Stadt lesen -> Queries brauchen ein stadt-Feld.
 * Guard: Wir schreiben nur, wenn stadt/center fehlen oder leer sind.
 */
exports.enrichWochenWartungLocation = onDocumentWritten(
  {
    region: "europe-west3",
    document: "wochenWartung/{id}",
  },
  async (event) => {
    const after = event.data?.after?.data() || null;
    if (!after) return; // gelöscht

    const automatCode = after.automatCode ? String(after.automatCode).trim() : "";
    if (!automatCode) return;

    const stadtMissing = !after.stadt || String(after.stadt).trim() === "";
    const centerMissing = !after.center || String(after.center).trim() === "";

    if (!stadtMissing && !centerMissing) return; // nichts zu tun

    const loc = await deriveLocationFromAutomatCode(automatCode);

    // Wenn wir nichts ableiten können, nicht schreiben (sonst Endlosschleife ohne Nutzen)
    if ((!loc.stadt || loc.stadt.trim() === "") && (!loc.center || loc.center.trim() === "")) return;

    const patch = {};
    if (stadtMissing && loc.stadt) patch.stadt = loc.stadt;
    if (centerMissing && loc.center) patch.center = loc.center;
    if (loc.standortId) patch.standortId = loc.standortId;

    patch.updatedAt = admin.firestore.FieldValue.serverTimestamp();

    await event.data.after.ref.set(patch, { merge: true });
  }
);

/**
 * PIN-Login (robust):
 * - verifyPin funktioniert auch dann, wenn request.auth mal nicht mitkommt.
 * - Wir erstellen dann selbst eine uid "pin_<PIN>" (deterministisch).
 * - Token enthält weiterhin Claim { pin_ok: true }.
 */
exports.verifyPin = onCall({ region: "europe-west3" }, async (request) => {
  const pinRaw = request.data && request.data.pin != null ? String(request.data.pin) : "";
  const pin = pinRaw.trim();
  if (!pin) throw new HttpsError("invalid-argument", "PIN fehlt.");
  if (pin.length > 20) throw new HttpsError("invalid-argument", "PIN ungültig.");

  const snap = await db
    .collection("pins")
    .where("pin", "==", pin)
    .limit(1)
    .get();

  if (snap.empty) {
    throw new HttpsError("permission-denied", "PIN falsch.");
  }

  const pinDoc = snap.docs[0].data() || {};
  const name = pinDoc.name != null ? String(pinDoc.name).trim() : "";

  let cities = [];
  if (Array.isArray(pinDoc.staedte)) {
    cities = pinDoc.staedte.map((c) => String(c).trim()).filter(Boolean);
  } else if (pinDoc.stadt != null) {
    const s = String(pinDoc.stadt).trim();
    if (s) cities = [s];
  }

  // ✅ UID: wenn Auth vorhanden -> nutze die uid, sonst deterministisch aus PIN
  const uid = (request.auth && request.auth.uid) ? request.auth.uid : `pin_${pin}`;

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
