"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from "react";
import { track } from "@/lib/analytics";

export interface CartItem {
  variantId: string;
  slug: string;
  nome: string;
  formato: string;
  prezzo: number;
  quantita: number;
  accent: "olive" | "gold" | "clay" | "forest";
}

interface CartState {
  items: CartItem[];
  hydrated: boolean;
}

type CartAction =
  | { type: "HYDRATE"; items: CartItem[] }
  | { type: "ADD"; item: Omit<CartItem, "quantita">; quantita: number }
  | { type: "REMOVE"; variantId: string }
  | { type: "UPDATE_QTY"; variantId: string; quantita: number }
  | { type: "CLEAR" };

const STORAGE_KEY = "pantaleo-cart-v1";

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "HYDRATE":
      return { items: action.items, hydrated: true };
    case "ADD": {
      const existing = state.items.find((i) => i.variantId === action.item.variantId);
      let items: CartItem[];
      if (existing) {
        items = state.items.map((i) =>
          i.variantId === action.item.variantId
            ? { ...i, quantita: i.quantita + action.quantita }
            : i,
        );
      } else {
        items = [...state.items, { ...action.item, quantita: action.quantita }];
      }
      return { ...state, items };
    }
    case "REMOVE":
      return { ...state, items: state.items.filter((i) => i.variantId !== action.variantId) };
    case "UPDATE_QTY":
      return {
        ...state,
        items: state.items
          .map((i) => (i.variantId === action.variantId ? { ...i, quantita: action.quantita } : i))
          .filter((i) => i.quantita > 0),
      };
    case "CLEAR":
      return { ...state, items: [] };
    default:
      return state;
  }
}

interface CartContextValue {
  items: CartItem[];
  hydrated: boolean;
  totale: number;
  conteggio: number;
  aggiungi: (item: Omit<CartItem, "quantita">, quantita?: number) => void;
  rimuovi: (variantId: string) => void;
  aggiornaQuantita: (variantId: string, quantita: number) => void;
  svuota: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, { items: [], hydrated: false });

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const items: CartItem[] = raw ? JSON.parse(raw) : [];
      dispatch({ type: "HYDRATE", items });
    } catch {
      dispatch({ type: "HYDRATE", items: [] });
    }
  }, []);

  useEffect(() => {
    if (!state.hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items));
  }, [state.items, state.hydrated]);

  const aggiungi = useCallback((item: Omit<CartItem, "quantita">, quantita = 1) => {
    dispatch({ type: "ADD", item, quantita });
    track({
      name: "add_to_cart",
      params: { slug: item.slug, variantId: item.variantId, prezzo: item.prezzo, quantita },
    });
  }, []);

  const rimuovi = useCallback((variantId: string) => {
    dispatch({ type: "REMOVE", variantId });
  }, []);

  const aggiornaQuantita = useCallback((variantId: string, quantita: number) => {
    dispatch({ type: "UPDATE_QTY", variantId, quantita });
  }, []);

  const svuota = useCallback(() => {
    dispatch({ type: "CLEAR" });
  }, []);

  const totale = useMemo(
    () => state.items.reduce((sum, i) => sum + i.prezzo * i.quantita, 0),
    [state.items],
  );
  const conteggio = useMemo(
    () => state.items.reduce((sum, i) => sum + i.quantita, 0),
    [state.items],
  );

  const value: CartContextValue = {
    items: state.items,
    hydrated: state.hydrated,
    totale,
    conteggio,
    aggiungi,
    rimuovi,
    aggiornaQuantita,
    svuota,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart deve essere usato dentro CartProvider");
  return ctx;
}
