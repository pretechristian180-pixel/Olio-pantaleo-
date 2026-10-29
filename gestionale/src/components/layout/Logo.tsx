import { APP_NAME } from "@/config/app";

/** Logo Mattonio: i tre mattoni e il nome in minuscolo. */
export function Logo() {
  return (
    <span className="flex items-center gap-2.5 text-foreground">
      <svg viewBox="0 0 120 64" className="h-[19px] w-9 shrink-0" aria-hidden>
        <rect x="33" y="0" width="54" height="28" rx="5" fill="#C4532F" />
        <rect x="4" y="36" width="54" height="28" rx="5" fill="currentColor" />
        <rect x="62" y="36" width="54" height="28" rx="5" fill="currentColor" />
      </svg>
      <span className="text-[19px] font-extrabold leading-none tracking-[-0.03em]">{APP_NAME.toLowerCase()}</span>
    </span>
  );
}
