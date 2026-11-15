// Pruebas unitarias de los handlers. DynamoDB se reemplaza por un doble en
// memoria para validar la lógica (códigos HTTP, validaciones y comandos
// enviados) sin tocar AWS. Las pruebas reales contra AWS están en
// scripts/smoke-test.mjs.
const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

process.env.LIBROS_TABLE = "tabla-pruebas";

const dynamo = require("../src/db");
const handler = require("../src/handler");

let enviados;
let siguienteRespuesta;

beforeEach(() => {
  enviados = [];
  siguienteRespuesta = async () => ({});
  dynamo.db = {
    send: async (cmd) => {
      enviados.push(cmd);
      return siguienteRespuesta(cmd);
    },
  };
});

const libroValido = {
  titulo: "  Cien años de soledad ",
  autor: "Gabriel García Márquez",
  genero: "Novela",
  paginas: 471,
  disponible: true,
};

const ID = "3f2b8c1e-9a4d-4c2b-8f1e-2a3b4c5d6e7f";
const body = (r) => JSON.parse(r.body);
const condicionFallida = () => {
  const e = new Error("conditional");
  e.name = "ConditionalCheckFailedException";
  throw e;
};

test("crear: 201 con datos válidos, normaliza y genera id/creadoEn", async () => {
  const r = await handler.crear({ body: JSON.stringify({ ...libroValido, extra: "x" }) });
  assert.equal(r.statusCode, 201);
  const b = body(r);
  assert.equal(b.titulo, "Cien años de soledad");
  assert.match(b.id, /^[0-9a-f-]{36}$/);
  assert.ok(!Number.isNaN(Date.parse(b.creadoEn)));
  assert.equal(b.extra, undefined);
  assert.equal(enviados.length, 1);
  assert.equal(enviados[0].input.TableName, "tabla-pruebas");
});

test("crear: 400 con JSON inválido", async () => {
  const r = await handler.crear({ body: "{no-json" });
  assert.equal(r.statusCode, 400);
  assert.equal(enviados.length, 0);
});

test("crear: 400 cuando faltan campos o los tipos son incorrectos", async () => {
  for (const malo of [
    { ...libroValido, titulo: "" },
    { ...libroValido, autor: 3 },
    { ...libroValido, paginas: 0 },
    { ...libroValido, paginas: 12.5 },
    { ...libroValido, paginas: 20000 },
    { ...libroValido, disponible: "si" },
    { ...libroValido, titulo: "x".repeat(151) },
    [],
  ]) {
    const r = await handler.crear({ body: JSON.stringify(malo) });
    assert.equal(r.statusCode, 400, JSON.stringify(malo).slice(0, 60));
  }
  assert.equal(enviados.length, 0);
});

test("crear: 413 si el cuerpo supera 10 KB", async () => {
  const r = await handler.crear({ body: JSON.stringify({ ...libroValido, relleno: "a".repeat(11000) }) });
  assert.equal(r.statusCode, 413);
});

test("crear: acepta cuerpo en base64", async () => {
  const r = await handler.crear({
    isBase64Encoded: true,
    body: Buffer.from(JSON.stringify(libroValido)).toString("base64"),
  });
  assert.equal(r.statusCode, 201);
});

test("crear: 500 si DynamoDB falla", async () => {
  siguienteRespuesta = async () => {
    throw new Error("boom");
  };
  const r = await handler.crear({ body: JSON.stringify(libroValido) });
  assert.equal(r.statusCode, 500);
});

test("listar: 200, recorre todas las páginas y ordena por fecha desc", async () => {
  let llamada = 0;
  siguienteRespuesta = async () => {
    llamada += 1;
    return llamada === 1
      ? { Items: [{ id: "a", creadoEn: "2026-01-01T00:00:00Z" }], LastEvaluatedKey: { id: "a" } }
      : { Items: [{ id: "b", creadoEn: "2026-02-01T00:00:00Z" }] };
  };
  const r = await handler.listar({});
  assert.equal(r.statusCode, 200);
  assert.deepEqual(body(r).map((l) => l.id), ["b", "a"]);
  assert.equal(enviados.length, 2);
});

test("obtener: 400 con id inválido, 404 si no existe, 200 si existe", async () => {
  assert.equal((await handler.obtener({ pathParameters: { id: "abc" } })).statusCode, 400);

  siguienteRespuesta = async () => ({});
  assert.equal((await handler.obtener({ pathParameters: { id: ID } })).statusCode, 404);

  siguienteRespuesta = async () => ({ Item: { id: ID, titulo: "X" } });
  const r = await handler.obtener({ pathParameters: { id: ID } });
  assert.equal(r.statusCode, 200);
  assert.equal(body(r).id, ID);
});

test("actualizar: 200 con datos válidos y 404 si no existe", async () => {
  siguienteRespuesta = async (cmd) => ({ Attributes: { id: ID, ...cmd.input.ExpressionAttributeValues } });
  const ok = await handler.actualizar({ pathParameters: { id: ID }, body: JSON.stringify(libroValido) });
  assert.equal(ok.statusCode, 200);
  assert.equal(enviados[0].input.ConditionExpression, "attribute_exists(id)");

  siguienteRespuesta = async () => condicionFallida();
  const no = await handler.actualizar({ pathParameters: { id: ID }, body: JSON.stringify(libroValido) });
  assert.equal(no.statusCode, 404);
});

test("actualizar: 400 con datos inválidos sin llamar a DynamoDB", async () => {
  const r = await handler.actualizar({ pathParameters: { id: ID }, body: JSON.stringify({ titulo: "x" }) });
  assert.equal(r.statusCode, 400);
  assert.equal(enviados.length, 0);
});

test("eliminar: 200 si existe, 404 si no existe, 400 con id inválido", async () => {
  assert.equal((await handler.eliminar({ pathParameters: { id: ID } })).statusCode, 200);

  siguienteRespuesta = async () => condicionFallida();
  assert.equal((await handler.eliminar({ pathParameters: { id: ID } })).statusCode, 404);

  assert.equal((await handler.eliminar({ pathParameters: { id: "../x" } })).statusCode, 400);
});
