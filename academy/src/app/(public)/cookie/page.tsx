import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Cookie", alternates: { canonical: "/cookie" } };

export default function CookiePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <PageHeader eyebrow="Note legali" title="Cookie" />
      <div className="mt-8 space-y-4 text-[15px] leading-7">
        <p>Usiamo solo cookie tecnici, necessari a far funzionare la piattaforma:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>sb-…-auth-token</strong>: tiene aperta la tua sessione dopo l&apos;accesso.
          </li>
          <li>
            <strong>nx_ricordami</strong>: ricorda se hai scelto «Ricordami» al login.
          </li>
        </ul>
        <p>
          Non usiamo cookie di profilazione né di statistica di terze parti. Se in futuro li
          aggiungeremo, ti chiederemo prima il consenso.
        </p>
      </div>
    </div>
  );
}
