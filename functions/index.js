// functions/index.js

const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

/* =========================================================
   Bestehende Logik – UNVERÄNDERT
   ========================================================= */

async function getBestand(automatCode) {
  const snap = await db
    .collection("Automatenbestand")
    .where("automatCode", "==", automatCode)
    .limit(1)
    .get();

  if (snap.empty) return null;
  return snap.docs[0].data();
}

async function getAutomatMirror(automatCode) {
  const snap = await db
    .collection("automaten")
    .where("automatCode", "==", automatCode)
    .limit(1)
    .get();

  if (snap.empty) return null;
  return snap.docs[0].data();
}

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

/* =========================================================
   sync + enrich – UNVERÄNDERT
   ========================================================= */

exports.syncAutomatenFromReinigungsdienst = onDocumentWritten(
  {
    region: "europe-west3",
    document: "reinigungsdienst_automaten/{docId}",
  },
  async () => {}
);

exports.enrichWochenWartungLocation = onDocumentWritten(
  {
    region: "europe-west3",
    document: "wochenWartung/{id}",
  },
  async (event) => {
    const after = event.data?.after?.data();
    if (!after) return;

    const automatCode = after.automatCode?.toString().trim();
    if (!automatCode) return;

    if (after.stadt && after.center) return;

    const loc = await deriveLocationFromAutomatCode(automatCode);
    if (!loc.stadt && !loc.center) return;

    const patch = {};
    if (!after.stadt && loc.stadt) patch.stadt = loc.stadt;
    if (!after.center && loc.center) patch.center = loc.center;
    if (loc.standortId) patch.standortId = loc.standortId;

    patch.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    await event.data.after.ref.set(patch, { merge: true });
  }
);

/* =========================================================
   ✅ EINFACHE PIN-PRÜFUNG (FINAL)
   ========================================================= */

exports.verifyPin = onCall(
  {
    region: "europe-west3",
    enforceAppCheck: false,
  },
  async (request) => {
    const pin = String(request.data?.pin || "").trim();
    if (!pin) {
      throw new HttpsError("invalid-argument", "PIN fehlt");
    }

    const snap = await db
      .collection("pins")
      .where("pin", "==", pin)
      .limit(1)
      .get();

    if (snap.empty) {
      throw new HttpsError("permission-denied", "PIN ungültig");
    }

    const pinDoc = snap.docs[0].data();

    return {
      ok: true,
      name: pinDoc.name || "",
      staedte: Array.isArray(pinDoc.staedte)
        ? pinDoc.staedte
        : pinDoc.stadt
        ? [pinDoc.stadt]
        : [],
    };
  }
);
