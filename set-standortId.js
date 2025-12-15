// set-standortId.js
// Einmal-Skript: setzt standortId in Automatenbestand anhand von centername + standort

import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocs,
  updateDoc,
  doc,
} from "firebase/firestore";

// HIER dieselbe Config wie in src/firebase.js verwenden!
const firebaseConfig = {
  apiKey: "AIzaSyBo-pt3krDP9c5AxojmWaHVqPkoqmupOvA",
  authDomain: "digitales-bordbuch.firebaseapp.com",
  projectId: "digitales-bordbuch",
  storageBucket: "digitales-bordbuch.appspot.com",
  messagingSenderId: "612073997080",
  appId: "1:612073997080:web:762a85694716da8f84546d",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  console.log("Lade Standorte...");
  const standorteSnap = await getDocs(collection(db, "Standorte"));

  // Map: key = centername + '|' + standort  ->  value = standortId
  const standortMap = {};
  standorteSnap.forEach((d) => {
    const data = d.data();
    const key =
      (data.centername || "").trim().toLowerCase() +
      "|" +
      (data.standort || "").trim().toLowerCase();
    if (!key.includes("|")) return;
    standortMap[key] = d.id;
  });

  console.log("Anzahl Standorte:", Object.keys(standortMap).length);

  console.log("Lade Automaten...");
  const automatenSnap = await getDocs(collection(db, "Automatenbestand"));

  let matched = 0;
  let unmatched = 0;

  for (const docSnap of automatenSnap.docs) {
    const data = docSnap.data();

    // Wenn schon eine standortId vorhanden ist, überspringen
    if (data.standortId) {
      continue;
    }

    const key =
      (data.centername || "").trim().toLowerCase() +
      "|" +
      (data.standort || "").trim().toLowerCase();

    const foundId = standortMap[key];

    if (foundId) {
      await updateDoc(doc(db, "Automatenbestand", docSnap.id), {
        standortId: foundId,
      });
      matched++;
      console.log(
        `OK: ${data.maschinenCode || docSnap.id} -> standortId = ${foundId}`
      );
    } else {
      unmatched++;
      console.log(
        `KEIN MATCH: ${data.maschinenCode || docSnap.id} (${data.centername} / ${data.standort})`
      );
    }
  }

  console.log("Fertig.");
  console.log("Automaten aktualisiert:", matched);
  console.log("Ohne passenden Standort:", unmatched);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
