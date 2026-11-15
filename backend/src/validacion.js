// Reglas de validación del recurso "libro".
// Se mantienen los mismos campos y tipos de la API del Laboratorio 3
// (titulo, autor, genero, paginas, disponible) para conservar compatibilidad,
// y se agregan límites de longitud y rango para proteger la tabla.

const LIMITES = {
  titulo: 150,
  autor: 100,
  genero: 50,
  paginasMax: 10000,
  bodyBytes: 10 * 1024,
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const textoValido = (valor, campo, max) => {
  if (typeof valor !== "string" || !valor.trim())
    return `"${campo}" es obligatorio y debe ser texto no vacío`;
  if (valor.trim().length > max)
    return `"${campo}" no puede superar ${max} caracteres`;
  return null;
};

/**
 * Valida el cuerpo de un libro. Devuelve un mensaje de error o null.
 */
const validarLibro = (data) => {
  if (!data || typeof data !== "object" || Array.isArray(data))
    return "El cuerpo debe ser un objeto JSON válido";

  return (
    textoValido(data.titulo, "titulo", LIMITES.titulo) ||
    textoValido(data.autor, "autor", LIMITES.autor) ||
    textoValido(data.genero, "genero", LIMITES.genero) ||
    (!Number.isInteger(data.paginas) ||
    data.paginas <= 0 ||
    data.paginas > LIMITES.paginasMax
      ? `"paginas" es obligatorio y debe ser un entero entre 1 y ${LIMITES.paginasMax}`
      : null) ||
    (typeof data.disponible !== "boolean"
      ? '"disponible" es obligatorio y debe ser booleano'
      : null)
  );
};

/**
 * Normaliza los campos permitidos (recorta espacios y descarta campos extra).
 */
const normalizarLibro = (data) => ({
  titulo: data.titulo.trim(),
  autor: data.autor.trim(),
  genero: data.genero.trim(),
  paginas: data.paginas,
  disponible: data.disponible,
});

const idValido = (id) => typeof id === "string" && UUID_RE.test(id);

module.exports = { validarLibro, normalizarLibro, idValido, LIMITES };
