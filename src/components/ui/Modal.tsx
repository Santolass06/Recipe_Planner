import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface ModalProps {
  open: boolean; 
  onClose: () => void; 
  title: string;
  children: ReactNode; 
  footer?: ReactNode; 
  wide?: boolean;
}

export default function Modal({ open, onClose, title, children, footer, wide }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { 
      if (e.key === "Escape") onClose(); 
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;
  // ponytail: portal to document.body — .main has overflow:hidden, which in
  // WebKitGTK makes it the containing block for position:fixed descendants,
  // clipping the backdrop/modal instead of covering the full viewport.
  return createPortal(
    <div className="modal-backdrop"
         onClick={onClose}
         role="dialog"
         aria-modal="true">
      <div className={"modal" + (wide ? " wide" : "")}
           onClick={e => e.stopPropagation()}>
        <h2 className="modal-title">{title}</h2>
        {children}
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
