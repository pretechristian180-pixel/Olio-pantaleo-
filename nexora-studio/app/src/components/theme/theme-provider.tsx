"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/** Tema scuro di base; l'utente può passare al chiaro o seguire il sistema. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
      storageKey="nexora-theme"
    >
      {children}
    </NextThemesProvider>
  );
}
