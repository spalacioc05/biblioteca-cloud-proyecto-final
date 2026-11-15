// Pruebas de humo contra la infraestructura REAL desplegada en AWS:
// CRUD completo, validaciones, 404, CORS y disponibilidad del frontend.
// No deja datos: el libro de prueba se elimina al final.
// Uso: node scripts/smoke-test.mjs <URL API> <URL frontend> [bucket S3]
const API = (process.argv[2] || "").replace(/\/+$/, "");
const SITIO = (process.argv[3] || "").replace(/\/+$/, "");
const BUCKET = process.argv[4] || "";
if (!API || !SITIO) {
  console.error("Uso: node scripts/smoke-test.mjs <URL API> <URL frontend CloudFront> [bucket S3]");
  process.exit(1);
}

const resultados = [];
const prueba = async (nombre, fn) => {
  const inicio = Date.now();
  try {
    const detalle = await fn();
    resultados.push({ prueba: nombre, resultado: "OK", ms: Date.now() - inicio, detalle: detalle || "" });
  } catch (err) {
    resultados.push({ prueba: nombre, resultado: "FALLA", ms: Date.now() - inicio, detalle: err.message });
  }
};
const esperar = (cond, msg) => {
  if (!cond) throw new Error(msg);
};
const json = (body) => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

const libro = { titulo: "Prueba automatizada", autor: "Smoke Test", genero: "Ensayo", paginas: 99, disponible: true };
let id;

await prueba("Frontend HTTPS (CloudFront) responde 200 con HTML", async () => {
  const r = await fetch(SITIO);
  const html = await r.text();
  esperar(r.status === 200 && html.includes("Biblioteca Cloud"), `status ${r.status}`);
  return `${r.headers.get("x-cache") || ""}`;
});
await prueba("Ruta SPA inexistente devuelve index.html", async () => {
  const r = await fetch(`${SITIO}/ruta/que/no/existe`);
  esperar(r.status === 200 && (await r.text()).includes('id="root"'), `status ${r.status}`);
});
if (BUCKET) {
  await prueba("Bucket S3 privado: acceso directo denegado (403)", async () => {
    const r = await fetch(`https://${BUCKET}.s3.amazonaws.com/index.html`);
    esperar(r.status === 403, `status ${r.status}`);
  });
}
await prueba("POST /libros crea (201)", async () => {
  const r = await fetch(`${API}/libros`, json(libro));
  const b = await r.json();
  esperar(r.status === 201 && b.id, `status ${r.status}`);
  id = b.id;
  return id;
});
await prueba("GET /libros incluye el libro creado (200)", async () => {
  const r = await fetch(`${API}/libros`);
  const b = await r.json();
  esperar(r.status === 200 && b.some((l) => l.id === id), `status ${r.status}`);
  return `${b.length} libros`;
});
await prueba("GET /libros/{id} (200)", async () => {
  const r = await fetch(`${API}/libros/${id}`);
  esperar(r.status === 200 && (await r.json()).titulo === libro.titulo, `status ${r.status}`);
});
await prueba("PUT /libros/{id} actualiza (200)", async () => {
  const r = await fetch(`${API}/libros/${id}`, { ...json({ ...libro, paginas: 120, disponible: false }), method: "PUT" });
  const b = await r.json();
  esperar(r.status === 200 && b.paginas === 120 && b.disponible === false && b.actualizadoEn, `status ${r.status}`);
});
await prueba("POST con datos inválidos (400)", async () => {
  const r = await fetch(`${API}/libros`, json({ ...libro, paginas: -1 }));
  esperar(r.status === 400, `status ${r.status}`);
  return (await r.json()).error;
});
await prueba("POST con JSON mal formado (400)", async () => {
  const r = await fetch(`${API}/libros`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{malo" });
  esperar(r.status === 400, `status ${r.status}`);
});
await prueba("GET con id mal formado (400)", async () => {
  const r = await fetch(`${API}/libros/no-es-uuid`);
  esperar(r.status === 400, `status ${r.status}`);
});
await prueba("GET de id inexistente (404)", async () => {
  const r = await fetch(`${API}/libros/00000000-0000-4000-8000-000000000000`);
  esperar(r.status === 404, `status ${r.status}`);
});
await prueba("CORS: preflight desde el dominio de CloudFront permitido", async () => {
  const r = await fetch(`${API}/libros`, {
    method: "OPTIONS",
    headers: { Origin: SITIO, "Access-Control-Request-Method": "PUT", "Access-Control-Request-Headers": "content-type" },
  });
  esperar(r.headers.get("access-control-allow-origin") === SITIO, `ACAO=${r.headers.get("access-control-allow-origin")}`);
});
await prueba("CORS: origen no autorizado no recibe cabeceras", async () => {
  const r = await fetch(`${API}/libros`, {
    method: "OPTIONS",
    headers: { Origin: "https://sitio-no-autorizado.example", "Access-Control-Request-Method": "DELETE" },
  });
  esperar(!r.headers.get("access-control-allow-origin"), "se devolvió Access-Control-Allow-Origin");
});
await prueba("DELETE /libros/{id} (200)", async () => {
  const r = await fetch(`${API}/libros/${id}`, { method: "DELETE" });
  esperar(r.status === 200, `status ${r.status}`);
});
await prueba("DELETE repetido (404)", async () => {
  const r = await fetch(`${API}/libros/${id}`, { method: "DELETE" });
  esperar(r.status === 404, `status ${r.status}`);
});

console.log(`Pruebas de humo — ${new Date().toISOString()}`);
console.log(`API: ${API}\nSitio: ${SITIO}\n`);
console.table(resultados);
const fallas = resultados.filter((r) => r.resultado !== "OK").length;
console.log(fallas ? `${fallas} prueba(s) fallaron` : `Todas las pruebas (${resultados.length}) pasaron`);
process.exit(fallas ? 1 : 0);
