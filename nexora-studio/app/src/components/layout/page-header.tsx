import { cn } from "@/lib/utils";

/** Intestazione di pagina: titolo, sottotitolo semplice e azioni (a destra su desktop). */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}
    >
      <div className="grid gap-1.5">
        <h1 className="text-2xl font-semibold sm:text-[1.75rem]">{title}</h1>
        {description && (
          <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** Contenitore standard delle pagine dell'area cliente. */
export function PageContainer({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "mx-auto grid w-full max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:gap-8 lg:px-8 lg:py-10",
        className,
      )}
      {...props}
    />
  );
}
