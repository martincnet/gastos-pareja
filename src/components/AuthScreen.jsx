import { useId, useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { auth, db } from "../firebase";
import { GRADIENT_ACCENT, FONT } from "../theme";
import { useTema, useEstilos } from "../themeContext";
import LogoMarca from "./LogoMarca";

export default function AuthScreen() {
  const T = useTema();
  const { inputStyle, labelStyle } = useEstilos();
  const [modo, setModo] = useState("login");
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verPassword, setVerPassword] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [resetEnviado, setResetEnviado] = useState(false);
  const nombreId = useId();
  const emailId = useId();
  const passwordId = useId();
  const errorId = useId();

  const traducirError = (code) => {
    switch (code) {
      case "auth/email-already-in-use": return "Ese email ya está registrado";
      case "auth/invalid-email":        return "El email no es válido";
      case "auth/weak-password":        return "La contraseña debe tener al menos 6 caracteres";
      case "auth/invalid-credential":   return "Email o contraseña incorrectos";
      default: return "Ocurrió un error, intentá de nuevo";
    }
  };

  const handleSubmit = async (event) => {
    event?.preventDefault();
    setError("");
    if (!email.trim() || !password.trim()) return setError("Completá todos los campos");
    if (modo === "registro" && !nombre.trim()) return setError("Poné tu nombre");
    setCargando(true);
    try {
      if (modo === "registro") {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await setDoc(doc(db, "usuarios", cred.user.uid), {
          nombre: nombre.trim(),
          email: email.trim().toLowerCase(),
          uid: cred.user.uid,
          creadoEn: Date.now(),
        });
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (e) {
      setError(traducirError(e.code));
    }
    setCargando(false);
  };

  return (
    <div style={{ minHeight: "100dvh", background: T.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "calc(24px + env(safe-area-inset-top)) 20px calc(24px + env(safe-area-inset-bottom))", fontFamily: FONT, color: T.text }}>
      <div style={{ position: "fixed", top: -100, right: -100, width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,100,130,0.07), transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "fixed", bottom: -80, left: -80, width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(120,100,255,0.05), transparent 70%)", pointerEvents: "none" }} />

      <div style={{ textAlign: "center", marginBottom: 36 }}>
        <LogoMarca size="grande" />
      </div>

      <form onSubmit={handleSubmit} style={{ width: "100%", maxWidth: 390, background: T.surface, borderRadius: 24, padding: "28px 24px", border: `1px solid ${T.border}`, boxShadow: "0 10px 34px rgba(61,40,22,0.08)" }}>
        <div style={{ display: "flex", background: T.surface2, borderRadius: 12, padding: 4, marginBottom: 24 }}>
          {["login", "registro"].map(m => (
            <button key={m} type="button" aria-pressed={modo === m} onClick={() => { setModo(m); setError(""); }} style={{
              flex: 1, padding: "11px", borderRadius: 10, border: "none",
              background: modo === m ? T.surface : "transparent",
              color: modo === m ? T.accent : T.text2,
              cursor: "pointer", fontSize: 15, fontWeight: modo === m ? "bold" : "normal",
              fontFamily: FONT,
              boxShadow: modo === m ? "0 1px 6px rgba(0,0,0,0.08)" : "none",
            }}>{m === "login" ? "Ingresar" : "Registrarse"}</button>
          ))}
        </div>

        {modo === "registro" && (
          <>
            <label htmlFor={nombreId} style={labelStyle}>Tu nombre</label>
            <input id={nombreId} placeholder="Ej: Martín" value={nombre} onChange={e => setNombre(e.target.value)} style={inputStyle} autoComplete="name" />
          </>
        )}

        <label htmlFor={emailId} style={labelStyle}>Email</label>
        <input id={emailId} placeholder="tu@email.com" type="email" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} autoCapitalize="none" autoComplete="email" aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} />

        <label htmlFor={passwordId} style={labelStyle}>Contraseña</label>
        <div style={{ position: "relative", marginBottom: error ? 8 : 20 }}>
          <input id={passwordId} placeholder={modo === "registro" ? "Mínimo 6 caracteres" : "Tu contraseña"} type={verPassword ? "text" : "password"}
            value={password} onChange={e => setPassword(e.target.value)}
            style={{ ...inputStyle, marginBottom: 0, paddingRight: 48 }}
            autoComplete={modo === "registro" ? "new-password" : "current-password"}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : undefined}
          />
          <button type="button" aria-label={verPassword ? "Ocultar contraseña" : "Mostrar contraseña"} aria-pressed={verPassword} onClick={() => setVerPassword(v => !v)} style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: T.text3, cursor: "pointer", fontSize: 17, padding: 0, lineHeight: 1, minWidth: 32, minHeight: 32 }}>
            {verPassword ? "🙈" : "👁"}
          </button>
        </div>

        {error && <div id={errorId} role="alert" aria-live="assertive" style={{ color: T.neg, fontSize: 13, marginBottom: 16, textAlign: "center" }}>{error}</div>}

        {modo === "login" && (
          <div style={{ textAlign: "right", marginBottom: 16, marginTop: error ? 0 : -12 }}>
            {resetEnviado ? (
              <span style={{ fontSize: 13, color: T.ok }}>Te mandamos el email de recuperación</span>
            ) : (
              <button type="button" onClick={async () => {
                if (!email.trim()) return setError("Primero escribí tu email");
                setError("");
                try {
                  await sendPasswordResetEmail(auth, email.trim());
                  setResetEnviado(true);
                } catch {
                  setError("No encontramos ese email");
                }
              }} style={{ background: "none", border: "none", color: T.text3, fontSize: 13, cursor: "pointer", padding: 0, fontFamily: FONT }}>
                ¿Olvidaste tu contraseña?
              </button>
            )}
          </div>
        )}

        <button type="submit" disabled={cargando} style={{
          width: "100%", padding: "17px", borderRadius: 18, border: "none",
          background: cargando ? "rgba(255,77,109,0.35)" : GRADIENT_ACCENT,
          color: "#fff", fontSize: 16, fontWeight: "bold", cursor: cargando ? "not-allowed" : "pointer",
          fontFamily: FONT,
          boxShadow: cargando ? "none" : "0 12px 28px rgba(255,77,109,0.24)",
        }}>{cargando ? "Cargando..." : modo === "login" ? "Ingresar" : "Crear cuenta"}</button>
      </form>
    </div>
  );
}
