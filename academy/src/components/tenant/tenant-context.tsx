"use client";

import { createContext, useContext } from "react";

export type TenantUi = {
  nome: string;
  slug: string;
  logoText: string;
  logoUrl: string | null;
  tagline: string | null;
  /** Mostrare "Piattaforma Christian Prete Academy" nel footer. */
  poweredBy: boolean;
  /** È l'academy di Christian Prete Academy (contenuti e offerte Christian Prete Academy), non quella di un cliente. */
  isNexora: boolean;
};

export const DEFAULT_TENANT_UI: TenantUi = {
  nome: "Christian Prete Academy",
  slug: "nexora",
  logoText: "CHRISTIAN PRETE",
  logoUrl: null,
  tagline: null,
  poweredBy: false,
  isNexora: true,
};

const Ctx = createContext<TenantUi>(DEFAULT_TENANT_UI);

export function TenantProvider({
  value,
  children,
}: {
  value: TenantUi;
  children: React.ReactNode;
}) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTenantUi() {
  return useContext(Ctx);
}
