/** Da quale academy arriva la richiesta? Logica pura, testata. */

export type HostMatch =
  { kind: "root" } | { kind: "sub"; slug: string } | { kind: "custom"; domain: string };

export function normalizeHost(host: string | null | undefined) {
  return (host ?? "").trim().toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
}

export function resolveHost(rawHost: string | null | undefined, rootDomain: string): HostMatch {
  const host = normalizeHost(rawHost);
  const root = normalizeHost(rootDomain);
  if (!host || host === root || host === `www.${root}`) return { kind: "root" };
  // Sviluppo: localhost, 127.0.0.1 e <cliente>.localhost
  if (host === "localhost" || host === "127.0.0.1") return { kind: "root" };
  if (host.endsWith(".localhost")) return subOrRoot(host.slice(0, -".localhost".length));
  // Anteprime Vercel: mostrano l'academy principale.
  if (host.endsWith(".vercel.app")) return { kind: "root" };
  if (host.endsWith(`.${root}`)) return subOrRoot(host.slice(0, -(root.length + 1)));
  return { kind: "custom", domain: host };
}

function subOrRoot(sub: string): HostMatch {
  // Un solo livello: "a.b.academy..." non è un'academy valida.
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(sub) || sub === "www") return { kind: "root" };
  return { kind: "sub", slug: sub };
}

/** Dominio dei cookie di sessione: condiviso tra tutte le academy *.root, così chi crea un'academy resta collegato. */
export function cookieDomainFor(rawHost: string | null | undefined, rootDomain: string) {
  const host = normalizeHost(rawHost);
  const root = normalizeHost(rootDomain);
  if (host === root || host.endsWith(`.${root}`)) return `.${root}`;
  return undefined;
}

export function tenantUrl(slug: string, rootDomain: string, path = "/") {
  return `https://${slug}.${normalizeHost(rootDomain)}${path}`;
}

/**
 * Indirizzo di un'academy visto da dove si trova l'utente ora.
 * In sviluppo usa <slug>.localhost; sulle anteprime Vercel i sottodomini non esistono: null.
 */
export function academyUrlFrom(
  currentHost: string | null | undefined,
  slug: string,
  rootDomain: string,
  path = "/",
) {
  const raw = (currentHost ?? "").trim().toLowerCase();
  const host = normalizeHost(raw);
  const port = raw.match(/:(\d+)$/)?.[1];
  if (host === "localhost" || host === "127.0.0.1" || host.endsWith(".localhost")) {
    return `http://${slug}.localhost${port ? `:${port}` : ""}${path}`;
  }
  if (host.endsWith(".vercel.app")) return null;
  return tenantUrl(slug, rootDomain, path);
}

/** Suggerisce un sottodominio dal nome: "Pizzeria Da Mario!" → "pizzeria-da-mario". */
export function slugify(nome: string) {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30)
    .replace(/-+$/g, "");
}
