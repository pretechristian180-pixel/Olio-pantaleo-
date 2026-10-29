import type { ReactNode } from "react";
import { Logo } from "@/components/layout/Logo";

/** Cornice delle schermate di accesso: stesso stile semplice del resto dell'app. */
export function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="border-b">
        <div className="mx-auto flex h-16 max-w-md items-center px-4">
          <Logo />
        </div>
      </header>
      <main className="mx-auto w-full max-w-md flex-1 px-4 pb-16 pt-8">
        <h1 className="text-[28px] font-bold leading-tight tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-[17px] text-muted-foreground">{subtitle}</p>}
        <div className="mt-8">{children}</div>
        {footer && <div className="mt-8 border-t pt-6 text-center text-[16px] text-muted-foreground">{footer}</div>}
      </main>
    </div>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-lg bg-destructive-soft px-4 py-3 text-[15px] font-medium text-destructive">
      {message}
    </p>
  );
}

export function FormNotice({ children }: { children: ReactNode }) {
  return <div className="rounded-lg bg-success-soft px-4 py-4 text-[16px] text-success">{children}</div>;
}
