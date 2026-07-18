import { useState } from "react";

const LAST_KEY = "rotinas-notify-lastDate";

/**
 * Notificação do navegador (foreground) — sem service worker/push.
 * Pede permissão sob demanda e dispara no máximo 1 notificação/dia com o resumo do dia.
 */
export const useDailyNotify = () => {
  const supported = typeof window !== "undefined" && "Notification" in window;
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    supported ? Notification.permission : "unsupported",
  );

  const enable = async () => {
    if (!supported) return "unsupported" as const;
    const p = await Notification.requestPermission();
    setPermission(p);
    return p;
  };

  /** Dispara uma vez por dia (idempotente via localStorage). */
  const notifyDaily = (title: string, body: string) => {
    if (!supported || Notification.permission !== "granted") return;
    const today = new Date().toISOString().slice(0, 10);
    try {
      if (localStorage.getItem(LAST_KEY) === today) return;
      new Notification(title, { body, tag: "rotinas-hoje" });
      localStorage.setItem(LAST_KEY, today);
    } catch {
      /* noop */
    }
  };

  return { supported, permission, enable, notifyDaily };
};
