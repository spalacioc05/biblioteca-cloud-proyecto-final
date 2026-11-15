// Biblioteca Cloud — handlers Lambda del CRUD de libros.
// Base: Laboratorio 3 (cinco funciones sobre DynamoDB). En el proyecto final se
// agregaron: validaciones con límites, normalización de datos, validación de id,
// paginación del Scan, ordenamiento, control de tamaño del cuerpo y logs
// estructurados para CloudWatch.

const {
  PutCommand,
  GetCommand,
  ScanCommand,
  UpdateCommand,
  DeleteCommand,
} = require("@aws-sdk/lib-dynamodb");
const { randomUUID } = require("crypto");

const dynamo = require("./db");
const { respuesta, leerBody, log } = require("./http");
const { validarLibro, normalizarLibro, idValido } = require("./validacion");

const TABLE = process.env.LIBROS_TABLE;

const send = (command) => dynamo.db.send(command);

const leerId = (event) => {
  const id = event.pathParameters && event.pathParameters.id;
  return idValido(id) ? id : null;
};

const ID_INVALIDO = { error: "El identificador del libro no es válido" };
const NO_ENCONTRADO = { error: "Libro no encontrado" };

// CREATE - POST /libros
module.exports.crear = async (event) => {
  const { data, error: errorBody, statusCode } = leerBody(event);
  if (errorBody) return respuesta(statusCode, { error: errorBody });

  const error = validarLibro(data);
  if (error) {
    log("WARN", "crear", { motivo: "validacion", error });
    return respuesta(400, { error });
  }

  const item = {
    id: randomUUID(),
    ...normalizarLibro(data),
    creadoEn: new Date().toISOString(),
  };

  try {
    await send(
      new PutCommand({
        TableName: TABLE,
        Item: item,
        ConditionExpression: "attribute_not_exists(id)",
      })
    );
    log("INFO", "crear", { id: item.id });
    return respuesta(201, item);
  } catch (err) {
    log("ERROR", "crear", { error: err.name, mensaje: err.message });
    return respuesta(500, { error: "No fue posible crear el libro" });
  }
};

// READ (todos) - GET /libros
module.exports.listar = async () => {
  try {
    const items = [];
    let ExclusiveStartKey;
    // Scan paginado: DynamoDB devuelve como máximo 1 MB por página.
    do {
      const pagina = await send(
        new ScanCommand({ TableName: TABLE, ExclusiveStartKey })
      );
      items.push(...(pagina.Items || []));
      ExclusiveStartKey = pagina.LastEvaluatedKey;
    } while (ExclusiveStartKey);

    items.sort((a, b) => String(b.creadoEn).localeCompare(String(a.creadoEn)));
    log("INFO", "listar", { total: items.length });
    return respuesta(200, items);
  } catch (err) {
    log("ERROR", "listar", { error: err.name, mensaje: err.message });
    return respuesta(500, { error: "No fue posible listar los libros" });
  }
};

// READ (uno) - GET /libros/{id}
module.exports.obtener = async (event) => {
  const id = leerId(event);
  if (!id) return respuesta(400, ID_INVALIDO);

  try {
    const { Item } = await send(new GetCommand({ TableName: TABLE, Key: { id } }));
    if (!Item) return respuesta(404, NO_ENCONTRADO);
    log("INFO", "obtener", { id });
    return respuesta(200, Item);
  } catch (err) {
    log("ERROR", "obtener", { id, error: err.name, mensaje: err.message });
    return respuesta(500, { error: "No fue posible consultar el libro" });
  }
};

// UPDATE - PUT /libros/{id}
module.exports.actualizar = async (event) => {
  const id = leerId(event);
  if (!id) return respuesta(400, ID_INVALIDO);

  const { data, error: errorBody, statusCode } = leerBody(event);
  if (errorBody) return respuesta(statusCode, { error: errorBody });

  const error = validarLibro(data);
  if (error) {
    log("WARN", "actualizar", { id, motivo: "validacion", error });
    return respuesta(400, { error });
  }

  const libro = normalizarLibro(data);

  try {
    const { Attributes } = await send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { id },
        ConditionExpression: "attribute_exists(id)",
        UpdateExpression:
          "SET titulo = :titulo, autor = :autor, genero = :genero, paginas = :paginas, disponible = :disponible, actualizadoEn = :actualizadoEn",
        ExpressionAttributeValues: {
          ":titulo": libro.titulo,
          ":autor": libro.autor,
          ":genero": libro.genero,
          ":paginas": libro.paginas,
          ":disponible": libro.disponible,
          ":actualizadoEn": new Date().toISOString(),
        },
        ReturnValues: "ALL_NEW",
      })
    );
    log("INFO", "actualizar", { id });
    return respuesta(200, Attributes);
  } catch (err) {
    if (err.name === "ConditionalCheckFailedException") {
      return respuesta(404, NO_ENCONTRADO);
    }
    log("ERROR", "actualizar", { id, error: err.name, mensaje: err.message });
    return respuesta(500, { error: "No fue posible actualizar el libro" });
  }
};

// DELETE - DELETE /libros/{id}
module.exports.eliminar = async (event) => {
  const id = leerId(event);
  if (!id) return respuesta(400, ID_INVALIDO);

  try {
    await send(
      new DeleteCommand({
        TableName: TABLE,
        Key: { id },
        ConditionExpression: "attribute_exists(id)",
      })
    );
    log("INFO", "eliminar", { id });
    return respuesta(200, { mensaje: "Libro eliminado correctamente", id });
  } catch (err) {
    if (err.name === "ConditionalCheckFailedException") {
      return respuesta(404, NO_ENCONTRADO);
    }
    log("ERROR", "eliminar", { id, error: err.name, mensaje: err.message });
    return respuesta(500, { error: "No fue posible eliminar el libro" });
  }
};
