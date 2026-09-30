import { createContext, useContext } from "react";
import { FONT } from "./theme";

export const TemaContext = createContext(null);
export const useTema = () => useContext(TemaContext);

export const estilosDeTema = (T) => ({
  cardStyle: { background: T.surface, border: `1px solid ${T.border}`, boxShadow: T.sombra },
  inputStyle: { width: "100%", padding: "13px 14px", borderRadius: 12, background: T.surface2, border: `1px solid ${T.border}`, color: T.text, fontSize: 16, marginBottom: 16, boxSizing: "border-box", fontFamily: FONT },
  labelStyle: { display: "block", fontSize: 13, fontWeight: 600, color: T.text2, marginBottom: 8 },
  seccionStyle: { fontSize: 12, fontWeight: 600, letterSpacing: 0.6, textTransform: "uppercase", color: T.text3 },
});

export const useEstilos = () => estilosDeTema(useTema());
