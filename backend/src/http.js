const { LIMITES } = require("./validacion");

// Los encabezados CORS los agrega API Gateway (configuración httpApi.cors en
// serverless.yml), por eso aquí solo se define el tipo de contenido.
const respuesta = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  },
  body: JSON.stringify(body),
});

/**
 * Lee y parsea el cuerpo JSON de un evento de API Gateway HTTP API (payload v2).
 * Devuelve { data } si es válido, o { error, statusCode } si no lo es.
 */
const leerBody = (event) => {
  let raw = event.body || "";
  if (event.isBase64Encoded && raw) {
    raw = Buffer.from(raw, "base64").toString("utf8");
  }
  if (Buffer.byteLength(raw, "utf8") > LIMITES.bodyBytes) {
    return { statusCode: 413, error: "El cuerpo de la petición es demasiado grande" };
  }
  try {
    return { data: JSON.parse(raw || "{}") };
  } catch {
    return { statusCode: 400, error: "El cuerpo debe ser un JSON válido" };
  }
};

// Log estructurado en JSON para facilitar búsquedas en CloudWatch Logs Insights.
const log = (nivel, operacion, detalle = {}) => {
  const linea = JSON.stringify({ nivel, operacion, ...detalle });
  if (nivel === "ERROR") console.error(linea);
  else console.log(linea);
};

module.exports = { respuesta, leerBody, log };
