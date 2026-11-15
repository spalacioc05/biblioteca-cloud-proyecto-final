export const GENEROS_SUGERIDOS = [
  "Novela",
  "Ciencia ficción",
  "Fantasía",
  "Historia",
  "Ensayo",
  "Poesía",
  "Programación",
  "Ciencia",
  "Biografía",
];

// Normaliza texto para búsquedas sin distinguir mayúsculas ni tildes.
export const normalizar = (texto) =>
  String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

// Color estable por género para el lomo de cada tarjeta.
const TONOS = ["#1f5f5b", "#8a4b2a", "#3d5a80", "#6b4e71", "#4f6d3a", "#9c6b1d", "#7a3b4b", "#2f6f8f"];
export const colorGenero = (genero) => {
  let h = 0;
  for (const c of normalizar(genero)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return TONOS[h % TONOS.length];
};

const formatoFecha = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "America/Bogota",
});
export const fecha = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : formatoFecha.format(d);
};

export const numero = (n) => new Intl.NumberFormat("es-CO").format(n);
