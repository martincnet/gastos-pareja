import { useState } from "react";
import { GRADIENTES_BALANCE, GRADIENT_ACCENT, FONT } from "../theme";
import { useTema, useEstilos } from "../themeContext";
import { NOMBRES_MES_LARGO } from "../constants";
import { formatMonto, formatMontoCorto, fmtFechaCorta, agruparPorDia, resumenPagos, mesKey } from "../utils";
import GastoRow from "./GastoRow";
import IconoLinea from "./IconoLinea";

export default function HomeView({ gastos, gastosActuales, balance, nombreOtro, miUid, cargando, onNuevo, onEditar, onHistorial, onSaldar }) {
  const T = useTema();
  const { cardStyle, seccionStyle } = useEstilos();
  const [ahora] = useState(() => Date.now());

  const estado = balance > 0 ? "pos" : balance < 0 ? "neg" : "ok";
  const hayPeriodo = gastosActuales.length > 0;
  const pagos = resumenPagos(gastosActuales, miUid);
  const desde = hayPeriodo ? gastosActuales[gastosActuales.length - 1].timestamp : null;
  const ultimoSaldo = gastos.reduce((max, g) => Math.max(max, g.saldadoEn || 0), 0);
  const periodoViejo = hayPeriodo && mesKey(desde) < mesKey(ahora);
  const dias = agruparPorDia(gastosActuales);

  return (
    <div style={{ width: "100%", maxWidth: 430, padding: "0 20px 110px" }}>
      {/* Balance */}
      <section aria-label="Balance" style={{ background: GRADIENTES_BALANCE[estado], borderRadius: 24, padding: "22px 22px 18px", marginBottom: 12, color: "#fff", boxShadow: "0 10px 30px rgba(0,0,0,0.12)" }}>
        <div style={{ fontSize: 13, fontWeight: 600, opacity: 0.85 }}>
          {estado === "pos" ? `${nombreOtro} te debe` : estado === "neg" ? `Le debés a ${nombreOtro}` : "Están a mano"}
        </div>
        <div className="num" style={{ fontSize: 44, fontWeight: 800, letterSpacing: -1, margin: "4px 0 2px", lineHeight: 1.1 }}>
          ${formatMonto(Math.abs(balance))}
        </div>
        <div style={{ fontSize: 13, opacity: 0.8 }}>
          {cargando
            ? "Actualizando…"
            : hayPeriodo
              ? `${gastosActuales.length} gasto${gastosActuales.length !== 1 ? "s" : ""} desde el ${fmtFechaCorta(desde)}`
              : ultimoSaldo ? `Saldaron el ${fmtFechaCorta(ultimoSaldo)}` : "Todavía no hay gastos"}
        </div>
        {hayPeriodo && (
          <button type="button" onClick={onSaldar} style={{ marginTop: 16, width: "100%", minHeight: 44, borderRadius: 14, border: "1px solid rgba(255,255,255,0.35)", background: "rgba(255,255,255,0.16)", color: "#fff", fontSize: 15, fontWeight: 700, fontFamily: FONT, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <IconoLinea name="check" size={16} color="#fff" />
            {balance === 0 ? "Cerrar período" : "Saldar cuentas"}
          </button>
        )}
      </section>

      {/* Quién puso cuánto */}
      {hayPeriodo && (
        <div style={{ ...cardStyle, borderRadius: 18, padding: "12px 4px", marginBottom: 12, display: "grid", gridTemplateColumns: "1fr 1fr", textAlign: "center" }}>
          {[
            { label: "Pusiste vos", valor: pagos.yo },
            { label: `Puso ${nombreOtro}`, valor: pagos.otro },
          ].map((item, i) => (
            <div key={item.label} style={{ borderLeft: i ? `1px solid ${T.border}` : "none", padding: "0 10px", minWidth: 0 }}>
              <div style={{ fontSize: 12.5, color: T.text3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.label}</div>
              <div className="num" style={{ fontSize: 16, fontWeight: 700, color: T.text, marginTop: 3 }}>${formatMontoCorto(item.valor)}</div>
            </div>
          ))}
        </div>
      )}

      {/* Aviso suave si el período viene de meses anteriores */}
      {periodoViejo && (
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "12px 14px", borderRadius: 16, background: T.accentBg, marginBottom: 12, fontSize: 13, color: T.text, lineHeight: 1.5 }}>
          <IconoLinea name="bell" size={16} color={T.accent} />
          <span>
            Este período viene desde {NOMBRES_MES_LARGO[new Date(desde).getMonth()]}. Si ya se pagaron, saldalo para arrancar {NOMBRES_MES_LARGO[new Date(ahora).getMonth()]} de cero.
          </span>
        </div>
      )}

      {/* Gastos del período abierto, completos y agrupados por día */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "20px 2px 8px" }}>
        <h2 style={{ ...seccionStyle, margin: 0 }}>
          Período abierto{hayPeriodo && <span className="num" style={{ textTransform: "none", letterSpacing: 0, fontWeight: 500 }}> · ${formatMontoCorto(pagos.total)}</span>}
        </h2>
        <button type="button" onClick={onHistorial} style={{ background: "none", border: "none", color: T.accent, fontSize: 14, fontWeight: 600, cursor: "pointer", minHeight: 40, padding: 0, display: "flex", alignItems: "center", gap: 4, fontFamily: FONT }}>
          Historial
          <IconoLinea name="chevron-right" size={13} color={T.accent} />
        </button>
      </div>

      {cargando && gastos.length === 0 ? (
        <div style={{ ...cardStyle, borderRadius: 18, overflow: "hidden" }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ display: "flex", gap: 12, padding: 14, borderBottom: i < 2 ? `1px solid ${T.border}` : "none" }}>
              <div className="skeleton" style={{ width: 38, height: 38, borderRadius: 12 }} />
              <div style={{ flex: 1 }}>
                <div className="skeleton" style={{ height: 13, width: "60%", borderRadius: 6, marginBottom: 8 }} />
                <div className="skeleton" style={{ height: 11, width: "40%", borderRadius: 6 }} />
              </div>
            </div>
          ))}
        </div>
      ) : hayPeriodo ? (
        dias.map(dia => (
          <div key={dia.key} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.text2, margin: "0 4px 6px" }}>{dia.label}</div>
            <div style={{ ...cardStyle, borderRadius: 18, overflow: "hidden" }}>
              {dia.gastos.map((g, i) => (
                <GastoRow key={g.id} g={g} nombreOtro={nombreOtro} miUid={miUid} onEditar={onEditar} ultimo={i === dia.gastos.length - 1} />
              ))}
            </div>
          </div>
        ))
      ) : (
        <div style={{ ...cardStyle, borderRadius: 20, padding: "26px 20px", textAlign: "center" }}>
          <div style={{ width: 52, height: 52, borderRadius: 16, margin: "0 auto 12px", display: "flex", alignItems: "center", justifyContent: "center", background: gastos.length ? T.okBg : T.accentBg }}>
            <IconoLinea name={gastos.length ? "check" : "plus"} size={22} color={gastos.length ? T.ok : T.accent} />
          </div>
          <div style={{ fontSize: 17, fontWeight: 700, color: T.text, marginBottom: 6 }}>
            {gastos.length ? "Todo saldado" : "Carguen el primer gasto"}
          </div>
          <div style={{ fontSize: 14, color: T.text2, lineHeight: 1.55, maxWidth: 280, margin: "0 auto" }}>
            {gastos.length
              ? "El próximo gasto que carguen abre un período nuevo. Los anteriores quedan en el historial."
              : `Súper, nafta, una salida… Cargalo y SplitEasy calcula quién le debe a quién con ${nombreOtro}.`}
          </div>
        </div>
      )}

      {/* Acción principal fija abajo, siempre a mano */}
      <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, padding: "12px 20px max(14px, env(safe-area-inset-bottom))", background: `linear-gradient(to top, ${T.bg} 65%, transparent)`, display: "flex", justifyContent: "center", zIndex: 50, pointerEvents: "none" }}>
        <button type="button" onClick={onNuevo} style={{ pointerEvents: "auto", width: "100%", maxWidth: 390, minHeight: 54, borderRadius: 18, border: "none", background: GRADIENT_ACCENT, color: "#fff", fontSize: 16, fontWeight: 700, fontFamily: FONT, cursor: "pointer", boxShadow: "0 10px 26px rgba(244,63,94,0.32)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <IconoLinea name="plus" size={18} color="#fff" stroke={2.4} />
          Cargar gasto
        </button>
      </div>
    </div>
  );
}
