const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient } = require("@aws-sdk/lib-dynamodb");

// Cliente creado fuera de los handlers para reutilizar conexiones entre
// invocaciones "calientes" de la misma instancia de Lambda.
const client = new DynamoDBClient({});

const db = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

module.exports = { db };
