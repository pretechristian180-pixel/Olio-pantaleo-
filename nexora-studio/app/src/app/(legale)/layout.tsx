import Link from "next/link";

import { NexoraLogo } from "@/components/brand/logo";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex h-16 w-full max-w-3xl items-center px-5">
        <Link href="/" aria-label="Christian Prete Studio, torna alla pagina iniziale">
          <NexoraLogo />
        </Link>
      </header>
      <main className="mx-auto grid w-full max-w-3xl content-start gap-4 px-5 py-10">
        {children}
      </main>
    </div>
  );
}
