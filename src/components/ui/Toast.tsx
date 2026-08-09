import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

type ToastType = "ok" | "err" | "warn" | "info";

interface Toast {
  id: number;
  msg: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (msg: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let toastId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((msg: string, type: ToastType = "info") => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, msg, type }]);
    // Errors and warnings stay longer: they carry the detail the user has to
    // act on — which receipt lines failed, which ingredient was short — and
    // three seconds is not enough to read a list of names.
    const ms = type === "err" ? 9000 : type === "warn" ? 6000 : 3000;
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, ms);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div 
        className="toast-container"
        style={{
          position: "fixed",
          bottom: "20px",
          right: "20px",
          zIndex: 9999,
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          pointerEvents: "none"
        }}
      >
        {toasts.map((t) => (
          <div 
            key={t.id} 
            className={`toast ${t.type}`} 
            role="alert" 
            aria-live="polite"
            style={{ pointerEvents: "all" }}
          >
            {t.msg}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
