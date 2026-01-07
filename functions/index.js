// functions/index.js  (Cloud Functions v2)
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");

admin.initializeApp();

// Region wie bei dir im Frontend: firebase.app().functions("europe-west3")
setGlobalOptions({ region: "europe-west3" });

// Session TTL (8 Stunden)
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

function normPin(v) {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function safeArray(v) {
  return Array.isArray(v) ? v.map(x => String(x).trim()).filter(Boolean) : [];
}

exports.verifyPin = onCall(async (request) => {
  // Variante B braucht Auth (anonym reicht), weil Session an UID hängt
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError("unauthenticated", "Auth required (anonymous is fine).");
  }

  const uid = request.auth.uid;
  const pin = normPin(request.data && request.data.pin);

  if (!pin) {
    return { ok: false };
  }

  const db = admin.firestore();
  const pinsRef = db.collection("pins");

  // Wir suchen robust:
  // - Feld "pin" oder "code" oder "PIN"
  // - PIN als String oder als Number gespeichert
  const pinNum = Number(pin);
  const pinNumValid = Number.isFinite(pinNum);

  const queries = [
    pinsRef.where("pin", "==", pin).limit(1),
    pinsRef.where("code", "==", pin).limit(1),
    pinsRef.where("PIN", "==", pin).limit(1),
  ];

  if (pinNumValid) {
    queries.push(pinsRef.where("pin", "==", pinNum).limit(1));
    queries.push(pinsRef.where("code", "==", pinNum).limit(1));
    queries.push(pinsRef.where("PIN", "==", pinNum).limit(1));
  }

  let pinDoc = null;

  for (const q of queries) {
    const snap = await q.get();
    if (!snap.empty) {
      pinDoc = snap.docs[0];
      break;
    }
  }

  // Optional: Wenn du PINs als Doc-ID speicherst (z.B. doc("1234")), dann fallback:
  if (!pinDoc) {
    const byId = await pinsRef.doc(pin).get();
    if (byId.exists) pinDoc = byId;
  }

  if (!pinDoc) {
    return { ok: false };
  }

  const pinData = pinDoc.data() || {};

  // Optionales "active" / "aktiv" Flag: wenn vorhanden und false -> blocken
  if (pinData.active === false || pinData.aktiv === false) {
    return { ok: false };
  }

  // Session schreiben
  const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + SESSION_TTL_MS);

  const session = {
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAt,
    pinId: pinDoc.id,
    name: pinData.name || pinData.mitarbeiter || pinData.user || "",
    stadt: pinData.stadt || "",
    staedte: safeArray(pinData.staedte),
  };

  await db.collection("pinSessions").doc(uid).set(session, { merge: true });

  // Antwort an Frontend: UI bleibt wie bei dir
  return {
    ok: true,
    name: session.name,
    stadt: session.stadt,
    staedte: session.staedte,
  };
});
