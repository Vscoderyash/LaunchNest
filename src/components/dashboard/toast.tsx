"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { CheckCircle, XCircle, X } from "lucide-react";

type Toast = { id: number; message: string; type: "success" | "error" };
type ToastCtx = { toast: (msg: string, type?: Toast["type"]) => void };

const Ctx = createContext<ToastCtx>({ toast: () => {} });
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: Toast["type"] = "success") => {
    const id = Date.now();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-20 md:bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-start gap-2.5 px-4 py-3 rounded-xl shadow-lg text-sm border ${
              t.type === "success"
                ? "bg-neutral-900 border-neutral-700 text-neutral-100"
                : "bg-red-950/80 border-red-800 text-red-200"
            }`}
          >
            {t.type === "success"
              ? <CheckCircle size={16} className="text-green-400 mt-0.5 shrink-0" />
              : <XCircle size={16} className="text-red-400 mt-0.5 shrink-0" />}
            <span className="flex-1">{t.message}</span>
            <button onClick={() => setToasts((ts) => ts.filter((x) => x.id !== t.id))} className="text-neutral-600 hover:text-neutral-300 mt-0.5">
              <X size={13} />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
