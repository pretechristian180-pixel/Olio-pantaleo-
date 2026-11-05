"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

/** Notifiche a comparsa. Su mobile in alto, lontane dalla barra di navigazione. */
function Toaster(props: ToasterProps) {
  const { resolvedTheme } = useTheme();
  return (
    <Sonner
      theme={(resolvedTheme as ToasterProps["theme"]) ?? "dark"}
      position="top-center"
      richColors
      closeButton
      className="toaster group"
      toastOptions={{ classNames: { toast: "font-sans" } }}
      {...props}
    />
  );
}

export { Toaster };
