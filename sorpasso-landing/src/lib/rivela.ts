import { useEffect } from "react";

/** Aggiunge .visibile agli elementi .rivela quando entrano nello schermo (una volta sola). */
export function useRivela(dipendenza?: unknown) {
  useEffect(() => {
    const el = Array.from(document.querySelectorAll<HTMLElement>(".rivela:not(.visibile)"));
    if (!("IntersectionObserver" in window)) {
      el.forEach((e) => e.classList.add("visibile"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("visibile");
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    el.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [dipendenza]);
}

export const euro = (n: number) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
export const numero = (n: number, dec = 0) => new Intl.NumberFormat("it-IT", { maximumFractionDigits: dec }).format(n);
