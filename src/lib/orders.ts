import type { CartItem } from "@/lib/cart-context";

export interface Order {
  id: string;
  data: string;
  items: CartItem[];
  totale: number;
  spedizione: {
    nome: string;
    indirizzo: string;
    citta: string;
    cap: string;
    email: string;
  };
}

const ORDERS_KEY = "pantaleo-orders-v1";

export function saveOrder(order: Order): void {
  if (typeof window === "undefined") return;
  const existing = getOrders();
  window.localStorage.setItem(ORDERS_KEY, JSON.stringify([order, ...existing]));
}

export function getOrders(): Order[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(ORDERS_KEY);
    return raw ? (JSON.parse(raw) as Order[]) : [];
  } catch {
    return [];
  }
}

export function getOrder(id: string): Order | undefined {
  return getOrders().find((o) => o.id === id);
}

export function generateOrderId(): string {
  const now = new Date();
  const y = now.getFullYear();
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `PNT-${y}-${rand}`;
}
