import { useState, useEffect, useRef, useId, lazy, Suspense } from "react";
import {
  collection, addDoc, deleteDoc, doc, setDoc,
  onSnapshot, query, orderBy, writeBatch,
  getDocs, where, getDoc, updateDoc,
} from "firebase/firestore";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { onMessage } from "firebase/messaging";
import { db, auth, messaging, registrarTokenFCM, reconectarFirestore } from "./firebase";
import { TEMA_CLARO, TEMA_OSCURO, FONT, GRADIENT_ACCENT } from "./theme";
import { TemaContext, estilosDeTema } from "./themeContext";
import { COLORES_GRUPO, FORM_INICIAL } from "./constants";
import {
  formatMonto, formatMontoInput, parseMontoInput, calcularBalance,
  hoyInput, fechaInputDesdeTs, tsDesdeFechaInput,
} from "./utils";
import IconoLinea from "./components/IconoLinea";
import LogoMarca from "./components/LogoMarca";
import GrupoCard from "./components/GrupoCard";
import HomeView from "./components/HomeView";
const ExpenseFormView   = lazy(() => import("./components/ExpenseFormView"));
const HistoryView       = lazy(() => import("./components/HistoryView"));
const AuthScreen        = lazy(() => import("./components/AuthScreen"));
const OnboardingModal   = lazy(() => import("./components/OnboardingModal"));
const ReporteView       = lazy(() => import("./components/ReporteView"));

const formVacio = () => ({ ...FORM_INICIAL, fecha: hoyInput() });

export default function App() {
  const [usuario, setUsuario] = useState(null);
  const [usuarioData, setUsuarioData] = useState(null);
  const [authListo, setAuthListo] = useState(false);
  const [grupos, setGrupos] = useState([]);
  const [grupoActivo, setGrupoActivo] = useState(null);
  const [gastos, setGastos] = useState([]);
  const [vista, setVista] = useState("grupos");
  const [form, setForm] = useState(formVacio);
  const [toast, setToast] = useState(null);
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
  const [gruposListos, setGruposListos] = useState(false);
  const [onboardingVisto, setOnboardingVisto] = useState(() => !!localStorage.getItem("spliteasy_onboarding"));
  const [mostrarAyuda, setMostrarAyuda] = useState(false);
  const [gastoEditando, setGastoEditando] = useState(null);
  const [editandoNombreGrupo, setEditandoNombreGrupo] = useState(false);
  const [nuevoNombreGrupo, setNuevoNombreGrupo] = useState("");
  const [modoOscuro, setModoOscuro] = useState(() => {
    const guardado = localStorage.getItem("spliteasy_tema");
    if (guardado !== null) return guardado === "1";
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
  });
  const [mostrarOpciones, setMostrarOpciones] = useState(false);
  const T = modoOscuro ? TEMA_OSCURO : TEMA_CLARO;
  const { cardStyle, inputStyle, labelStyle, seccionStyle } = estilosDeTema(T);
  const nombreOtro = !grupoActivo ? "" :
    Object.entries(grupoActivo.miembrosNombres || {}).find(([uid]) => uid !== usuario?.uid)?.[1]
    || grupoActivo.nombreOtroDefault
    || grupoActivo.nombre;
  const gastosRef = useRef([]);
  const gruposInvitadosSincronizadosRef = useRef(new Set());
  const modalCancelarRef = useRef(null);
  const modalConfirmarRef = useRef(null);
  const ultimoFocoAntesModalRef = useRef(null);
  const toastTimerRef = useRef(null);
  const grupoNombreId = useId();
  const grupoEmailId = useId();
  const grupoNombreOtroId = useId();
  const modalMensajeId = useId();

  const confirmar = (opciones) => setModal(opciones);
  const cerrarModal = () => setModal(null);

  const mostrarToast = (msg, tipo = "ok") => {
    clearTimeout(toastTimerRef.current);
    setToast({ msg, tipo });
    toastTimerRef.current = setTimeout(() => setToast(null), tipo === "err" ? 4000 : 2500);
  };

  const resetFormGrupo = () => {
    setNuevoGrupoNombre("");
    setNuevoGrupoEmail("");
    setNuevoGrupoNombreOtro("");
    setMostrarFormGrupo(false);
  };

  const resetFormGasto = () => {
    setForm(formVacio());
    setGastoEditando(null);
  };

  const abrirGrupo = (grupo) => {
    setGrupoActivo(grupo);
    gastosRef.current = [];
    setGastos([]);
    setCargandoGastos(true);
    setEditandoNombreGrupo(false);
    setVista("inicio");
  };

  const volverAGrupos = () => {
    setGrupoActivo(null);
    gastosRef.current = [];
    setGastos([]);
    setEditandoNombreGrupo(false);
    setVista("grupos");
  };

  const volver = () => {
    if (vista === "reporte") { setVista("historial"); return; }
    if (vista === "historial" || vista === "nuevo" || vista === "editar") { resetFormGasto(); setVista("inicio"); return; }
    if (vista === "inicio") volverAGrupos();
  };

  // Fondo del documento y barra de estado acordes al tema
  useEffect(() => {
    document.body.style.background = T.bg;
    document.documentElement.style.colorScheme = modoOscuro ? "dark" : "light";
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", T.bg);
  }, [T.bg, modoOscuro]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setUsuario(user);
      if (user) {
        try {
          const snap = await getDoc(doc(db, "usuarios", user.uid));
          if (snap.exists()) setUsuarioData(snap.data());
        } catch (e) {
          console.warn("No se pudo leer el perfil:", e);
        }
      } else {
        setUsuarioData(null);
        setGrupos([]);
        setGruposListos(false);
      }
      setAuthListo(true);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!messaging) return;
    const unsub = onMessage(messaging, (payload) => {
      const { title, body } = payload.data ?? payload.notification ?? {};
      if (title) mostrarToast(body || title);
    });
    return () => unsub();
  }, []);

  // Al volver a la app (o recuperar la señal) forzamos la reconexión en tiempo real
  useEffect(() => {
    let ocultoDesde = 0;
    const onVisibilidad = () => {
      if (document.visibilityState === "hidden") { ocultoDesde = Date.now(); return; }
      if (ocultoDesde && Date.now() - ocultoDesde > 5000) reconectarFirestore();
      ocultoDesde = 0;
    };
    const onOnline = () => reconectarFirestore();
    document.addEventListener("visibilitychange", onVisibilidad);
    window.addEventListener("online", onOnline);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilidad);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [vista]);



  // Swipe desde el borde izquierdo para volver
  useEffect(() => {
    let startX = 0, startY = 0;
    const onTouchStart = (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    };
    const onTouchEnd = (e) => {
      if (modal || mostrarOpciones || mostrarAyuda) return;
      const dx = e.changedTouches[0].clientX - startX;
      const dy = Math.abs(e.changedTouches[0].clientY - startY);
      if (startX > 30 || dx < 60 || dy > 80) return;
      volver();
    };
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [vista, modal, mostrarOpciones, mostrarAyuda]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!modal) return;
    ultimoFocoAntesModalRef.current = document.activeElement;
    modalCancelarRef.current?.focus();
    const manejarTeclasModal = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        cerrarModal();
        return;
      }
      if (event.key !== "Tab") return;
      const primero = modalCancelarRef.current;
      const ultimo = modalConfirmarRef.current;
      if (!primero || !ultimo) return;
      if (event.shiftKey && document.activeElement === primero) {
        event.preventDefault();
        ultimo.focus();
      } else if (!event.shiftKey && document.activeElement === ultimo) {
        event.preventDefault();
        primero.focus();
      }
    };
    document.addEventListener("keydown", manejarTeclasModal);
    return () => {
      document.removeEventListener("keydown", manejarTeclasModal);
      if (ultimoFocoAntesModalRef.current instanceof HTMLElement) ultimoFocoAntesModalRef.current.focus();
    };
  }, [modal]);

  useEffect(() => {
    if (!usuario) return;
    const q = query(collection(db, "grupos"), where("miembros", "array-contains", usuario.uid));
    let primeraCarga = true;
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setGrupos(data);
      setGruposListos(true);
      // Si hay un solo grupo, entramos directo
      if (primeraCarga) {
        primeraCarga = false;
        if (data.length === 1) abrirGrupo(data[0]);
      }
      setGrupoActivo(prev => {
        if (!prev) return prev;
        const actualizado = data.find(g => g.id === prev.id);
        if (!actualizado) return prev;
        if (actualizado.nombre === prev.nombre && JSON.stringify(actualizado.miembrosNombres) === JSON.stringify(prev.miembrosNombres)) return prev;
        return actualizado;
      });
    }, (error) => {
      console.error("Error al cargar grupos:", error);
      setGruposListos(true);
    });
    return () => unsub();
  }, [usuario]);

  useEffect(() => {
    if (!usuario?.uid || !usuario.email) return;
    const syncKey = `${usuario.uid}:${usuarioData?.nombre || ""}`;
    if (gruposInvitadosSincronizadosRef.current.has(syncKey)) return;

    const sincronizarInvitaciones = async () => {
      try {
        const email = usuario.email.toLowerCase();
        const snap = await getDocs(query(collection(db, "grupos"), where("emailsInvitados", "array-contains", email)));
        const pendientes = snap.docs.filter((grupoDoc) => !(grupoDoc.data().miembros || []).includes(usuario.uid));

        if (pendientes.length === 0) {
          gruposInvitadosSincronizadosRef.current.add(syncKey);
          return;
        }

        const batch = writeBatch(db);
        pendientes.forEach((grupoDoc) => {
          const data = grupoDoc.data();
          batch.update(grupoDoc.ref, {
            miembros: [...(data.miembros || []), usuario.uid],
            miembrosNombres: { ...(data.miembrosNombres || {}), [usuario.uid]: usuarioData?.nombre || email },
          });
        });

        await batch.commit();
        gruposInvitadosSincronizadosRef.current.add(syncKey);
        mostrarToast(
          pendientes.length === 1
            ? "Te sumamos al grupo donde estabas invitado"
            : `Te sumamos a ${pendientes.length} grupos donde estabas invitado`
        );
      } catch (error) {
        console.error("Error al sincronizar invitaciones:", error);
      }
    };

    sincronizarInvitaciones();
  }, [usuario?.uid, usuario?.email, usuarioData?.nombre]);

  // Única fuente de verdad de los gastos: el listener en tiempo real.
  // Las escrituras locales aparecen al instante gracias a la compensación de latencia de Firestore.
  useEffect(() => {
    if (!grupoActivo?.id) return;
    const q = query(collection(db, "gastos"), where("grupoId", "==", grupoActivo.id), orderBy("timestamp", "desc"));
    const unsub = onSnapshot(q,
      (snap) => {
        const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        gastosRef.current = lista;
        setGastos(lista);
        setCargandoGastos(false);
      },
      (error) => {
        console.error("Error al cargar gastos:", error);
        setCargandoGastos(false);
        mostrarToast("No pudimos cargar los gastos. Revisá la conexión", "err");
      }
    );
    return () => unsub();
  }, [grupoActivo?.id]);

  const crearGrupo = async () => {
    const emailOtro = nuevoGrupoEmail.trim().toLowerCase();
    if (!emailOtro || !/^\S+@\S+\.\S+$/.test(emailOtro)) return mostrarToast("Poné un email válido", "err");
    if (emailOtro === usuario.email.toLowerCase()) return mostrarToast("No podés invitarte a vos mismo", "err");
    setGuardando(true);
    try {
      const snap = await getDocs(query(collection(db, "usuarios"), where("email", "==", emailOtro)));
      const otro = snap.empty ? null : snap.docs[0].data();
      const nombreOtroFinal = otro?.nombre || nuevoGrupoNombreOtro.trim() || emailOtro.split("@")[0];
      const nombre = nuevoGrupoNombre.trim() || nombreOtroFinal;
      const miembrosNombres = { [usuario.uid]: usuarioData?.nombre || "" };
      if (otro) miembrosNombres[otro.uid] = nombreOtroFinal;
      const ref = await addDoc(collection(db, "grupos"), {
        nombre,
        color: COLORES_GRUPO[grupos.length % COLORES_GRUPO.length],
        creadoEn: Date.now(),
        creadoPor: usuario.uid,
        miembros: otro ? [usuario.uid, otro.uid] : [usuario.uid],
        emailsInvitados: [usuario.email.toLowerCase(), emailOtro],
        miembrosNombres,
        nombreOtroDefault: nombreOtroFinal,
      });
      resetFormGrupo();
      mostrarToast(otro ? `Grupo con ${nombreOtroFinal} creado` : `Grupo creado. Cuando ${nombreOtroFinal} se registre con ese email, se suma solo`);
      if (grupos.length === 0) abrirGrupo({ id: ref.id, nombre, miembros: [usuario.uid], miembrosNombres, nombreOtroDefault: nombreOtroFinal });
    } catch (e) {
      console.error(e);
      mostrarToast("No se pudo crear el grupo", "err");
    }
    setGuardando(false);
  };

  const guardarNombreGrupo = async () => {
    const nombre = nuevoNombreGrupo.trim();
    setEditandoNombreGrupo(false);
    if (!nombre || nombre === grupoActivo?.nombre) return;
    const anterior = grupoActivo.nombre;
    setGrupoActivo(g => ({ ...g, nombre }));
    try {
      await updateDoc(doc(db, "grupos", grupoActivo.id), { nombre });
    } catch {
      setGrupoActivo(g => ({ ...g, nombre: anterior }));
      mostrarToast("No se pudo cambiar el nombre", "err");
    }
  };

  const eliminarGrupo = (grupo) => {
    confirmar({
      titulo: `¿Eliminar "${grupo.nombre}"?`,
      mensaje: "Se borran el grupo y todos sus gastos, para los dos. No se puede deshacer.",
      confirmLabel: "Eliminar",
      peligro: true,
      onConfirm: async () => {
        try {
          const snap = await getDocs(query(collection(db, "gastos"), where("grupoId", "==", grupo.id)));
          const batch = writeBatch(db);
          snap.docs.forEach(d => batch.delete(d.ref));
          batch.delete(doc(db, "grupos", grupo.id));
          await batch.commit();
          setMostrarOpciones(false);
          volverAGrupos();
          mostrarToast("Grupo eliminado");
        } catch {
          mostrarToast("No se pudo eliminar el grupo", "err");
        }
      },
    });
  };

  // Guarda sin esperar al servidor: Firestore aplica el cambio local al instante
  // (y lo sincroniza cuando haya señal). Si el servidor lo rechaza, avisamos.
  const guardarGasto = () => {
    const montoNumero = parseMontoInput(form.monto);
    if (!form.monto || Number.isNaN(montoNumero) || montoNumero <= 0) return mostrarToast("Poné un monto mayor a 0", "err");
    if (!form.descripcion.trim()) return mostrarToast("Poné una descripción", "err");

    const timestamp = tsDesdeFechaInput(form.fecha, gastoEditando?.timestamp);
    const datos = {
      descripcion: form.descripcion.trim(),
      categoria: form.categoria,
      monto: Math.round(montoNumero * 100) / 100,
      modo: form.modo,
      timestamp,
      fecha: new Date(timestamp).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" }),
      hora: new Date(timestamp).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
    };

    const editando = !!gastoEditando;
    const escritura = editando
      ? updateDoc(doc(db, "gastos", gastoEditando.id), datos)
      : setDoc(doc(collection(db, "gastos")), {
          ...datos,
          grupoId: grupoActivo.id,
          cargadoPor: usuario.uid,
          cargadoPorNombre: usuarioData?.nombre || "",
        });
    escritura.catch((e) => {
      console.error("Error al guardar gasto:", e);
      mostrarToast("No se pudo guardar el gasto. Probá de nuevo", "err");
    });

    resetFormGasto();
    setVista("inicio");
    mostrarToast(!navigator.onLine
      ? "Guardado sin señal. Se sincroniza solo"
      : editando ? "Gasto actualizado" : "Gasto cargado");
  };

  const abrirEditar = (g) => {
    setGastoEditando(g);
    setForm({
      descripcion: g.descripcion,
      categoria: g.categoria,
      monto: formatMontoInput(String(g.monto).replace(".", ",")),
      modo: g.modo,
      fecha: fechaInputDesdeTs(g.timestamp),
    });
    setVista("editar");
  };

  const eliminarGasto = (g) => {
    confirmar({
      titulo: "¿Eliminar este gasto?",
      mensaje: `"${g.descripcion}" por $${formatMonto(g.monto)}. No se puede deshacer.`,
      confirmLabel: "Eliminar",
      peligro: true,
      onConfirm: () => {
        deleteDoc(doc(db, "gastos", g.id)).catch(() => mostrarToast("No se pudo eliminar", "err"));
        resetFormGasto();
        setVista("inicio");
        mostrarToast("Gasto eliminado");
      },
    });
  };

  const saldarCuentas = () => {
    // Leemos del ref para usar siempre los gastos más recientes, no los del momento en que se abrió el modal
    const noSaldados = gastosRef.current.filter(g => !g.saldadoEn);
    if (noSaldados.length === 0) return;
    const ahora = Date.now();
    const escrituras = [];
    for (let i = 0; i < noSaldados.length; i += 400) {
      const batch = writeBatch(db);
      noSaldados.slice(i, i + 400).forEach(g => batch.update(doc(db, "gastos", g.id), { saldadoEn: ahora }));
      escrituras.push(batch.commit());
    }
    Promise.all(escrituras).catch((e) => {
      console.error("Error al saldar:", e);
      mostrarToast("No se pudo saldar. Probá de nuevo", "err");
    });
    mostrarToast("Listo, quedaron a mano");
  };

  const pedirSaldar = () => {
    const b = calcularBalance(gastosRef.current, usuario.uid);
    const monto = `$${formatMonto(Math.abs(b))}`;
    confirmar({
      titulo: b > 0 ? `¿${nombreOtro} ya te pagó ${monto}?` : b < 0 ? `¿Ya le pagaste ${monto} a ${nombreOtro}?` : "¿Cerrar este período?",
      mensaje: "El balance vuelve a $0 y estos gastos pasan al historial.",
      confirmLabel: b === 0 ? "Cerrar período" : "Sí, saldar",
      onConfirm: saldarCuentas,
    });
  };



  const cerrarSesion = () => {
    confirmar({
      titulo: "¿Cerrar sesión?",
      confirmLabel: "Cerrar sesión",
      onConfirm: async () => {
        setMostrarOpciones(false);
        await signOut(auth);
        setVista("grupos");
        setGrupoActivo(null);
        setGastos([]);
      },
    });
  };

  const cambiarTema = (oscuro) => {
    setModoOscuro(oscuro);
    localStorage.setItem("spliteasy_tema", oscuro ? "1" : "0");
  };


  const estilosGlobales = (
    <style>{`
      body { font-family: ${FONT}; -webkit-font-smoothing: antialiased; color: ${T.text}; }
      input, button, select, textarea { font-family: inherit; }
      input:focus { outline: none; border-color: ${T.focus} !important; box-shadow: 0 0 0 3px ${T.accentBg}; }
      input::placeholder { color: ${T.placeholder}; }
      input[type="date"] { color: ${T.text}; }
      button { -webkit-tap-highlight-color: transparent; }
      button:not(.fila-tocable):active { transform: scale(0.98); }
      button:disabled:active { transform: none; }
      .fila-tocable:active { background: ${T.surface2} !important; }
      button:focus-visible { outline: 3px solid ${T.focus}; outline-offset: 2px; }
      .num { font-variant-numeric: tabular-nums; }
      .sin-scrollbar { scrollbar-width: none; }
      .sin-scrollbar::-webkit-scrollbar { display: none; }
      .skeleton { background: linear-gradient(90deg, ${T.surface2} 25%, ${T.border} 50%, ${T.surface2} 75%); background-size: 200% 100%; animation: skeleton 1.2s infinite; }
      @keyframes skeleton { from { background-position: 200% 0; } to { background-position: -200% 0; } }
      @keyframes subir { from { transform: translateY(24px); opacity: 0; } to { transform: none; opacity: 1; } }
      @keyframes aparecer { from { opacity: 0; } to { opacity: 1; } }
      @media (prefers-reduced-motion: reduce) {
        *, *::before, *::after { animation: none !important; transition: none !important; }
        button:active { transform: none !important; }
      }
    `}</style>
  );

  if (!authListo) return (
    <TemaContext.Provider value={T}>
      {estilosGlobales}
      <div style={{ minHeight: "100dvh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <LogoMarca size="grande" />
      </div>
    </TemaContext.Provider>
  );

  if (!usuario) return (
    <TemaContext.Provider value={T}>
      {estilosGlobales}
      <Suspense fallback={null}><AuthScreen /></Suspense>
    </TemaContext.Provider>
  );

  const gastosActuales = gastos.filter(g => !g.saldadoEn);
  const balance = calcularBalance(gastos, usuario.uid);
  const nombreGrupo = grupoActivo?.nombre || "";
  const esCreador = grupoActivo?.creadoPor === usuario.uid;
  const esVistaDetalle = vista === "nuevo" || vista === "editar" || vista === "historial" || vista === "reporte";

  const botonIcono = {
    width: 40, height: 40, borderRadius: 12, border: `1px solid ${T.border}`, background: T.surface,
    display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, padding: 0,
  };
  const botonTexto = {
    background: "none", border: "none", color: T.accent, cursor: "pointer", fontSize: 15, fontWeight: 600,
    padding: "8px 0", display: "inline-flex", alignItems: "center", gap: 4, minHeight: 44, fontFamily: FONT,
  };
  const hojaStyle = {
    background: T.surface, borderRadius: "24px 24px 0 0", padding: "12px 20px calc(24px + env(safe-area-inset-bottom))",
    width: "100%", maxWidth: 430, border: `1px solid ${T.border}`, borderBottom: "none", animation: "subir 0.2s ease-out",
    maxHeight: "90dvh", overflowY: "auto",
  };
  const fondoHoja = {
    position: "fixed", inset: 0, background: T.overlay, display: "flex", alignItems: "flex-end",
    justifyContent: "center", zIndex: 1000, animation: "aparecer 0.15s ease-out",
  };
  const agarradera = <div style={{ width: 36, height: 5, borderRadius: 3, background: T.border, margin: "0 auto 16px" }} />;

  return (
    <TemaContext.Provider value={T}>
    {estilosGlobales}
    <div style={{ minHeight: "100dvh", background: T.bg, fontFamily: FONT, color: T.text, display: "flex", flexDirection: "column", alignItems: "center", paddingBottom: "env(safe-area-inset-bottom)" }}>

      {/* ── Opciones ── */}
      {mostrarOpciones && (
        <div style={fondoHoja} onClick={() => setMostrarOpciones(false)}>
          <div role="dialog" aria-modal="true" aria-label="Opciones" onClick={e => e.stopPropagation()} style={hojaStyle}>
            {agarradera}
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Opciones</div>
            <div style={{ fontSize: 13, color: T.text2, marginBottom: 20 }}>{usuarioData?.nombre ? `${usuarioData.nombre} · ` : ""}{usuario.email}</div>

            <div style={{ ...seccionStyle, marginBottom: 10 }}>Apariencia</div>
            <div role="radiogroup" aria-label="Apariencia" style={{ display: "flex", background: T.surface2, borderRadius: 12, padding: 3, marginBottom: 24, border: `1px solid ${T.border}` }}>
              {[{ id: false, label: "Claro", icon: "sun" }, { id: true, label: "Oscuro", icon: "moon" }].map(op => {
                const activo = modoOscuro === op.id;
                return (
                  <button key={String(op.id)} type="button" role="radio" aria-checked={activo} onClick={() => cambiarTema(op.id)} style={{ flex: 1, minHeight: 42, borderRadius: 10, border: "none", background: activo ? T.surface : "transparent", color: activo ? T.text : T.text2, cursor: "pointer", fontSize: 14, fontWeight: activo ? 700 : 500, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: activo ? "0 1px 4px rgba(0,0,0,0.10)" : "none" }}>
                    <IconoLinea name={op.icon} size={15} color={activo ? T.accent : T.text3} />
                    {op.label}
                  </button>
                );
              })}
            </div>

            <div style={{ ...seccionStyle, marginBottom: 10 }}>Notificaciones</div>
            {notifPermiso === "granted" ? (
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", background: T.okBg, borderRadius: 14, marginBottom: 24 }}>
                <IconoLinea name="bell" size={18} color={T.ok} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: T.ok }}>Activadas</div>
                  <div style={{ fontSize: 13, color: T.text2, marginTop: 2 }}>Te avisamos cuando {nombreOtro || "la otra persona"} cargue un gasto</div>
                </div>
              </div>
            ) : notifPermiso === "denied" || !messaging ? (
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", background: T.surface2, borderRadius: 14, marginBottom: 24 }}>
                <IconoLinea name="bell" size={18} color={T.text3} />
                <div>
                  <div style={{ fontSize: 14, color: T.text }}>{messaging ? "Bloqueadas" : "No disponibles en este navegador"}</div>
                  <div style={{ fontSize: 13, color: T.text2, marginTop: 2 }}>{messaging ? "Activalas desde los ajustes del teléfono" : "Instalá la app en la pantalla de inicio para recibirlas"}</div>
                </div>
              </div>
            ) : (
              <button type="button" onClick={async () => { await registrarTokenFCM(usuario.uid); setNotifPermiso("Notification" in window ? Notification.permission : "denied"); }} style={{ width: "100%", padding: "14px 16px", borderRadius: 14, border: `1px solid ${T.border}`, background: T.surface2, color: T.text, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
                <IconoLinea name="bell" size={18} color={T.accent} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>Activar notificaciones</div>
                  <div style={{ fontSize: 13, color: T.text2, marginTop: 2 }}>Enterate cuando carguen un gasto</div>
                </div>
              </button>
            )}

            {grupoActivo && esCreador && (
              <button type="button" onClick={() => eliminarGrupo(grupoActivo)} style={{ width: "100%", minHeight: 48, borderRadius: 14, border: `1px solid ${T.border}`, background: "transparent", color: T.neg, fontSize: 15, fontWeight: 600, cursor: "pointer", marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <IconoLinea name="trash" size={16} color={T.neg} />
                Eliminar este grupo
              </button>
            )}
            <button type="button" onClick={cerrarSesion} style={{ width: "100%", minHeight: 48, borderRadius: 14, border: `1px solid ${T.border}`, background: "transparent", color: T.text, fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
              Cerrar sesión
            </button>
          </div>
        </div>
      )}

      {/* ── Confirmación ── */}
      {modal && (
        <div style={{ ...fondoHoja, alignItems: "center", padding: "0 24px", zIndex: 1100 }} onClick={cerrarModal}>
          <div role="alertdialog" aria-modal="true" aria-label={modal.titulo} aria-describedby={modal.mensaje ? modalMensajeId : undefined} onClick={e => e.stopPropagation()} style={{ background: T.surface, borderRadius: 22, padding: "24px 20px 18px", maxWidth: 340, width: "100%", border: `1px solid ${T.border}`, boxShadow: "0 18px 42px rgba(0,0,0,0.2)", textAlign: "center", animation: "aparecer 0.15s ease-out" }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: T.text, lineHeight: 1.35, marginBottom: modal.mensaje ? 8 : 20 }}>{modal.titulo}</div>
            {modal.mensaje && <div id={modalMensajeId} style={{ fontSize: 14, color: T.text2, lineHeight: 1.5, marginBottom: 20 }}>{modal.mensaje}</div>}
            <div style={{ display: "flex", gap: 10 }}>
              <button ref={modalCancelarRef} type="button" onClick={cerrarModal} style={{ flex: 1, minHeight: 48, borderRadius: 14, border: `1px solid ${T.border}`, background: T.surface2, color: T.text, cursor: "pointer", fontSize: 15, fontWeight: 600 }}>Cancelar</button>
              <button ref={modalConfirmarRef} type="button" onClick={() => { cerrarModal(); modal.onConfirm(); }} style={{ flex: 1, minHeight: 48, borderRadius: 14, border: "none", background: modal.peligro ? T.neg : GRADIENT_ACCENT, color: "#fff", cursor: "pointer", fontSize: 15, fontWeight: 700 }}>{modal.confirmLabel || "Confirmar"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Ayuda ── */}
      {mostrarAyuda && (
        <div style={fondoHoja} onClick={() => setMostrarAyuda(false)}>
          <div role="dialog" aria-modal="true" aria-label="Cómo funciona" onClick={e => e.stopPropagation()} style={hojaStyle}>
            {agarradera}
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 18 }}>Cómo funciona</div>
            {[
              { icon: "plus",  color: T.accent, titulo: "Cargá cada gasto", desc: "Poné el monto, quién pagó y si se reparte mitad y mitad o le toca todo a uno." },
              { icon: "home",  color: T.pos,    titulo: "Mirá el balance",   desc: "El número grande es cuánto se deben en el período abierto. Abajo está la lista completa." },
              { icon: "check", color: T.ok,     titulo: "Saldá",             desc: "Cuando se pagan, saldá: el balance vuelve a $0 y esos gastos pasan al historial." },
              { icon: "list",  color: "#7C6AF6", titulo: "Historial y resumen", desc: "Revisá períodos anteriores y compartí el resumen de un mes como imagen." },
              { icon: "edit",  color: T.text2,  titulo: "Editar o borrar",   desc: "Tocá un gasto que cargaste vos para corregirlo o eliminarlo." },
            ].map(({ icon, color, titulo, desc }) => (
              <div key={titulo} style={{ display: "flex", gap: 14, marginBottom: 16 }}>
                <div style={{ width: 36, height: 36, borderRadius: 11, background: `${color}1A`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <IconoLinea name={icon} size={16} color={color} />
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 2 }}>{titulo}</div>
                  <div style={{ fontSize: 14, color: T.text2, lineHeight: 1.5 }}>{desc}</div>
                </div>
              </div>
            ))}
            <button type="button" onClick={() => setMostrarAyuda(false)} style={{ width: "100%", minHeight: 50, borderRadius: 14, border: "none", background: GRADIENT_ACCENT, color: "#fff", cursor: "pointer", fontSize: 15, fontWeight: 700, marginTop: 4 }}>
              Entendido
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div role={toast.tipo === "err" ? "alert" : "status"} aria-live={toast.tipo === "err" ? "assertive" : "polite"} style={{ position: "fixed", top: "calc(12px + env(safe-area-inset-top))", left: "50%", transform: "translateX(-50%)", width: "max-content", maxWidth: "calc(100% - 40px)", background: toast.tipo === "err" ? T.neg : T.text, color: toast.tipo === "err" ? "#fff" : T.bg, padding: "12px 16px", borderRadius: 16, fontWeight: 600, fontSize: 14, lineHeight: 1.35, zIndex: 1200, boxShadow: "0 10px 30px rgba(0,0,0,0.2)", display: "flex", alignItems: "center", gap: 8, animation: "aparecer 0.15s ease-out" }}>
          <IconoLinea name={toast.tipo === "err" ? "x" : "check"} size={15} color={toast.tipo === "err" ? "#fff" : T.bg} />
          {toast.msg}
        </div>
      )}

      {/* ── Header ── */}
      <header style={{ width: "100%", maxWidth: 430, padding: "calc(8px + env(safe-area-inset-top)) 20px 12px", position: "sticky", top: 0, zIndex: 40, background: T.bg }}>
        {vista === "grupos" ? (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", minHeight: 44 }}>
            <LogoMarca />
            <button type="button" aria-label="Opciones" onClick={() => setMostrarOpciones(true)} style={botonIcono}>
              <IconoLinea name="settings" size={18} color={T.text2} />
            </button>
          </div>
        ) : esVistaDetalle ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button type="button" onClick={volver} style={{ ...botonTexto, flexShrink: 0 }}>
              <span style={{ transform: "rotate(180deg)", display: "inline-flex" }}>
                <IconoLinea name="chevron-right" size={14} color={T.accent} stroke={2.4} />
              </span>
              {vista === "reporte" ? "Historial" : nombreGrupo}
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button type="button" onClick={volverAGrupos} aria-label="Ver todos los grupos" style={{ ...botonTexto, flexShrink: 0 }}>
              <span style={{ transform: "rotate(180deg)", display: "inline-flex" }}>
                <IconoLinea name="chevron-right" size={14} color={T.accent} stroke={2.4} />
              </span>
              Grupos
            </button>
            <div style={{ flex: 1, minWidth: 0, textAlign: "center" }}>
              {editandoNombreGrupo ? (
                <input
                  autoFocus
                  aria-label="Nombre del grupo"
                  value={nuevoNombreGrupo}
                  onChange={e => setNuevoNombreGrupo(e.target.value)}
                  onBlur={guardarNombreGrupo}
                  onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") setEditandoNombreGrupo(false); }}
                  style={{ fontSize: 17, fontWeight: 700, color: T.text, border: "none", borderBottom: `2px solid ${T.accent}`, background: "transparent", textAlign: "center", outline: "none", width: "100%", padding: "4px 0", boxShadow: "none" }}
                  maxLength={40}
                />
              ) : (
                <button type="button" aria-label={`Cambiar nombre del grupo ${nombreGrupo}`} onClick={() => { setNuevoNombreGrupo(nombreGrupo); setEditandoNombreGrupo(true); }} style={{ background: "none", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 8px", borderRadius: 10, maxWidth: "100%", color: T.text }}>
                  <h1 style={{ fontSize: 17, fontWeight: 700, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nombreGrupo}</h1>
                  <IconoLinea name="edit" size={13} color={T.text3} />
                </button>
              )}
            </div>
            <button type="button" aria-label="Cómo funciona" onClick={() => setMostrarAyuda(true)} style={{ ...botonIcono, fontSize: 16, fontWeight: 700, color: T.text2 }}>?</button>
            <button type="button" aria-label="Opciones" onClick={() => setMostrarOpciones(true)} style={botonIcono}>
              <IconoLinea name="settings" size={18} color={T.text2} />
            </button>
          </div>
        )}
      </header>

      {/* ── GRUPOS ── */}
      {vista === "grupos" && (
        <main style={{ width: "100%", maxWidth: 430, padding: "4px 20px 32px" }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.5, margin: "0 0 4px" }}>
            Hola{usuarioData?.nombre ? `, ${usuarioData.nombre}` : ""}
          </h1>
          <div style={{ fontSize: 15, color: T.text2, marginBottom: 20 }}>
            {grupos.length ? "Tus grupos de gastos compartidos" : "Empecemos por crear tu grupo"}
          </div>

          {!gruposListos && [0, 1].map(i => (
            <div key={i} className="skeleton" style={{ height: 82, borderRadius: 20, marginBottom: 10 }} />
          ))}

          {[...grupos].sort((a, b) => a.creadoEn - b.creadoEn).map(grupo => (
            <GrupoCard key={grupo.id} grupo={grupo} usuarioUid={usuario.uid} onAbrir={abrirGrupo} />
          ))}

          {gruposListos && (mostrarFormGrupo || grupos.length === 0) ? (
            <form onSubmit={e => { e.preventDefault(); crearGrupo(); }} style={{ ...cardStyle, borderRadius: 20, padding: 18, marginTop: 4 }}>
              <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>¿Con quién compartís gastos?</div>
              <div style={{ fontSize: 14, color: T.text2, marginBottom: 18, lineHeight: 1.5 }}>Si todavía no tiene cuenta, se suma sola cuando se registre con ese email.</div>
              <label htmlFor={grupoEmailId} style={labelStyle}>Su email</label>
              <input id={grupoEmailId} placeholder="nombre@email.com" type="email" value={nuevoGrupoEmail} onChange={e => setNuevoGrupoEmail(e.target.value)} style={inputStyle} autoCapitalize="none" autoComplete="off" />
              <label htmlFor={grupoNombreOtroId} style={labelStyle}>Su nombre</label>
              <input id={grupoNombreOtroId} placeholder="Ej: Juli" value={nuevoGrupoNombreOtro} onChange={e => setNuevoGrupoNombreOtro(e.target.value)} style={inputStyle} maxLength={30} />
              <label htmlFor={grupoNombreId} style={labelStyle}>Nombre del grupo <span style={{ fontWeight: 400, color: T.text3 }}>(opcional)</span></label>
              <input id={grupoNombreId} placeholder="Ej: Casa" value={nuevoGrupoNombre} onChange={e => setNuevoGrupoNombre(e.target.value)} style={inputStyle} maxLength={40} />
              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                {grupos.length > 0 && (
                  <button type="button" onClick={resetFormGrupo} style={{ flex: 1, minHeight: 48, borderRadius: 14, border: `1px solid ${T.border}`, background: "transparent", color: T.text, cursor: "pointer", fontSize: 15, fontWeight: 600 }}>Cancelar</button>
                )}
                <button type="submit" disabled={guardando} style={{ flex: 2, minHeight: 48, borderRadius: 14, border: "none", background: guardando ? T.text3 : GRADIENT_ACCENT, color: "#fff", cursor: guardando ? "not-allowed" : "pointer", fontSize: 15, fontWeight: 700 }}>{guardando ? "Creando…" : "Crear grupo"}</button>
              </div>
            </form>
          ) : gruposListos && (
            <button type="button" onClick={() => setMostrarFormGrupo(true)} style={{ width: "100%", minHeight: 56, borderRadius: 20, background: "transparent", border: `1.5px dashed ${T.border}`, color: T.text2, cursor: "pointer", fontSize: 15, fontWeight: 600, marginTop: 4, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <IconoLinea name="plus" size={16} color={T.accent} />
              Nuevo grupo
            </button>
          )}
        </main>
      )}

      {/* ── INICIO GRUPO ── */}
      {vista === "inicio" && grupoActivo && (
        <HomeView
          gastos={gastos}
          gastosActuales={gastosActuales}
          balance={balance}
          nombreOtro={nombreOtro}
          miUid={usuario.uid}
          cargando={cargandoGastos}
          onNuevo={() => { resetFormGasto(); setVista("nuevo"); }}
          onEditar={abrirEditar}
          onHistorial={() => setVista("historial")}
          onSaldar={pedirSaldar}
        />
      )}

      <Suspense fallback={null}>
        {gruposListos && grupos.length === 0 && !onboardingVisto && (
          <OnboardingModal onClose={() => {
            localStorage.setItem("spliteasy_onboarding", "1");
            setOnboardingVisto(true);
          }} />
        )}

        {(vista === "nuevo" || (vista === "editar" && gastoEditando)) && grupoActivo && (
          <ExpenseFormView
            title={vista === "nuevo" ? "Nuevo gasto" : "Editar gasto"}
            submitLabel={vista === "nuevo" ? "Guardar gasto" : "Guardar cambios"}
            onSubmit={guardarGasto}
            onEliminar={vista === "editar" ? () => eliminarGasto(gastoEditando) : undefined}
            form={form}
            setForm={setForm}
            nombreOtro={nombreOtro}
          />
        )}

        {vista === "historial" && grupoActivo && (
          <HistoryView
            nombreOtro={nombreOtro}
            gastos={gastos}
            miUid={usuario.uid}
            onEditar={abrirEditar}
            onVerReporte={() => setVista("reporte")}
          />
        )}

        {vista === "reporte" && grupoActivo && (
          <ReporteView
            gastos={gastos}
            grupoNombre={nombreGrupo}
            nombreOtro={nombreOtro}
            miUid={usuario.uid}
          />
        )}
      </Suspense>
    </div>
    </TemaContext.Provider>
  );
}
