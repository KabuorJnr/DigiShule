import { useEffect } from 'react';
import { createPortal } from 'react-dom';

export default function Modal({ title, onClose, children, footer, wide, hideClose }) {
  useEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, []);

  const content = (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div
        className={`modal${wide ? ' modal-lg' : ''}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>{title}</h3>
          {!hideClose && (
            <button className="btn btn-icon btn-sm" onClick={onClose} aria-label="Close">
              âœ•
            </button>
          )}
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
}



