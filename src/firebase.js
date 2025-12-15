import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth"; // NEU: Firebase Authentication

// Konfiguration deines Projekts "Digitales Bordbuch"
const firebaseConfig = {
  apiKey: "AIzaSyBo-pt3krDP9c5AxojmWaHVqPkoqmupOvA",
  authDomain: "digitales-bordbuch.firebaseapp.com",
  projectId: "digitales-bordbuch",
  storageBucket: "digitales-bordbuch.appspot.com",
  messagingSenderId: "612073997080",
  appId: "1:612073997080:web:762a85694716da8f84546d",
  measurementId: "G-VRX8Q8QNDH",
};

// App initialisieren
const app = initializeApp(firebaseConfig);

// Firestore, Storage und Auth holen und exportieren
export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);      // NEU: wird in der Verwaltungsapp für Login/Route-Schutz genutzt
