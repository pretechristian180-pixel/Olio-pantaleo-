export function Badge({ testo, colore }: { testo: string; colore: string }) {
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${colore}`}>{testo}</span>;
}
