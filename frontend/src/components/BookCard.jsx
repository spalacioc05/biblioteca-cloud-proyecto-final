import { colorGenero, numero } from "../utils.js";

export default function BookCard({ libro, onVer, onEditar, onEliminar, onAlternar, ocupado }) {
  return (
    <article className="tarjeta" style={{ "--lomo": colorGenero(libro.genero) }} aria-busy={ocupado}>
      <div className="tarjeta__lomo" aria-hidden="true" />
      <div className="tarjeta__cuerpo">
        <div className="tarjeta__meta">
          <span className="chip">{libro.genero}</span>
          <span className={`estado ${libro.disponible ? "estado--si" : "estado--no"}`}>
            {libro.disponible ? "Disponible" : "Prestado"}
          </span>
        </div>
        <h3 className="tarjeta__titulo">
          <button type="button" className="enlace" onClick={() => onVer(libro)}>
            {libro.titulo}
          </button>
        </h3>
        <p className="tarjeta__autor">{libro.autor}</p>
        <p className="tarjeta__paginas">{numero(libro.paginas)} páginas</p>
      </div>
      <div className="tarjeta__acciones">
        <button type="button" className="boton boton--chico boton--texto" onClick={() => onAlternar(libro)} disabled={ocupado}>
          {ocupado ? "Actualizando…" : libro.disponible ? "Marcar prestado" : "Marcar disponible"}
        </button>
        <span className="tarjeta__separador" />
        <button
          type="button"
          className="boton-icono"
          onClick={() => onEditar(libro)}
          aria-label={`Editar «${libro.titulo}»`}
          title="Editar"
          disabled={ocupado}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4" />
          </svg>
        </button>
        <button
          type="button"
          className="boton-icono boton-icono--peligro"
          onClick={() => onEliminar(libro)}
          aria-label={`Eliminar «${libro.titulo}»`}
          title="Eliminar"
          disabled={ocupado}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13M10 11v6M14 11v6" />
          </svg>
        </button>
      </div>
    </article>
  );
}
