import "server-only";
import { optionalServerEnv } from "@/lib/env.server";

/**
 * Registra il sottodominio di una nuova academy sul progetto Vercel, così Vercel emette il suo
 * certificato HTTPS. Il DNS (CNAME *.academy su Aruba) porta già tutto il traffico a Vercel.
 * Senza token non fa nulla: l'academy resta creata e il dominio si aggiunge a mano.
 */
export async function registerAcademyDomain(hostname: string): Promise<boolean> {
  const token = optionalServerEnv("VERCEL_API_TOKEN");
  const project = optionalServerEnv("VERCEL_PROJECT_ID");
  if (!token || !project) return false;
  const team = optionalServerEnv("VERCEL_TEAM_ID");
  const url = `https://api.vercel.com/v10/projects/${encodeURIComponent(project)}/domains${
    team ? `?teamId=${encodeURIComponent(team)}` : ""
  }`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: hostname }),
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) return true;
    const body = (await res.json().catch(() => null)) as { error?: { code?: string } } | null;
    // Già presente sul progetto: va bene così.
    if (body?.error?.code === "domain_already_in_use" || res.status === 409) return true;
    console.error("Vercel: dominio non aggiunto", hostname, res.status, body?.error?.code);
    return false;
  } catch (e) {
    console.error("Vercel: dominio non aggiunto", hostname, e);
    return false;
  }
}
