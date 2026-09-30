import { useState, useEffect } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { FONT } from "../theme";
import { useTema } from "../themeContext";
import { calcularBalance, formatMonto } from "../utils";
import IconoLinea from "./IconoLinea";

export default function GrupoCard({ grupo, usuarioUid, onAbrir }) {
  const T = useTema();
  const [resumen, setResumen] = useState(null);

  useEffect(() => {
    const q = query(collection(db, "gastos"), where("grupoId", "==", grupo.id));
    const unsub = onSnapshot(q,
      (snap) => {
        const gastos = snap.docs.map(d => d.data());
        setResumen({ cant: gastos.length, balance: calcularBalance(gastos, usuarioUid) });
      },
      (error) => { console.error("Error al cargar balance:", error); }
    );
    return () => unsub();
  }, [grupo.id, usuarioUid]);

  const pendiente = grupo.miembros.length === 1;
  const nombreOtro = Object.entries(grupo.miembrosNombres || {}).find(([uid]) => uid !== usuarioUid)?.[1] || grupo.nombreOtroDefault || "";
  const balance = resumen?.balance ?? 0;

  let detalle, color = T.text2;
  if (pendiente) detalle = "Esperando que se registre";
  else if (!resumen) detalle = "…";
  else if (resumen.cant === 0) detalle = "Sin gastos todavía";
  else if (balance > 0) { detalle = `Te debe $${formatMonto(balance)}`; color = T.pos; }
  else if (balance < 0) { detalle = `Le debés $${formatMonto(-balance)}`; color = T.neg; }
  else { detalle = "Están a mano"; color = T.ok; }

  return (
    <button type="button" onClick={() => onAbrir(grupo)} className="fila-tocable" style={{ width: "100%", display: "flex", alignItems: "center", gap: 14, padding: 16, marginBottom: 10, background: T.surface, borderRadius: 20, border: `1px solid ${T.border}`, boxShadow: T.sombra, cursor: "pointer", textAlign: "left", fontFamily: FONT, color: T.text }}>
      <span style={{ width: 48, height: 48, borderRadius: 15, background: grupo.color, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 700, color: "#fff" }}>
        {grupo.nombre.charAt(0).toUpperCase()}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 16, fontWeight: 700 }}>
          <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{grupo.nombre}</span>
          {pendiente && (
            <span style={{ fontSize: 10, background: "rgba(245,158,11,0.14)", color: "#B45309", borderRadius: 999, padding: "3px 8px", fontWeight: 700, flexShrink: 0 }}>PENDIENTE</span>
          )}
        </span>
        {nombreOtro && nombreOtro !== grupo.nombre && (
          <span style={{ display: "block", fontSize: 13, color: T.text3, marginTop: 2 }}>con {nombreOtro}</span>
        )}
        <span className="num" style={{ display: "block", fontSize: 14, fontWeight: 600, color, marginTop: 4 }}>{detalle}</span>
      </span>
      <IconoLinea name="chevron-right" size={16} color={T.text3} />
    </button>
  );
}
