import { useState, useEffect, useMemo } from "react";
import { initializeApp } from "firebase/app";
import {
  getFirestore, collection, addDoc, deleteDoc,
  doc, onSnapshot, query, orderBy, writeBatch,
  getDocs, where, setDoc, getDoc, updateDoc
} from "firebase/firestore";
import {
  getAuth, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, signOut, onAuthStateChanged
} from "firebase/auth";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyBbN60YgAm7HHcdIO2az43g2PhZsUS2CNA",
  authDomain: "gastos-pareja-a2a0b.firebaseapp.com",
  projectId: "gastos-pareja-a2a0b",
  storageBucket: "gastos-pareja-a2a0b.firebasestorage.app",
  messagingSenderId: "1081231883778",
  appId: "1:1081231883778:web:395365a07c41d562c0311b"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const messaging = getMessaging(app);

const VAPID_KEY = "BBEG-L5NZm9-CY3Newy1v1sh_NkxLHMYQYbpoQweSPLoDols4kNNh2eVlS498TQoXKs7EmiiU_B8L7RiHPdIaag";

async function registrarTokenFCM(uid) {
  try {
    if (!("Notification" in window)) return;
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;
    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
    if (token) {
      await setDoc(doc(db, "fcmTokens", uid), { token, uid, updatedAt: Date.now() }, { merge: true });
    }
  } catch (e) {
    console.warn("No se pudo registrar el token FCM:", e);
  }
}

const CATEGORIAS = [
  { id: "comida",     label: "Comida",      emoji: "🍕" },
  { id: "super",      label: "Super",       emoji: "🛒" },
  { id: "salidas",    label: "Salidas",     emoji: "🎬" },
  { id: "transporte", label: "Transporte",  emoji: "🚌" },
  { id: "casa",       label: "Casa",        emoji: "🏠" },
  { id: "salud",      label: "Salud",       emoji: "💊" },
  { id: "ropa",       label: "Ropa",        emoji: "👗" },
  { id: "viajes",     label: "Viajes",      emoji: "✈️" },
  { id: "otro",       label: "Otro",        emoji: "📦" },
];

const COLORES_GRUPO = [
  "linear-gradient(135deg, #ff758c, #ff4d6d)",
  "linear-gradient(135deg, #667eea, #764ba2)",
  "linear-gradient(135deg, #2ec4b6, #1a8a84)",
  "linear-gradient(135deg, #f7971e, #ffd200)",
  "linear-gradient(135deg, #56ab2f, #a8e063)",
  "linear-gradient(135deg, #ee0979, #ff6a00)",
];

const MODOS = [
  { id: "pague_yo_total",  label: "Pagué yo, me deben el total", emoji: "💸", desc: "El otro te debe todo" },
  { id: "pague_yo_mitad",  label: "Pagué yo, me deben la mitad", emoji: "✂️", desc: "Se divide al 50%" },
  { id: "pago_otro_total", label: "Pagó el otro, le debo el total", emoji: "🙏", desc: "Le debés todo al otro" },
  { id: "pago_otro_mitad", label: "Pagó el otro, le debo la mitad", emoji: "💝", desc: "Se divide al 50%" },
];

const CAT_COLORES = {
  comida:     "#FF6B6B",
  super:      "#4FC3A1",
  salidas:    "#5B9BD5",
  transporte: "#F0A500",
  casa:       "#9B59B6",
  salud:      "#2ECC71",
  ropa:       "#E05C5C",
  viajes:     "#3498DB",
  otro:       "#A0A0B0",
};

// ─── Design tokens ───────────────────────────────────────────────────────────
const T = {
  bg:      "#F7F5F2",
  surface: "#FFFFFF",
  surface2:"#F2EFE9",
  border:  "#E8E4DF",
  text:    "#1A1825",
  text2:   "#7A7A8A",
  text3:   "#B0AABB",
  accent:  "#FF4D6D",
  accent2: "#FF758C",
};

const inputStyle = {
  width: "100%", padding: "14px", borderRadius: 13,
  background: T.surface2, border: `1px solid ${T.border}`,
  color: T.text, fontSize: 16, marginBottom: 16, boxSizing: "border-box",
  fontFamily: "'Georgia', serif",
};

const labelStyle = {
  display: "block", fontSize: 11, letterSpacing: 2,
  textTransform: "uppercase", color: T.text2, marginBottom: 8,
};

// ─── Pure helpers ─────────────────────────────────────────────────────────────
function formatMonto(n) {
  return n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function calcularBalance(gastos, miUid) {
  let balance = 0;
  for (const g of gastos) {
    const yoCargue = g.cargadoPor === miUid;
    if (yoCargue) {
      if (g.modo === "pague_yo_total")  balance += g.monto;
      else if (g.modo === "pague_yo_mitad")  balance += g.monto / 2;
      else if (g.modo === "pago_otro_total") balance -= g.monto;
      else if (g.modo === "pago_otro_mitad") balance -= g.monto / 2;
    } else {
      if (g.modo === "pague_yo_total")  balance -= g.monto;
      else if (g.modo === "pague_yo_mitad")  balance -= g.monto / 2;
      else if (g.modo === "pago_otro_total") balance += g.monto;
      else if (g.modo === "pago_otro_mitad") balance += g.monto / 2;
    }
  }
  return balance;
}

function getEtiqueta(g, miUid, nombreOtro) {
  const yoCargue = g.cargadoPor === miUid;
  const modo = g.modo;
  if (yoCargue) {
    if (modo === "pague_yo_total")  return { label: `${nombreOtro} te debe el total`, emoji: "💸" };
    if (modo === "pague_yo_mitad")  return { label: `${nombreOtro} te debe la mitad`, emoji: "✂️" };
    if (modo === "pago_otro_total") return { label: `Le debés el total a ${nombreOtro}`, emoji: "🙏" };
    if (modo === "pago_otro_mitad") return { label: `Le debés la mitad a ${nombreOtro}`, emoji: "💝" };
  } else {
    if (modo === "pague_yo_total")  return { label: `Le debés el total a ${nombreOtro}`, emoji: "🙏" };
    if (modo === "pague_yo_mitad")  return { label: `Le debés la mitad a ${nombreOtro}`, emoji: "💝" };
    if (modo === "pago_otro_total") return { label: `${nombreOtro} te debe el total`, emoji: "💸" };
    if (modo === "pago_otro_mitad") return { label: `${nombreOtro} te debe la mitad`, emoji: "✂️" };
  }
  return { label: "", emoji: "" };
}

function getMontoYSigno(g, miUid) {
  const yoCargue = g.cargadoPor === miUid;
  const esMitad = g.modo.includes("mitad");
  const monto = esMitad ? g.monto / 2 : g.monto;
  let meDebenAMi;
  if (yoCargue) {
    meDebenAMi = g.modo === "pague_yo_total" || g.modo === "pague_yo_mitad";
  } else {
    meDebenAMi = g.modo === "pago_otro_total" || g.modo === "pago_otro_mitad";
  }
  return { monto, signo: meDebenAMi ? "+" : "-", color: meDebenAMi ? "#E84070" : "#7C6AF6" };
}

// ─── Logo ─────────────────────────────────────────────────────────────────────
function LogoMarca({ size = "normal" }) {
  const grande = size === "grande";
  const s = grande ? 48 : 32;
  const rad = grande ? 14 : 10;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: grande ? 10 : 7, marginBottom: grande ? 8 : 0 }}>
      <div style={{
        width: s, height: s, borderRadius: rad,
        background: "linear-gradient(135deg, #ff758c, #ff4d6d)",
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 4px 14px rgba(255,77,109,0.25)", flexShrink: 0,
      }}>
        <svg width={grande ? 24 : 16} height={grande ? 24 : 16} viewBox="0 0 24 24" fill="none">
          <line x1="4" y1="12" x2="20" y2="12" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
          <circle cx="12" cy="5.5" r="2.5" fill="white"/>
          <circle cx="12" cy="18.5" r="2.5" fill="white"/>
        </svg>
      </div>
      <div>
        <div style={{ fontSize: grande ? 26 : 18, fontWeight: "bold", color: T.text, letterSpacing: -0.5, lineHeight: 1 }}>
          SplitEasy
        </div>
        {grande && <div style={{ fontSize: 13, color: T.text2, marginTop: 3 }}>Dividí gastos sin drama</div>}
      </div>
    </div>
  );
}

// ─── Pie chart (donut) ────────────────────────────────────────────────────────
function TortaGastos({ gastos }) {
  const totales = {};
  for (const g of gastos) {
    totales[g.categoria] = (totales[g.categoria] || 0) + g.monto;
  }
  const total = Object.values(totales).reduce((a, b) => a + b, 0);
  if (!total) return null;

  const slices = Object.entries(totales)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, val]) => ({
      cat, val, pct: val / total,
      color: CAT_COLORES[cat] || "#A0A0B0",
      label: CATEGORIAS.find(c => c.id === cat)?.label || cat,
      emoji: CATEGORIAS.find(c => c.id === cat)?.emoji || "📦",
    }));

  const cx = 70, cy = 70, r = 55, ri = 33;
  let angle = -Math.PI / 2;
  const GAP = slices.length > 1 ? 0.03 : 0;

  const arcs = slices.map(s => {
    const sweep = s.pct * Math.PI * 2 - GAP;
    const a0 = angle + GAP / 2;
    const a1 = a0 + sweep;
    angle += s.pct * Math.PI * 2;
    if (sweep <= 0) return { ...s, path: "" };
    const cos0o = Math.cos(a0), sin0o = Math.sin(a0);
    const cos1o = Math.cos(a1), sin1o = Math.sin(a1);
    const x1o = cx + r * cos0o,  y1o = cy + r * sin0o;
    const x2o = cx + r * cos1o,  y2o = cy + r * sin1o;
    const x1i = cx + ri * cos0o, y1i = cy + ri * sin0o;
    const x2i = cx + ri * cos1o, y2i = cy + ri * sin1o;
    const large = sweep > Math.PI ? 1 : 0;
    return {
      ...s,
      path: `M ${x1i} ${y1i} L ${x1o} ${y1o} A ${r} ${r} 0 ${large} 1 ${x2o} ${y2o} L ${x2i} ${y2i} A ${ri} ${ri} 0 ${large} 0 ${x1i} ${y1i} Z`,
    };
  });

  return (
    <div style={{ background: T.surface, borderRadius: 18, padding: "20px", marginBottom: 20, border: `1px solid ${T.border}`, boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
      <div style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: T.text2, marginBottom: 16 }}>Gastos por categoría</div>
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <svg width="140" height="140" viewBox="0 0 140 140" style={{ flexShrink: 0 }}>
          {arcs.map((s, i) => s.path && <path key={i} d={s.path} fill={s.color} />)}
          <text x={cx} y={cy - 5}  textAnchor="middle" fontSize="10" fill={T.text2}>Total</text>
          <text x={cx} y={cy + 11} textAnchor="middle" fontSize="11" fill={T.text} fontWeight="bold">${formatMonto(total)}</text>
        </svg>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
          {arcs.map(s => (
            <div key={s.cat} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: s.color, flexShrink: 0 }} />
              <div style={{ flex: 1, fontSize: 12, color: T.text }}>{s.emoji} {s.label}</div>
              <div style={{ fontSize: 12, fontWeight: "bold", color: T.text }}>{Math.round(s.pct * 100)}%</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Auth screen ──────────────────────────────────────────────────────────────
function AuthScreen() {
  const [modo, setModo] = useState("login");
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verPassword, setVerPassword] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  const traducirError = (code) => {
    switch (code) {
      case "auth/email-already-in-use": return "Ese email ya está registrado";
      case "auth/invalid-email":        return "El email no es válido";
      case "auth/weak-password":        return "La contraseña debe tener al menos 6 caracteres";
      case "auth/invalid-credential":   return "Email o contraseña incorrectos";
      default: return "Ocurrió un error, intentá de nuevo";
    }
  };

  const handleSubmit = async () => {
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
    <div style={{ minHeight: "100dvh", background: T.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 20px", fontFamily: "'Georgia', serif", color: T.text }}>
      <div style={{ position: "fixed", top: -100, right: -100, width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,100,130,0.07), transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "fixed", bottom: -80, left: -80, width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(120,100,255,0.05), transparent 70%)", pointerEvents: "none" }} />

      <div style={{ textAlign: "center", marginBottom: 36 }}>
        <LogoMarca size="grande" />
      </div>

      <div style={{ width: "100%", maxWidth: 380, background: T.surface, borderRadius: 22, padding: "28px 24px", border: `1px solid ${T.border}`, boxShadow: "0 4px 24px rgba(0,0,0,0.07)" }}>
        <div style={{ display: "flex", background: T.surface2, borderRadius: 12, padding: 4, marginBottom: 24 }}>
          {["login", "registro"].map(m => (
            <button key={m} onClick={() => { setModo(m); setError(""); }} style={{
              flex: 1, padding: "11px", borderRadius: 10, border: "none",
              background: modo === m ? T.surface : "transparent",
              color: modo === m ? T.accent : T.text2,
              cursor: "pointer", fontSize: 15, fontWeight: modo === m ? "bold" : "normal",
              fontFamily: "'Georgia', serif",
              boxShadow: modo === m ? "0 1px 6px rgba(0,0,0,0.08)" : "none",
            }}>{m === "login" ? "Ingresar" : "Registrarse"}</button>
          ))}
        </div>

        {modo === "registro" && (
          <>
            <label style={labelStyle}>Tu nombre</label>
            <input placeholder="Ej: Martín" value={nombre} onChange={e => setNombre(e.target.value)} style={inputStyle} />
          </>
        )}

        <label style={labelStyle}>Email</label>
        <input placeholder="tu@email.com" type="email" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} autoCapitalize="none" />

        <label style={labelStyle}>Contraseña</label>
        <div style={{ position: "relative", marginBottom: error ? 8 : 20 }}>
          <input placeholder={modo === "registro" ? "Mínimo 6 caracteres" : "Tu contraseña"} type={verPassword ? "text" : "password"}
            value={password} onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSubmit()}
            style={{ ...inputStyle, marginBottom: 0, paddingRight: 48 }} />
          <button type="button" onClick={() => setVerPassword(v => !v)} style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: T.text3, cursor: "pointer", fontSize: 17, padding: 0, lineHeight: 1 }}>
            {verPassword ? "🙈" : "👁"}
          </button>
        </div>

        {error && <div style={{ color: "#E8375A", fontSize: 13, marginBottom: 16, textAlign: "center" }}>{error}</div>}

        <button onClick={handleSubmit} disabled={cargando} style={{
          width: "100%", padding: "17px", borderRadius: 14, border: "none",
          background: cargando ? "rgba(255,77,109,0.35)" : "linear-gradient(135deg, #ff758c, #ff4d6d)",
          color: "#fff", fontSize: 16, fontWeight: "bold", cursor: cargando ? "not-allowed" : "pointer",
          fontFamily: "'Georgia', serif",
          boxShadow: cargando ? "none" : "0 4px 18px rgba(255,77,109,0.3)",
        }}>{cargando ? "Cargando..." : modo === "login" ? "Ingresar" : "Crear cuenta"}</button>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [usuario, setUsuario] = useState(null);
  const [usuarioData, setUsuarioData] = useState(null);
  const [authListo, setAuthListo] = useState(false);
  const [grupos, setGrupos] = useState([]);
  const [grupoActivo, setGrupoActivo] = useState(null);
  const [gastos, setGastos] = useState([]);
  const [vista, setVista] = useState("grupos");
  const [form, setForm] = useState({ descripcion: "", categoria: "comida", monto: "", modo: "pague_yo_mitad" });
  const [toast, setToast] = useState(null);
  const [filtro, setFiltro] = useState("todos");
  const [guardando, setGuardando] = useState(false);
  const [nuevoGrupoNombre, setNuevoGrupoNombre] = useState("");
  const [nuevoGrupoEmail, setNuevoGrupoEmail] = useState("");
  const [nuevoGrupoNombreOtro, setNuevoGrupoNombreOtro] = useState("");
  const [mostrarFormGrupo, setMostrarFormGrupo] = useState(false);
  const [notifPermiso, setNotifPermiso] = useState(() =>
    "Notification" in window ? Notification.permission : "denied"
  );
  const [modal, setModal] = useState(null);
  const [cargandoGastos, setCargandoGastos] = useState(false);
  const [gastoEditando, setGastoEditando] = useState(null);

  const confirmar = (mensaje, onConfirm) => setModal({ mensaje, onConfirm });
  const cerrarModal = () => setModal(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setUsuario(user);
      if (user) {
        const snap = await getDoc(doc(db, "usuarios", user.uid));
        if (snap.exists()) setUsuarioData(snap.data());
      } else {
        setUsuarioData(null);
      }
      setAuthListo(true);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onMessage(messaging, (payload) => {
      const { title, body } = payload.notification;
      setToast({ msg: `${title}: ${body}`, tipo: "ok" });
      setTimeout(() => setToast(null), 2500);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [vista]);

  useEffect(() => {
    if (!usuario) return;
    const q = query(collection(db, "grupos"), where("miembros", "array-contains", usuario.uid));
    const unsub = onSnapshot(q, (snap) => {
      setGrupos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [usuario]);

  useEffect(() => {
    if (!grupoActivo) return;
    const q = query(collection(db, "gastos"), where("grupoId", "==", grupoActivo.id), orderBy("timestamp", "desc"));
    const unsub = onSnapshot(q,
      (snap) => {
        setGastos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setCargandoGastos(false);
      },
      (error) => {
        console.error("Error al cargar gastos:", error);
        setCargandoGastos(false);
      }
    );
    return () => unsub();
  }, [grupoActivo?.id]);

  const mostrarToast = (msg, tipo = "ok") => {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 2500);
  };

  const resetFormGrupo = () => {
    setNuevoGrupoNombre("");
    setNuevoGrupoEmail("");
    setNuevoGrupoNombreOtro("");
    setMostrarFormGrupo(false);
  };

  const crearGrupo = async () => {
    const nombre = nuevoGrupoNombre.trim();
    const emailOtro = nuevoGrupoEmail.trim().toLowerCase();
    if (!nombre) return mostrarToast("Poné un nombre", "err");
    if (!emailOtro) return mostrarToast("Poné el email de la otra persona", "err");
    if (emailOtro === usuario.email.toLowerCase()) return mostrarToast("No podés invitarte a vos mismo", "err");
    setGuardando(true);
    try {
      const q = query(collection(db, "usuarios"), where("email", "==", emailOtro));
      const snap = await getDocs(q);
      let otroUid = null;
      let otroNombre = emailOtro;
      if (!snap.empty) {
        otroUid = snap.docs[0].data().uid;
        otroNombre = snap.docs[0].data().nombre;
      }
      const colorIdx = grupos.length % COLORES_GRUPO.length;
      const nombreFinal = snap.empty ? (nuevoGrupoNombreOtro.trim() || emailOtro) : otroNombre;
      const miembrosNombres = { [usuario.uid]: usuarioData?.nombre || "" };
      if (otroUid) miembrosNombres[otroUid] = nombreFinal;
      await addDoc(collection(db, "grupos"), {
        nombre,
        color: COLORES_GRUPO[colorIdx],
        creadoEn: Date.now(),
        creadoPor: usuario.uid,
        miembros: otroUid ? [usuario.uid, otroUid] : [usuario.uid],
        emailsInvitados: [usuario.email.toLowerCase(), emailOtro],
        miembrosNombres,
        nombreOtroDefault: nombreFinal,
      });
      resetFormGrupo();
      if (snap.empty) {
        mostrarToast(`Grupo creado (${emailOtro} aún no tiene cuenta)`);
      } else {
        mostrarToast(`Grupo "${nombre}" creado`);
      }
    } catch {
      mostrarToast("Error al crear el grupo", "err");
    }
    setGuardando(false);
  };

  const eliminarGrupo = (grupo) => {
    confirmar(`¿Eliminar el grupo "${grupo.nombre}" y todos sus gastos?`, async () => {
      try {
        const snap = await getDocs(query(collection(db, "gastos"), where("grupoId", "==", grupo.id)));
        const batch = writeBatch(db);
        snap.docs.forEach(d => batch.delete(d.ref));
        batch.delete(doc(db, "grupos", grupo.id));
        await batch.commit();
        mostrarToast("Grupo eliminado");
      } catch {
        mostrarToast("Error al eliminar", "err");
      }
    });
  };

  const agregarGasto = async () => {
    if (!form.descripcion.trim()) return mostrarToast("Poné una descripción", "err");
    if (!form.monto || isNaN(form.monto) || Number(form.monto) <= 0) return mostrarToast("El monto tiene que ser mayor a 0", "err");
    setGuardando(true);
    try {
      const nuevoGastoData = {
        grupoId: grupoActivo.id,
        descripcion: form.descripcion.trim(),
        categoria: form.categoria,
        monto: parseFloat(form.monto),
        modo: form.modo,
        fecha: new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" }),
        hora: new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
        timestamp: Date.now(),
        cargadoPor: usuario.uid,
        cargadoPorNombre: usuarioData?.nombre || "",
      };
      const docRef = await addDoc(collection(db, "gastos"), nuevoGastoData);
      setGastos(prev => [{ id: docRef.id, ...nuevoGastoData }, ...prev]);
      setForm({ descripcion: "", categoria: "comida", monto: "", modo: "pague_yo_mitad" });
      mostrarToast("Gasto cargado");
      setVista("inicio");
    } catch {
      mostrarToast("Error al guardar", "err");
    }
    setGuardando(false);
  };

  const abrirEditar = (g) => {
    setGastoEditando(g);
    setForm({ descripcion: g.descripcion, categoria: g.categoria, monto: String(g.monto), modo: g.modo });
    setVista("editar");
  };

  const editarGastoGuardar = async () => {
    if (!form.descripcion.trim()) return mostrarToast("Poné una descripción", "err");
    if (!form.monto || isNaN(form.monto) || Number(form.monto) <= 0) return mostrarToast("El monto tiene que ser mayor a 0", "err");
    setGuardando(true);
    try {
      await updateDoc(doc(db, "gastos", gastoEditando.id), {
        descripcion: form.descripcion.trim(),
        categoria: form.categoria,
        monto: parseFloat(form.monto),
        modo: form.modo,
      });
      mostrarToast("Gasto actualizado");
      setGastoEditando(null);
      setVista("inicio");
    } catch {
      mostrarToast("Error al guardar", "err");
    }
    setGuardando(false);
  };

  const eliminarGasto = async (id) => {
    try {
      await deleteDoc(doc(db, "gastos", id));
      setGastos(prev => prev.filter(g => g.id !== id));
      mostrarToast("Gasto eliminado");
    } catch {
      mostrarToast("Error al eliminar", "err");
    }
  };

  const saldarCuentas = async () => {
    try {
      const snap = await getDocs(query(collection(db, "gastos"), where("grupoId", "==", grupoActivo.id)));
      const batch = writeBatch(db);
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      setGastos([]);
      mostrarToast("Cuentas saldadas. Empiecen de cero");
    } catch {
      mostrarToast("Error al saldar", "err");
    }
  };

  const abrirGrupo = (grupo) => {
    setGrupoActivo(grupo);
    setFiltro("todos");
    setGastos([]);
    setCargandoGastos(true);
    setVista("inicio");
  };

  const volverAGrupos = () => {
    setGrupoActivo(null);
    setGastos([]);
    setVista("grupos");
  };

  const cerrarSesion = () => {
    confirmar("¿Querés cerrar sesión?", async () => {
      await signOut(auth);
      setVista("grupos");
      setGrupoActivo(null);
    });
  };

  const nombreOtro = useMemo(() => {
    if (!grupoActivo) return "";
    return Object.entries(grupoActivo.miembrosNombres || {}).find(([uid]) => uid !== usuario?.uid)?.[1]
      || grupoActivo.nombreOtroDefault
      || grupoActivo.nombre;
  }, [grupoActivo, usuario?.uid]);

  if (!authListo) return (
    <div style={{ minHeight: "100dvh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
      <LogoMarca size="grande" />
      <div style={{ fontSize: 11, color: T.text2, letterSpacing: 3, marginTop: 8 }}>CARGANDO...</div>
    </div>
  );

  if (!usuario) return <AuthScreen />;

  const balance = calcularBalance(gastos, usuario.uid);
  const gastosFiltrados = filtro === "todos" ? gastos : gastos.filter(g => g.categoria === filtro);
  const catEmoji = (id) => CATEGORIAS.find(c => c.id === id)?.emoji || "📦";
  const nombreGrupo = grupoActivo?.nombre || "";

  return (
    <div style={{ minHeight: "100dvh", background: T.bg, fontFamily: "'Georgia', serif", color: T.text, display: "flex", flexDirection: "column", alignItems: "center", paddingBottom: "max(80px, calc(70px + env(safe-area-inset-bottom)))", position: "relative" }}>
      <div style={{ position: "fixed", top: -100, right: -100, width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,100,130,0.06), transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "fixed", bottom: -80, left: -80, width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(120,100,255,0.04), transparent 70%)", pointerEvents: "none" }} />

      {/* Modal de confirmación */}
      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "0 24px" }}>
          <div style={{ background: "#1c1a2a", borderRadius: 22, padding: "28px 24px", maxWidth: 320, width: "100%", border: "1px solid rgba(255,255,255,0.12)", textAlign: "center" }}>
            <div style={{ fontSize: 15, color: "#f0ece8", lineHeight: 1.6, marginBottom: 24 }}>{modal.mensaje}</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={cerrarModal} style={{ flex: 1, padding: "14px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.15)", background: "transparent", color: "#f0ece8", cursor: "pointer", fontSize: 15, fontFamily: "'Georgia', serif" }}>Cancelar</button>
              <button onClick={() => { cerrarModal(); modal.onConfirm(); }} style={{ flex: 1, padding: "14px", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #ff758c, #ff4d6d)", color: "#fff", cursor: "pointer", fontSize: 15, fontWeight: "bold", fontFamily: "'Georgia', serif", boxShadow: "0 4px 14px rgba(255,77,109,0.3)" }}>Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", top: "calc(20px + env(safe-area-inset-top))", left: "50%", transform: "translateX(-50%)", background: toast.tipo === "err" ? "#E8375A" : "#2ec4b6", color: "#fff", padding: "11px 22px", borderRadius: 30, fontWeight: "bold", fontSize: 14, zIndex: 999, boxShadow: "0 4px 20px rgba(0,0,0,0.15)", whiteSpace: "nowrap" }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ width: "100%", maxWidth: 430, padding: "calc(20px + env(safe-area-inset-top)) 20px 0" }}>
        {vista === "grupos" ? (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <LogoMarca />
              <div style={{ fontSize: 13, color: T.text2, marginTop: 6 }}>
                Hola, <span style={{ color: T.text, fontWeight: "bold" }}>{usuarioData?.nombre || "bienvenido"}</span>
              </div>
            </div>
            <button onClick={cerrarSesion} style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.text2, cursor: "pointer", fontSize: 13, padding: "10px 16px", borderRadius: 12, fontFamily: "'Georgia', serif", minHeight: 44, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>Salir</button>
          </div>
        ) : (
          <div style={{ textAlign: "center" }}>
            <button onClick={volverAGrupos} style={{ background: "none", border: "none", color: T.accent2, cursor: "pointer", fontSize: 14, padding: "8px 0", display: "block", margin: "0 auto 8px", minHeight: 44 }}>← Todos los grupos</button>
            <h1 style={{ fontSize: 26, fontWeight: "normal", margin: 0, color: T.text }}>{nombreGrupo}</h1>
          </div>
        )}
        <div style={{ height: 1, background: `linear-gradient(90deg, transparent, rgba(255,77,109,0.15), transparent)`, margin: "16px 0" }} />
      </div>

      {/* ── GRUPOS ── */}
      {vista === "grupos" && (
        <div style={{ width: "100%", maxWidth: 430, padding: "0 20px" }}>
          {notifPermiso !== "granted" && (
            <button onClick={async () => {
              await registrarTokenFCM(usuario.uid);
              setNotifPermiso("Notification" in window ? Notification.permission : "denied");
            }} style={{ width: "100%", padding: "13px 16px", borderRadius: 14, border: `1px solid rgba(255,77,109,0.25)`, background: "rgba(255,77,109,0.05)", color: T.accent, cursor: "pointer", fontSize: 14, marginBottom: 14, fontFamily: "'Georgia', serif", textAlign: "left", minHeight: 44 }}>
              🔔 Activar notificaciones push
            </button>
          )}
          {grupos.length === 0 && !mostrarFormGrupo && (
            <div style={{ textAlign: "center", color: T.text2, padding: "48px 0", fontSize: 14 }}>
              <div style={{ fontSize: 44, marginBottom: 12 }}>👥</div>
              Todavía no tenés grupos.<br />¡Creá el primero!
            </div>
          )}
          {grupos.sort((a, b) => a.creadoEn - b.creadoEn).map(grupo => (
            <GrupoCard key={grupo.id} grupo={grupo} usuarioUid={usuario.uid} onAbrir={abrirGrupo} onEliminar={eliminarGrupo} db={db} />
          ))}
          {mostrarFormGrupo && (
            <div style={{ background: T.surface, borderRadius: 18, padding: "20px", marginBottom: 12, border: `1px solid ${T.border}`, boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
              <div style={{ fontSize: 14, marginBottom: 14, color: T.text2 }}>¿Con quién compartís gastos?</div>
              <label style={labelStyle}>Nombre del grupo</label>
              <input placeholder="Ej: Ailén, Juan..." value={nuevoGrupoNombre} onChange={e => setNuevoGrupoNombre(e.target.value)} style={inputStyle} maxLength={40} />
              <label style={labelStyle}>Email de la otra persona</label>
              <input placeholder="su@email.com" type="email" value={nuevoGrupoEmail} onChange={e => setNuevoGrupoEmail(e.target.value)} style={inputStyle} autoCapitalize="none" />
              <label style={labelStyle}>¿Cómo se llama?</label>
              <input placeholder="Ej: Ailén" value={nuevoGrupoNombreOtro} onChange={e => setNuevoGrupoNombreOtro(e.target.value)} onKeyDown={e => e.key === "Enter" && crearGrupo()} style={inputStyle} />
              <div style={{ fontSize: 12, color: T.text3, marginTop: -12, marginBottom: 16 }}>Si ya está registrada, usamos su nombre automáticamente</div>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={resetFormGrupo} style={{ flex: 1, padding: "14px", borderRadius: 12, border: `1px solid ${T.border}`, background: "transparent", color: T.text, cursor: "pointer", fontSize: 14, fontFamily: "'Georgia', serif", minHeight: 44 }}>Cancelar</button>
                <button onClick={crearGrupo} disabled={guardando} style={{ flex: 2, padding: "14px", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #ff758c, #ff4d6d)", color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: "bold", fontFamily: "'Georgia', serif", minHeight: 44, boxShadow: "0 4px 14px rgba(255,77,109,0.25)" }}>{guardando ? "Creando..." : "Crear grupo"}</button>
              </div>
            </div>
          )}
          {!mostrarFormGrupo && (
            <button onClick={() => setMostrarFormGrupo(true)} style={{ width: "100%", padding: "17px", borderRadius: 14, background: "transparent", border: `2px dashed ${T.border}`, color: T.text2, cursor: "pointer", fontSize: 15, marginTop: grupos.length > 0 ? 4 : 0, fontFamily: "'Georgia', serif", minHeight: 54 }}>+ Nuevo grupo</button>
          )}
        </div>
      )}

      {/* ── INICIO GRUPO ── */}
      {vista === "inicio" && grupoActivo && (
        <div style={{ width: "100%", maxWidth: 430, padding: "0 20px" }}>
          <div style={{
            background: balance === 0 ? "linear-gradient(135deg, #2ec4b6, #1a8a84)" : balance > 0 ? "linear-gradient(135deg, #ff758c, #ff4d6d)" : "linear-gradient(135deg, #667eea, #764ba2)",
            borderRadius: 22, padding: "26px 24px 22px", marginBottom: 20,
            boxShadow: "0 6px 24px rgba(0,0,0,0.12)", textAlign: "center",
          }}>
            <div style={{ fontSize: 11, letterSpacing: 3, textTransform: "uppercase", color: "rgba(255,255,255,0.8)", marginBottom: 8 }}>Balance con {nombreOtro}</div>
            <div style={{ fontSize: 44, fontWeight: "bold", color: "#fff", marginBottom: 4 }}>${formatMonto(Math.abs(balance))}</div>
            <div style={{ fontSize: 15, color: "rgba(255,255,255,0.9)" }}>
              {balance === 0 ? "Están a mano" : balance > 0 ? `${nombreOtro} te debe a vos` : `Vos le debés a ${nombreOtro}`}
            </div>
            {gastos.length > 0 && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", marginTop: 6 }}>{gastos.length} gasto{gastos.length !== 1 ? "s" : ""}</div>}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
            {[
              { label: "Nuevo gasto", icon: "＋", action: () => setVista("nuevo"), disabled: false },
              { label: "Historial",   icon: "≡",  action: () => setVista("historial"), disabled: false },
              { label: "Saldar",      icon: "✓",  action: () => confirmar(`¿Confirman que saldaron las cuentas con ${nombreOtro}?`, saldarCuentas), disabled: gastos.length === 0 },
            ].map(btn => (
              <button key={btn.label} onClick={btn.disabled ? undefined : btn.action}
                style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: "18px 8px", color: T.text, cursor: btn.disabled ? "default" : "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, fontSize: 12, fontFamily: "'Georgia', serif", minHeight: 80, opacity: btn.disabled ? 0.35 : 1, boxShadow: "0 1px 6px rgba(0,0,0,0.05)" }}
                onMouseEnter={e => { if (!btn.disabled) e.currentTarget.style.background = T.surface2; }}
                onMouseLeave={e => { if (!btn.disabled) e.currentTarget.style.background = T.surface; }}
              >
                <span style={{ fontSize: 20, fontWeight: "bold", color: T.accent }}>{btn.icon}</span>
                {btn.label}
              </button>
            ))}
          </div>

          {cargandoGastos ? (
            <div style={{ textAlign: "center", color: T.text2, padding: "36px 0", fontSize: 14 }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
              Cargando...
            </div>
          ) : gastos.length > 0 ? (
            <div>
              <div style={{ fontSize: 11, letterSpacing: 3, textTransform: "uppercase", color: T.text2, marginBottom: 12 }}>Últimos gastos</div>
              {gastos.slice(0, 4).map(g => <GastoRow key={g.id} g={g} catEmoji={catEmoji} nombreGrupo={nombreOtro} miUid={usuario.uid} onEliminar={eliminarGasto} onEditar={abrirEditar} />)}
              {gastos.length > 4 && (
                <button onClick={() => setVista("historial")} style={{ background: "none", border: "none", color: T.accent2, cursor: "pointer", fontSize: 14, padding: "10px 0", width: "100%", textAlign: "center", minHeight: 44 }}>Ver todos ({gastos.length}) →</button>
              )}
            </div>
          ) : (
            <div style={{ textAlign: "center", color: T.text2, padding: "36px 0", fontSize: 14 }}>
              <div style={{ fontSize: 44, marginBottom: 12 }}>🌱</div>
              No hay gastos con {nombreOtro}.<br />¡Cargá el primero!
            </div>
          )}
        </div>
      )}

      {/* ── NUEVO GASTO ── */}
      {vista === "nuevo" && grupoActivo && (
        <div style={{ width: "100%", maxWidth: 430, padding: "0 20px" }}>
          <button onClick={() => setVista("inicio")} style={{ background: "none", border: "none", color: T.accent2, cursor: "pointer", fontSize: 14, marginBottom: 16, padding: "8px 0", minHeight: 44 }}>← Volver</button>
          <div style={{ background: T.surface, borderRadius: 22, padding: "24px 20px", border: `1px solid ${T.border}`, boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
            <h2 style={{ margin: "0 0 20px", fontSize: 20, fontWeight: "normal", color: T.text }}>Nuevo gasto con {nombreOtro}</h2>

            <label style={labelStyle}>Descripción</label>
            <input placeholder="Ej: Pizza del viernes" value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} style={inputStyle} maxLength={80} />

            <label style={labelStyle}>Categoría</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 16 }}>
              {CATEGORIAS.map(c => (
                <button key={c.id} onClick={() => setForm(f => ({ ...f, categoria: c.id }))} style={{ padding: "12px 6px", borderRadius: 12, border: form.categoria === c.id ? `2px solid ${T.accent}` : `1px solid ${T.border}`, background: form.categoria === c.id ? "rgba(255,77,109,0.07)" : T.surface2, color: T.text, cursor: "pointer", fontSize: 12, textAlign: "center", minHeight: 60 }}>
                  <div style={{ fontSize: 22 }}>{c.emoji}</div>{c.label}
                </button>
              ))}
            </div>

            <label style={labelStyle}>Monto total ($)</label>
            <input placeholder="0.00" type="number" inputMode="decimal" value={form.monto} onChange={e => setForm(f => ({ ...f, monto: e.target.value }))} style={{ ...inputStyle, fontSize: 24, textAlign: "center" }} />

            <label style={labelStyle}>¿Cómo se divide?</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
              {MODOS.map(m => (
                <button key={m.id} onClick={() => setForm(f => ({ ...f, modo: m.id }))} style={{ padding: "14px 16px", borderRadius: 13, border: form.modo === m.id ? `2px solid ${T.accent}` : `1px solid ${T.border}`, background: form.modo === m.id ? "rgba(255,77,109,0.07)" : T.surface2, color: T.text, cursor: "pointer", textAlign: "left", display: "flex", gap: 12, alignItems: "center", fontFamily: "'Georgia', serif", minHeight: 60 }}>
                  <span style={{ fontSize: 22 }}>{m.emoji}</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: "bold" }}>{m.label}</div>
                    <div style={{ fontSize: 12, color: T.text2, marginTop: 2 }}>{m.desc}</div>
                  </div>
                </button>
              ))}
            </div>

            {form.monto && !isNaN(form.monto) && Number(form.monto) > 0 && (
              <div style={{ background: "rgba(255,77,109,0.06)", borderRadius: 13, padding: "13px 16px", marginBottom: 16, fontSize: 14, border: "1px solid rgba(255,77,109,0.15)", color: T.text }}>
                {MODOS.find(m => m.id === form.modo)?.label}: <strong>${formatMonto(form.modo.includes("mitad") ? Number(form.monto) / 2 : Number(form.monto))}</strong>
              </div>
            )}

            <button onClick={agregarGasto} disabled={guardando} style={{ width: "100%", padding: "17px", borderRadius: 14, border: "none", background: guardando ? "rgba(255,77,109,0.35)" : "linear-gradient(135deg, #ff758c, #ff4d6d)", color: "#fff", fontSize: 16, fontWeight: "bold", cursor: guardando ? "not-allowed" : "pointer", boxShadow: guardando ? "none" : "0 4px 18px rgba(255,77,109,0.3)", fontFamily: "'Georgia', serif", minHeight: 54 }}>
              {guardando ? "Guardando..." : "Guardar gasto"}
            </button>
          </div>
        </div>
      )}

      {/* ── EDITAR GASTO ── */}
      {vista === "editar" && grupoActivo && gastoEditando && (
        <div style={{ width: "100%", maxWidth: 430, padding: "0 20px" }}>
          <button onClick={() => { setVista("inicio"); setGastoEditando(null); }} style={{ background: "none", border: "none", color: T.accent2, cursor: "pointer", fontSize: 14, marginBottom: 16, padding: "8px 0", minHeight: 44 }}>← Volver</button>
          <div style={{ background: T.surface, borderRadius: 22, padding: "24px 20px", border: `1px solid ${T.border}`, boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
            <h2 style={{ margin: "0 0 20px", fontSize: 20, fontWeight: "normal", color: T.text }}>Editar gasto</h2>

            <label style={labelStyle}>Descripción</label>
            <input placeholder="Ej: Pizza del viernes" value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} style={inputStyle} maxLength={80} />

            <label style={labelStyle}>Categoría</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 16 }}>
              {CATEGORIAS.map(c => (
                <button key={c.id} onClick={() => setForm(f => ({ ...f, categoria: c.id }))} style={{ padding: "12px 6px", borderRadius: 12, border: form.categoria === c.id ? `2px solid ${T.accent}` : `1px solid ${T.border}`, background: form.categoria === c.id ? "rgba(255,77,109,0.07)" : T.surface2, color: T.text, cursor: "pointer", fontSize: 12, textAlign: "center", minHeight: 60 }}>
                  <div style={{ fontSize: 22 }}>{c.emoji}</div>{c.label}
                </button>
              ))}
            </div>

            <label style={labelStyle}>Monto total ($)</label>
            <input placeholder="0.00" type="number" inputMode="decimal" value={form.monto} onChange={e => setForm(f => ({ ...f, monto: e.target.value }))} style={{ ...inputStyle, fontSize: 24, textAlign: "center" }} />

            <label style={labelStyle}>¿Cómo se divide?</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
              {MODOS.map(m => (
                <button key={m.id} onClick={() => setForm(f => ({ ...f, modo: m.id }))} style={{ padding: "14px 16px", borderRadius: 13, border: form.modo === m.id ? `2px solid ${T.accent}` : `1px solid ${T.border}`, background: form.modo === m.id ? "rgba(255,77,109,0.07)" : T.surface2, color: T.text, cursor: "pointer", textAlign: "left", display: "flex", gap: 12, alignItems: "center", fontFamily: "'Georgia', serif", minHeight: 60 }}>
                  <span style={{ fontSize: 22 }}>{m.emoji}</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: "bold" }}>{m.label}</div>
                    <div style={{ fontSize: 12, color: T.text2, marginTop: 2 }}>{m.desc}</div>
                  </div>
                </button>
              ))}
            </div>

            {form.monto && !isNaN(form.monto) && Number(form.monto) > 0 && (
              <div style={{ background: "rgba(255,77,109,0.06)", borderRadius: 13, padding: "13px 16px", marginBottom: 16, fontSize: 14, border: "1px solid rgba(255,77,109,0.15)", color: T.text }}>
                {MODOS.find(m => m.id === form.modo)?.label}: <strong>${formatMonto(form.modo.includes("mitad") ? Number(form.monto) / 2 : Number(form.monto))}</strong>
              </div>
            )}

            <button onClick={editarGastoGuardar} disabled={guardando} style={{ width: "100%", padding: "17px", borderRadius: 14, border: "none", background: guardando ? "rgba(255,77,109,0.35)" : "linear-gradient(135deg, #ff758c, #ff4d6d)", color: "#fff", fontSize: 16, fontWeight: "bold", cursor: guardando ? "not-allowed" : "pointer", boxShadow: guardando ? "none" : "0 4px 18px rgba(255,77,109,0.3)", fontFamily: "'Georgia', serif", minHeight: 54 }}>
              {guardando ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </div>
      )}

      {/* ── HISTORIAL ── */}
      {vista === "historial" && grupoActivo && (
        <div style={{ width: "100%", maxWidth: 430, padding: "0 20px" }}>
          <button onClick={() => setVista("inicio")} style={{ background: "none", border: "none", color: T.accent2, cursor: "pointer", fontSize: 14, marginBottom: 16, padding: "8px 0", minHeight: 44 }}>← Volver</button>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: "normal", color: T.text }}>Historial con {nombreOtro}</h2>
            <span style={{ fontSize: 12, color: T.text2 }}>{gastos.length} gastos</span>
          </div>

          {filtro === "todos" && gastos.length > 1 && <TortaGastos gastos={gastos} />}

          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 12, marginBottom: 16 }}>
            <button onClick={() => setFiltro("todos")} style={{ padding: "8px 16px", borderRadius: 20, whiteSpace: "nowrap", border: filtro === "todos" ? `2px solid ${T.accent}` : `1px solid ${T.border}`, background: filtro === "todos" ? "rgba(255,77,109,0.08)" : T.surface, color: T.text, cursor: "pointer", fontSize: 13, minHeight: 36 }}>Todos</button>
            {CATEGORIAS.filter(c => gastos.some(g => g.categoria === c.id)).map(c => (
              <button key={c.id} onClick={() => setFiltro(c.id)} style={{ padding: "8px 16px", borderRadius: 20, whiteSpace: "nowrap", border: filtro === c.id ? `2px solid ${T.accent}` : `1px solid ${T.border}`, background: filtro === c.id ? "rgba(255,77,109,0.08)" : T.surface, color: T.text, cursor: "pointer", fontSize: 13, minHeight: 36 }}>{c.emoji} {c.label}</button>
            ))}
          </div>
          {gastosFiltrados.length === 0
            ? <div style={{ textAlign: "center", color: T.text2, padding: "36px 0", fontSize: 14 }}>No hay gastos en esta categoría</div>
            : gastosFiltrados.map(g => <GastoRow key={g.id} g={g} catEmoji={catEmoji} nombreGrupo={nombreOtro} miUid={usuario.uid} onEliminar={eliminarGasto} onEditar={abrirEditar} />)
          }
        </div>
      )}

      <style>{`
        input:focus { outline: none; border-color: #FF4D6D !important; }
        input::placeholder { color: rgba(26,24,37,0.3); }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.12); border-radius: 2px; }
      `}</style>
    </div>
  );
}

// ─── GrupoCard ────────────────────────────────────────────────────────────────
function GrupoCard({ grupo, usuarioUid, onAbrir, onEliminar, db }) {
  const [balance, setBalance] = useState(0);
  const [cantGastos, setCantGastos] = useState(0);

  useEffect(() => {
    const q = query(collection(db, "gastos"), where("grupoId", "==", grupo.id));
    const unsub = onSnapshot(q, (snap) => {
      const gastos = snap.docs.map(d => d.data());
      setCantGastos(gastos.length);
      setBalance(calcularBalance(gastos, usuarioUid));
    });
    return () => unsub();
  }, [grupo.id, usuarioUid]);

  const esMio = grupo.creadoPor === usuarioUid;

  return (
    <div style={{ background: T.surface, borderRadius: 18, marginBottom: 12, border: `1px solid ${T.border}`, boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}>
      <div style={{ display: "flex", alignItems: "center", padding: "16px" }}>
        <div style={{ width: 48, height: 48, borderRadius: 15, background: grupo.color, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: "bold", color: "#fff", boxShadow: "0 3px 10px rgba(0,0,0,0.15)" }}>
          {grupo.nombre.charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1, marginLeft: 14 }}>
          <div style={{ fontSize: 17, fontWeight: "bold", color: T.text, display: "flex", alignItems: "center", gap: 8 }}>
            {grupo.nombre}
            {grupo.miembros.length === 1 && (
              <span style={{ fontSize: 10, background: "rgba(247,151,30,0.12)", color: "#D4890A", borderRadius: 6, padding: "2px 7px", fontWeight: "normal", letterSpacing: 0.5 }}>PENDIENTE</span>
            )}
          </div>
          <div style={{ fontSize: 12, color: T.text2, marginTop: 3 }}>
            {grupo.miembros.length === 1
              ? "El otro usuario aún no tiene cuenta"
              : cantGastos === 0 ? "Sin gastos" : `${cantGastos} gasto${cantGastos !== 1 ? "s" : ""}`}
            {grupo.miembros.length > 1 && balance !== 0 && (
              <span style={{ color: balance > 0 ? "#E84070" : "#7C6AF6", marginLeft: 6 }}>
                · {balance > 0 ? `te debe $${formatMonto(balance)}` : `le debés $${formatMonto(Math.abs(balance))}`}
              </span>
            )}
            {grupo.miembros.length > 1 && balance === 0 && cantGastos > 0 && (
              <span style={{ color: "#2ec4b6", marginLeft: 6 }}>· a mano</span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {esMio && (
            <button onClick={() => onEliminar(grupo)} style={{ background: "rgba(232,55,90,0.07)", border: "none", color: "#E8375A", cursor: "pointer", fontSize: 16, width: 44, height: 44, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>🗑</button>
          )}
          <button onClick={() => onAbrir(grupo)} style={{ background: grupo.color, border: "none", color: "#fff", cursor: "pointer", fontSize: 13, padding: "0 16px", height: 44, borderRadius: 12, fontWeight: "bold", fontFamily: "'Georgia', serif", boxShadow: "0 3px 10px rgba(0,0,0,0.1)" }}>Ver →</button>
        </div>
      </div>
    </div>
  );
}

// ─── GastoRow ─────────────────────────────────────────────────────────────────
function GastoRow({ g, catEmoji, nombreGrupo, miUid, onEliminar, onEditar }) {
  const etiqueta = getEtiqueta(g, miUid, nombreGrupo);
  const { monto, signo, color } = getMontoYSigno(g, miUid);
  const esMio = g.cargadoPor === miUid;

  return (
    <div style={{ background: T.surface, borderRadius: 15, padding: "14px 12px 14px 16px", marginBottom: 10, border: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 12, boxShadow: "0 1px 6px rgba(0,0,0,0.04)" }}>
      <div style={{ fontSize: 24 }}>{catEmoji(g.categoria)}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: "bold", color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{g.descripcion}</div>
        <div style={{ fontSize: 11, color: T.text2, marginTop: 3 }}>
          {g.fecha} · {g.hora} · {etiqueta.emoji} {etiqueta.label}
          <span style={{ marginLeft: 4 }}>· cargó {esMio ? "vos" : g.cargadoPorNombre || nombreGrupo}</span>
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontSize: 16, fontWeight: "bold", color }}>{signo}${formatMonto(monto)}</div>
        <div style={{ fontSize: 10, color: T.text3 }}>total: ${formatMonto(g.monto)}</div>
      </div>
      {esMio && (
        <button onClick={() => onEditar(g)} style={{ background: "none", border: "none", color: T.text3, cursor: "pointer", fontSize: 15, width: 32, height: 44, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>✏️</button>
      )}
      <button onClick={() => onEliminar(g.id)} style={{ background: "none", border: "none", color: T.text3, cursor: "pointer", fontSize: 20, width: 32, height: 44, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>×</button>
    </div>
  );
}
