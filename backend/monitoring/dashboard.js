// Genera el cuerpo del dashboard de CloudWatch "biblioteca-cloud-<stage>".
// Se usa Fn::Join para insertar el Id real de la HTTP API sin conflictos con
// la sintaxis de variables de Serverless.

const OPERACIONES = ["crear", "listar", "obtener", "actualizar", "eliminar"];

module.exports.cuerpo = async ({ resolveVariable }) => {
  const prefijo = await resolveVariable("self:custom.prefijoFuncion");
  const tabla = await resolveVariable("self:custom.tablaLibros");
  const region = await resolveVariable("self:provider.region");

  const API = "__API_ID__";
  const lambdaMetric = (metrica, stat) =>
    OPERACIONES.map((op) => [
      "AWS/Lambda",
      metrica,
      "FunctionName",
      `${prefijo}-${op}`,
      { stat, label: op },
    ]);

  const widget = (x, y, title, metrics, extra = {}) => ({
    type: "metric",
    x,
    y,
    width: 12,
    height: 6,
    properties: { title, region, metrics, period: 300, view: "timeSeries", ...extra },
  });

  const body = {
    widgets: [
      {
        type: "text",
        x: 0,
        y: 0,
        width: 24,
        height: 2,
        properties: {
          markdown:
            "# Biblioteca Cloud — Observabilidad\nAPI Gateway (HTTP API) → 5 funciones Lambda → DynamoDB. Periodo de 5 minutos.",
        },
      },
      widget(0, 2, "API Gateway — peticiones y errores", [
        ["AWS/ApiGateway", "Count", "ApiId", API, "Stage", "$default", { stat: "Sum", label: "Peticiones" }],
        ["AWS/ApiGateway", "4xx", "ApiId", API, "Stage", "$default", { stat: "Sum", label: "4xx" }],
        ["AWS/ApiGateway", "5xx", "ApiId", API, "Stage", "$default", { stat: "Sum", label: "5xx" }],
      ]),
      widget(12, 2, "API Gateway — latencia (ms)", [
        ["AWS/ApiGateway", "Latency", "ApiId", API, "Stage", "$default", { stat: "Average", label: "Promedio" }],
        ["AWS/ApiGateway", "Latency", "ApiId", API, "Stage", "$default", { stat: "p95", label: "p95" }],
      ]),
      widget(0, 8, "Lambda — invocaciones por función", lambdaMetric("Invocations", "Sum")),
      widget(12, 8, "Lambda — errores por función", lambdaMetric("Errors", "Sum")),
      widget(0, 14, "Lambda — duración promedio (ms)", lambdaMetric("Duration", "Average")),
      widget(12, 14, "DynamoDB — unidades consumidas", [
        ["AWS/DynamoDB", "ConsumedReadCapacityUnits", "TableName", tabla, { stat: "Sum", label: "Lectura" }],
        ["AWS/DynamoDB", "ConsumedWriteCapacityUnits", "TableName", tabla, { stat: "Sum", label: "Escritura" }],
      ]),
    ],
  };

  const partes = JSON.stringify(body).split(API);
  const join = [];
  partes.forEach((parte, i) => {
    join.push(parte);
    if (i < partes.length - 1) join.push({ Ref: "HttpApi" });
  });
  return { "Fn::Join": ["", join] };
};
