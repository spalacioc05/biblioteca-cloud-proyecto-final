import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { actualizarLibro, apiConfigurada, crearLibro, eliminarLibro, listarLibros } from "./api.js";
import { normalizar } from "./utils.js";
import Modal from "./components/Modal.jsx";
import BookForm from "./components/BookForm.jsx";
import BookCard from "./components/BookCard.jsx";
import BookDetail from "./components/BookDetail.jsx";

const FILTROS_DISPONIBILIDAD = [
  { valor: "todos", etiqueta: "Todos" },
  { valor: "si", etiqueta: "Disponibles" },
  { valor: "no", etiqueta: "Prestados" },
];

const sinId = ({ titulo, autor, genero, paginas, disponible }) => ({ titulo, autor, genero, paginas, disponible });

export default function App() {
  const [libros, setLibros] = useState([]);
  const [carga, setCarga] = useState({ estado: "cargando", error: "" });
  const [busqueda, setBusqueda] = useState("");
  const [genero, setGenero] = useState("");
  const [disponibilidad, setDisponibilidad] = useState("todos");
  const [modal, setModal] = useState(null); // { tipo: crear|editar|detalle|eliminar, libro }
  const [ocupados, setOcupados] = useState(() => new Set());
  const [eliminando, setEliminando] = useState(false);
  const [avisos, setAvisos] = useState([]);
  const idAviso = useRef(0);

  const avisar = useCallback((texto, tipo = "exito") => {
    const id = ++idAviso.current;
    setAvisos((a) => [...a, { id, texto, tipo }]);
    setTimeout(() => setAvisos((a) => a.filter((x) => x.id !== id)), tipo === "error" ? 7000 : 4000);
  }, []);

  // Cada incremento de "version" vuelve a consultar GET /libros.
  const [version, setVersion] = useState(0);
  const cargar = useCallback(() => {
    setCarga({ estado: "cargando", error: "" });
    setVersion((v) => v + 1);
  }, []);

  useEffect(() => {
    if (!apiConfigurada) return;
    let vigente = true;
    listarLibros()
      .then((datos) => {
        if (!vigente) return;
        setLibros(Array.isArray(datos) ? datos : []);
        setCarga({ estado: "listo", error: "" });
      })
      .catch((err) => vigente && setCarga({ estado: "error", error: err.message }));
    return () => {
      vigente = false;
    };
  }, [version]);

  const generos = useMemo(
    () => [...new Set(libros.map((l) => l.genero))].sort((a, b) => a.localeCompare(b, "es")),
    [libros]
  );

  const visibles = useMemo(() => {
    const q = normalizar(busqueda);
    return libros.filter(
      (l) =>
        (!q || normalizar(l.titulo).includes(q) || normalizar(l.autor).includes(q)) &&
        (!genero || l.genero === genero) &&
        (disponibilidad === "todos" || (disponibilidad === "si") === l.disponible)
    );
  }, [libros, busqueda, genero, disponibilidad]);

  const resumen = useMemo(() => {
    const disponibles = libros.filter((l) => l.disponible).length;
    return { total: libros.length, disponibles, prestados: libros.length - disponibles };
  }, [libros]);

  const hayFiltros = busqueda || genero || disponibilidad !== "todos";
  const limpiarFiltros = () => {
    setBusqueda("");
    setGenero("");
    setDisponibilidad("todos");
  };

  const cerrar = () => setModal(null);

  const guardarNuevo = async (datos) => {
    const creado = await crearLibro(datos);
    setLibros((ls) => [creado, ...ls]);
    cerrar();
    avisar(`«${creado.titulo}» se registró en el catálogo.`);
  };

  const guardarEdicion = async (datos) => {
    const actualizado = await actualizarLibro(modal.libro.id, datos);
    setLibros((ls) => ls.map((l) => (l.id === actualizado.id ? actualizado : l)));
    cerrar();
    avisar(`Se guardaron los cambios de «${actualizado.titulo}».`);
  };

  const alternar = async (libro) => {
    setOcupados((s) => new Set(s).add(libro.id));
    try {
      const actualizado = await actualizarLibro(libro.id, { ...sinId(libro), disponible: !libro.disponible });
      setLibros((ls) => ls.map((l) => (l.id === actualizado.id ? actualizado : l)));
      avisar(`«${actualizado.titulo}» ahora está ${actualizado.disponible ? "disponible" : "prestado"}.`);
    } catch (err) {
      avisar(err.message, "error");
      if (err.status === 404) cargar();
    } finally {
      setOcupados((s) => {
        const n = new Set(s);
        n.delete(libro.id);
        return n;
      });
    }
  };

  const confirmarEliminar = async () => {
    const { libro } = modal;
    setEliminando(true);
    try {
      await eliminarLibro(libro.id);
      setLibros((ls) => ls.filter((l) => l.id !== libro.id));
      avisar(`«${libro.titulo}» se eliminó del catálogo.`);
      cerrar();
    } catch (err) {
      avisar(err.message, "error");
      if (err.status === 404) {
        cerrar();
        cargar();
      }
    } finally {
      setEliminando(false);
    }
  };

  const tituloModal = {
    crear: "Registrar un libro",
    editar: "Editar libro",
    detalle: modal?.libro?.titulo,
    eliminar: "Eliminar libro",
  }[modal?.tipo];

  return (
    <>
      <a className="saltar" href="#catalogo">
        Saltar al catálogo
      </a>

      <header className="cabecera">
        <div className="contenedor cabecera__interior">
          <div className="marca">
            <img src="/favicon.svg" alt="" width="40" height="40" />
            <div>
              <p className="marca__nombre">Biblioteca Cloud</p>
              <p className="marca__lema">Catálogo de libros en la nube</p>
            </div>
          </div>
          <button type="button" className="boton boton--primario" onClick={() => setModal({ tipo: "crear" })} disabled={!apiConfigurada}>
            <svg viewBox="0 0 24 24" aria-hidden="true" className="boton__icono">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Nuevo libro
          </button>
        </div>
      </header>

      <main className="contenedor" id="catalogo">
        <section className="intro" aria-labelledby="titulo-catalogo">
          <div>
            <h1 id="titulo-catalogo">Catálogo</h1>
            <p>Registra, consulta, edita y elimina libros. Cada cambio se guarda en Amazon DynamoDB a través de API Gateway y AWS Lambda.</p>
          </div>
          {carga.estado === "listo" && (
            <dl className="resumen" aria-label="Resumen del catálogo">
              <div>
                <dt>Libros</dt>
                <dd>{resumen.total}</dd>
              </div>
              <div>
                <dt>Disponibles</dt>
                <dd>{resumen.disponibles}</dd>
              </div>
              <div>
                <dt>Prestados</dt>
                <dd>{resumen.prestados}</dd>
              </div>
            </dl>
          )}
        </section>

        <section className="herramientas" aria-label="Búsqueda y filtros">
          <div className="campo campo--busqueda">
            <label htmlFor="buscar" className="visualmente-oculto">
              Buscar por título o autor
            </label>
            <svg viewBox="0 0 24 24" aria-hidden="true" className="campo__lupa">
              <circle cx="11" cy="11" r="6" />
              <path d="M20 20l-4.5-4.5" />
            </svg>
            <input
              id="buscar"
              type="search"
              placeholder="Buscar por título o autor…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
          <div className="campo">
            <label htmlFor="filtro-genero" className="visualmente-oculto">
              Filtrar por género
            </label>
            <select id="filtro-genero" value={genero} onChange={(e) => setGenero(e.target.value)}>
              <option value="">Todos los géneros</option>
              {generos.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
          <div className="segmentado" role="radiogroup" aria-label="Filtrar por disponibilidad">
            {FILTROS_DISPONIBILIDAD.map((f) => (
              <button
                key={f.valor}
                type="button"
                role="radio"
                aria-checked={disponibilidad === f.valor}
                className={disponibilidad === f.valor ? "activo" : ""}
                onClick={() => setDisponibilidad(f.valor)}
              >
                {f.etiqueta}
              </button>
            ))}
          </div>
          <button type="button" className="boton-icono" onClick={cargar} aria-label="Recargar catálogo" title="Recargar catálogo" disabled={carga.estado === "cargando"}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6" />
            </svg>
          </button>
        </section>

        <p className="visualmente-oculto" aria-live="polite">
          {carga.estado === "listo" ? `${visibles.length} libros mostrados` : ""}
        </p>

        {!apiConfigurada ? (
          <div className="vacio" role="alert">
            <h2>Falta configurar la API</h2>
            <p>Compila el frontend con la variable VITE_API_URL apuntando a API Gateway.</p>
          </div>
        ) : carga.estado === "cargando" ? (
          <div className="rejilla" aria-busy="true" aria-label="Cargando catálogo">
            {Array.from({ length: 6 }, (_, i) => (
              <div className="tarjeta tarjeta--esqueleto" key={i} />
            ))}
          </div>
        ) : carga.estado === "error" ? (
          <div className="vacio vacio--error" role="alert">
            <h2>No pudimos cargar el catálogo</h2>
            <p>{carga.error}</p>
            <button type="button" className="boton boton--primario" onClick={cargar}>
              Reintentar
            </button>
          </div>
        ) : libros.length === 0 ? (
          <div className="vacio">
            <h2>El catálogo está vacío</h2>
            <p>Registra el primer libro para comenzar.</p>
            <button type="button" className="boton boton--primario" onClick={() => setModal({ tipo: "crear" })}>
              Registrar libro
            </button>
          </div>
        ) : visibles.length === 0 ? (
          <div className="vacio">
            <h2>Sin resultados</h2>
            <p>Ningún libro coincide con la búsqueda o los filtros seleccionados.</p>
            <button type="button" className="boton boton--secundario" onClick={limpiarFiltros}>
              Limpiar filtros
            </button>
          </div>
        ) : (
          <>
            {hayFiltros && (
              <p className="conteo">
                Mostrando {visibles.length} de {libros.length} libros ·{" "}
                <button type="button" className="enlace" onClick={limpiarFiltros}>
                  limpiar filtros
                </button>
              </p>
            )}
            <div className="rejilla">
              {visibles.map((libro) => (
                <BookCard
                  key={libro.id}
                  libro={libro}
                  ocupado={ocupados.has(libro.id)}
                  onVer={(l) => setModal({ tipo: "detalle", libro: l })}
                  onEditar={(l) => setModal({ tipo: "editar", libro: l })}
                  onEliminar={(l) => setModal({ tipo: "eliminar", libro: l })}
                  onAlternar={alternar}
                />
              ))}
            </div>
          </>
        )}
      </main>

      <footer className="pie">
        <div className="contenedor">
          <p>
            Proyecto final · Cloud Computing · Universidad de Antioquia 2026-2
          </p>
          <p className="pie__stack">Amazon S3 · CloudFront · API Gateway · AWS Lambda · DynamoDB · CloudWatch</p>
        </div>
      </footer>

      <Modal abierto={Boolean(modal)} onCerrar={eliminando ? () => {} : cerrar} titulo={tituloModal} ancho={modal?.tipo === "eliminar" ? "chico" : "normal"}>
        {modal?.tipo === "crear" && <BookForm generos={generos} onGuardar={guardarNuevo} onCancelar={cerrar} />}
        {modal?.tipo === "editar" && (
          <BookForm key={modal.libro.id} inicial={modal.libro} generos={generos} onGuardar={guardarEdicion} onCancelar={cerrar} />
        )}
        {modal?.tipo === "detalle" && (
          <BookDetail
            id={modal.libro.id}
            onCerrar={cerrar}
            onEditar={(l) => setModal({ tipo: "editar", libro: l })}
            onEliminar={(l) => setModal({ tipo: "eliminar", libro: l })}
          />
        )}
        {modal?.tipo === "eliminar" && (
          <div className="confirmar">
            <p>
              ¿Seguro que quieres eliminar <strong>«{modal.libro.titulo}»</strong> de {modal.libro.autor}? Esta acción no se puede deshacer.
            </p>
            <div className="formulario__acciones">
              <button type="button" className="boton boton--secundario" onClick={cerrar} disabled={eliminando} data-autofocus>
                Cancelar
              </button>
              <button type="button" className="boton boton--peligro" onClick={confirmarEliminar} disabled={eliminando}>
                {eliminando && <span className="spinner" aria-hidden="true" />}
                {eliminando ? "Eliminando…" : "Sí, eliminar"}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <div className="avisos" aria-live="polite" aria-atomic="false">
        {avisos.map((a) => (
          <div key={a.id} className={`aviso aviso--${a.tipo}`} role={a.tipo === "error" ? "alert" : "status"}>
            {a.texto}
          </div>
        ))}
      </div>
    </>
  );
}
