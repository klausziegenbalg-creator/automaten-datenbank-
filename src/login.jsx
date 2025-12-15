// src/Login.jsx
import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "./firebase";

function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      await signInWithEmailAndPassword(auth, email, password);
      if (onLoginSuccess) {
        onLoginSuccess();
      }
    } catch (err) {
      // einfache, aber hilfreiche Fehlermeldung
      switch (err.code) {
        case "auth/invalid-credential":
        case "auth/wrong-password":
          setError("E-Mail oder Passwort ist falsch.");
          break;
        case "auth/user-not-found":
          setError("Es existiert kein Benutzer mit dieser E-Mail.");
          break;
        default:
          setError("Login fehlgeschlagen. Bitte später erneut versuchen.");
      }
    }
  };

  return (
    <div style={{ maxWidth: "400px", margin: "40px auto", padding: "20px", border: "1px solid #ccc", borderRadius: "8px" }}>
      <h2>Verwaltung Login</h2>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: "12px" }}>
          <label htmlFor="email">E-Mail</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: "100%", padding: "8px", boxSizing: "border-box" }}
            required
          />
        </div>

        <div style={{ marginBottom: "12px" }}>
          <label htmlFor="password">Passwort</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: "100%", padding: "8px", boxSizing: "border-box" }}
            required
          />
        </div>

        {error && (
          <div style={{ marginBottom: "12px", color: "red" }}>
            {error}
          </div>
        )}

        <button type="submit" style={{ padding: "8px 16px" }}>
          Anmelden
        </button>
      </form>
    </div>
  );
}

export default Login;
