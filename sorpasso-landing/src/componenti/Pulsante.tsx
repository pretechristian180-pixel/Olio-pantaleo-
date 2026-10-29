import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from "react";

const base =
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold transition-[transform,background-color,box-shadow] active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none";
const varianti = {
  primario: "bg-accent text-white shadow-[0_8px_30px_-8px_rgb(47_107_255/0.7)] hover:bg-accent-2",
  secondario: "border border-line-2 bg-white/5 text-text hover:bg-white/10",
};
const misure = { md: "h-12 px-6 text-[16px]", lg: "h-14 px-8 text-[17px]" };

type Comuni = { variante?: keyof typeof varianti; misura?: keyof typeof misure; className?: string };

export function LinkPulsante({ variante = "primario", misura = "md", className = "", ...p }: Comuni & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a className={`${base} ${varianti[variante]} ${misure[misura]} ${className}`} {...p} />;
}

export function Pulsante({ variante = "primario", misura = "md", className = "", ...p }: Comuni & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={`${base} ${varianti[variante]} ${misure[misura]} ${className}`} {...p} />;
}
