import { CATEGORIAS, NOMBRES_MES } from "./constants";

export function formatMonto(n) {
  return n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Monto compacto: sin centavos si es redondo ($12.500 en vez de $12.500,00)
export function formatMontoCorto(n) {
  const redondo = Math.abs(n - Math.round(n)) < 0.005;
  return n.toLocaleString("es-AR", { minimumFractionDigits: redondo ? 0 : 2, maximumFractionDigits: 2 });
}

export function formatMontoInput(raw) {
  const limpio = String(raw || "").replace(/[^\d,]/g, "");
  if (!limpio) return "";
  const [enteraRaw, decimalRaw = ""] = limpio.split(",");
  const entera = enteraRaw.replace(/^0+(?=\d)/, "") || "0";
  const conMiles = entera.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const decimal = decimalRaw.slice(0, 2);
  return limpio.includes(",") ? `${conMiles},${decimal}` : conMiles;
}

export function parseMontoInput(raw) {
  if (!raw) return NaN;
  const normalizado = String(raw).replace(/\./g, "").replace(",", ".");
  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : NaN;
}

export const redondear = (n) => {
  const r = Math.round(n * 100) / 100;
  return Math.abs(r) < 0.005 ? 0 : r;
};

// ── Fechas ────────────────────────────────────────────────

export function mesKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function fmtMes(ym) {
  if (!ym) return "";
  const [y, m] = ym.split("-");
  return `${NOMBRES_MES[+m - 1]} ${y}`;
}

export function fmtFechaCorta(ts) {
  const d = new Date(ts);
  const mismoAnio = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("es-AR", { day: "numeric", month: "short", ...(mismoAnio ? {} : { year: "2-digit" }) }).replace(".", "");
}

export function fmtHora(ts) {
  return new Date(ts).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

function inicioDelDia(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function etiquetaDia(ts) {
  const hoy = inicioDelDia(Date.now());
  const dia = inicioDelDia(ts);
  const diff = Math.round((hoy - dia) / 86400000);
  if (diff === 0) return "Hoy";
  if (diff === 1) return "Ayer";
  const d = new Date(ts);
  const txt = d.toLocaleDateString("es-AR", {
    weekday: "long", day: "numeric", month: "long",
    ...(d.getFullYear() === new Date().getFullYear() ? {} : { year: "numeric" }),
  });
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}

// "YYYY-MM-DD" en hora local, para <input type="date">
export function fechaInputDesdeTs(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function hoyInput() {
  return fechaInputDesdeTs(Date.now());
}

// Convierte la fecha elegida en un timestamp. Si es hoy usa la hora actual;
// si es otro día, conserva la hora original (al editar) o usa el mediodía.
export function tsDesdeFechaInput(fecha, tsOriginal) {
  if (!fecha) return tsOriginal ?? Date.now();
  if (tsOriginal && fechaInputDesdeTs(tsOriginal) === fecha) return tsOriginal;
  if (fecha === hoyInput()) return Date.now();
  const [y, m, d] = fecha.split("-").map(Number);
  const base = tsOriginal ? new Date(tsOriginal) : null;
  return new Date(y, m - 1, d, base ? base.getHours() : 12, base ? base.getMinutes() : 0).getTime();
}

export function agruparPorDia(gastos) {
  const grupos = [];
  for (const g of gastos) {
    const key = inicioDelDia(g.timestamp);
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.key === key) ultimo.gastos.push(g);
    else grupos.push({ key, label: etiquetaDia(g.timestamp), gastos: [g] });
  }
  return grupos;
}

// ── Dinero ────────────────────────────────────────────────

export function getCategoriaMeta(id) {
  return CATEGORIAS.find(c => c.id === id) || CATEGORIAS[CATEGORIAS.length - 1];
}

// true si el pago lo hizo el usuario actual (independiente de quién cargó el gasto)
export function pagueYo(g, miUid) {
  return (g.cargadoPor === miUid) === g.modo.startsWith("pague_yo");
}

// Cuánto le suma (positivo) o resta (negativo) este gasto a mi balance
export function efectoEnBalance(g, miUid) {
  const parte = g.modo.includes("mitad") ? g.monto / 2 : g.monto;
  return pagueYo(g, miUid) ? parte : -parte;
}

export function calcularBalance(gastos, miUid) {
  let balance = 0;
  for (const g of gastos) {
    if (g.saldadoEn) continue;
    balance += efectoEnBalance(g, miUid);
  }
  return redondear(balance);
}

export function resumenPagos(gastos, miUid) {
  let yo = 0, otro = 0;
  for (const g of gastos) {
    if (pagueYo(g, miUid)) yo += g.monto;
    else otro += g.monto;
  }
  return { total: redondear(yo + otro), yo: redondear(yo), otro: redondear(otro) };
}

// Agrupa los gastos por período: el abierto (sin saldar) y cada saldo
export function agruparPorPeriodo(gastos) {
  const mapa = new Map();
  for (const g of gastos) {
    const key = g.saldadoEn || 0;
    if (!mapa.has(key)) mapa.set(key, []);
    mapa.get(key).push(g);
  }
  return [...mapa.entries()]
    .sort(([a], [b]) => (a === 0 ? -1 : b === 0 ? 1 : b - a))
    .map(([key, lista]) => {
      const ordenados = [...lista].sort((a, b) => b.timestamp - a.timestamp);
      return {
        key: String(key),
        abierto: key === 0,
        saldadoEn: key || null,
        gastos: ordenados,
        desde: ordenados[ordenados.length - 1].timestamp,
        hasta: ordenados[0].timestamp,
        total: redondear(ordenados.reduce((acc, g) => acc + g.monto, 0)),
      };
    });
}

export function getEtiqueta(g, miUid, nombreOtro) {
  const mitad = g.modo.includes("mitad");
  if (pagueYo(g, miUid)) {
    return { label: mitad ? `Pagaste vos · 50/50` : `Pagaste vos · lo debe ${nombreOtro}`, icon: mitad ? "split" : "arrow-in" };
  }
  return { label: mitad ? `Pagó ${nombreOtro} · 50/50` : `Pagó ${nombreOtro} · lo debés vos`, icon: mitad ? "divide" : "arrow-out" };
}

export function getMontoYSigno(g, miUid) {
  const efecto = efectoEnBalance(g, miUid);
  return { monto: Math.abs(efecto), signo: efecto >= 0 ? "+" : "−", tipo: efecto >= 0 ? "pos" : "neg" };
}

export function getModoUI(modo) {
  switch (modo) {
    case "pague_yo_total":  return { quienPago: "yo",   tipoDivision: "total" };
    case "pague_yo_mitad":  return { quienPago: "yo",   tipoDivision: "mitad" };
    case "pago_otro_total": return { quienPago: "otro", tipoDivision: "total" };
    case "pago_otro_mitad": return { quienPago: "otro", tipoDivision: "mitad" };
    default:                return { quienPago: "yo",   tipoDivision: "mitad" };
  }
}

export function getModoDesdeUI(quienPago, tipoDivision) {
  if (quienPago === "yo") {
    return tipoDivision === "total" ? "pague_yo_total" : "pague_yo_mitad";
  }
  return tipoDivision === "total" ? "pago_otro_total" : "pago_otro_mitad";
}

export function getResumenModo(modo, nombreOtro, montoRaw) {
  const montoNum = parseMontoInput(montoRaw);
  if (!montoRaw || Number.isNaN(montoNum) || montoNum <= 0) return null;
  const monto = modo.includes("mitad") ? montoNum / 2 : montoNum;
  if (modo.startsWith("pague_yo")) {
    return { texto: `${nombreOtro} te debe $${formatMonto(monto)}`, tipo: "pos" };
  }
  return { texto: `Vos le debés $${formatMonto(monto)} a ${nombreOtro}`, tipo: "neg" };
}
