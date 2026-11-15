import { useEffect, useId, useRef } from "react";

// Ventana modal accesible basada en <dialog> nativo: atrapa el foco,
// se cierra con Escape y con clic fuera del contenido.
export default function Modal({ abierto, onCerrar, titulo, children, ancho = "normal" }) {
  const ref = useRef(null);
  const tituloId = useId();

  useEffect(() => {
    const dialogo = ref.current;
    if (!dialogo) return;
    if (abierto && !dialogo.open) {
      dialogo.showModal();
      // showModal() enfoca el primer botón (cerrar); se prefiere el primer campo.
      const destino = dialogo.querySelector("[data-autofocus], input:not([type=checkbox]), select");
      destino?.focus();
    }
    if (!abierto && dialogo.open) dialogo.close();
  }, [abierto]);

  return (
    <dialog
      ref={ref}
      className={`modal modal--${ancho}`}
      aria-labelledby={tituloId}
      onCancel={(e) => {
        e.preventDefault();
        onCerrar();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onCerrar();
      }}
    >
      {abierto && (
        <div className="modal__contenido">
          <header className="modal__cabecera">
            <h2 id={tituloId}>{titulo}</h2>
            <button type="button" className="boton-icono" onClick={onCerrar} aria-label="Cerrar ventana">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </header>
          {children}
        </div>
      )}
    </dialog>
  );
}
