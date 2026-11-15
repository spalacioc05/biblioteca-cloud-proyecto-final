import { useEffect, useState } from "react";
import { obtenerLibro } from "../api.js";
import { colorGenero, fecha, numero } from "../utils.js";

// Consulta el libro con GET /libros/{id} para mostrar la versión más reciente
// guardada en DynamoDB.
export default function BookDetail({ id, onEditar, onEliminar, onCerrar }) {
  const [estado, setEstado] = useState({ cargando: true, libro: null, error: "" });

  useEffect(() => {
    let vigente = true;
    obtenerLibro(id)
      .then((libro) => vigente && setEstado({ cargando: false, libro, error: "" }))
      .catch((err) => vigente && setEstado({ cargando: false, libro: null, error: err.message }));
    return () => {
      vigente = false;
    };
  }, [id]);

  if (estado.cargando)
    return (
      <div className="detalle detalle--cargando" role="status">
        <span className="spinner spinner--grande" aria-hidden="true" />
        <p>Consultando el libro en la nube…</p>
      </div>
    );

  if (estado.error)
    return (
      <div className="detalle">
        <p className="alerta alerta--error" role="alert">
          {estado.error}
        </p>
        <div className="formulario__acciones">
          <button type="button" className="boton boton--secundario" onClick={onCerrar}>
            Cerrar
          </button>
        </div>
      </div>
    );

  const { libro } = estado;
  return (
    <div className="detalle" style={{ "--lomo": colorGenero(libro.genero) }}>
      <div className="detalle__portada" aria-hidden="true">
        <span>{libro.titulo}</span>
      </div>
      <div className="detalle__info">
        <p className="detalle__autor">{libro.autor}</p>
        <dl className="detalle__datos">
          <div>
            <dt>Género</dt>
            <dd>{libro.genero}</dd>
          </div>
          <div>
            <dt>Páginas</dt>
            <dd>{numero(libro.paginas)}</dd>
          </div>
          <div>
            <dt>Estado</dt>
            <dd>
              <span className={`estado ${libro.disponible ? "estado--si" : "estado--no"}`}>
                {libro.disponible ? "Disponible" : "Prestado"}
              </span>
            </dd>
          </div>
          <div>
            <dt>Registrado</dt>
            <dd>{fecha(libro.creadoEn)}</dd>
          </div>
          {libro.actualizadoEn && (
            <div>
              <dt>Última edición</dt>
              <dd>{fecha(libro.actualizadoEn)}</dd>
            </div>
          )}
          <div className="detalle__id">
            <dt>Identificador</dt>
            <dd>
              <code>{libro.id}</code>
            </dd>
          </div>
        </dl>
        <div className="formulario__acciones">
          <button type="button" className="boton boton--peligro-suave" onClick={() => onEliminar(libro)}>
            Eliminar
          </button>
          <button type="button" className="boton boton--primario" onClick={() => onEditar(libro)}>
            Editar
          </button>
        </div>
      </div>
    </div>
  );
}
