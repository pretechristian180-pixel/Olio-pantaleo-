import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { ProgressBar } from "@/components/ui/progress-bar";

export function PlayerTopbar({ courseTitolo, percent }: { courseTitolo: string; percent: number }) {
  return (
    <header className="flex h-16 items-center gap-3 border-b border-line bg-surface px-2 sm:h-18 sm:gap-5 sm:px-8">
      <Link
        href="/app"
        className="flex min-h-11 items-center gap-1.5 rounded-md px-2 text-sm font-semibold hover:bg-surface-alt"
        aria-label="Torna alla dashboard"
      >
        <ChevronLeft aria-hidden className="size-5" />
        <span className="hidden sm:inline">Dashboard</span>
      </Link>
      <span aria-hidden className="hidden h-8 w-px bg-line sm:block" />
      <div className="flex min-w-0 flex-1 items-baseline gap-3">
        <span className="hidden sm:inline">
          <Logo size="sm" href={null} layout="inline" label="" />
        </span>
        <p className="truncate text-[15px] font-semibold">{courseTitolo}</p>
      </div>
      <span className="sm:hidden">
        <Logo size="sm" href={null} layout="inline" label="" />
      </span>
      <div className="hidden w-70 items-center md:flex">
        <ProgressBar
          value={percent}
          showValue
          size="md"
          track="tint"
          label="Avanzamento del corso"
          className="w-full"
        />
      </div>
    </header>
  );
}
