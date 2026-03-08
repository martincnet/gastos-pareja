import { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import {
  getFirestore, collection, addDoc, deleteDoc,
  doc, onSnapshot, query, orderBy, writeBatch,
  getDocs, where, setDoc, getDoc
} from "firebase/firestore";
import {
  getAuth, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, signOut, onAuthStateChanged
} from "firebase/auth";

// ⚠️ REEMPLAZÁ CON TUS CREDENCIALES DE FIREBASE
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

const CATEGORIAS = [
  { id: "comida", label: "Comida", emoji: "🍕" },
  { id: "super", label: "Super", emoji: "🛒" },
  { id: "salidas", label: "Salidas", emoji: "🎬" },
  { id: "transporte", label: "Transporte", emoji: "🚌" },
  { id: "casa", label: "Casa", emoji: "🏠" },
  { id: "salud", label: "Salud", emoji: "💊" },
  { id: "ropa", label: "Ropa", emoji: "👗" },
  { id: "viajes", label: "Viajes", emoji: "✈️" },
  { id: "otro", label: "Otro", emoji: "📦" },
];

const COLORES_GRUPO = [
  "linear-gradient(135deg, #ff758c, #ff4d6d)",
  "linear-gradient(135deg, #667eea, #764ba2)",
  "linear-gradient(135deg, #2ec4b6, #1a8a84)",
  "linear-gradient(135deg, #f7971e, #ffd200)",
  "linear-gradient(135deg, #56ab2f, #a8e063)",
  "linear-gradient(135deg, #ee0979, #ff6a00)",
];

// Modos desde la perspectiva de quien carga el gasto
const MODOS = [
  { id: "pague_yo_total", label: "Pagué yo, me deben el total", emoji: "💸", desc: "El otro te debe todo" },
  { id: "pague_yo_mitad", label: "Pagué yo, me deben la mitad", emoji: "✂️", desc: "Se divide al 50%" },
  { id: "pago_otro_total", label: "Pagó el otro, le debo el total", emoji: "🙏", desc: "Le debés todo al otro" },
  { id: "pago_otro_mitad", label: "Pagó el otro, le debo la mitad", emoji: "💝", desc: "Se divide al 50%" },
];

// Calcula el balance desde la perspectiva del usuario actual
// gasto.cargadoPor = uid de quien cargó el gasto
// si yo cargué el gasto:
//   pague_yo_total → el otro me debe el total → +monto
//   pague_yo_mitad → el otro me debe la mitad → +monto/2
//   pago_otro_total → yo le debo el total → -monto
//   pago_otro_mitad → yo le debo la mitad → -monto/2
// si el otro cargó el gasto (perspectiva invertida):
//   pague_yo_total (desde su perspectiva) → él pagó, yo le debo el total → -monto
//   pague_yo_mitad → él pagó, yo le debo la mitad → -monto/2
//   pago_otro_total → yo pagué, él me debe el total → +monto
//   pago_otro_mitad → yo pagué, él me debe la mitad → +monto/2
function calcularBalance(gastos, miUid) {
  let balance = 0;
  for (const g of gastos) {
    const yoCargue = g.cargadoPor === miUid;
    if (yoCargue) {
      if (g.modo === "pague_yo_total") balance += g.monto;
      else if (g.modo === "pague_yo_mitad") balance += g.monto / 2;
      else if (g.modo === "pago_otro_total") balance -= g.monto;
      else if (g.modo === "pago_otro_mitad") balance -= g.monto / 2;
    } else {
      // El otro cargó → perspectiva invertida
      if (g.modo === "pague_yo_total") balance -= g.monto;
      else if (g.modo === "pague_yo_mitad") balance -= g.monto / 2;
      else if (g.modo === "pago_otro_total") balance += g.monto;
      else if (g.modo === "pago_otro_mitad") balance += g.monto / 2;
    }
  }
  return balance;
}

// Etiqueta del gasto desde la perspectiva del usuario actual
function getEtiqueta(g, miUid, nombreOtro) {
  const yoCargue = g.cargadoPor === miUid;
  const modo = g.modo;
  if (yoCargue) {
    if (modo === "pague_yo_total") return { label: `${nombreOtro} te debe el total`, emoji: "💸" };
    if (modo === "pague_yo_mitad") return { label: `${nombreOtro} te debe la mitad`, emoji: "✂️" };
    if (modo === "pago_otro_total") return { label: `Le debés el total a ${nombreOtro}`, emoji: "🙏" };
    if (modo === "pago_otro_mitad") return { label: `Le debés la mitad a ${nombreOtro}`, emoji: "💝" };
  } else {
    if (modo === "pague_yo_total") return { label: `Le debés el total a ${nombreOtro}`, emoji: "🙏" };
    if (modo === "pague_yo_mitad") return { label: `Le debés la mitad a ${nombreOtro}`, emoji: "💝" };
    if (modo === "pago_otro_total") return { label: `${nombreOtro} te debe el total`, emoji: "💸" };
    if (modo === "pago_otro_mitad") return { label: `${nombreOtro} te debe la mitad`, emoji: "✂️" };
  }
  return { label: "", emoji: "" };
}

// Monto a mostrar desde la perspectiva del usuario
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

  return { monto, signo: meDebenAMi ? "+" : "-", color: meDebenAMi ? "#fb7185" : "#a78bfa" };
}

function AuthScreen() {
  const [modo, setModo] = useState("login");
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  const traducirError = (code) => {
    switch (code) {
      case "auth/email-already-in-use": return "Ese email ya está registrado";
      case "auth/invalid-email": return "El email no es válido";
      case "auth/weak-password": return "La contraseña debe tener al menos 6 caracteres";
      case "auth/invalid-credential": return "Email o contraseña incorrectos";
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
    <div style={{ minHeight: "100vh", background: "#0a0a0f", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px", fontFamily: "'Georgia', serif", color: "#f0ece8" }}>
      <div style={{ position: "fixed", top: -100, right: -100, width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,100,130,0.1), transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "fixed", bottom: -80, left: -80, width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(100,150,255,0.08), transparent 70%)", pointerEvents: "none" }} />

      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>💸</div>
        <h1 style={{ fontSize: 28, fontWeight: "normal", margin: 0 }}>SplitEasy</h1>
        <div style={{ fontSize: 13, opacity: 0.5, marginTop: 6 }}>Dividí gastos sin drama</div>
      </div>

      <div style={{ width: "100%", maxWidth: 380, background: "rgba(255,255,255,0.05)", borderRadius: 20, padding: "28px 24px", border: "1px solid rgba(255,255,255,0.1)" }}>
        <div style={{ display: "flex", background: "rgba(255,255,255,0.07)", borderRadius: 12, padding: 4, marginBottom: 24 }}>
          {["login", "registro"].map(m => (
            <button key={m} onClick={() => { setModo(m); setError(""); }} style={{
              flex: 1, padding: "10px", borderRadius: 10, border: "none",
              background: modo === m ? "rgba(255,117,140,0.3)" : "transparent",
              color: modo === m ? "#ff758c" : "rgba(255,255,255,0.5)",
              cursor: "pointer", fontSize: 14, fontWeight: modo === m ? "bold" : "normal", fontFamily: "'Georgia', serif",
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
        <input placeholder="tu@email.com" type="email" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} />

        <label style={labelStyle}>Contraseña</label>
        <input placeholder={modo === "registro" ? "Mínimo 6 caracteres" : "Tu contraseña"} type="password"
          value={password} onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleSubmit()}
          style={{ ...inputStyle, marginBottom: error ? 8 : 20 }} />

        {error && <div style={{ color: "#ff4d6d", fontSize: 13, marginBottom: 16, textAlign: "center" }}>{error}</div>}

        <button onClick={handleSubmit} disabled={cargando} style={{
          width: "100%", padding: "16px", borderRadius: 14, border: "none",
          background: cargando ? "rgba(255,117,140,0.4)" : "linear-gradient(135deg, #ff758c, #ff4d6d)",
          color: "#fff", fontSize: 16, fontWeight: "bold", cursor: cargando ? "not-allowed" : "pointer", fontFamily: "'Georgia', serif",
        }}>{cargando ? "Cargando..." : modo === "login" ? "Ingresar 🚀" : "Crear cuenta ✨"}</button>
      </div>
    </div>
  );
}

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
  const [mostrarFormGrupo, setMostrarFormGrupo] = useState(false);

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
    const unsub = onSnapshot(q, (snap) => {
      setGastos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [grupoActivo?.id]);

  const mostrarToast = (msg, tipo = "ok") => {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 2500);
  };

  const crearGrupo = async () => {
    const nombre = nuevoGrupoNombre.trim();
    const emailOtro = nuevoGrupoEmail.trim().toLowerCase();
    if (!nombre) return mostrarToast("Poné un nombre 😅", "err");
    if (!emailOtro) return mostrarToast("Poné el email de la otra persona 😅", "err");
    if (emailOtro === usuario.email.toLowerCase()) return mostrarToast("No podés invitarte a vos mismo 😅", "err");
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
      await addDoc(collection(db, "grupos"), {
        nombre,
        color: COLORES_GRUPO[colorIdx],
        creadoEn: Date.now(),
        creadoPor: usuario.uid,
        miembros: otroUid ? [usuario.uid, otroUid] : [usuario.uid],
        emailsInvitados: [usuario.email.toLowerCase(), emailOtro],
      });
      setNuevoGrupoNombre("");
      setNuevoGrupoEmail("");
      setMostrarFormGrupo(false);
      mostrarToast(`Grupo "${nombre}" creado! 🎉`);
    } catch {
      mostrarToast("Error al crear el grupo 😥", "err");
    }
    setGuardando(false);
  };

  const eliminarGrupo = async (grupo) => {
    if (!confirm(`¿Eliminar el grupo "${grupo.nombre}" y todos sus gastos?`)) return;
    try {
      const snap = await getDocs(query(collection(db, "gastos"), where("grupoId", "==", grupo.id)));
      const batch = writeBatch(db);
      snap.docs.forEach(d => batch.delete(d.ref));
      batch.delete(doc(db, "grupos", grupo.id));
      await batch.commit();
      mostrarToast("Grupo eliminado", "err");
    } catch {
      mostrarToast("Error al eliminar 😥", "err");
    }
  };

  const agregarGasto = async () => {
    if (!form.descripcion.trim()) return mostrarToast("Poné una descripción 😅", "err");
    if (!form.monto || isNaN(form.monto) || Number(form.monto) <= 0) return mostrarToast("El monto tiene que ser mayor a 0 💰", "err");
    setGuardando(true);
    try {
      await addDoc(collection(db, "gastos"), {
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
      });
      setForm({ descripcion: "", categoria: "comida", monto: "", modo: "pague_yo_mitad" });
      mostrarToast("¡Gasto cargado! 🎉");
      setGrupoActivo({ ...grupoActivo });
      setVista("inicio");
    } catch {
      mostrarToast("Error al guardar 😥", "err");
    }
    setGuardando(false);
  };

  const eliminarGasto = async (id) => {
    try {
      await deleteDoc(doc(db, "gastos", id));
      mostrarToast("Gasto eliminado", "err");
    } catch {
      mostrarToast("Error al eliminar 😥", "err");
    }
  };

  const saldarCuentas = async () => {
    try {
      const snap = await getDocs(query(collection(db, "gastos"), where("grupoId", "==", grupoActivo.id)));
      const batch = writeBatch(db);
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      mostrarToast("¡Cuentas saldadas! Empiecen de cero 🥂");
    } catch {
      mostrarToast("Error al saldar 😥", "err");
    }
  };

  const abrirGrupo = (grupo) => {
    setGrupoActivo(grupo);
    setGastos([]);
    setFiltro("todos");
    setVista("inicio");
  };

  const volverAGrupos = () => {
    setGrupoActivo(null);
    setGastos([]);
    setVista("grupos");
  };

  const cerrarSesion = async () => {
    if (confirm("¿Querés cerrar sesión?")) {
      await signOut(auth);
      setVista("grupos");
      setGrupoActivo(null);
    }
  };

  if (!authListo) return (
    <div style={{ minHeight: "100vh", background: "#0a0a0f", display: "flex", alignItems: "center", justifyContent: "center", color: "#f0ece8", flexDirection: "column", gap: 16 }}>
      <div style={{ fontSize: 40 }}>💸</div>
      <div style={{ fontSize: 14, opacity: 0.6, letterSpacing: 2 }}>CARGANDO...</div>
    </div>
  );

  if (!usuario) return <AuthScreen />;

  const balance = calcularBalance(gastos, usuario.uid);
  const gastosFiltrados = filtro === "todos" ? gastos : gastos.filter(g => g.categoria === filtro);
  const catEmoji = (id) => CATEGORIAS.find(c => c.id === id)?.emoji || "📦";
  const nombreGrupo = grupoActivo?.nombre || "";

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0f", fontFamily: "'Georgia', serif", color: "#f0ece8", display: "flex", flexDirection: "column", alignItems: "center", padding: "0 0 80px 0", position: "relative" }}>
      <div style={{ position: "fixed", top: -100, right: -100, width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,100,130,0.1), transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "fixed", bottom: -80, left: -80, width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(100,150,255,0.08), transparent 70%)", pointerEvents: "none" }} />

      {toast && (
        <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", background: toast.tipo === "err" ? "#ff4d6d" : "#2ec4b6", color: "#fff", padding: "10px 22px", borderRadius: 30, fontWeight: "bold", fontSize: 14, zIndex: 999, boxShadow: "0 4px 20px rgba(0,0,0,0.4)", whiteSpace: "nowrap" }}>
          {toast.msg}
        </div>
      )}

      <div style={{ width: "100%", maxWidth: 420, padding: "36px 20px 0" }}>
        {vista === "grupos" ? (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 11, letterSpacing: 4, textTransform: "uppercase", color: "rgba(255,180,200,0.6)", marginBottom: 4 }}>hola,</div>
              <h1 style={{ fontSize: 28, fontWeight: "normal", margin: 0, color: "#fff" }}>{usuarioData?.nombre || "bienvenido"} 👋</h1>
              <div style={{ fontSize: 11, color: "rgba(46,196,182,0.7)", marginTop: 4, letterSpacing: 1 }}>🟢 sincronizado</div>
            </div>
            <button onClick={cerrarSesion} style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: 12, padding: "8px 14px", borderRadius: 10, fontFamily: "'Georgia', serif" }}>Salir</button>
          </div>
        ) : (
          <div style={{ textAlign: "center" }}>
            <button onClick={volverAGrupos} style={{ background: "none", border: "none", color: "rgba(255,180,200,0.7)", cursor: "pointer", fontSize: 13, padding: 0, display: "block", margin: "0 auto 8px" }}>← Todos los grupos</button>
            <h1 style={{ fontSize: 28, fontWeight: "normal", margin: 0, color: "#fff" }}>{nombreGrupo}</h1>
          </div>
        )}
        <div style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(255,180,200,0.3), transparent)", margin: "16px 0" }} />
      </div>

      {/* GRUPOS */}
      {vista === "grupos" && (
        <div style={{ width: "100%", maxWidth: 420, padding: "0 20px" }}>
          {grupos.length === 0 && !mostrarFormGrupo && (
            <div style={{ textAlign: "center", opacity: 0.4, padding: "40px 0", fontSize: 14 }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>👥</div>
              Todavía no tenés grupos.<br />¡Creá el primero!
            </div>
          )}

          {grupos.sort((a, b) => a.creadoEn - b.creadoEn).map(grupo => (
            <GrupoCard key={grupo.id} grupo={grupo} usuarioUid={usuario.uid} onAbrir={abrirGrupo} onEliminar={eliminarGrupo} db={db} />
          ))}

          {mostrarFormGrupo && (
            <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 16, padding: "20px", marginBottom: 12, border: "1px solid rgba(255,255,255,0.1)" }}>
              <div style={{ fontSize: 13, marginBottom: 12, opacity: 0.7 }}>¿Con quién compartís gastos?</div>
              <label style={labelStyle}>Nombre del grupo</label>
              <input placeholder="Ej: Ailén, Juan..." value={nuevoGrupoNombre} onChange={e => setNuevoGrupoNombre(e.target.value)} style={inputStyle} />
              <label style={labelStyle}>Email de la otra persona</label>
              <input placeholder="su@email.com" type="email" value={nuevoGrupoEmail} onChange={e => setNuevoGrupoEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && crearGrupo()} style={inputStyle} />
              <div style={{ fontSize: 11, opacity: 0.4, marginTop: -12, marginBottom: 16 }}>La otra persona tiene que estar registrada en la app</div>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => { setMostrarFormGrupo(false); setNuevoGrupoNombre(""); setNuevoGrupoEmail(""); }} style={{ flex: 1, padding: "12px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.15)", background: "transparent", color: "#f0ece8", cursor: "pointer", fontSize: 14, fontFamily: "'Georgia', serif" }}>Cancelar</button>
                <button onClick={crearGrupo} disabled={guardando} style={{ flex: 2, padding: "12px", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #ff758c, #ff4d6d)", color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: "bold", fontFamily: "'Georgia', serif" }}>{guardando ? "Creando..." : "Crear grupo ✨"}</button>
              </div>
            </div>
          )}

          {!mostrarFormGrupo && (
            <button onClick={() => setMostrarFormGrupo(true)} style={{ width: "100%", padding: "16px", borderRadius: 14, background: "rgba(255,255,255,0.06)", border: "2px dashed rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: 15, marginTop: grupos.length > 0 ? 4 : 0, fontFamily: "'Georgia', serif" }}>+ Nuevo grupo</button>
          )}
        </div>
      )}

      {/* INICIO GRUPO */}
      {vista === "inicio" && grupoActivo && (
        <div style={{ width: "100%", maxWidth: 420, padding: "0 20px" }}>
          <div style={{
            background: balance === 0 ? "linear-gradient(135deg, #2ec4b6, #1a8a84)" : balance > 0 ? "linear-gradient(135deg, #ff758c, #ff4d6d)" : "linear-gradient(135deg, #667eea, #764ba2)",
            borderRadius: 20, padding: "24px 24px 20px", marginBottom: 20, boxShadow: "0 8px 32px rgba(0,0,0,0.4)", textAlign: "center",
          }}>
            <div style={{ fontSize: 12, letterSpacing: 3, textTransform: "uppercase", opacity: 0.8, marginBottom: 8 }}>balance con {nombreGrupo}</div>
            <div style={{ fontSize: 42, fontWeight: "bold", marginBottom: 4 }}>${Math.abs(balance).toFixed(2)}</div>
            <div style={{ fontSize: 15, opacity: 0.9 }}>
              {balance === 0 ? "✨ Están a mano" : balance > 0 ? `👉 ${nombreGrupo} te debe a vos` : `👉 Vos le debés a ${nombreGrupo}`}
            </div>
            {gastos.length > 0 && <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>{gastos.length} gasto{gastos.length !== 1 ? "s" : ""}</div>}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
            {[
              { label: "Nuevo gasto", icon: "➕", action: () => setVista("nuevo") },
              { label: "Historial", icon: "📋", action: () => setVista("historial") },
              { label: "Saldar", icon: "🤝", action: () => { if (gastos.length > 0 && confirm(`¿Confirman que saldaron las cuentas con ${nombreGrupo}?`)) saldarCuentas(); } },
            ].map(btn => (
              <button key={btn.label} onClick={btn.action} style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14, padding: "16px 8px", color: "#f0ece8", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, fontSize: 12, fontFamily: "'Georgia', serif" }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.14)"}
                onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.07)"}
              >
                <span style={{ fontSize: 22 }}>{btn.icon}</span>{btn.label}
              </button>
            ))}
          </div>

          {gastos.length > 0 ? (
            <div>
              <div style={{ fontSize: 11, letterSpacing: 3, textTransform: "uppercase", opacity: 0.5, marginBottom: 12 }}>últimos gastos</div>
              {gastos.slice(0, 4).map(g => <GastoRow key={g.id} g={g} catEmoji={catEmoji} nombreGrupo={nombreGrupo} miUid={usuario.uid} onEliminar={eliminarGasto} />)}
              {gastos.length > 4 && (
                <button onClick={() => setVista("historial")} style={{ background: "none", border: "none", color: "rgba(255,180,200,0.7)", cursor: "pointer", fontSize: 13, padding: "8px 0", width: "100%", textAlign: "center" }}>Ver todos ({gastos.length}) →</button>
              )}
            </div>
          ) : (
            <div style={{ textAlign: "center", opacity: 0.4, padding: "30px 0", fontSize: 14 }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>🌱</div>
              No hay gastos con {nombreGrupo}.<br />¡Cargá el primero!
            </div>
          )}
        </div>
      )}

      {/* NUEVO GASTO */}
      {vista === "nuevo" && grupoActivo && (
        <div style={{ width: "100%", maxWidth: 420, padding: "0 20px" }}>
          <button onClick={() => setVista("inicio")} style={{ background: "none", border: "none", color: "rgba(255,180,200,0.7)", cursor: "pointer", fontSize: 13, marginBottom: 16, padding: 0 }}>← Volver</button>
          <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 20, padding: "24px 20px", border: "1px solid rgba(255,255,255,0.1)" }}>
            <h2 style={{ margin: "0 0 20px", fontSize: 20, fontWeight: "normal" }}>Nuevo gasto con {nombreGrupo} ✨</h2>

            <label style={labelStyle}>Descripción</label>
            <input placeholder="Ej: Pizza el viernes" value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} style={inputStyle} />

            <label style={labelStyle}>Categoría</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 16 }}>
              {CATEGORIAS.map(c => (
                <button key={c.id} onClick={() => setForm(f => ({ ...f, categoria: c.id }))} style={{ padding: "10px 6px", borderRadius: 12, border: form.categoria === c.id ? "2px solid #ff758c" : "1px solid rgba(255,255,255,0.12)", background: form.categoria === c.id ? "rgba(255,117,140,0.2)" : "rgba(255,255,255,0.05)", color: "#f0ece8", cursor: "pointer", fontSize: 12, textAlign: "center" }}>
                  <div style={{ fontSize: 20 }}>{c.emoji}</div>{c.label}
                </button>
              ))}
            </div>

            <label style={labelStyle}>Monto total ($)</label>
            <input placeholder="0.00" type="number" value={form.monto} onChange={e => setForm(f => ({ ...f, monto: e.target.value }))} style={{ ...inputStyle, fontSize: 22, textAlign: "center" }} />

            <label style={labelStyle}>¿Cómo se divide?</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
              {MODOS.map(m => (
                <button key={m.id} onClick={() => setForm(f => ({ ...f, modo: m.id }))} style={{ padding: "12px 16px", borderRadius: 12, border: form.modo === m.id ? "2px solid #ff758c" : "1px solid rgba(255,255,255,0.12)", background: form.modo === m.id ? "rgba(255,117,140,0.15)" : "rgba(255,255,255,0.04)", color: "#f0ece8", cursor: "pointer", textAlign: "left", display: "flex", gap: 12, alignItems: "center", fontFamily: "'Georgia', serif" }}>
                  <span style={{ fontSize: 22 }}>{m.emoji}</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: "bold" }}>{m.label}</div>
                    <div style={{ fontSize: 11, opacity: 0.6 }}>{m.desc}</div>
                  </div>
                </button>
              ))}
            </div>

            {form.monto && !isNaN(form.monto) && Number(form.monto) > 0 && (
              <div style={{ background: "rgba(255,117,140,0.1)", borderRadius: 12, padding: "12px 16px", marginBottom: 16, fontSize: 13, border: "1px solid rgba(255,117,140,0.2)" }}>
                💡 {MODOS.find(m => m.id === form.modo)?.label}: <strong>${(form.modo.includes("mitad") ? Number(form.monto) / 2 : Number(form.monto)).toFixed(2)}</strong>
              </div>
            )}

            <button onClick={agregarGasto} disabled={guardando} style={{ width: "100%", padding: "16px", borderRadius: 14, border: "none", background: guardando ? "rgba(255,117,140,0.4)" : "linear-gradient(135deg, #ff758c, #ff4d6d)", color: "#fff", fontSize: 16, fontWeight: "bold", cursor: guardando ? "not-allowed" : "pointer", boxShadow: "0 4px 20px rgba(255,77,109,0.4)", fontFamily: "'Georgia', serif" }}>
              {guardando ? "Guardando..." : "Guardar gasto 💾"}
            </button>
          </div>
        </div>
      )}

      {/* HISTORIAL */}
      {vista === "historial" && grupoActivo && (
        <div style={{ width: "100%", maxWidth: 420, padding: "0 20px" }}>
          <button onClick={() => setVista("inicio")} style={{ background: "none", border: "none", color: "rgba(255,180,200,0.7)", cursor: "pointer", fontSize: 13, marginBottom: 16, padding: 0 }}>← Volver</button>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: "normal" }}>Historial con {nombreGrupo} 📋</h2>
            <span style={{ fontSize: 12, opacity: 0.5 }}>{gastos.length} gastos</span>
          </div>
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 12, marginBottom: 16 }}>
            <button onClick={() => setFiltro("todos")} style={{ padding: "6px 14px", borderRadius: 20, whiteSpace: "nowrap", border: filtro === "todos" ? "2px solid #ff758c" : "1px solid rgba(255,255,255,0.2)", background: filtro === "todos" ? "rgba(255,117,140,0.2)" : "transparent", color: "#f0ece8", cursor: "pointer", fontSize: 12 }}>Todos</button>
            {CATEGORIAS.filter(c => gastos.some(g => g.categoria === c.id)).map(c => (
              <button key={c.id} onClick={() => setFiltro(c.id)} style={{ padding: "6px 14px", borderRadius: 20, whiteSpace: "nowrap", border: filtro === c.id ? "2px solid #ff758c" : "1px solid rgba(255,255,255,0.2)", background: filtro === c.id ? "rgba(255,117,140,0.2)" : "transparent", color: "#f0ece8", cursor: "pointer", fontSize: 12 }}>{c.emoji} {c.label}</button>
            ))}
          </div>
          {gastosFiltrados.length === 0
            ? <div style={{ textAlign: "center", opacity: 0.4, padding: "30px 0", fontSize: 14 }}>No hay gastos en esta categoría</div>
            : gastosFiltrados.map(g => <GastoRow key={g.id} g={g} catEmoji={catEmoji} nombreGrupo={nombreGrupo} miUid={usuario.uid} onEliminar={eliminarGasto} />)
          }
        </div>
      )}

      <style>{`
        input:focus { outline: none; border-color: #ff758c !important; }
        input::placeholder { color: rgba(240,236,232,0.3); }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 2px; }
      `}</style>
    </div>
  );
}

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
    <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 16, marginBottom: 12, border: "1px solid rgba(255,255,255,0.08)" }}>
      <div style={{ display: "flex", alignItems: "center", padding: "16px" }}>
        <div style={{ width: 46, height: 46, borderRadius: 14, background: grupo.color, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: "bold", color: "#fff", boxShadow: "0 4px 12px rgba(0,0,0,0.3)" }}>
          {grupo.nombre.charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1, marginLeft: 14 }}>
          <div style={{ fontSize: 17, fontWeight: "bold" }}>{grupo.nombre}</div>
          <div style={{ fontSize: 12, opacity: 0.5, marginTop: 2 }}>
            {cantGastos === 0 ? "Sin gastos" : `${cantGastos} gasto${cantGastos !== 1 ? "s" : ""}`}
            {balance !== 0 && <span style={{ color: balance > 0 ? "#fb7185" : "#a78bfa", marginLeft: 6 }}>· {balance > 0 ? `te debe $${balance.toFixed(2)}` : `le debés $${Math.abs(balance).toFixed(2)}`}</span>}
            {balance === 0 && cantGastos > 0 && <span style={{ color: "#2ec4b6", marginLeft: 6 }}>· a mano ✨</span>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {esMio && <button onClick={() => onEliminar(grupo)} style={{ background: "rgba(255,77,109,0.15)", border: "none", color: "#ff4d6d", cursor: "pointer", fontSize: 16, padding: "8px 10px", borderRadius: 10 }}>🗑</button>}
          <button onClick={() => onAbrir(grupo)} style={{ background: grupo.color, border: "none", color: "#fff", cursor: "pointer", fontSize: 13, padding: "8px 14px", borderRadius: 10, fontWeight: "bold", fontFamily: "'Georgia', serif" }}>Ver →</button>
        </div>
      </div>
    </div>
  );
}

function GastoRow({ g, catEmoji, nombreGrupo, miUid, onEliminar }) {
  const etiqueta = getEtiqueta(g, miUid, nombreGrupo);
  const { monto, signo, color } = getMontoYSigno(g, miUid);
  const esMio = g.cargadoPor === miUid;

  return (
    <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 14, padding: "14px 16px", marginBottom: 10, border: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ fontSize: 26 }}>{catEmoji(g.categoria)}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: "bold", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{g.descripcion}</div>
        <div style={{ fontSize: 11, opacity: 0.5, marginTop: 2 }}>
          {g.fecha} · {g.hora} · {etiqueta.emoji} {etiqueta.label}
          <span style={{ marginLeft: 4 }}>· cargó {esMio ? "vos" : g.cargadoPorNombre || nombreGrupo}</span>
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 16, fontWeight: "bold", color }}>{signo}${monto.toFixed(2)}</div>
        <div style={{ fontSize: 10, opacity: 0.4 }}>total: ${g.monto.toFixed(2)}</div>
      </div>
      <button onClick={() => onEliminar(g.id)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.25)", cursor: "pointer", fontSize: 18, padding: "4px", borderRadius: 8 }}>×</button>
    </div>
  );
}

const inputStyle = {
  width: "100%", padding: "12px 14px", borderRadius: 12,
  background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)",
  color: "#f0ece8", fontSize: 15, marginBottom: 16, boxSizing: "border-box",
  fontFamily: "'Georgia', serif",
};

const labelStyle = {
  display: "block", fontSize: 11, letterSpacing: 2,
  textTransform: "uppercase", opacity: 0.6, marginBottom: 8,
};
