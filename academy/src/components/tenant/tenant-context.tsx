"use client";

import { createContext, useContext } from "react";

export type TenantUi = {
  nome: string;
  slug: string;
  logoText: string;
  logoUrl: string | null;
  tagline: string | null;
  /** Mostrare "Piattaforma Nexora Academy" nel footer. */
  poweredBy: boolean;
};

export const DEFAULT_TENANT_UI: TenantUi = {
  nome: "Nexora Academy",
  slug: "nexora",
  logoText: "NEXORA",
  logoUrl: null,
  tagline: null,
  poweredBy: false,
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
