import { APP_NAME } from "@/config/app";

export function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <svg viewBox="0 0 32 32" className="size-9 shrink-0" aria-hidden>
        <rect width="32" height="32" rx="9" fill="#2563EB" />
        <path d="M8 15.5 16 9l8 6.5V24a1 1 0 0 1-1 1h-4.5v-5.5h-5V25H9a1 1 0 0 1-1-1z" fill="#fff" />
      </svg>
      <span className="text-lg font-bold tracking-tight">{APP_NAME}</span>
    </span>
  );
}
