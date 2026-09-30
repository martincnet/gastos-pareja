import { useState } from "react";
import { FONT, GRADIENT_ACCENT, GRADIENTES_BALANCE } from "../theme";
import { useTema } from "../themeContext";
import IconoLinea from "./IconoLinea";

function MockupGrupo() {
  const T = useTema();
  return (
    <div style={{ background: T.surface, borderRadius: 16, padding: 16, border: `1px solid ${T.border}`, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
      <div style={{ fontSize: 12, color: T.text2, marginBottom: 12 }}>¿Con quién compartís gastos?</div>
      {[
        { label: "Nombre del grupo", value: "Casa con Juli" },
        { label: "Email de la otra persona", value: "juli@email.com" },
      ].map(({ label, value }) => (
        <div key={label}>
          <div style={{ fontSize: 10, color: T.text3, marginBottom: 4, letterSpacing: 1.5, textTransform: "uppercase" }}>{label}</div>
          <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 10, padding: "9px 12px", fontSize: 13, color: T.text, marginBottom: 10 }}>{value}</div>
        </div>
      ))}
      <div style={{ background: GRADIENT_ACCENT, borderRadius: 10, padding: "11px", color: "#fff", fontSize: 13, fontWeight: "bold", textAlign: "center", fontFamily: FONT }}>
        Crear grupo
      </div>
    </div>
  );
}

function MockupInvitacion() {
  const T = useTema();
  return (
    <div>
      <div style={{ background: T.surface, borderRadius: 16, padding: "14px 16px", border: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 12, marginBottom: 10, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
        <div style={{ width: 42, height: 42, borderRadius: 13, background: "linear-gradient(135deg, #ff758c, #ff4d6d)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: "bold", fontSize: 20, flexShrink: 0, fontFamily: FONT }}>
          C
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: "bold", color: T.text, display: "flex", alignItems: "center", gap: 6 }}>
            Casa con Juli
            <span style={{ fontSize: 9, background: "rgba(247,151,30,0.12)", color: "#D4890A", borderRadius: 999, padding: "3px 7px", fontWeight: "bold", letterSpacing: 0.5 }}>PENDIENTE</span>
          </div>
          <div style={{ fontSize: 11, color: T.text2, marginTop: 4 }}>El otro usuario aún no tiene cuenta</div>
        </div>
      </div>
      <div style={{ background: "rgba(46,196,182,0.08)", borderRadius: 13, padding: "11px 13px", border: "1px solid rgba(46,196,182,0.2)", display: "flex", gap: 9, alignItems: "flex-start" }}>
        <IconoLinea name="bell" size={14} color="#1a8a84" />
        <div style={{ fontSize: 12, color: "#1a8a84", lineHeight: 1.55 }}>
          Cuando Juli se registre con ese email, se une al grupo automáticamente.
        </div>
      </div>
    </div>
  );
}

function MockupGasto() {
  const T = useTema();
  return (
    <div>
      <div style={{ background: GRADIENTES_BALANCE.pos, borderRadius: 16, padding: "14px 16px 12px", marginBottom: 10, textAlign: "center", boxShadow: "0 6px 20px rgba(255,77,109,0.25)" }}>
        <div style={{ fontSize: 10, letterSpacing: 3, color: "rgba(255,255,255,0.8)", marginBottom: 4, textTransform: "uppercase" }}>Te deben</div>
        <div style={{ fontSize: 34, fontWeight: "bold", color: "#fff", fontFamily: FONT }}>$1.500</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.9)", marginTop: 2 }}>Juli te debe a vos</div>
      </div>
      <div style={{ background: T.surface, borderRadius: 13, padding: "11px 13px", border: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 10, boxShadow: "0 1px 6px rgba(0,0,0,0.04)" }}>
        <div style={{ width: 34, height: 34, borderRadius: 11, background: "rgba(255,107,107,0.10)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <IconoLinea name="food" size={15} color="#FF6B6B" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: "bold", color: T.text }}>Pizza del viernes</div>
          <div style={{ fontSize: 11, color: T.text2, marginTop: 2 }}>Pagaste vos · mitad y mitad</div>
        </div>
        <div style={{ fontSize: 14, fontWeight: "bold", color: T.pos }}>+$1.500</div>
      </div>
    </div>
  );
}

const PASOS = [
  {
    titulo: "Creá tu grupo",
    descripcion: "Agregá el email de la persona con la que compartís gastos.",
    mockup: <MockupGrupo />,
  },
  {
    titulo: "Invitás a alguien",
    descripcion: "Si todavía no tiene cuenta, el grupo queda en espera. Cuando se registre con ese email, se une solo.",
    mockup: <MockupInvitacion />,
  },
  {
    titulo: "Cargás un gasto",
    descripcion: "Elegís quién pagó y cómo se divide. SplitEasy calcula el balance automáticamente.",
    mockup: <MockupGasto />,
  },
];

export default function OnboardingModal({ onClose }) {
  const T = useTema();
  const [paso, setPaso] = useState(0);
  const esUltimo = paso === PASOS.length - 1;
  const { titulo, descripcion, mockup } = PASOS[paso];

  return (
    <div style={{ position: "fixed", inset: 0, background: T.overlay, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "0 24px" }}>
      <div style={{ background: T.surface, borderRadius: 28, padding: "24px 20px 20px", maxWidth: 360, width: "100%", border: `1px solid ${T.border}`, boxShadow: "0 20px 48px rgba(0,0,0,0.14)" }}>

        {/* Dots */}
        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 20 }}>
          {PASOS.map((_, i) => (
            <div key={i} style={{ height: 6, borderRadius: 3, background: i === paso ? T.accent : T.border, width: i === paso ? 22 : 6, transition: "all 0.25s ease" }} />
          ))}
        </div>

        {/* Mockup */}
        <div style={{ marginBottom: 20 }}>{mockup}</div>

        {/* Texto */}
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 19, fontWeight: 700, color: T.text, marginBottom: 6, fontFamily: FONT }}>{titulo}</div>
          <div style={{ fontSize: 13, color: T.text2, lineHeight: 1.65 }}>{descripcion}</div>
        </div>

        {/* Botones */}
        <div style={{ display: "flex", gap: 10 }}>
          {paso > 0 && (
            <button
              onClick={() => setPaso(p => p - 1)}
              style={{ flex: 1, padding: "13px", borderRadius: 14, border: `1px solid ${T.border}`, background: T.surface2, color: T.text, cursor: "pointer", fontSize: 15, fontFamily: FONT }}
            >
              Atrás
            </button>
          )}
          <button
            onClick={() => esUltimo ? onClose() : setPaso(p => p + 1)}
            style={{ flex: 2, padding: "13px", borderRadius: 14, border: "none", background: GRADIENT_ACCENT, color: "#fff", cursor: "pointer", fontSize: 15, fontWeight: "bold", fontFamily: FONT, boxShadow: "0 8px 20px rgba(255,77,109,0.28)" }}
          >
            {esUltimo ? "¡Empezar!" : "Siguiente"}
          </button>
        </div>
      </div>
    </div>
  );
}
