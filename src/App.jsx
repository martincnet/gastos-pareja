import { useState, useEffect, useMemo, useRef } from "react";
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
  { id: "comida",     label: "Comida",      emoji: "🍕", icon: "food" },
  { id: "super",      label: "Super",       emoji: "🛒", icon: "cart" },
  { id: "salidas",    label: "Salidas",     emoji: "🎬", icon: "ticket" },
  { id: "transporte", label: "Transporte",  emoji: "🚌", icon: "bus" },
  { id: "casa",       label: "Casa",        emoji: "🏠", icon: "home" },
  { id: "salud",      label: "Salud",       emoji: "💊", icon: "health" },
  { id: "ropa",       label: "Ropa",        emoji: "👗", icon: "shirt" },
  { id: "viajes",     label: "Viajes",      emoji: "✈️", icon: "plane" },
  { id: "otro",       label: "Otro",        emoji: "📦", icon: "box" },
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
  { id: "pague_yo_total",  label: "Pagué yo, me deben el total", emoji: "💸", icon: "arrow-in",  desc: "El otro te debe todo" },
  { id: "pague_yo_mitad",  label: "Pagué yo, me deben la mitad", emoji: "✂️", icon: "split",     desc: "Se divide al 50%" },
  { id: "pago_otro_total", label: "Pagó el otro, le debo el total", emoji: "🙏", icon: "arrow-out", desc: "Le debés todo al otro" },
  { id: "pago_otro_mitad", label: "Pagó el otro, le debo la mitad", emoji: "💝", icon: "divide",   desc: "Se divide al 50%" },
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

function formatMontoInput(raw) {
  const limpio = String(raw || "").replace(/[^\d,]/g, "");
  if (!limpio) return "";

  const [enteraRaw, decimalRaw = ""] = limpio.split(",");
  const entera = enteraRaw.replace(/^0+(?=\d)/, "") || "0";
  const conMiles = entera.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const decimal = decimalRaw.slice(0, 2);

  return decimalRaw !== "" ? `${conMiles},${decimal}` : conMiles;
}

function parseMontoInput(raw) {
  if (!raw) return NaN;
  const normalizado = String(raw).replace(/\./g, "").replace(",", ".");
  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : NaN;
}

function getCategoriaMeta(id) {
  return CATEGORIAS.find(c => c.id === id) || CATEGORIAS[CATEGORIAS.length - 1];
}

function calcularBalance(gastos, miUid) {
  let balance = 0;
  for (const g of gastos) {
    if (g.saldadoEn) continue;
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
    if (modo === "pague_yo_total")  return { label: `${nombreOtro} te debe el total`, icon: "arrow-in" };
    if (modo === "pague_yo_mitad")  return { label: `${nombreOtro} te debe la mitad`, icon: "split" };
    if (modo === "pago_otro_total") return { label: `Le debés el total a ${nombreOtro}`, icon: "arrow-out" };
    if (modo === "pago_otro_mitad") return { label: `Le debés la mitad a ${nombreOtro}`, icon: "divide" };
  } else {
    if (modo === "pague_yo_total")  return { label: `Le debés el total a ${nombreOtro}`, icon: "arrow-out" };
    if (modo === "pague_yo_mitad")  return { label: `Le debés la mitad a ${nombreOtro}`, icon: "divide" };
    if (modo === "pago_otro_total") return { label: `${nombreOtro} te debe el total`, icon: "arrow-in" };
    if (modo === "pago_otro_mitad") return { label: `${nombreOtro} te debe la mitad`, icon: "split" };
  }
  return { label: "", icon: "box" };
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

function getModoUI(modo) {
  switch (modo) {
    case "pague_yo_total":
      return { quienPago: "yo", tipoDivision: "total" };
    case "pague_yo_mitad":
      return { quienPago: "yo", tipoDivision: "mitad" };
    case "pago_otro_total":
      return { quienPago: "otro", tipoDivision: "total" };
    case "pago_otro_mitad":
    default:
      return { quienPago: "otro", tipoDivision: "mitad" };
  }
}

function getModoDesdeUI(quienPago, tipoDivision) {
  if (quienPago === "yo") {
    return tipoDivision === "total" ? "pague_yo_total" : "pague_yo_mitad";
  }
  return tipoDivision === "total" ? "pago_otro_total" : "pago_otro_mitad";
}

function getResumenModo(modo, nombreOtro, montoRaw) {
  const montoNum = parseMontoInput(montoRaw);
  if (!montoRaw || Number.isNaN(montoNum) || montoNum <= 0) return null;
  const mitad = modo.includes("mitad");
  const monto = mitad ? montoNum / 2 : montoNum;

  switch (modo) {
    case "pague_yo_total":
      return { titulo: "Resultado", texto: `${nombreOtro} te debe $${formatMonto(monto)}`, color: "#E84070", fondo: "rgba(255,77,109,0.08)", borde: "rgba(255,77,109,0.18)" };
    case "pague_yo_mitad":
      return { titulo: "Resultado", texto: `${nombreOtro} te debe $${formatMonto(monto)}`, color: "#E84070", fondo: "rgba(255,77,109,0.08)", borde: "rgba(255,77,109,0.18)" };
    case "pago_otro_total":
      return { titulo: "Resultado", texto: `Vos le debés $${formatMonto(monto)} a ${nombreOtro}`, color: "#7C6AF6", fondo: "rgba(124,106,246,0.08)", borde: "rgba(124,106,246,0.18)" };
    case "pago_otro_mitad":
    default:
      return { titulo: "Resultado", texto: `Vos le debés $${formatMonto(monto)} a ${nombreOtro}`, color: "#7C6AF6", fondo: "rgba(124,106,246,0.08)", borde: "rgba(124,106,246,0.18)" };
  }
}

function IconoLinea({ name, size = 20, color = "currentColor", stroke = 1.9 }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: color,
    strokeWidth: stroke,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };

  switch (name) {
    case "food":
      return (
        <svg {...common}>
          <path d="M7 3v8" />
          <path d="M4.5 3v5a2.5 2.5 0 0 0 5 0V3" />
          <path d="M7 11v10" />
          <path d="M16 3c-2 1.6-3 3.8-3 6.7V21" />
          <path d="M16 3v18" />
        </svg>
      );
    case "cart":
      return (
        <svg {...common}>
          <circle cx="9" cy="19" r="1.5" />
          <circle cx="17" cy="19" r="1.5" />
          <path d="M3 4h2l2.2 10.2a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L20 7H6.2" />
        </svg>
      );
    case "ticket":
      return (
        <svg {...common}>
          <path d="M5 7.5A2.5 2.5 0 0 1 7.5 5h9A2.5 2.5 0 0 1 19 7.5v2a2 2 0 0 0 0 5v2a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 5 16.5v-2a2 2 0 0 0 0-5z" />
          <path d="M9 9h6" />
          <path d="M9 15h6" />
        </svg>
      );
    case "bus":
      return (
        <svg {...common}>
          <path d="M7 17v2" />
          <path d="M17 17v2" />
          <path d="M6 17h12a1 1 0 0 0 1-1V8c0-3-2.5-4-7-4S5 5 5 8v8a1 1 0 0 0 1 1Z" />
          <path d="M7 13h.01" />
          <path d="M17 13h.01" />
          <path d="M7 8h10" />
        </svg>
      );
    case "home":
      return (
        <svg {...common}>
          <path d="M4 10.5 12 4l8 6.5" />
          <path d="M6.5 9.5V20h11V9.5" />
          <path d="M10 20v-5h4v5" />
        </svg>
      );
    case "health":
      return (
        <svg {...common}>
          <rect x="4.5" y="6" width="15" height="12" rx="3" />
          <path d="M12 9v6" />
          <path d="M9 12h6" />
        </svg>
      );
    case "shirt":
      return (
        <svg {...common}>
          <path d="m9 5 3-2 3 2 3 1.5-1.5 4-2.5-1V20h-6V9.5l-2.5 1L4 6.5Z" />
        </svg>
      );
    case "plane":
      return (
        <svg {...common}>
          <path d="M3 13 21 5l-5.5 14-3.5-5.5L7 17z" />
          <path d="M11.5 13.5 21 5" />
        </svg>
      );
    case "box":
      return (
        <svg {...common}>
          <path d="M12 3 4.5 7 12 11l7.5-4Z" />
          <path d="M4.5 7v10L12 21l7.5-4V7" />
          <path d="M12 11v10" />
        </svg>
      );
    case "arrow-in":
      return (
        <svg {...common}>
          <path d="M12 5v14" />
          <path d="m7 10 5-5 5 5" />
          <rect x="4" y="4" width="16" height="16" rx="4" />
        </svg>
      );
    case "arrow-out":
      return (
        <svg {...common}>
          <path d="M12 19V5" />
          <path d="m17 14-5 5-5-5" />
          <rect x="4" y="4" width="16" height="16" rx="4" />
        </svg>
      );
    case "split":
      return (
        <svg {...common}>
          <path d="M6 5h12" />
          <path d="M12 5v14" />
          <path d="m8.5 14 3.5 5 3.5-5" />
        </svg>
      );
    case "divide":
      return (
        <svg {...common}>
          <circle cx="12" cy="7.5" r="1.2" fill={color} stroke="none" />
          <path d="M8 12h8" />
          <circle cx="12" cy="16.5" r="1.2" fill={color} stroke="none" />
        </svg>
      );
    case "plus":
      return (
        <svg {...common}>
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
      );
    case "list":
      return (
        <svg {...common}>
          <path d="M8 7h11" />
          <path d="M8 12h11" />
          <path d="M8 17h11" />
          <circle cx="4.5" cy="7" r="1" fill={color} stroke="none" />
          <circle cx="4.5" cy="12" r="1" fill={color} stroke="none" />
          <circle cx="4.5" cy="17" r="1" fill={color} stroke="none" />
        </svg>
      );
    case "check":
      return (
        <svg {...common}>
          <path d="m5 12 4.2 4.2L19 6.5" />
        </svg>
      );
    case "bell":
      return (
        <svg {...common}>
          <path d="M6 9a6 6 0 1 1 12 0c0 7 3 7 3 7H3s3 0 3-7" />
          <path d="M10.5 20a1.5 1.5 0 0 0 3 0" />
        </svg>
      );
    case "users":
      return (
        <svg {...common}>
          <path d="M16.5 19a4.5 4.5 0 0 0-9 0" />
          <circle cx="12" cy="10" r="3" />
          <path d="M21 19a3.8 3.8 0 0 0-3-3.7" />
          <path d="M3 19a3.8 3.8 0 0 1 3-3.7" />
        </svg>
      );
    case "trash":
      return (
        <svg {...common}>
          <path d="M4 7h16" />
          <path d="M10 11v6" />
          <path d="M14 11v6" />
          <path d="M6 7l1 12a2 2 0 0 0 2 1.8h6a2 2 0 0 0 2-1.8L18 7" />
          <path d="M9 4h6" />
        </svg>
      );
    case "edit":
      return (
        <svg {...common}>
          <path d="M4 20h4l9.5-9.5a2.1 2.1 0 0 0-4-4L4 16z" />
          <path d="m12.5 6.5 4 4" />
        </svg>
      );
    case "chevron-right":
      return (
        <svg {...common}>
          <path d="m9 6 6 6-6 6" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
        </svg>
      );
  }
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
      label: getCategoriaMeta(cat).label || cat,
      icon: getCategoriaMeta(cat).icon || "box",
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
              <div style={{ flex: 1, fontSize: 12, color: T.text, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 18, height: 18, display: "inline-flex", alignItems: "center", justifyContent: "center", color: s.color }}>
                  <IconoLinea name={s.icon} size={14} color={s.color} />
                </span>
                {s.label}
              </div>
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

      <div style={{ width: "100%", maxWidth: 390, background: "rgba(255,255,255,0.92)", borderRadius: 24, padding: "28px 24px", border: `1px solid ${T.border}`, boxShadow: "0 10px 34px rgba(61,40,22,0.08)" }}>
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
          width: "100%", padding: "17px", borderRadius: 18, border: "none",
          background: cargando ? "rgba(255,77,109,0.35)" : "linear-gradient(135deg, #ff758c, #ff4d6d)",
          color: "#fff", fontSize: 16, fontWeight: "bold", cursor: cargando ? "not-allowed" : "pointer",
          fontFamily: "'Georgia', serif",
          boxShadow: cargando ? "none" : "0 12px 28px rgba(255,77,109,0.24)",
        }}>{cargando ? "Cargando..." : modo === "login" ? "Ingresar" : "Crear cuenta"}</button>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const FORM_INICIAL = { descripcion: "", categoria: "comida", monto: "", modo: "pague_yo_mitad" };
  const [usuario, setUsuario] = useState(null);
  const [usuarioData, setUsuarioData] = useState(null);
  const [authListo, setAuthListo] = useState(false);
  const [grupos, setGrupos] = useState([]);
  const [grupoActivo, setGrupoActivo] = useState(null);
  const [gastos, setGastos] = useState([]);
  const [vista, setVista] = useState("grupos");
  const [form, setForm] = useState(FORM_INICIAL);
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
  const [mesSeleccionado, setMesSeleccionado] = useState(null);
  const mesPromptRef = useRef(null);

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

  useEffect(() => {
    if (cargandoGastos || !grupoActivo) return;
    const promptKey = grupoActivo.id;
    if (mesPromptRef.current === promptKey) return;
    mesPromptRef.current = promptKey;
    const now = new Date();
    const mesActual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const noSaldados = gastos.filter(g => !g.saldadoEn);
    const tieneViejos = noSaldados.some(g => {
      const d = new Date(g.timestamp);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` < mesActual;
    });
    if (tieneViejos) {
      const nombres = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
      const mesNombre = nombres[now.getMonth()];
      confirmar(`Hay gastos sin saldar de meses anteriores. ¿Saldamos y empezamos ${mesNombre} de cero?`, saldarCuentas);
    }
  }, [cargandoGastos, grupoActivo?.id]);

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

  const resetFormGasto = () => {
    setForm(FORM_INICIAL);
    setGastoEditando(null);
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
    const montoNumero = parseMontoInput(form.monto);
    if (!form.descripcion.trim()) return mostrarToast("Poné una descripción", "err");
    if (!form.monto || Number.isNaN(montoNumero) || montoNumero <= 0) return mostrarToast("El monto tiene que ser mayor a 0", "err");
    setGuardando(true);
    try {
      const nuevoGastoData = {
        grupoId: grupoActivo.id,
        descripcion: form.descripcion.trim(),
        categoria: form.categoria,
        monto: montoNumero,
        modo: form.modo,
        fecha: new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" }),
        hora: new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
        timestamp: Date.now(),
        cargadoPor: usuario.uid,
        cargadoPorNombre: usuarioData?.nombre || "",
      };
      const docRef = await addDoc(collection(db, "gastos"), nuevoGastoData);
      setGastos(prev => [{ id: docRef.id, ...nuevoGastoData }, ...prev]);
      resetFormGasto();
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
    const montoNumero = parseMontoInput(form.monto);
    if (!form.descripcion.trim()) return mostrarToast("Poné una descripción", "err");
    if (!form.monto || Number.isNaN(montoNumero) || montoNumero <= 0) return mostrarToast("El monto tiene que ser mayor a 0", "err");
    setGuardando(true);
    try {
      await updateDoc(doc(db, "gastos", gastoEditando.id), {
        descripcion: form.descripcion.trim(),
        categoria: form.categoria,
        monto: montoNumero,
        modo: form.modo,
      });
      mostrarToast("Gasto actualizado");
      resetFormGasto();
      setVista("inicio");
    } catch {
      mostrarToast("Error al guardar", "err");
    }
    setGuardando(false);
  };

  const eliminarGasto = (id) => {
    confirmar("¿Eliminar este gasto?", async () => {
      try {
        await deleteDoc(doc(db, "gastos", id));
        setGastos(prev => prev.filter(g => g.id !== id));
        if (gastoEditando?.id === id) {
          resetFormGasto();
          setVista("inicio");
        }
        mostrarToast("Gasto eliminado");
      } catch {
        mostrarToast("Error al eliminar", "err");
      }
    });
  };

  const saldarCuentas = async () => {
    const ahora = Date.now();
    try {
      const noSaldados = gastos.filter(g => !g.saldadoEn);
      if (noSaldados.length === 0) return;
      const batch = writeBatch(db);
      noSaldados.forEach(g => batch.update(doc(db, "gastos", g.id), { saldadoEn: ahora }));
      await batch.commit();
      setGastos(prev => prev.map(g => g.saldadoEn ? g : { ...g, saldadoEn: ahora }));
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
    setMesSeleccionado(null);
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

  const gastosActuales = gastos.filter(g => !g.saldadoEn);
  const balance = calcularBalance(gastos, usuario.uid);
  const gastosFiltrados = filtro === "todos" ? gastos : gastos.filter(g => g.categoria === filtro);
  const catMeta = (id) => getCategoriaMeta(id);
  const nombreGrupo = grupoActivo?.nombre || "";
  const modoUI = getModoUI(form.modo);
  const resumenForm = getResumenModo(form.modo, nombreOtro, form.monto);
  const now = new Date();
  const mesActual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const mesesHistorial = [...new Set(gastos.map(g => {
    const d = new Date(g.timestamp);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }))].sort().reverse();
  const mesActivoHistorial = mesSeleccionado && mesesHistorial.includes(mesSeleccionado)
    ? mesSeleccionado
    : (mesesHistorial.includes(mesActual) ? mesActual : mesesHistorial[0]);
  const gastosMesActivo = mesActivoHistorial
    ? gastos.filter(g => {
        const d = new Date(g.timestamp);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` === mesActivoHistorial;
      })
    : [];
  const totalMesActivo = gastosMesActivo.reduce((acc, g) => acc + g.monto, 0);
  const balanceMesActivo = grupoActivo ? calcularBalance(gastosMesActivo, usuario.uid) : 0;
  const NOMBRES_MES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  const fmtMes = (ym) => {
    if (!ym) return "";
    const [y, m] = ym.split("-");
    return `${NOMBRES_MES[+m - 1]} ${y}`;
  };

  return (
    <div style={{ minHeight: "100dvh", background: T.bg, fontFamily: "'Georgia', serif", color: T.text, display: "flex", flexDirection: "column", alignItems: "center", paddingBottom: "max(80px, calc(70px + env(safe-area-inset-bottom)))", position: "relative" }}>
      <div style={{ position: "fixed", top: -100, right: -100, width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,100,130,0.06), transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "fixed", bottom: -80, left: -80, width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(120,100,255,0.04), transparent 70%)", pointerEvents: "none" }} />

      {/* Modal de confirmación */}
      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "0 24px" }}>
          <div style={{ background: "rgba(255,255,255,0.96)", borderRadius: 24, padding: "28px 24px", maxWidth: 332, width: "100%", border: `1px solid ${T.border}`, boxShadow: "0 18px 42px rgba(0,0,0,0.12)", textAlign: "center" }}>
            <div style={{ fontSize: 15, color: T.text, lineHeight: 1.6, marginBottom: 24 }}>{modal.mensaje}</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={cerrarModal} style={{ flex: 1, padding: "14px", borderRadius: 14, border: `1px solid ${T.border}`, background: T.surface2, color: T.text, cursor: "pointer", fontSize: 15, fontFamily: "'Georgia', serif" }}>Cancelar</button>
              <button onClick={() => { cerrarModal(); modal.onConfirm(); }} style={{ flex: 1, padding: "14px", borderRadius: 14, border: "none", background: "linear-gradient(135deg, #ff758c, #ff4d6d)", color: "#fff", cursor: "pointer", fontSize: 15, fontWeight: "bold", fontFamily: "'Georgia', serif", boxShadow: "0 10px 24px rgba(255,77,109,0.24)" }}>Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", top: "calc(20px + env(safe-area-inset-top))", left: "50%", transform: "translateX(-50%)", background: toast.tipo === "err" ? "#E8375A" : "#2ec4b6", color: "#fff", padding: "12px 18px", borderRadius: 18, fontWeight: "bold", fontSize: 14, zIndex: 999, boxShadow: "0 10px 24px rgba(0,0,0,0.14)", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 8 }}>
          <IconoLinea name={toast.tipo === "err" ? "trash" : "check"} size={14} color="#fff" />
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
            <button onClick={cerrarSesion} style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.text2, cursor: "pointer", fontSize: 13, padding: "10px 16px", borderRadius: 14, fontFamily: "'Georgia', serif", minHeight: 44, boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>Salir</button>
          </div>
        ) : (
          <div style={{ textAlign: "center" }}>
            <button onClick={volverAGrupos} style={{ background: "none", border: "none", color: T.accent2, cursor: "pointer", fontSize: 14, padding: "8px 0", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, margin: "0 auto 8px", minHeight: 44 }}>
              <span style={{ width: 22, height: 22, borderRadius: 999, background: "rgba(255,117,140,0.10)", color: T.accent2, display: "inline-flex", alignItems: "center", justifyContent: "center", transform: "rotate(180deg)" }}>
                <IconoLinea name="chevron-right" size={12} color={T.accent2} />
              </span>
              Todos los grupos
            </button>
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
            }} style={{ width: "100%", padding: "14px 16px", borderRadius: 18, border: `1px solid rgba(255,77,109,0.20)`, background: "rgba(255,77,109,0.05)", color: T.text, cursor: "pointer", fontSize: 14, marginBottom: 14, fontFamily: "'Georgia', serif", textAlign: "left", minHeight: 60, display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ width: 38, height: 38, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,77,109,0.10)", color: T.accent, flexShrink: 0 }}>
                <IconoLinea name="bell" size={18} color={T.accent} />
              </span>
              <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 14, fontWeight: "bold", color: T.text }}>Activar notificaciones</span>
                <span style={{ fontSize: 12, color: T.text2 }}>Recibí avisos cuando se carga un gasto nuevo</span>
              </span>
            </button>
          )}
          {grupos.length === 0 && !mostrarFormGrupo && (
            <div style={{ textAlign: "center", color: T.text2, padding: "48px 0", fontSize: 14 }}>
              <div style={{ width: 60, height: 60, margin: "0 auto 14px", borderRadius: 20, background: "rgba(255,77,109,0.08)", color: T.accent, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <IconoLinea name="users" size={24} color={T.accent} />
              </div>
              Todavía no tenés grupos.<br />¡Creá el primero!
            </div>
          )}
          {[...grupos].sort((a, b) => a.creadoEn - b.creadoEn).map(grupo => (
            <GrupoCard key={grupo.id} grupo={grupo} usuarioUid={usuario.uid} onAbrir={abrirGrupo} onEliminar={eliminarGrupo} />
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
            <button onClick={() => setMostrarFormGrupo(true)} style={{ width: "100%", padding: "17px", borderRadius: 18, background: "transparent", border: `2px dashed ${T.border}`, color: T.text2, cursor: "pointer", fontSize: 15, marginTop: grupos.length > 0 ? 4 : 0, fontFamily: "'Georgia', serif", minHeight: 58, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
              <span style={{ width: 32, height: 32, borderRadius: 12, background: "rgba(255,77,109,0.08)", color: T.accent, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <IconoLinea name="plus" size={16} color={T.accent} />
              </span>
              Nuevo grupo
            </button>
          )}
        </div>
      )}

      {/* ── INICIO GRUPO ── */}
      {vista === "inicio" && grupoActivo && (
        <div style={{ width: "100%", maxWidth: 430, padding: "0 20px" }}>
          <div style={{
            background: balance === 0 ? "linear-gradient(135deg, #2ec4b6, #1a8a84)" : balance > 0 ? "linear-gradient(135deg, #ff758c, #ff4d6d)" : "linear-gradient(135deg, #667eea, #764ba2)",
            borderRadius: 24, padding: "24px 24px 22px", marginBottom: 20,
            boxShadow: "0 6px 24px rgba(0,0,0,0.12)", textAlign: "center",
          }}>
            <div style={{ fontSize: 11, letterSpacing: 3, textTransform: "uppercase", color: "rgba(255,255,255,0.8)", marginBottom: 8 }}>
              {balance === 0 ? "Balance al día" : balance > 0 ? "Te deben" : "Vos debés"}
            </div>
            <div style={{ fontSize: 44, fontWeight: "bold", color: "#fff", marginBottom: 4 }}>${formatMonto(Math.abs(balance))}</div>
            <div style={{ fontSize: 15, color: "rgba(255,255,255,0.9)" }}>
              {balance === 0 ? "Están a mano" : balance > 0 ? `${nombreOtro} te debe a vos` : `Vos le debés a ${nombreOtro}`}
            </div>
            {gastosActuales.length > 0 && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", marginTop: 6 }}>{gastosActuales.length} gasto{gastosActuales.length !== 1 ? "s" : ""} este período</div>}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
              {[
              { label: "Nuevo gasto", icon: "plus", action: () => { resetFormGasto(); setVista("nuevo"); }, disabled: false },
              { label: "Historial",   icon: "list", action: () => setVista("historial"), disabled: false },
              { label: "Saldar",      icon: "check", action: () => confirmar(`¿Confirman que saldaron las cuentas con ${nombreOtro}?`, saldarCuentas), disabled: gastosActuales.length === 0 },
            ].map(btn => (
              <button key={btn.label} onClick={btn.disabled ? undefined : btn.action}
                style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 18, padding: "16px 8px", color: T.text, cursor: btn.disabled ? "default" : "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, fontSize: 12, fontFamily: "'Georgia', serif", minHeight: 88, opacity: btn.disabled ? 0.35 : 1, boxShadow: "0 1px 6px rgba(0,0,0,0.05)" }}
                onMouseEnter={e => { if (!btn.disabled) e.currentTarget.style.background = T.surface2; }}
                onMouseLeave={e => { if (!btn.disabled) e.currentTarget.style.background = T.surface; }}
              >
                <span style={{ width: 38, height: 38, borderRadius: 12, background: btn.icon === "list" ? "rgba(124,106,246,0.08)" : btn.icon === "check" ? "rgba(46,196,182,0.10)" : "rgba(255,77,109,0.08)", color: btn.icon === "list" ? "#7C6AF6" : btn.icon === "check" ? "#1a8a84" : T.accent, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <IconoLinea name={btn.icon} size={18} color={btn.icon === "list" ? "#7C6AF6" : btn.icon === "check" ? "#1a8a84" : T.accent} />
                </span>
                {btn.label}
              </button>
            ))}
          </div>

          {cargandoGastos ? (
            <div style={{ textAlign: "center", color: T.text2, padding: "36px 0", fontSize: 14 }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
              Cargando...
            </div>
          ) : gastosActuales.length > 0 ? (
            <div>
              <div style={{ fontSize: 11, letterSpacing: 3, textTransform: "uppercase", color: T.text2, marginBottom: 12 }}>Últimos gastos</div>
              {gastosActuales.slice(0, 4).map(g => <GastoRow key={g.id} g={g} catMeta={catMeta} nombreGrupo={nombreOtro} miUid={usuario.uid} onEliminar={eliminarGasto} onEditar={abrirEditar} />)}
              {gastosActuales.length > 4 && (
                <button onClick={() => setVista("historial")} style={{ background: "none", border: "none", color: T.accent2, cursor: "pointer", fontSize: 14, padding: "10px 0", width: "100%", textAlign: "center", minHeight: 44 }}>Ver todos ({gastosActuales.length}) →</button>
              )}
            </div>
          ) : (
              <div style={{ textAlign: "center", color: T.text2, padding: "36px 0", fontSize: 14 }}>
              <div style={{ width: 54, height: 54, borderRadius: 18, margin: "0 auto 14px", display: "flex", alignItems: "center", justifyContent: "center", color: T.accent, background: "rgba(255,77,109,0.08)" }}>
                <IconoLinea name="plus" size={22} color={T.accent} />
              </div>
              {gastos.length > 0 ? <>Cuentas saldadas con {nombreOtro}.<br />¡Cargá el próximo gasto!</> : <>No hay gastos con {nombreOtro}.<br />¡Cargá el primero!</>}
            </div>
          )}
        </div>
      )}

      {vista === "nuevo" && grupoActivo && (
        <ExpenseFormView
          title="Nuevo gasto"
          subtitle={`Cargá un gasto con ${nombreOtro} en pocos pasos`}
          submitLabel={guardando ? "Guardando..." : "Guardar gasto"}
          onBack={() => setVista("inicio")}
          onSubmit={agregarGasto}
          disabled={guardando}
          form={form}
          setForm={setForm}
          modoUI={modoUI}
          resumenForm={resumenForm}
          nombreOtro={nombreOtro}
        />
      )}

      {vista === "editar" && grupoActivo && gastoEditando && (
        <ExpenseFormView
          title="Editar gasto"
          subtitle="Actualizá el gasto sin cambiar el flujo"
          submitLabel={guardando ? "Guardando..." : "Guardar cambios"}
          onBack={() => { resetFormGasto(); setVista("inicio"); }}
          onSubmit={editarGastoGuardar}
          disabled={guardando}
          form={form}
          setForm={setForm}
          modoUI={modoUI}
          resumenForm={resumenForm}
          nombreOtro={nombreOtro}
        />
      )}

      {vista === "historial" && grupoActivo && (
        <HistoryView
          onBack={() => setVista("inicio")}
          nombreOtro={nombreOtro}
          mesesHistorial={mesesHistorial}
          mesActivoHistorial={mesActivoHistorial}
          setMesSeleccionado={setMesSeleccionado}
          fmtMes={fmtMes}
          filtro={filtro}
          setFiltro={setFiltro}
          gastos={gastos}
          gastosFiltrados={gastosFiltrados}
          gastosMesActivo={gastosMesActivo}
          totalMesActivo={totalMesActivo}
          balanceMesActivo={balanceMesActivo}
          catMeta={catMeta}
          usuario={usuario}
          eliminarGasto={eliminarGasto}
          abrirEditar={abrirEditar}
        />
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

function ExpenseFormView({ title, subtitle, submitLabel, onBack, onSubmit, disabled, form, setForm, modoUI, resumenForm, nombreOtro }) {
  return (
    <div style={{ width: "100%", maxWidth: 430, padding: "0 20px" }}>
      <button onClick={onBack} style={{ background: "none", border: "none", color: T.accent2, cursor: "pointer", fontSize: 14, marginBottom: 16, padding: "8px 0", minHeight: 44 }}>← Volver</button>
      <div style={{ background: T.surface, borderRadius: 22, padding: "24px 20px", border: `1px solid ${T.border}`, boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
        <h2 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: "normal", color: T.text }}>{title}</h2>
        <div style={{ fontSize: 13, color: T.text2, marginBottom: 22 }}>{subtitle}</div>

        <label style={labelStyle}>Descripción</label>
        <input placeholder="Ej: Pizza del viernes" value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} style={inputStyle} maxLength={80} />

        <label style={labelStyle}>Monto total ($)</label>
        <input placeholder="0" type="text" inputMode="decimal" value={form.monto} onChange={e => setForm(f => ({ ...f, monto: formatMontoInput(e.target.value) }))} style={{ ...inputStyle, fontSize: 30, textAlign: "center", fontWeight: "bold", background: T.surface }} />

        <label style={labelStyle}>Quién pagó</label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
          {[{ id: "yo", label: "Yo" }, { id: "otro", label: nombreOtro }].map(op => (
            <button key={op.id} onClick={() => setForm(f => ({ ...f, modo: getModoDesdeUI(op.id, modoUI.tipoDivision) }))} style={{
              minHeight: 58, borderRadius: 16, border: modoUI.quienPago === op.id ? `2px solid ${T.accent}` : `1px solid ${T.border}`,
              background: modoUI.quienPago === op.id ? "rgba(255,77,109,0.08)" : T.surface,
              color: T.text, cursor: "pointer", fontSize: 15, fontWeight: "bold", fontFamily: "'Georgia', serif"
            }}>{op.label}</button>
          ))}
        </div>

        <label style={labelStyle}>Cómo se reparte</label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
          {[{ id: "total", label: "Total" }, { id: "mitad", label: "Mitad" }].map(op => (
            <button key={op.id} onClick={() => setForm(f => ({ ...f, modo: getModoDesdeUI(modoUI.quienPago, op.id) }))} style={{
              minHeight: 58, borderRadius: 16, border: modoUI.tipoDivision === op.id ? `2px solid ${T.accent}` : `1px solid ${T.border}`,
              background: modoUI.tipoDivision === op.id ? "rgba(255,77,109,0.08)" : T.surface,
              color: T.text, cursor: "pointer", fontSize: 15, fontWeight: "bold", fontFamily: "'Georgia', serif"
            }}>{op.label}</button>
          ))}
        </div>

        <label style={labelStyle}>Categoría</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
          {CATEGORIAS.map(c => (
            <button key={c.id} onClick={() => setForm(f => ({ ...f, categoria: c.id }))} style={{
              padding: "10px 14px", borderRadius: 999, border: form.categoria === c.id ? `2px solid ${T.accent}` : `1px solid ${T.border}`,
              background: form.categoria === c.id ? "rgba(255,77,109,0.08)" : T.surface, color: T.text, cursor: "pointer",
              fontSize: 13, display: "flex", alignItems: "center", gap: 8, fontFamily: "'Georgia', serif"
            }}>
              <IconoLinea name={c.icon} size={15} color={form.categoria === c.id ? T.accent : (CAT_COLORES[c.id] || T.text2)} />
              {c.label}
            </button>
          ))}
        </div>

        {resumenForm && (
          <div style={{ background: resumenForm.fondo, borderRadius: 18, padding: "16px", marginBottom: 18, border: `1px solid ${resumenForm.borde}` }}>
            <div style={{ fontSize: 14, fontWeight: "bold", color: T.text, marginBottom: 6 }}>{resumenForm.titulo}</div>
            <div style={{ fontSize: 23, fontWeight: "bold", color: resumenForm.color, lineHeight: 1.2 }}>{resumenForm.texto}</div>
          </div>
        )}

        <button onClick={onSubmit} disabled={disabled} style={{ width: "100%", padding: "17px", borderRadius: 14, border: "none", background: disabled ? "rgba(255,77,109,0.35)" : "linear-gradient(135deg, #ff758c, #ff4d6d)", color: "#fff", fontSize: 16, fontWeight: "bold", cursor: disabled ? "not-allowed" : "pointer", boxShadow: disabled ? "none" : "0 4px 18px rgba(255,77,109,0.3)", fontFamily: "'Georgia', serif", minHeight: 54 }}>
          {submitLabel}
        </button>
      </div>
    </div>
  );
}

function HistoryView({ onBack, nombreOtro, mesesHistorial, mesActivoHistorial, setMesSeleccionado, fmtMes, filtro, setFiltro, gastos, gastosFiltrados, gastosMesActivo, totalMesActivo, balanceMesActivo, catMeta, usuario, eliminarGasto, abrirEditar }) {
  return (
    <div style={{ width: "100%", maxWidth: 430, padding: "0 20px" }}>
      <button onClick={onBack} style={{ background: "none", border: "none", color: T.accent2, cursor: "pointer", fontSize: 14, marginBottom: 16, padding: "8px 0", minHeight: 44 }}>← Volver</button>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: "normal", color: T.text }}>Historial</h2>
        <div style={{ fontSize: 13, color: T.text2 }}>Análisis y movimientos con {nombreOtro}</div>
      </div>

      {mesesHistorial.length > 0 && (
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8, marginBottom: 12 }}>
          {mesesHistorial.map(m => (
            <button key={m} onClick={() => setMesSeleccionado(m)} style={{
              padding: "8px 13px", borderRadius: 999, whiteSpace: "nowrap", fontSize: 12, fontWeight: "bold",
              border: mesActivoHistorial === m ? `2px solid ${T.accent}` : `1px solid ${T.border}`,
              background: mesActivoHistorial === m ? "rgba(255,77,109,0.08)" : T.surface,
              color: T.text, cursor: "pointer", minHeight: 34, flexShrink: 0, fontFamily: "'Georgia', serif"
            }}>{fmtMes(m)}</button>
          ))}
        </div>
      )}

      {filtro === "todos" && gastosMesActivo.length >= 1 && (
        <div style={{ background: T.surface, borderRadius: 22, padding: "18px", marginBottom: 16, border: `1px solid ${T.border}`, boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
          <div style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: T.text2, marginBottom: 12 }}>Resumen de {fmtMes(mesActivoHistorial)}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
            <div style={{ background: T.surface2, borderRadius: 16, padding: "14px 12px", border: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 12, color: T.text2 }}>Total cargado</div>
              <div style={{ marginTop: 6, fontSize: 18, fontWeight: "bold", color: T.text }}>${formatMonto(totalMesActivo)}</div>
            </div>
            <div style={{ background: T.surface2, borderRadius: 16, padding: "14px 12px", border: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 12, color: T.text2 }}>Balance</div>
              <div style={{ marginTop: 6, fontSize: 18, fontWeight: "bold", color: balanceMesActivo >= 0 ? "#E84070" : "#7C6AF6" }}>
                {balanceMesActivo >= 0 ? "Te deben" : "Debés"} ${formatMonto(Math.abs(balanceMesActivo))}
              </div>
            </div>
          </div>
          <TortaGastos gastos={gastosMesActivo} />
        </div>
      )}

      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 12, marginBottom: 16 }}>
        <button onClick={() => setFiltro("todos")} style={{ padding: "8px 16px", borderRadius: 20, whiteSpace: "nowrap", border: filtro === "todos" ? `2px solid ${T.accent}` : `1px solid ${T.border}`, background: filtro === "todos" ? "rgba(255,77,109,0.08)" : T.surface, color: T.text, cursor: "pointer", fontSize: 13, minHeight: 36, fontFamily: "'Georgia', serif" }}>Todos</button>
        {CATEGORIAS.filter(c => gastos.some(g => g.categoria === c.id)).map(c => (
          <button key={c.id} onClick={() => setFiltro(c.id)} style={{ padding: "8px 14px", borderRadius: 20, whiteSpace: "nowrap", border: filtro === c.id ? `2px solid ${T.accent}` : `1px solid ${T.border}`, background: filtro === c.id ? "rgba(255,77,109,0.08)" : T.surface, color: T.text, cursor: "pointer", fontSize: 13, minHeight: 36, display: "flex", alignItems: "center", gap: 8 }}>
            <IconoLinea name={c.icon} size={14} color={filtro === c.id ? T.accent : (CAT_COLORES[c.id] || T.text2)} />
            {c.label}
          </button>
        ))}
      </div>

      {gastosFiltrados.length === 0
        ? <div style={{ textAlign: "center", color: T.text2, padding: "36px 0", fontSize: 14 }}>No hay gastos en esta categoría</div>
        : (() => {
            const items = [];
            let lastSaldadoEn = -1;
            for (const g of gastosFiltrados) {
              const se = g.saldadoEn || null;
              if (se !== null && se !== lastSaldadoEn) items.push({ _divider: true, saldadoEn: se });
              lastSaldadoEn = se;
              items.push(g);
            }
            return items.map(item => item._divider
              ? (
                <div key={`saldado-${item.saldadoEn}`} style={{ display: "flex", alignItems: "center", gap: 10, margin: "4px 0 10px" }}>
                  <div style={{ flex: 1, height: 1, background: T.border }} />
                  <div style={{ fontSize: 11, color: T.text3, letterSpacing: 0.5, whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6 }}>
                    <IconoLinea name="check" size={12} color={T.text3} />
                    Saldado el {new Date(item.saldadoEn).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" })}
                  </div>
                  <div style={{ flex: 1, height: 1, background: T.border }} />
                </div>
              )
              : (
                <div key={item.id} style={{ opacity: item.saldadoEn ? 0.5 : 1 }}>
                  <GastoRow g={item} catMeta={catMeta} nombreGrupo={nombreOtro} miUid={usuario.uid} onEliminar={eliminarGasto} onEditar={abrirEditar} />
                </div>
              )
            );
          })()
      }
    </div>
  );
}

// ─── GrupoCard ────────────────────────────────────────────────────────────────
function GrupoCard({ grupo, usuarioUid, onAbrir, onEliminar }) {
  const [balance, setBalance] = useState(0);
  const [cantGastos, setCantGastos] = useState(0);

  useEffect(() => {
    const q = query(collection(db, "gastos"), where("grupoId", "==", grupo.id));
    const unsub = onSnapshot(q,
      (snap) => {
        const gastos = snap.docs.map(d => d.data());
        setCantGastos(gastos.length);
        setBalance(calcularBalance(gastos, usuarioUid));
      },
      (error) => { console.error("Error al cargar balance:", error); }
    );
    return () => unsub();
  }, [grupo.id, usuarioUid]);

  const esMio = grupo.creadoPor === usuarioUid;

  return (
    <div style={{ background: T.surface, borderRadius: 20, marginBottom: 12, border: `1px solid ${T.border}`, boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
      <div style={{ display: "flex", alignItems: "center", padding: "16px" }}>
        <div style={{ width: 48, height: 48, borderRadius: 15, background: grupo.color, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: "bold", color: "#fff", boxShadow: "0 3px 10px rgba(0,0,0,0.15)" }}>
          {grupo.nombre.charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1, marginLeft: 14 }}>
          <div style={{ fontSize: 17, fontWeight: "bold", color: T.text, display: "flex", alignItems: "center", gap: 8 }}>
            {grupo.nombre}
            {grupo.miembros.length === 1 && (
              <span style={{ fontSize: 10, background: "rgba(247,151,30,0.12)", color: "#D4890A", borderRadius: 999, padding: "4px 8px", fontWeight: "bold", letterSpacing: 0.5 }}>PENDIENTE</span>
            )}
          </div>
          <div style={{ fontSize: 12, color: T.text2, marginTop: 5, lineHeight: 1.45 }}>
            {grupo.miembros.length === 1
              ? "El otro usuario aún no tiene cuenta"
              : cantGastos === 0 ? "Sin gastos" : `${cantGastos} gasto${cantGastos !== 1 ? "s" : ""}`}
            {grupo.miembros.length > 1 && balance !== 0 && (
              <span style={{ color: balance > 0 ? "#E84070" : "#7C6AF6", marginLeft: 6, fontWeight: "bold" }}>
                · {balance > 0 ? `te debe $${formatMonto(balance)}` : `le debés $${formatMonto(Math.abs(balance))}`}
              </span>
            )}
            {grupo.miembros.length > 1 && balance === 0 && cantGastos > 0 && (
              <span style={{ color: "#2ec4b6", marginLeft: 6, fontWeight: "bold" }}>· a mano</span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {esMio && (
            <button onClick={() => onEliminar(grupo)} style={{ background: "rgba(232,55,90,0.07)", border: "none", color: "#E8375A", cursor: "pointer", width: 42, height: 42, borderRadius: 13, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <IconoLinea name="trash" size={17} color="#E8375A" />
            </button>
          )}
          <button onClick={() => onAbrir(grupo)} style={{ background: grupo.color, border: "none", color: "#fff", cursor: "pointer", fontSize: 13, padding: "0 14px", height: 42, borderRadius: 13, fontWeight: "bold", fontFamily: "'Georgia', serif", boxShadow: "0 3px 10px rgba(0,0,0,0.1)", display: "flex", alignItems: "center", gap: 8 }}>
            Ver
            <IconoLinea name="chevron-right" size={15} color="#fff" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── GastoRow ─────────────────────────────────────────────────────────────────
function GastoRow({ g, catMeta, nombreGrupo, miUid, onEliminar, onEditar }) {
  const etiqueta = getEtiqueta(g, miUid, nombreGrupo);
  const { monto, signo, color } = getMontoYSigno(g, miUid);
  const esMio = g.cargadoPor === miUid;
  const categoria = catMeta(g.categoria);

  return (
    <div style={{ background: T.surface, borderRadius: 15, padding: "14px 12px 14px 16px", marginBottom: 10, border: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 12, boxShadow: "0 1px 6px rgba(0,0,0,0.04)" }}>
      <div style={{ width: 40, height: 40, borderRadius: 13, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.9)", color: CAT_COLORES[g.categoria] || T.text2, boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.04)", flexShrink: 0 }}>
        <IconoLinea name={categoria.icon} size={18} color={CAT_COLORES[g.categoria] || T.text2} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: "bold", color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{g.descripcion}</div>
        <div style={{ fontSize: 11, color: T.text2, marginTop: 3, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 4 }}>
          <span>{g.fecha} · {g.hora}</span>
          <span style={{ color: T.text3 }}>·</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <IconoLinea name={etiqueta.icon} size={11} color={color} />
            {etiqueta.label}
          </span>
          <span style={{ color: T.text3 }}>·</span>
          <span>cargó {esMio ? "vos" : g.cargadoPorNombre || nombreGrupo}</span>
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontSize: 16, fontWeight: "bold", color }}>{signo}${formatMonto(monto)}</div>
        <div style={{ fontSize: 10, color: T.text3 }}>total: ${formatMonto(g.monto)}</div>
      </div>
      {esMio && (
        <button onClick={() => onEditar(g)} style={{ background: "none", border: "none", color: T.text3, cursor: "pointer", width: 32, height: 44, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <IconoLinea name="edit" size={15} color={T.text3} />
        </button>
      )}
      <button onClick={() => onEliminar(g.id)} style={{ background: "none", border: "none", color: T.text3, cursor: "pointer", width: 32, height: 44, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <IconoLinea name="trash" size={15} color={T.text3} />
      </button>
    </div>
  );
}
