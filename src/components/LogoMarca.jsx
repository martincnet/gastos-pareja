import { useTema } from "../themeContext";

export default function LogoMarca({ size = "normal" }) {
  const T = useTema();
  const grande = size === "grande";
  const s = grande ? 48 : 32;
  const rad = grande ? 14 : 10;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: grande ? 10 : 7, marginBottom: grande ? 8 : 0 }}>
      <div style={{
        width: s, height: s, borderRadius: rad,
        background: "linear-gradient(135deg, #FB7185, #F43F5E)",
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 4px 14px rgba(244,63,94,0.25)", flexShrink: 0,
      }}>
        <svg width={grande ? 24 : 16} height={grande ? 24 : 16} viewBox="0 0 24 24" fill="none">
          <line x1="4" y1="12" x2="20" y2="12" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
          <circle cx="12" cy="5.5" r="2.5" fill="white"/>
          <circle cx="12" cy="18.5" r="2.5" fill="white"/>
        </svg>
      </div>
      <div>
        <div style={{ fontSize: grande ? 26 : 18, fontWeight: 800, color: T.text, letterSpacing: -0.5, lineHeight: 1 }}>
          SplitEasy
        </div>
        {grande && <div style={{ fontSize: 13, color: T.text2, marginTop: 3 }}>Dividí gastos sin drama</div>}
      </div>
    </div>
  );
}
