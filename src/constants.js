export const CATEGORIAS = [
  { id: "comida",     label: "Comida",      icon: "food" },
  { id: "super",      label: "Super",       icon: "cart" },
  { id: "salidas",    label: "Salidas",     icon: "ticket" },
  { id: "transporte", label: "Transporte",  icon: "bus" },
  { id: "casa",       label: "Casa",        icon: "home" },
  { id: "salud",      label: "Salud",       icon: "health" },
  { id: "ropa",       label: "Ropa",        icon: "shirt" },
  { id: "viajes",     label: "Viajes",      icon: "plane" },
  { id: "mascota",    label: "Mascota",     icon: "paw" },
  { id: "otro",       label: "Otro",        icon: "box" },
];

export const COLORES_GRUPO = [
  "linear-gradient(135deg, #ff758c, #ff4d6d)",
  "linear-gradient(135deg, #667eea, #764ba2)",
  "linear-gradient(135deg, #2ec4b6, #1a8a84)",
  "linear-gradient(135deg, #f7971e, #ffd200)",
  "linear-gradient(135deg, #56ab2f, #a8e063)",
  "linear-gradient(135deg, #ee0979, #ff6a00)",
];

export const MODOS = [
  { id: "pague_yo_total",  label: "Pagué yo, me deben el total" },
  { id: "pague_yo_mitad",  label: "Pagué yo, me deben la mitad" },
  { id: "pago_otro_total", label: "Pagó el otro, le debo el total" },
  { id: "pago_otro_mitad", label: "Pagó el otro, le debo la mitad" },
];

export const CAT_COLORES = {
  comida:     "#FF6B6B",
  super:      "#4FC3A1",
  salidas:    "#5B9BD5",
  transporte: "#F0A500",
  casa:       "#9B59B6",
  salud:      "#2ECC71",
  ropa:       "#E05C5C",
  viajes:     "#3498DB",
  mascota:    "#F4A24A",
  otro:       "#A0A0B0",
};

export const FORM_INICIAL = { descripcion: "", categoria: "comida", monto: "", modo: "pague_yo_mitad" };
export const NOMBRES_MES  = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
export const NOMBRES_MES_LARGO = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
