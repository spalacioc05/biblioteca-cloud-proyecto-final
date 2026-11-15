// Cliente de la API REST de Biblioteca Cloud (API Gateway + Lambda).
// La URL se inyecta en tiempo de compilación con VITE_API_URL; no hay
// credenciales ni secretos en el navegador.

const BASE = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");

export const apiConfigurada = Boolean(BASE);
export const apiUrl = BASE;

export class ApiError extends Error {
  constructor(mensaje, status) {
    super(mensaje);
    this.status = status;
  }
}

async function solicitar(ruta, opciones = {}) {
  if (!BASE) throw new ApiError("La URL de la API no está configurada (VITE_API_URL).", 0);

  let res;
  try {
    res = await fetch(`${BASE}${ruta}`, {
      ...opciones,
      headers: opciones.body ? { "Content-Type": "application/json" } : undefined,
    });
  } catch {
    throw new ApiError("No hay conexión con el servidor. Revisa tu red e inténtalo de nuevo.", 0);
  }

  let datos = null;
  try {
    datos = await res.json();
  } catch {
    // respuesta sin cuerpo JSON
  }

  if (!res.ok) {
    const mensaje =
      (datos && datos.error) ||
      (res.status === 429
        ? "Demasiadas solicitudes. Espera un momento e inténtalo de nuevo."
        : `Error inesperado del servidor (${res.status}).`);
    throw new ApiError(mensaje, res.status);
  }
  return datos;
}

export const listarLibros = () => solicitar("/libros");
export const obtenerLibro = (id) => solicitar(`/libros/${encodeURIComponent(id)}`);
export const crearLibro = (libro) =>
  solicitar("/libros", { method: "POST", body: JSON.stringify(libro) });
export const actualizarLibro = (id, libro) =>
  solicitar(`/libros/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(libro) });
export const eliminarLibro = (id) =>
  solicitar(`/libros/${encodeURIComponent(id)}`, { method: "DELETE" });
