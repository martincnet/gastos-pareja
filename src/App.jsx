import { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import {
  getFirestore, collection, addDoc, deleteDoc,
  doc, onSnapshot, query, orderBy, writeBatch, getDocs, setDoc, where
} from "firebase/firestore";

// ⚠️ REEMPLAZÁ CON TUS CREDENCIALES DE FIREBASE (las mismas que ya tenés)
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
  "linear-gradient(135deg, #4776e6, #8e54e9)",
  "linear-gradient(135deg, #11998e, #38ef7d)",
];

function getModoLabel(modo, nombre) {
  switch (modo) {
    case "yo_pague_total": return { label: `${nombre} te debe todo`, emoji: "💸", desc: `Pagaste vos, ${nombre} te debe el total` };
    case "yo_pague_mitad": return { label: `${nombre} te debe la mitad`, emoji: "✂️", desc: `Pagaste vos, se dividen al 50%` };
    case "ella_pago_total": return { label: `Le debés todo a ${nombre}`, emoji: "🙏", desc: `Pagó ${nombre}, le debés el total` };
    case "ella_pago_mitad": return { label: `Le debés la mitad a ${nombre}`, emoji: "💝", desc: `Pagó ${nombre}, se dividen al 50%` };
    default: return { label: "", emoji: "", desc: "" };
  }
}

function calcularBalance(gastos) {
  let balance = 0;
  for (const g of gastos) {
    if (g.modo === "yo_pague_total") balance += g.monto;
    else if (g.modo === "yo_pague_mitad") balance += g.monto / 2;
    else if (g.modo === "ella_pago_total") balance -= g.monto;
    else if (g.modo === "ella_pago_mitad") balance -= g.monto / 2;
  }
  return balance;
}

export default function App() {
  const [grupos, setGrupos] = useState([]);
  const [grupoActivo, setGrupoActivo] = useState(null);
  const [gastos, setGastos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [vista, setVista] = useState("grupos"); // grupos | inicio | nuevo | historial
  const [form, setForm] = useState({ descripcion: "", categoria: "comida", monto: "", modo: "yo_pague_mitad" });
  const [toast, setToast] = useState(null);
  const [filtro, setFiltro] = useState("todos");
  const [guardando, setGuardando] = useState(false);
  const [nuevoGrupoNombre, setNuevoGrupoNombre] = useState("");
  const [mostrarFormGrupo, setMostrarFormGrupo] = useState(false);

  // Cargar grupos
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "grupos"), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setGrupos(data);
      setCargando(false);
    });
    return () => unsub();
  }, []);

  // Cargar gastos del grupo activo
  useEffect(() => {
    if (!grupoActivo) return;
    const q = query(
      collection(db, "gastos"),
      where("grupoId", "==", grupoActivo.id),
      orderBy("timestamp", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setGastos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [grupoActivo]);

  const mostrarToast = (msg, tipo = "ok") => {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 2500);
  };

  const crearGrupo = async () => {
    const nombre = nuevoGrupoNombre.trim();
    if (!nombre) return mostrarToast("Poné un nombre 😅", "err");
    if (grupos.some(g => g.nombre.toLowerCase() === nombre.toLowerCase()))
      return mostrarToast("Ya existe ese grupo 😅", "err");
    setGuardando(true);
    try {
      const colorIdx = grupos.length % COLORES_GRUPO.length;
      await addDoc(collection(db, "grupos"), {
        nombre,
        color: COLORES_GRUPO[colorIdx],
        creadoEn: Date.now(),
      });
      setNuevoGrupoNombre("");
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
      // Eliminar gastos del grupo
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
      });
      setForm({ descripcion: "", categoria: "comida", monto: "", modo: "yo_pague_mitad" });
      mostrarToast("¡Gasto cargado! 🎉");
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

  const balance = calcularBalance(gastos);
  const gastosFiltrados = filtro === "todos" ? gastos : gastos.filter(g => g.categoria === filtro);
  const catEmoji = (id) => CATEGORIAS.find(c => c.id === id)?.emoji || "📦";
  const nombre = grupoActivo?.nombre || "";

  if (cargando) return (
    <div style={{ minHeight: "100vh", background: "#0a0a0f", display: "flex", alignItems: "center", justifyContent: "center", color: "#f0ece8", flexDirection: "column", gap: 16 }}>
      <div style={{ fontSize: 40 }}>💸</div>
      <div style={{ fontSize: 14, opacity: 0.6, letterSpacing: 2 }}>CARGANDO...</div>
    </div>
  );

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0a0f",
      fontFamily: "'Georgia', serif",
      color: "#f0ece8",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: "0 0 80px 0",
      position: "relative",
    }}>
      {/* BG decoration */}
      <div style={{ position: "fixed", top: -100, right: -100, width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,100,130,0.1), transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "fixed", bottom: -80, left: -80, width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(100,150,255,0.08), transparent 70%)", pointerEvents: "none" }} />

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)",
          background: toast.tipo === "err" ? "#ff4d6d" : "#2ec4b6",
          color: "#fff", padding: "10px 22px", borderRadius: 30,
          fontWeight: "bold", fontSize: 14, zIndex: 999,
          boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
          whiteSpace: "nowrap",
        }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ width: "100%", maxWidth: 420, padding: "36px 20px 0", textAlign: "center" }}>
        {vista === "grupos" ? (
          <>
            <div style={{ fontSize: 11, letterSpacing: 4, textTransform: "uppercase", color: "rgba(255,180,200,0.6)", marginBottom: 8 }}>mis gastos</div>
            <h1 style={{ fontSize: 32, fontWeight: "normal", margin: 0, color: "#fff" }}>
              💸 SplitEasy
            </h1>
            <div style={{ fontSize: 11, color: "rgba(46,196,182,0.7)", marginTop: 6, letterSpacing: 1 }}>🟢 sincronizado en tiempo real</div>
          </>
        ) : (
          <>
            <button onClick={volverAGrupos} style={{ background: "none", border: "none", color: "rgba(255,180,200,0.7)", cursor: "pointer", fontSize: 13, marginBottom: 8, padding: 0, display: "block", margin: "0 auto 8px" }}>
              ← Todos los grupos
            </button>
            <h1 style={{ fontSize: 28, fontWeight: "normal", margin: 0, color: "#fff" }}>
              {nombre}
            </h1>
          </>
        )}
        <div style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(255,180,200,0.3), transparent)", margin: "16px 0" }} />
      </div>

      {/* VISTA: GRUPOS */}
      {vista === "grupos" && (
        <div style={{ width: "100%", maxWidth: 420, padding: "0 20px" }}>

          {grupos.length === 0 && !mostrarFormGrupo && (
            <div style={{ textAlign: "center", opacity: 0.4, padding: "40px 0", fontSize: 14 }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>👥</div>
              Todavía no tenés grupos.<br />¡Creá el primero!
            </div>
          )}

          {grupos.sort((a, b) => a.creadoEn - b.creadoEn).map((grupo, i) => {
            return (
              <GrupoCard key={grupo.id} grupo={grupo} onAbrir={abrirGrupo} onEliminar={eliminarGrupo} db={db} />
            );
          })}

          {/* Form nuevo grupo */}
          {mostrarFormGrupo && (
            <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 16, padding: "20px", marginBottom: 12, border: "1px solid rgba(255,255,255,0.1)" }}>
              <div style={{ fontSize: 13, marginBottom: 12, opacity: 0.7 }}>¿Con quién compartís gastos?</div>
              <input
                placeholder="Ej: Ailén, Juan, Mamá..."
                value={nuevoGrupoNombre}
                onChange={e => setNuevoGrupoNombre(e.target.value)}
                onKeyDown={e => e.key === "Enter" && crearGrupo()}
                autoFocus
                style={{
                  width: "100%", padding: "12px 14px", borderRadius: 12,
                  background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)",
                  color: "#f0ece8", fontSize: 16, marginBottom: 12, boxSizing: "border-box",
                }}
              />
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => { setMostrarFormGrupo(false); setNuevoGrupoNombre(""); }} style={{
                  flex: 1, padding: "12px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.15)",
                  background: "transparent", color: "#f0ece8", cursor: "pointer", fontSize: 14,
                }}>Cancelar</button>
                <button onClick={crearGrupo} disabled={guardando} style={{
                  flex: 2, padding: "12px", borderRadius: 12, border: "none",
                  background: "linear-gradient(135deg, #ff758c, #ff4d6d)",
                  color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: "bold",
                }}>
                  {guardando ? "Creando..." : "Crear grupo ✨"}
                </button>
              </div>
            </div>
          )}

          {!mostrarFormGrupo && (
            <button onClick={() => setMostrarFormGrupo(true)} style={{
              width: "100%", padding: "16px", borderRadius: 14,
              background: "rgba(255,255,255,0.06)",
              border: "2px dashed rgba(255,255,255,0.15)",
              color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: 15,
              marginTop: grupos.length > 0 ? 4 : 0,
            }}>
              + Nuevo grupo
            </button>
          )}
        </div>
      )}

      {/* VISTA: INICIO GRUPO */}
      {vista === "inicio" && grupoActivo && (
        <div style={{ width: "100%", maxWidth: 420, padding: "0 20px" }}>
          <div style={{
            background: balance === 0
              ? "linear-gradient(135deg, #2ec4b6, #1a8a84)"
              : balance > 0
                ? "linear-gradient(135deg, #ff758c, #ff4d6d)"
                : "linear-gradient(135deg, #667eea, #764ba2)",
            borderRadius: 20, padding: "24px 24px 20px",
            marginBottom: 20, boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            textAlign: "center",
          }}>
            <div style={{ fontSize: 12, letterSpacing: 3, textTransform: "uppercase", opacity: 0.8, marginBottom: 8 }}>balance con {nombre}</div>
            <div style={{ fontSize: 42, fontWeight: "bold", marginBottom: 4 }}>${Math.abs(balance).toFixed(2)}</div>
            <div style={{ fontSize: 15, opacity: 0.9 }}>
              {balance === 0 ? "✨ Están a mano" : balance > 0 ? `👉 ${nombre} te debe a vos` : `👉 Vos le debés a ${nombre}`}
            </div>
            {gastos.length > 0 && <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>{gastos.length} gasto{gastos.length !== 1 ? "s" : ""}</div>}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
            {[
              { label: "Nuevo gasto", icon: "➕", action: () => setVista("nuevo") },
              { label: "Historial", icon: "📋", action: () => setVista("historial") },
              { label: "Saldar", icon: "🤝", action: () => { if (gastos.length > 0 && confirm(`¿Confirman que saldaron las cuentas con ${nombre}?`)) saldarCuentas(); } },
            ].map(btn => (
              <button key={btn.label} onClick={btn.action} style={{
                background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 14, padding: "16px 8px", color: "#f0ece8", cursor: "pointer",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 6, fontSize: 12,
              }}
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
              {gastos.slice(0, 4).map(g => <GastoRow key={g.id} g={g} catEmoji={catEmoji} nombre={nombre} onEliminar={eliminarGasto} />)}
              {gastos.length > 4 && (
                <button onClick={() => setVista("historial")} style={{ background: "none", border: "none", color: "rgba(255,180,200,0.7)", cursor: "pointer", fontSize: 13, padding: "8px 0", width: "100%", textAlign: "center" }}>
                  Ver todos ({gastos.length}) →
                </button>
              )}
            </div>
          ) : (
            <div style={{ textAlign: "center", opacity: 0.4, padding: "30px 0", fontSize: 14 }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>🌱</div>
              No hay gastos con {nombre}.<br />¡Cargá el primero!
            </div>
          )}
        </div>
      )}

      {/* VISTA: NUEVO GASTO */}
      {vista === "nuevo" && grupoActivo && (
        <div style={{ width: "100%", maxWidth: 420, padding: "0 20px" }}>
          <button onClick={() => setVista("inicio")} style={{ background: "none", border: "none", color: "rgba(255,180,200,0.7)", cursor: "pointer", fontSize: 13, marginBottom: 16, padding: 0 }}>
            ← Volver
          </button>
          <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 20, padding: "24px 20px", border: "1px solid rgba(255,255,255,0.1)" }}>
            <h2 style={{ margin: "0 0 20px", fontSize: 20, fontWeight: "normal" }}>Nuevo gasto con {nombre} ✨</h2>

            <label style={labelStyle}>Descripción</label>
            <input placeholder="Ej: Pizza el viernes" value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} style={inputStyle} />

            <label style={labelStyle}>Categoría</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 16 }}>
              {CATEGORIAS.map(c => (
                <button key={c.id} onClick={() => setForm(f => ({ ...f, categoria: c.id }))} style={{
                  padding: "10px 6px", borderRadius: 12,
                  border: form.categoria === c.id ? "2px solid #ff758c" : "1px solid rgba(255,255,255,0.12)",
                  background: form.categoria === c.id ? "rgba(255,117,140,0.2)" : "rgba(255,255,255,0.05)",
                  color: "#f0ece8", cursor: "pointer", fontSize: 12, textAlign: "center",
                }}>
                  <div style={{ fontSize: 20 }}>{c.emoji}</div>{c.label}
                </button>
              ))}
            </div>

            <label style={labelStyle}>Monto total ($)</label>
            <input placeholder="0.00" type="number" value={form.monto} onChange={e => setForm(f => ({ ...f, monto: e.target.value }))}
              style={{ ...inputStyle, fontSize: 22, textAlign: "center" }} />

            <label style={labelStyle}>¿Cómo se divide?</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
              {["yo_pague_total", "yo_pague_mitad", "ella_pago_total", "ella_pago_mitad"].map(modoId => {
                const m = getModoLabel(modoId, nombre);
                return (
                  <button key={modoId} onClick={() => setForm(f => ({ ...f, modo: modoId }))} style={{
                    padding: "12px 16px", borderRadius: 12,
                    border: form.modo === modoId ? "2px solid #ff758c" : "1px solid rgba(255,255,255,0.12)",
                    background: form.modo === modoId ? "rgba(255,117,140,0.15)" : "rgba(255,255,255,0.04)",
                    color: "#f0ece8", cursor: "pointer", textAlign: "left", display: "flex", gap: 12, alignItems: "center",
                  }}>
                    <span style={{ fontSize: 22 }}>{m.emoji}</span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: "bold" }}>{m.label}</div>
                      <div style={{ fontSize: 11, opacity: 0.6 }}>{m.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            {form.monto && !isNaN(form.monto) && Number(form.monto) > 0 && (
              <div style={{ background: "rgba(255,117,140,0.1)", borderRadius: 12, padding: "12px 16px", marginBottom: 16, fontSize: 13, border: "1px solid rgba(255,117,140,0.2)" }}>
                💡 {getModoLabel(form.modo, nombre).label}: <strong>${(form.modo.includes("mitad") ? Number(form.monto) / 2 : Number(form.monto)).toFixed(2)}</strong>
              </div>
            )}

            <button onClick={agregarGasto} disabled={guardando} style={{
              width: "100%", padding: "16px", borderRadius: 14,
              background: guardando ? "rgba(255,117,140,0.4)" : "linear-gradient(135deg, #ff758c, #ff4d6d)",
              border: "none", color: "#fff", fontSize: 16, fontWeight: "bold",
              cursor: guardando ? "not-allowed" : "pointer",
              boxShadow: "0 4px 20px rgba(255,77,109,0.4)",
            }}>
              {guardando ? "Guardando..." : "Guardar gasto 💾"}
            </button>
          </div>
        </div>
      )}

      {/* VISTA: HISTORIAL */}
      {vista === "historial" && grupoActivo && (
        <div style={{ width: "100%", maxWidth: 420, padding: "0 20px" }}>
          <button onClick={() => setVista("inicio")} style={{ background: "none", border: "none", color: "rgba(255,180,200,0.7)", cursor: "pointer", fontSize: 13, marginBottom: 16, padding: 0 }}>
            ← Volver
          </button>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: "normal" }}>Historial con {nombre} 📋</h2>
            <span style={{ fontSize: 12, opacity: 0.5 }}>{gastos.length} gastos</span>
          </div>

          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 12, marginBottom: 16 }}>
            <button onClick={() => setFiltro("todos")} style={{
              padding: "6px 14px", borderRadius: 20, whiteSpace: "nowrap",
              border: filtro === "todos" ? "2px solid #ff758c" : "1px solid rgba(255,255,255,0.2)",
              background: filtro === "todos" ? "rgba(255,117,140,0.2)" : "transparent",
              color: "#f0ece8", cursor: "pointer", fontSize: 12,
            }}>Todos</button>
            {CATEGORIAS.filter(c => gastos.some(g => g.categoria === c.id)).map(c => (
              <button key={c.id} onClick={() => setFiltro(c.id)} style={{
                padding: "6px 14px", borderRadius: 20, whiteSpace: "nowrap",
                border: filtro === c.id ? "2px solid #ff758c" : "1px solid rgba(255,255,255,0.2)",
                background: filtro === c.id ? "rgba(255,117,140,0.2)" : "transparent",
                color: "#f0ece8", cursor: "pointer", fontSize: 12,
              }}>{c.emoji} {c.label}</button>
            ))}
          </div>

          {gastosFiltrados.length === 0
            ? <div style={{ textAlign: "center", opacity: 0.4, padding: "30px 0", fontSize: 14 }}>No hay gastos en esta categoría</div>
            : gastosFiltrados.map(g => <GastoRow key={g.id} g={g} catEmoji={catEmoji} nombre={nombre} onEliminar={eliminarGasto} />)
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

// Card de grupo en la pantalla principal
function GrupoCard({ grupo, onAbrir, onEliminar, db }) {
  const [balance, setBalance] = useState(0);
  const [cantGastos, setCantGastos] = useState(0);

  useEffect(() => {
    const q = query(collection(db, "gastos"), where("grupoId", "==", grupo.id));
    const unsub = onSnapshot(q, (snap) => {
      const gastos = snap.docs.map(d => d.data());
      setCantGastos(gastos.length);
      setBalance(calcularBalance(gastos));
    });
    return () => unsub();
  }, [grupo.id]);

  return (
    <div style={{
      background: "rgba(255,255,255,0.05)",
      borderRadius: 16, marginBottom: 12,
      border: "1px solid rgba(255,255,255,0.08)",
      overflow: "hidden",
    }}>
      <div style={{ display: "flex", alignItems: "center", padding: "16px" }}>
        <div style={{
          width: 46, height: 46, borderRadius: 14,
          background: grupo.color, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 20, fontWeight: "bold", color: "#fff",
          boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
        }}>
          {grupo.nombre.charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1, marginLeft: 14 }}>
          <div style={{ fontSize: 17, fontWeight: "bold" }}>{grupo.nombre}</div>
          <div style={{ fontSize: 12, opacity: 0.5, marginTop: 2 }}>
            {cantGastos === 0 ? "Sin gastos" : `${cantGastos} gasto${cantGastos !== 1 ? "s" : ""}`}
            {balance !== 0 && (
              <span style={{ color: balance > 0 ? "#fb7185" : "#a78bfa", marginLeft: 6 }}>
                · {balance > 0 ? `te debe $${balance.toFixed(2)}` : `le debés $${Math.abs(balance).toFixed(2)}`}
              </span>
            )}
            {balance === 0 && cantGastos > 0 && <span style={{ color: "#2ec4b6", marginLeft: 6 }}>· a mano ✨</span>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => onEliminar(grupo)} style={{
            background: "rgba(255,77,109,0.15)", border: "none", color: "#ff4d6d",
            cursor: "pointer", fontSize: 16, padding: "8px 10px", borderRadius: 10,
          }}>🗑</button>
          <button onClick={() => onAbrir(grupo)} style={{
            background: grupo.color, border: "none", color: "#fff",
            cursor: "pointer", fontSize: 13, padding: "8px 14px", borderRadius: 10,
            fontWeight: "bold",
          }}>Ver →</button>
        </div>
      </div>
    </div>
  );
}

function GastoRow({ g, catEmoji, nombre, onEliminar }) {
  const modo = getModoLabel(g.modo, nombre);
  const montoMostrado = g.modo.includes("mitad") ? g.monto / 2 : g.monto;
  const esDeuda = g.modo.startsWith("ella");

  return (
    <div style={{
      background: "rgba(255,255,255,0.05)", borderRadius: 14, padding: "14px 16px",
      marginBottom: 10, border: "1px solid rgba(255,255,255,0.07)",
      display: "flex", alignItems: "center", gap: 12,
    }}>
      <div style={{ fontSize: 26 }}>{catEmoji(g.categoria)}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: "bold", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{g.descripcion}</div>
        <div style={{ fontSize: 11, opacity: 0.5, marginTop: 2 }}>{g.fecha} · {g.hora} · {modo.emoji} {modo.label}</div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 16, fontWeight: "bold", color: esDeuda ? "#a78bfa" : "#fb7185" }}>
          {esDeuda ? "-" : "+"}${montoMostrado.toFixed(2)}
        </div>
        <div style={{ fontSize: 10, opacity: 0.4 }}>total: ${g.monto.toFixed(2)}</div>
      </div>
      <button onClick={() => onEliminar(g.id)} style={{
        background: "none", border: "none", color: "rgba(255,255,255,0.25)",
        cursor: "pointer", fontSize: 18, padding: "4px", borderRadius: 8,
      }}>×</button>
    </div>
  );
}

const inputStyle = {
  width: "100%", padding: "12px 14px", borderRadius: 12,
  background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)",
  color: "#f0ece8", fontSize: 15, marginBottom: 16, boxSizing: "border-box",
};

const labelStyle = {
  display: "block", fontSize: 11, letterSpacing: 2,
  textTransform: "uppercase", opacity: 0.6, marginBottom: 8,
};
