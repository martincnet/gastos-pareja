import { useId, useRef, useLayoutEffect } from "react";
import { GRADIENT_ACCENT, FONT } from "../theme";
import { useTema, useEstilos } from "../themeContext";
import { CATEGORIAS, CAT_COLORES } from "../constants";
import { formatMontoInput, getModoUI, getModoDesdeUI, getResumenModo, hoyInput } from "../utils";
import IconoLinea from "./IconoLinea";

function Segmentado({ opciones, valor, onChange, label }) {
  const T = useTema();
  return (
    <div role="radiogroup" aria-label={label} style={{ display: "flex", background: T.surface2, borderRadius: 12, padding: 3, border: `1px solid ${T.border}`, marginBottom: 16 }}>
      {opciones.map(op => {
        const activo = valor === op.id;
        return (
          <button key={op.id} type="button" role="radio" aria-checked={activo} onClick={() => onChange(op.id)} style={{
            flex: 1, minHeight: 42, borderRadius: 10, border: "none", padding: "6px 8px",
            background: activo ? T.surface : "transparent", color: activo ? T.text : T.text2,
            fontSize: 14, fontWeight: activo ? 700 : 500, fontFamily: FONT, cursor: "pointer",
            boxShadow: activo ? "0 1px 4px rgba(0,0,0,0.10)" : "none", transition: "background 0.15s",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>{op.label}</button>
        );
      })}
    </div>
  );
}

export default function ExpenseFormView({ title, submitLabel, onSubmit, onEliminar, disabled, form, setForm, nombreOtro }) {
  const T = useTema();
  const { inputStyle, labelStyle, cardStyle } = useEstilos();
  const modoUI      = getModoUI(form.modo);
  const resumenForm = getResumenModo(form.modo, nombreOtro, form.monto);

  const montoRef  = useRef(null);
  const cursorPos = useRef(null);
  const descripcionId = useId();
  const montoId = useId();
  const fechaId = useId();

  useLayoutEffect(() => {
    if (cursorPos.current !== null && montoRef.current) {
      const p = cursorPos.current;
      cursorPos.current = null;
      montoRef.current.setSelectionRange(p, p);
    }
  });

  const handleMontoChange = (e) => {
    // El teclado numérico de algunos teléfonos manda "." como separador decimal
    let raw = e.target.value;
    const pos = e.target.selectionStart;
    if (e.nativeEvent?.data === "." && !raw.includes(",")) {
      raw = raw.slice(0, pos - 1) + "," + raw.slice(pos);
    }

    // Cuenta caracteres significativos (dígitos + coma, NO puntos de miles) antes del cursor
    let sigBefore = 0;
    for (let i = 0; i < pos; i++) {
      if (raw[i] !== '.') sigBefore++;
    }

    const newVal = formatMontoInput(raw);

    let counted = 0;
    let newPos = newVal.length;
    for (let i = 0; i < newVal.length; i++) {
      if (counted === sigBefore) { newPos = i; break; }
      if (newVal[i] !== '.') counted++;
    }

    cursorPos.current = newPos;
    setForm(f => ({ ...f, monto: newVal }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <form onSubmit={handleSubmit} style={{ width: "100%", maxWidth: 430, padding: "0 20px 110px" }}>
      <h2 style={{ margin: "4px 0 16px", fontSize: 24, fontWeight: 700, color: T.text, letterSpacing: -0.4 }}>{title}</h2>

      <div style={{ ...cardStyle, borderRadius: 20, padding: 16, marginBottom: 12 }}>
        <label htmlFor={montoId} style={{ ...labelStyle, textAlign: "center" }}>Monto total</label>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, marginBottom: 14 }}>
          <span style={{ fontSize: 28, fontWeight: 700, color: form.monto ? T.text : T.text3 }}>$</span>
          <input
            id={montoId} ref={montoRef} placeholder="0" type="text" inputMode="decimal" autoComplete="off"
            value={form.monto} onChange={handleMontoChange} className="num"
            style={{ border: "none", background: "transparent", color: T.text, fontSize: 38, fontWeight: 700, fontFamily: FONT, width: `calc(${Math.max(1, form.monto.length)}ch + 12px)`, minWidth: 40, maxWidth: "85%", textAlign: "left", padding: "4px 0", outline: "none", boxShadow: "none" }}
          />
        </div>

        <label htmlFor={descripcionId} style={labelStyle}>Descripción</label>
        <input id={descripcionId} placeholder="Ej: Súper del sábado" value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} style={{ ...inputStyle, marginBottom: 14 }} maxLength={80} enterKeyHint="done" />

        <label htmlFor={fechaId} style={labelStyle}>Fecha</label>
        <input id={fechaId} type="date" value={form.fecha} max={hoyInput()} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} style={{ ...inputStyle, marginBottom: 0, minHeight: 48, WebkitAppearance: "none" }} />
      </div>

      <div style={{ ...cardStyle, borderRadius: 20, padding: 16, marginBottom: 12 }}>
        <div style={labelStyle}>¿Quién pagó?</div>
        <Segmentado
          label="Quién pagó"
          valor={modoUI.quienPago}
          onChange={id => setForm(f => ({ ...f, modo: getModoDesdeUI(id, modoUI.tipoDivision) }))}
          opciones={[{ id: "yo", label: "Yo" }, { id: "otro", label: nombreOtro }]}
        />
        <div style={labelStyle}>¿Cómo se reparte?</div>
        <Segmentado
          label="Cómo se reparte"
          valor={modoUI.tipoDivision}
          onChange={id => setForm(f => ({ ...f, modo: getModoDesdeUI(modoUI.quienPago, id) }))}
          opciones={[{ id: "mitad", label: "Mitad y mitad" }, { id: "total", label: modoUI.quienPago === "yo" ? `Le toca a ${nombreOtro}` : "Me toca a mí" }]}
        />
        <div aria-live="polite" style={{
          borderRadius: 12, padding: "11px 12px", fontSize: 14, fontWeight: 600, textAlign: "center",
          background: resumenForm ? T[`${resumenForm.tipo}Bg`] : T.surface2,
          color: resumenForm ? T[resumenForm.tipo] : T.text3,
        }}>
          {resumenForm ? resumenForm.texto : "Poné un monto para ver cómo queda"}
        </div>
      </div>

      <div style={{ ...cardStyle, borderRadius: 20, padding: 16, marginBottom: 12 }}>
        <div style={labelStyle}>Categoría</div>
        <div role="radiogroup" aria-label="Categoría" style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 6 }}>
          {CATEGORIAS.map(c => {
            const activo = form.categoria === c.id;
            const color = CAT_COLORES[c.id] || T.text2;
            return (
              <button key={c.id} type="button" role="radio" aria-checked={activo} onClick={() => setForm(f => ({ ...f, categoria: c.id }))} style={{
                minHeight: 62, padding: "8px 2px", borderRadius: 14,
                border: activo ? `2px solid ${color}` : `1px solid transparent`,
                background: activo ? `${color}1A` : "transparent", color: T.text, cursor: "pointer",
                fontSize: 11, fontWeight: activo ? 700 : 500, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5, fontFamily: FONT,
              }}>
                <IconoLinea name={c.icon} size={20} color={color} />
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      {onEliminar && (
        <button type="button" onClick={onEliminar} style={{ width: "100%", minHeight: 48, borderRadius: 14, border: `1px solid ${T.border}`, background: "transparent", color: T.neg, fontSize: 15, fontWeight: 600, fontFamily: FONT, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <IconoLinea name="trash" size={16} color={T.neg} />
          Eliminar gasto
        </button>
      )}

      <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, padding: "12px 20px max(14px, env(safe-area-inset-bottom))", background: `linear-gradient(to top, ${T.bg} 70%, transparent)`, display: "flex", justifyContent: "center", zIndex: 50 }}>
        <button type="submit" disabled={disabled} style={{ width: "100%", maxWidth: 390, minHeight: 52, borderRadius: 16, border: "none", background: disabled ? T.text3 : GRADIENT_ACCENT, color: "#fff", fontSize: 16, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer", boxShadow: disabled ? "none" : "0 8px 24px rgba(244,63,94,0.30)", fontFamily: FONT }}>
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
