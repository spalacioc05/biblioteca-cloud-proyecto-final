"""Genera el diagrama de arquitectura de Biblioteca Cloud en dos formatos a
partir de una sola especificacion:

  - biblioteca-cloud-arquitectura.svg    (vector, base para el PNG)
  - biblioteca-cloud-arquitectura.drawio (editable en https://app.diagrams.net)

Uso:  python docs/arquitectura/generar_diagrama.py
Luego el PNG se exporta con Edge/Chrome headless (ver README de esta carpeta).
"""
from pathlib import Path
from xml.sax.saxutils import escape

W, H = 1640, 1040
FONT = "Arial, Helvetica, sans-serif"

# Colores por categoria (paleta de iconos de AWS)
C = {
    "red": "#8C4FFF",        # redes y CDN
    "alm": "#7AA116",        # almacenamiento
    "comp": "#ED7100",       # computo
    "bd": "#C925D1",         # bases de datos
    "int": "#E7157B",        # integracion / administracion
    "seg": "#DD344C",        # seguridad
    "gris": "#232F3E",
}

# (id, x, y, w, h, color, titulo, [lineas])
NODOS = [
    ("usuario", 30, 360, 190, 120, C["gris"], "Usuario", ["Navegador web", "React SPA en español"]),
    ("iac", 30, 690, 190, 240, C["gris"], "GitHub + IaC", [
        "backend/serverless.yml", "infra/frontend-hosting.yml", "infra/red-ec2.yml",
        "scripts/deploy-all.ps1", "", "4 stacks de", "CloudFormation"]),
    ("cf", 330, 140, 240, 105, C["red"], "Amazon CloudFront", ["HTTPS · caché · compresión", "Cabeceras de seguridad", "SPA: 403/404 → index.html"]),
    ("s3", 690, 140, 250, 105, C["alm"], "Amazon S3 (privado)", ["Build React + Vite", "Block Public Access", "Cifrado SSE-S3"]),
    ("api", 330, 380, 240, 115, C["int"], "Amazon API Gateway", ["HTTP API · 5 rutas /libros", "CORS solo dominio CloudFront", "Throttling 10 rps · ráfaga 20"]),
    ("ddb", 1040, 390, 240, 105, C["bd"], "Amazon DynamoDB", ["biblioteca-cloud-libros-dev", "On-demand · PK: id", ""]),
    ("iam", 1040, 255, 240, 95, C["seg"], "AWS IAM", ["5 roles, uno por función", "1 acción DynamoDB por rol"]),
    ("cw", 1350, 300, 240, 260, C["int"], "Amazon CloudWatch", [
        "Logs JSON (retención 14 d)", "Métricas Lambda, API,", "DynamoDB", "Dashboard", "biblioteca-cloud-dev", "Alarma API 5xx"]),
    ("igw", 670, 690, 170, 70, C["red"], "Internet Gateway", []),
    ("rt", 670, 785, 170, 115, C["red"], "Tabla de rutas", ["0.0.0.0/0 → IGW", "10.20.0.0/16 → local"]),
    ("ec2", 900, 725, 260, 150, C["comp"], "Amazon EC2 t4g.micro", [
        "Amazon Linux 2023 · nginx", "Página de estado del nodo", "Rol IAM: solo SSM", "Detenida fuera de demos"]),
    ("sg", 1190, 725, 240, 150, C["seg"], "Security Group", ["Entrada: HTTP 80", "SSH (22) cerrado", "Admin: SSM Session Manager"]),
]

# Contenedores (x, y, w, h, color, etiqueta, discontinuo)
GRUPOS = [
    (260, 95, 1350, 880, C["gris"], "AWS Cloud · us-east-1 (Norte de Virginia)", True),
    (650, 315, 310, 270, C["comp"], "AWS Lambda · Node.js 24 · arm64", False),
    (650, 625, 940, 330, C["red"], "VPC biblioteca-cloud-vpc-dev · 10.20.0.0/16", True),
    (875, 665, 690, 240, C["alm"], "Subred pública 10.20.1.0/24 · us-east-1a", False),
]

FUNCIONES = [
    ("crear", "POST /libros"),
    ("listar", "GET /libros"),
    ("obtener", "GET /libros/{id}"),
    ("actualizar", "PUT /libros/{id}"),
    ("eliminar", "DELETE /libros/{id}"),
]

# Aristas: (puntos, etiqueta, pos_etiqueta, discontinua, color)
ARISTAS = [
    ([(220, 390), (285, 390), (285, 192), (330, 192)], "1 · HTTPS", (292, 300), False, C["gris"]),
    ([(570, 192), (690, 192)], "OAC (SigV4)", (630, 182), False, C["gris"]),
    ([(220, 437), (330, 437)], "2 · fetch JSON", (275, 427), False, C["gris"]),
    ([(570, 437), (650, 437)], "invoca", (610, 427), False, C["gris"]),
    ([(960, 442), (1040, 442)], "SDK v3", (1000, 432), False, C["gris"]),
    ([(960, 345), (1040, 302)], "asume rol", (1000, 312), True, C["seg"]),
    ([(1280, 442), (1350, 442)], "", None, True, C["int"]),
    ([(450, 495), (450, 600), (1470, 600), (1470, 560)], "logs y métricas", (1160, 594), True, C["int"]),
    ([(805, 585), (805, 600)], "", None, True, C["int"], False),
    ([(125, 480), (125, 655), (610, 655), (610, 725), (670, 725)], "3 · HTTP demo IaaS (opcional)", (380, 650), True, C["gris"]),
    ([(840, 725), (900, 760)], "", None, False, C["gris"]),
    ([(220, 810), (260, 810)], "despliega", (240, 800), True, C["gris"]),
]

NOTA = "Componente IaaS independiente: la VPC y la EC2 no participan en el flujo de la aplicación (las Lambdas no están dentro de la VPC)."


def svg():
    o = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" font-family="{FONT}">',
         '<defs><marker id="f" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">'
         '<path d="M0,0 L10,4 L0,8 z" fill="#232F3E"/></marker>'
         '<marker id="fr" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">'
         f'<path d="M0,0 L10,4 L0,8 z" fill="{C["seg"]}"/></marker>'
         '<marker id="fm" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">'
         f'<path d="M0,0 L10,4 L0,8 z" fill="{C["int"]}"/></marker></defs>',
         f'<rect width="{W}" height="{H}" fill="#ffffff"/>',
         f'<text x="30" y="52" font-size="28" font-weight="bold" fill="#232F3E">Biblioteca Cloud — Arquitectura en AWS</text>',
         f'<text x="30" y="78" font-size="15" fill="#545B64">Proyecto final Cloud Computing · Universidad de Antioquia 2026-2</text>']
    for x, y, w, h, col, lab, dash in GRUPOS:
        da = ' stroke-dasharray="8 6"' if dash else ""
        o.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="10" fill="{col}" fill-opacity="0.04" stroke="{col}" stroke-width="2"{da}/>')
        o.append(f'<text x="{x + 14}" y="{y + 24}" font-size="15" font-weight="bold" fill="{col}">{escape(lab)}</text>')
    for nid, x, y, w, h, col, tit, lineas in NODOS:
        o.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="10" fill="#ffffff" stroke="{col}" stroke-width="2.5"/>')
        o.append(f'<rect x="{x}" y="{y}" width="8" height="{h}" rx="4" fill="{col}"/>')
        o.append(f'<text x="{x + 20}" y="{y + 28}" font-size="17" font-weight="bold" fill="#232F3E">{escape(tit)}</text>')
        for i, linea in enumerate(lineas):
            o.append(f'<text x="{x + 20}" y="{y + 52 + i * 20}" font-size="14" fill="#3B4550">{escape(linea)}</text>')
    for i, (fn, ruta) in enumerate(FUNCIONES):
        y = 355 + i * 44
        o.append(f'<rect x="670" y="{y}" width="270" height="36" rx="18" fill="#FFF4E8" stroke="{C["comp"]}" stroke-width="1.5"/>')
        o.append(f'<text x="688" y="{y + 23}" font-size="14" font-weight="bold" fill="#232F3E">{fn}</text>')
        o.append(f'<text x="925" y="{y + 23}" font-size="13" fill="#545B64" text-anchor="end">{escape(ruta)}</text>')
    for pts, lab, lpos, dash, col, *resto in ARISTAS:
        flecha = resto[0] if resto else True
        d = " ".join(f"{'M' if i == 0 else 'L'}{x},{y}" for i, (x, y) in enumerate(pts))
        da = ' stroke-dasharray="7 5"' if dash else ""
        mk = "fr" if col == C["seg"] else "fm" if col == C["int"] else "f"
        me = f' marker-end="url(#{mk})"' if flecha else ""
        o.append(f'<path d="{d}" fill="none" stroke="{col}" stroke-width="2"{da}{me}/>')
        if lab and lpos:
            tw = len(lab) * 7.4 + 12
            o.append(f'<rect x="{lpos[0] - tw / 2}" y="{lpos[1] - 14}" width="{tw}" height="20" rx="4" fill="#ffffff"/>')
            o.append(f'<text x="{lpos[0]}" y="{lpos[1]}" font-size="13" font-weight="bold" fill="{col}" text-anchor="middle">{escape(lab)}</text>')
    o.append(f'<text x="665" y="940" font-size="13" font-style="italic" fill="#545B64">{escape(NOTA)}</text>')
    o.append('<text x="30" y="1020" font-size="13" fill="#545B64">Flujos: 1 carga del sitio estático · 2 operaciones CRUD (formulario → API → Lambda → DynamoDB → respuesta) · '
             '3 página de estado de la EC2 · líneas discontinuas: permisos, observabilidad y despliegue.</text>')
    o.append("</svg>")
    return "\n".join(o)


def drawio():
    celdas, n = [], [2]

    def nid():
        n[0] += 1
        return f"c{n[0]}"

    for x, y, w, h, col, lab, dash in GRUPOS:
        estilo = (f"rounded=1;arcSize=3;whiteSpace=wrap;html=1;fillColor=none;strokeColor={col};strokeWidth=2;"
                  f"dashed={1 if dash else 0};verticalAlign=top;align=left;spacingLeft=10;fontStyle=1;fontColor={col};fontFamily=Arial;")
        celdas.append(f'<mxCell id="{nid()}" value="{escape(lab)}" style="{estilo}" vertex="1" parent="1">'
                      f'<mxGeometry x="{x}" y="{y}" width="{w}" height="{h}" as="geometry"/></mxCell>')
    ids = {}
    for key, x, y, w, h, col, tit, lineas in NODOS:
        valor = f"<b>{escape(tit)}</b><br>" + "<br>".join(escape(linea) for linea in lineas if linea)
        estilo = (f"rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor={col};strokeWidth=2.5;"
                  "align=left;verticalAlign=top;spacingLeft=12;spacingTop=6;fontFamily=Arial;fontSize=13;")
        ids[key] = nid()
        celdas.append(f'<mxCell id="{ids[key]}" value="{escape(valor)}" style="{estilo}" vertex="1" parent="1">'
                      f'<mxGeometry x="{x}" y="{y}" width="{w}" height="{h}" as="geometry"/></mxCell>')
    for i, (fn, ruta) in enumerate(FUNCIONES):
        estilo = f"rounded=1;arcSize=50;whiteSpace=wrap;html=1;fillColor=#FFF4E8;strokeColor={C['comp']};fontFamily=Arial;fontSize=13;"
        celdas.append(f'<mxCell id="{nid()}" value="{escape(f"<b>{fn}</b> · {ruta}")}" style="{estilo}" vertex="1" parent="1">'
                      f'<mxGeometry x="670" y="{355 + i * 44}" width="270" height="36" as="geometry"/></mxCell>')
    for pts, lab, _lpos, dash, col, *_ in ARISTAS:
        (sx, sy), (tx, ty) = pts[0], pts[-1]
        medios = "".join(f'<mxPoint x="{x}" y="{y}"/>' for x, y in pts[1:-1])
        estilo = (f"endArrow=block;endFill=1;html=1;strokeColor={col};strokeWidth=2;dashed={1 if dash else 0};"
                  f"fontFamily=Arial;fontSize=12;fontStyle=1;fontColor={col};labelBackgroundColor=#ffffff;")
        celdas.append(f'<mxCell id="{nid()}" value="{escape(lab)}" style="{estilo}" edge="1" parent="1">'
                      f'<mxGeometry relative="1" as="geometry"><mxPoint x="{sx}" y="{sy}" as="sourcePoint"/>'
                      f'<mxPoint x="{tx}" y="{ty}" as="targetPoint"/><Array as="points">{medios}</Array></mxGeometry></mxCell>')
    textos = [(30, 25, 900, 35, "<b style='font-size:24px'>Biblioteca Cloud — Arquitectura en AWS</b>"),
              (665, 925, 920, 25, f"<i>{escape(NOTA)}</i>")]
    for x, y, w, h, v in textos:
        celdas.append(f'<mxCell id="{nid()}" value="{escape(v)}" style="text;html=1;fontFamily=Arial;fontSize=13;align=left;" vertex="1" parent="1">'
                      f'<mxGeometry x="{x}" y="{y}" width="{w}" height="{h}" as="geometry"/></mxCell>')
    return ('<mxfile host="biblioteca-cloud"><diagram name="Arquitectura" id="arq">'
            f'<mxGraphModel dx="{W}" dy="{H}" grid="1" gridSize="10" page="1" pageWidth="{W}" pageHeight="{H}">'
            '<root><mxCell id="0"/><mxCell id="1" parent="0"/>' + "".join(celdas) +
            "</root></mxGraphModel></diagram></mxfile>")


if __name__ == "__main__":
    aqui = Path(__file__).parent
    (aqui / "biblioteca-cloud-arquitectura.svg").write_text(svg(), encoding="utf-8")
    (aqui / "biblioteca-cloud-arquitectura.drawio").write_text(drawio(), encoding="utf-8")
    print("Diagramas generados en", aqui)
