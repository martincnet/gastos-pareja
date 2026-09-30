import { useTema } from "../themeContext";
import { CAT_COLORES } from "../constants";
import { getCategoriaMeta, getEtiqueta, getMontoYSigno, formatMonto, fmtHora, fmtFechaCorta } from "../utils";
import IconoLinea from "./IconoLinea";

// Fila de gasto pensada para ir dentro de una lista (sin tarjeta propia).
// Si el gasto es mío, toda la fila es tocable para editarlo.
export default function GastoRow({ g, nombreOtro, miUid, onEditar, conFecha = false, atenuado = false, ultimo = false }) {
  const T = useTema();
  const etiqueta = getEtiqueta(g, miUid, nombreOtro);
  const { monto, signo, tipo } = getMontoYSigno(g, miUid);
  const esMio = g.cargadoPor === miUid;
  const categoria = getCategoriaMeta(g.categoria);
  const colorCat = CAT_COLORES[g.categoria] || T.text2;
  const editable = esMio && onEditar;
  const Tag = editable ? "button" : "div";
  const cuando = conFecha ? `${fmtFechaCorta(g.timestamp)} · ${fmtHora(g.timestamp)}` : fmtHora(g.timestamp);
  const quien = esMio ? "" : ` · cargó ${g.cargadoPorNombre || nombreOtro}`;

  return (
    <Tag
      {...(editable ? { type: "button", onClick: () => onEditar(g), "aria-label": `Editar ${g.descripcion}` } : {})}
      className={editable ? "fila-tocable" : undefined}
      style={{
        width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
        background: "transparent", border: "none", borderBottom: ultimo ? "none" : `1px solid ${T.border}`,
        textAlign: "left", font: "inherit", color: "inherit", cursor: editable ? "pointer" : "default",
        opacity: atenuado ? 0.55 : 1,
      }}
    >
      <span style={{ width: 38, height: 38, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: `${colorCat}1A`, flexShrink: 0 }}>
        <IconoLinea name={categoria.icon} size={18} color={colorCat} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 15, fontWeight: 600, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {g.descripcion}
        </span>
        <span style={{ display: "block", fontSize: 12.5, color: T.text2, marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {etiqueta.label}
        </span>
        <span style={{ display: "block", fontSize: 12, color: T.text3, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {cuando}{quien}
        </span>
      </span>
      <span style={{ textAlign: "right", flexShrink: 0 }}>
        <span className="num" style={{ display: "block", fontSize: 15, fontWeight: 700, color: T[tipo] }}>{signo}${formatMonto(monto)}</span>
        {g.modo.includes("mitad") && (
          <span className="num" style={{ display: "block", fontSize: 12, color: T.text3, marginTop: 2 }}>de ${formatMonto(g.monto)}</span>
        )}
      </span>
      {editable && <IconoLinea name="chevron-right" size={14} color={T.text3} />}
    </Tag>
  );
}
