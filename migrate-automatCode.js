// migrate-automatCode.js
const admin = require("firebase-admin");
const path = require("path");

// 1. Service Account laden
const serviceAccount = require(path.join(__dirname, "serviceAccountKey.json"));

// 2. Firebase Admin initialisieren
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  // Optional, aber gut:
  // databaseURL: "https://DEIN_PROJECT_ID.firebaseio
