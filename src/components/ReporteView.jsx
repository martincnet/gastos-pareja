import { useState, useRef } from "react";
import { FONT, GRADIENT_ACCENT } from "../theme";
import { useTema, useEstilos } from "../themeContext";
import { CAT_COLORES } from "../constants";
import { formatMonto, fmtMes, fmtFechaCorta, getCategoriaMeta, mesKey, resumenPagos } from "../utils";
import IconoLinea from "./IconoLinea";

function GraficoCategorias({ gastos }) {
  const T = useTema();
  const totales = {};
  for (const g of gastos) {
    totales[g.categoria] = (totales[g.categoria] || 0) + g.monto;
  }
  const total = Object.values(totales).reduce((a, b) => a + b, 0);
  if (!total) return null;

  const slices = Object.entries(totales)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, val]) => ({
      cat, val,
      pct: val / total,
      color: CAT_COLORES[cat] || "#A0A0B0",
      label: getCategoriaMeta(cat).label,
      icon: getCategoriaMeta(cat).icon,
    }));

  const cx = 70, cy = 70, r = 60, ri = 40;
  const GAP = slices.length > 1 ? 0.03 : 0;
  const arcs = slices.map((s, i) => {
    // Un solo 100% no se puede dibujar como arco: usamos un anillo
    if (s.pct >= 0.9999) return { ...s, anillo: true };
    const inicio = -Math.PI / 2 + slices.slice(0, i).reduce((acc, x) => acc + x.pct, 0) * Math.PI * 2;
    const sweep = s.pct * Math.PI * 2 - GAP;
    const a0 = inicio + GAP / 2;
    const a1 = a0 + sweep;
    if (sweep <= 0) return { ...s, path: "" };
    const x1o = cx + r  * Math.cos(a0), y1o = cy + r  * Math.sin(a0);
    const x2o = cx + r  * Math.cos(a1), y2o = cy + r  * Math.sin(a1);
    const x1i = cx + ri * Math.cos(a0), y1i = cy + ri * Math.sin(a0);
    const x2i = cx + ri * Math.cos(a1), y2i = cy + ri * Math.sin(a1);
    const large = sweep > Math.PI ? 1 : 0;
    return { ...s, path: `M ${x1i} ${y1i} L ${x1o} ${y1o} A ${r} ${r} 0 ${large} 1 ${x2o} ${y2o} L ${x2i} ${y2i} A ${ri} ${ri} 0 ${large} 0 ${x1i} ${y1i} Z` };
  });

  return (
    <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
      <div style={{ position: "relative", width: 140, height: 140, flexShrink: 0 }}>
        <svg width="140" height="140" viewBox="0 0 140 140" aria-hidden="true">
          {arcs.map((s, i) => s.anillo
            ? <circle key={i} cx={cx} cy={cy} r={(r + ri) / 2} fill="none" stroke={s.color} strokeWidth={r - ri} />
            : s.path && <path key={i} d={s.path} fill={s.color} />)}
        </svg>
        {/* Texto en HTML (no SVG) para que html2canvas lo renderice bien */}
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
          <span style={{ fontSize: 11, color: T.text2 }}>{slices.length} categ.</span>
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {slices.map(s => (
          <div key={s.cat} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
            <IconoLinea name={s.icon} size={14} color={s.color} />
            <span style={{ fontSize: 13, color: T.text, flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.label}</span>
            <span className="num" style={{ fontSize: 12, color: T.text2 }}>{Math.round(s.pct * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ReporteView({ gastos, grupoNombre, nombreOtro, miUid }) {
  const T = useTema();
  const { cardStyle, seccionStyle } = useEstilos();
  const [generando, setGenerando] = useState(false);
  const reporteRef = useRef(null);

  const meses = [...new Set(gastos.map(g => mesKey(g.timestamp)))].sort().reverse();
  const [mesElegido, setMesElegido] = useState(null);
  const mes = mesElegido && meses.includes(mesElegido) ? mesElegido : meses[0];

  const gastosMes = gastos.filter(g => mesKey(g.timestamp) === mes).sort((a, b) => b.timestamp - a.timestamp);
  const pagos     = resumenPagos(gastosMes, miUid);
  const mesLabel  = fmtMes(mes);
  const hoy       = new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const MAX_FILAS = 12;

  const handleCompartir = async () => {
    if (!reporteRef.current) return;
    setGenerando(true);
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(reporteRef.current, { scale: 2, useCORS: true, backgroundColor: T.bg, logging: false });
      const blob = await new Promise(res => canvas.toBlob(res, "image/png"));
      const nombreArchivo = `reporte-${grupoNombre}-${mes}.png`;
      const file = new File([blob], nombreArchivo, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `Reporte ${mesLabel} · ${grupoNombre}` });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = nombreArchivo;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      if (e?.name !== "AbortError") console.error("Error al generar el reporte:", e);
    } finally {
      setGenerando(false);
    }
  };

  if (!mes) return null;

  return (
    <div style={{ width: "100%", maxWidth: 430, padding: "0 0 110px" }}>
      <h2 style={{ margin: "4px 20px 14px", fontSize: 24, fontWeight: 700, color: T.text, letterSpacing: -0.4 }}>Resumen por mes</h2>

      <div aria-label="Elegir mes" className="sin-scrollbar" style={{ display: "flex", gap: 8, overflowX: "auto", padding: "0 20px 4px", marginBottom: 8 }}>
        {meses.map(m => {
          const activo = m === mes;
          return (
            <button key={m} type="button" aria-pressed={activo} onClick={() => setMesElegido(m)} style={{
              padding: "8px 14px", borderRadius: 999, whiteSpace: "nowrap", flexShrink: 0, minHeight: 38,
              border: `1px solid ${activo ? T.text : T.border}`, background: activo ? T.text : T.surface,
              color: activo ? T.bg : T.text, cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: FONT,
            }}>{fmtMes(m)}</button>
          );
        })}
      </div>

      {/* Contenido que se exporta como imagen */}
      <div ref={reporteRef} style={{ padding: "12px 20px 16px", background: T.bg }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: T.accent, letterSpacing: -0.3 }}>SplitEasy</div>
          <div style={{ fontSize: 13, color: T.text2 }}>{grupoNombre} · {mesLabel}</div>
        </div>

        <div style={{ ...cardStyle, borderRadius: 18, padding: 16, marginBottom: 12 }}>
          <div style={{ fontSize: 13, color: T.text2 }}>Gastaron en {mesLabel}</div>
          <div className="num" style={{ fontSize: 30, fontWeight: 800, color: T.text, letterSpacing: -0.5, margin: "2px 0 12px" }}>${formatMonto(pagos.total)}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[{ label: "Pusiste vos", v: pagos.yo }, { label: `Puso ${nombreOtro}`, v: pagos.otro }].map(it => (
              <div key={it.label} style={{ background: T.surface2, borderRadius: 12, padding: "10px 12px" }}>
                <div style={{ fontSize: 12, color: T.text2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.label}</div>
                <div className="num" style={{ fontSize: 16, fontWeight: 700, color: T.text, marginTop: 2 }}>${formatMonto(it.v)}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ ...cardStyle, borderRadius: 18, padding: 16, marginBottom: 12 }}>
          <div style={{ ...seccionStyle, marginBottom: 14 }}>Por categoría</div>
          <GraficoCategorias gastos={gastosMes} />
        </div>

        <div style={{ ...cardStyle, borderRadius: 18, overflow: "hidden" }}>
          <div style={{ ...seccionStyle, padding: "14px 16px 10px" }}>{gastosMes.length} gasto{gastosMes.length !== 1 ? "s" : ""}</div>
          {gastosMes.slice(0, MAX_FILAS).map(g => {
            const cat = getCategoriaMeta(g.categoria);
            return (
              <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 16px", borderTop: `1px solid ${T.border}` }}>
                <IconoLinea name={cat.icon} size={15} color={CAT_COLORES[g.categoria] || T.text2} />
                <div style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{g.descripcion}</div>
                <div style={{ fontSize: 12, color: T.text3, flexShrink: 0 }}>{fmtFechaCorta(g.timestamp)}</div>
                <div className="num" style={{ fontSize: 13.5, fontWeight: 700, color: T.text, flexShrink: 0, minWidth: 84, textAlign: "right" }}>${formatMonto(g.monto)}</div>
              </div>
            );
          })}
          {gastosMes.length > MAX_FILAS && (
            <div style={{ padding: "10px 16px", textAlign: "center", fontSize: 12, color: T.text3, borderTop: `1px solid ${T.border}` }}>
              y {gastosMes.length - MAX_FILAS} más
            </div>
          )}
        </div>

        <div style={{ textAlign: "center", marginTop: 14, fontSize: 11, color: T.text3 }}>Generado con SplitEasy · {hoy}</div>
      </div>

      <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, padding: "12px 20px max(14px, env(safe-area-inset-bottom))", background: `linear-gradient(to top, ${T.bg} 70%, transparent)`, display: "flex", justifyContent: "center", zIndex: 50 }}>
        <button type="button" onClick={handleCompartir} disabled={generando} style={{ width: "100%", maxWidth: 390, minHeight: 52, borderRadius: 16, border: "none", background: generando ? T.text3 : GRADIENT_ACCENT, color: "#fff", cursor: generando ? "not-allowed" : "pointer", fontSize: 16, fontWeight: 700, fontFamily: FONT, boxShadow: generando ? "none" : "0 8px 24px rgba(244,63,94,0.30)" }}>
          {generando ? "Generando imagen…" : "Compartir como imagen"}
        </button>
      </div>
    </div>
  );
}
