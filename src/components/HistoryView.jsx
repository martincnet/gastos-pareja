import { useState } from "react";
import { FONT } from "../theme";
import { useTema, useEstilos } from "../themeContext";
import { CATEGORIAS, CAT_COLORES } from "../constants";
import { formatMonto, fmtFechaCorta, agruparPorPeriodo } from "../utils";
import GastoRow from "./GastoRow";
import IconoLinea from "./IconoLinea";

function Chip({ activo, onClick, children }) {
  const T = useTema();
  return (
    <button type="button" aria-pressed={activo} onClick={onClick} style={{
      padding: "8px 14px", borderRadius: 999, whiteSpace: "nowrap", flexShrink: 0, minHeight: 38,
      border: `1px solid ${activo ? T.text : T.border}`, background: activo ? T.text : T.surface,
      color: activo ? T.bg : T.text, cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: FONT,
      display: "flex", alignItems: "center", gap: 6,
    }}>{children}</button>
  );
}

export default function HistoryView({ nombreOtro, gastos, miUid, onEditar, onVerReporte }) {
  const T = useTema();
  const { cardStyle } = useEstilos();
  const [filtro, setFiltro] = useState("todos");
  const [abiertos, setAbiertos] = useState(() => new Set(["0"]));

  const filtrados = filtro === "todos" ? gastos : gastos.filter(g => g.categoria === filtro);
  const periodos = agruparPorPeriodo(filtrados);
  const categoriasUsadas = CATEGORIAS.filter(c => gastos.some(g => g.categoria === c.id));
  const toggle = (key) => setAbiertos(prev => {
    const s = new Set(prev);
    if (s.has(key)) s.delete(key); else s.add(key);
    return s;
  });

  return (
    <div style={{ width: "100%", maxWidth: 430, padding: "0 20px 40px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, margin: "4px 0 14px" }}>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: T.text, letterSpacing: -0.4 }}>Historial</h2>
        {gastos.length > 0 && (
          <button type="button" onClick={onVerReporte} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: "0 12px", minHeight: 38, fontSize: 13, fontWeight: 600, color: T.text, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: FONT }}>
            <IconoLinea name="list" size={14} color={T.accent} />
            Resumen por mes
          </button>
        )}
      </div>

      {categoriasUsadas.length > 1 && (
        <div aria-label="Filtrar por categoría" className="sin-scrollbar" style={{ display: "flex", gap: 8, overflowX: "auto", margin: "0 -20px 16px", padding: "0 20px 4px" }}>
          <Chip activo={filtro === "todos"} onClick={() => setFiltro("todos")}>Todas</Chip>
          {categoriasUsadas.map(c => (
            <Chip key={c.id} activo={filtro === c.id} onClick={() => setFiltro(c.id)}>
              <IconoLinea name={c.icon} size={14} color={filtro === c.id ? T.bg : (CAT_COLORES[c.id] || T.text2)} />
              {c.label}
            </Chip>
          ))}
        </div>
      )}

      {periodos.length === 0 ? (
        <div style={{ ...cardStyle, borderRadius: 20, padding: "26px 20px", textAlign: "center", color: T.text2, fontSize: 14, lineHeight: 1.55 }}>
          {filtro !== "todos"
            ? "No hay gastos de esta categoría."
            : `Cuando carguen gastos con ${nombreOtro}, van a quedar acá ordenados por período.`}
        </div>
      ) : periodos.map(p => {
        // Con un filtro activo mostramos todo desplegado para no esconder resultados
        const desplegado = filtro !== "todos" || abiertos.has(p.key);
        return (
          <section key={p.key} style={{ ...cardStyle, borderRadius: 20, overflow: "hidden", marginBottom: 12 }}>
            <button type="button" onClick={() => toggle(p.key)} aria-expanded={desplegado} disabled={filtro !== "todos"} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", background: "transparent", border: "none", borderBottom: desplegado ? `1px solid ${T.border}` : "none", textAlign: "left", cursor: filtro !== "todos" ? "default" : "pointer", fontFamily: FONT, color: T.text }}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 4, background: p.abierto ? T.accent : T.ok, flexShrink: 0 }} />
                    {p.abierto ? "Período abierto" : `Saldado el ${fmtFechaCorta(p.saldadoEn)}`}
                  </span>
                  <span className="num" style={{ fontSize: 15, fontWeight: 700, flexShrink: 0 }}>${formatMonto(p.total)}</span>
                </span>
                <span style={{ display: "block", fontSize: 12.5, color: T.text2, marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {fmtFechaCorta(p.desde)}{fmtFechaCorta(p.desde) !== fmtFechaCorta(p.hasta) ? ` – ${fmtFechaCorta(p.hasta)}` : ""} · {p.gastos.length} gasto{p.gastos.length !== 1 ? "s" : ""}
                </span>
              </span>
              {filtro === "todos" && (
                <span style={{ transform: desplegado ? "rotate(90deg)" : "none", transition: "transform 0.15s", display: "flex" }}>
                  <IconoLinea name="chevron-right" size={14} color={T.text3} />
                </span>
              )}
            </button>
            {desplegado && p.gastos.map((g, i) => (
              <GastoRow key={g.id} g={g} nombreOtro={nombreOtro} miUid={miUid} conFecha
                onEditar={p.abierto ? onEditar : undefined}
                ultimo={i === p.gastos.length - 1} />
            ))}
          </section>
        );
      })}
    </div>
  );
}
