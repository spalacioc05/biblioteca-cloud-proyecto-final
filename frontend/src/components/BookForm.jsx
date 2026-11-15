import { useState } from "react";
import { GENEROS_SUGERIDOS } from "../utils.js";

const VACIO = { titulo: "", autor: "", genero: "", paginas: "", disponible: true };

// Mismas reglas que el backend (backend/src/validacion.js) para dar
// retroalimentación inmediata; el backend sigue validando siempre.
function validar(v) {
  const errores = {};
  if (!v.titulo.trim()) errores.titulo = "Escribe el título del libro.";
  else if (v.titulo.trim().length > 150) errores.titulo = "Máximo 150 caracteres.";
  if (!v.autor.trim()) errores.autor = "Escribe el nombre del autor.";
  else if (v.autor.trim().length > 100) errores.autor = "Máximo 100 caracteres.";
  if (!v.genero.trim()) errores.genero = "Indica el género.";
  else if (v.genero.trim().length > 50) errores.genero = "Máximo 50 caracteres.";
  const paginas = Number(v.paginas);
  if (v.paginas === "" || !Number.isInteger(paginas) || paginas < 1 || paginas > 10000)
    errores.paginas = "Debe ser un número entero entre 1 y 10 000.";
  return errores;
}

export default function BookForm({ inicial, onGuardar, onCancelar, generos = [] }) {
  const [valores, setValores] = useState(() =>
    inicial
      ? {
          titulo: inicial.titulo,
          autor: inicial.autor,
          genero: inicial.genero,
          paginas: String(inicial.paginas),
          disponible: inicial.disponible,
        }
      : VACIO
  );
  const [errores, setErrores] = useState({});
  const [errorServidor, setErrorServidor] = useState("");
  const [guardando, setGuardando] = useState(false);

  const cambiar = (campo) => (e) => {
    const valor = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setValores((v) => ({ ...v, [campo]: valor }));
    if (errores[campo]) setErrores((er) => ({ ...er, [campo]: undefined }));
  };

  const enviar = async (e) => {
    e.preventDefault();
    const encontrados = validar(valores);
    setErrores(encontrados);
    const primero = Object.keys(encontrados)[0];
    if (primero) {
      document.getElementById(`campo-${primero}`)?.focus();
      return;
    }
    setGuardando(true);
    setErrorServidor("");
    try {
      await onGuardar({
        titulo: valores.titulo.trim(),
        autor: valores.autor.trim(),
        genero: valores.genero.trim(),
        paginas: Number(valores.paginas),
        disponible: valores.disponible,
      });
    } catch (err) {
      setErrorServidor(err.message);
      setGuardando(false);
    }
  };

  const opciones = [...new Set([...GENEROS_SUGERIDOS, ...generos])].sort((a, b) => a.localeCompare(b, "es"));

  const campo = (nombre, etiqueta, props = {}) => (
    <div className="campo">
      <label htmlFor={`campo-${nombre}`}>{etiqueta}</label>
      <input
        id={`campo-${nombre}`}
        name={nombre}
        value={valores[nombre]}
        onChange={cambiar(nombre)}
        aria-invalid={Boolean(errores[nombre])}
        aria-describedby={errores[nombre] ? `error-${nombre}` : undefined}
        disabled={guardando}
        {...props}
      />
      {errores[nombre] && (
        <p className="campo__error" id={`error-${nombre}`}>
          {errores[nombre]}
        </p>
      )}
    </div>
  );

  return (
    <form className="formulario" onSubmit={enviar} noValidate>
      {campo("titulo", "Título", { maxLength: 150, placeholder: "Ej. Cien años de soledad" })}
      {campo("autor", "Autor", { maxLength: 100, placeholder: "Ej. Gabriel García Márquez" })}
      <div className="formulario__fila">
        {campo("genero", "Género", { list: "generos-lista", maxLength: 50, placeholder: "Ej. Novela" })}
        {campo("paginas", "Páginas", { type: "number", inputMode: "numeric", min: 1, max: 10000, step: 1, placeholder: "Ej. 471" })}
      </div>
      <datalist id="generos-lista">
        {opciones.map((g) => (
          <option key={g} value={g} />
        ))}
      </datalist>

      <label className="interruptor">
        <input type="checkbox" checked={valores.disponible} onChange={cambiar("disponible")} disabled={guardando} />
        <span className="interruptor__pista" aria-hidden="true" />
        <span>
          {valores.disponible ? "Disponible para préstamo" : "Prestado actualmente"}
        </span>
      </label>

      {errorServidor && (
        <p className="alerta alerta--error" role="alert">
          {errorServidor}
        </p>
      )}

      <div className="formulario__acciones">
        <button type="button" className="boton boton--secundario" onClick={onCancelar} disabled={guardando}>
          Cancelar
        </button>
        <button type="submit" className="boton boton--primario" disabled={guardando}>
          {guardando && <span className="spinner" aria-hidden="true" />}
          {guardando ? "Guardando…" : inicial ? "Guardar cambios" : "Registrar libro"}
        </button>
      </div>
    </form>
  );
}
