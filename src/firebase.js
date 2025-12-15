import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
// Analytics kannst du später ergänzen, ist fürs Erste nicht nötig
// import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyBo-pt3krDP9c5AxojmWaHVqPkoqmupOvA",
  authDomain: "digitales-bordbuch.firebaseapp.com",
  projectId: "digitales-bordbuch",
  storageBucket: "digitales-bordbuch.appspot.com",
  messagingSenderId: "612073997080",
  appId: "1:612073997080:web:762a85694716da8f84546d",
  measurementId: "G-VRX8Q8QNDH",
};

const app = initializeApp(firebaseConfig);

// Firestore & Storage holen und exportieren
export const db = getFirestore(app);
export const storage = getStorage(app);
