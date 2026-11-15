// Carga libros de demostración (obras publicadas, sin datos personales) a
// través de la API real. Omite los que ya existen (mismo título y autor).
// Uso: node scripts/seed.mjs https://<api-id>.execute-api.us-east-1.amazonaws.com
const API = (process.argv[2] || process.env.API_URL || "").replace(/\/+$/, "");
if (!API) {
  console.error("Uso: node scripts/seed.mjs <URL de la API>");
  process.exit(1);
}

const LIBROS = [
  { titulo: "Cien años de soledad", autor: "Gabriel García Márquez", genero: "Novela", paginas: 471, disponible: true },
  { titulo: "La vorágine", autor: "José Eustasio Rivera", genero: "Novela", paginas: 320, disponible: false },
  { titulo: "María", autor: "Jorge Isaacs", genero: "Novela", paginas: 368, disponible: true },
  { titulo: "Ficciones", autor: "Jorge Luis Borges", genero: "Fantasía", paginas: 224, disponible: true },
  { titulo: "Fundación", autor: "Isaac Asimov", genero: "Ciencia ficción", paginas: 255, disponible: false },
  { titulo: "Clean Code", autor: "Robert C. Martin", genero: "Programación", paginas: 464, disponible: true },
  { titulo: "Designing Data-Intensive Applications", autor: "Martin Kleppmann", genero: "Programación", paginas: 616, disponible: true },
  { titulo: "Breve historia del tiempo", autor: "Stephen Hawking", genero: "Ciencia", paginas: 256, disponible: true },
  { titulo: "Veinte poemas de amor y una canción desesperada", autor: "Pablo Neruda", genero: "Poesía", paginas: 112, disponible: false },
];

const existentes = await (await fetch(`${API}/libros`)).json();
const clave = (l) => `${l.titulo}|${l.autor}`.toLowerCase();
const ya = new Set(existentes.map(clave));

let creados = 0;
for (const libro of LIBROS) {
  if (ya.has(clave(libro))) continue;
  const res = await fetch(`${API}/libros`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(libro),
  });
  if (!res.ok) throw new Error(`POST ${libro.titulo}: ${res.status} ${await res.text()}`);
  creados += 1;
}
console.log(`Libros creados: ${creados}. Total en catálogo: ${existentes.length + creados}.`);
