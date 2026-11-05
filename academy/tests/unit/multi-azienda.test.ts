import { describe, expect, it } from "vitest";
import { brandCss, contrast, DEFAULT_BRAND, parseBrand, readablePrimary } from "@/lib/brand";
import { cookieDomainFor, resolveHost, tenantUrl } from "@/lib/tenant-host";

const ROOT = "academy.nexoragruppodigitale.it";

describe("resolveHost", () => {
  it("dominio principale e www", () => {
    expect(resolveHost(ROOT, ROOT)).toEqual({ kind: "root" });
    expect(resolveHost(`www.${ROOT}`, ROOT)).toEqual({ kind: "root" });
    expect(resolveHost("ACADEMY.nexoragruppodigitale.it.", ROOT)).toEqual({ kind: "root" });
  });
  it("sottodominio del cliente", () => {
    expect(resolveHost(`pizzeria-mario.${ROOT}`, ROOT)).toEqual({
      kind: "sub",
      slug: "pizzeria-mario",
    });
  });
  it("sviluppo e anteprime", () => {
    expect(resolveHost("localhost:3000", ROOT)).toEqual({ kind: "root" });
    expect(resolveHost("prova.localhost:3000", ROOT)).toEqual({ kind: "sub", slug: "prova" });
    expect(resolveHost("academy-abc.vercel.app", ROOT)).toEqual({ kind: "root" });
  });
  it("dominio personalizzato", () => {
    expect(resolveHost("academy.cliente.it", ROOT)).toEqual({
      kind: "custom",
      domain: "academy.cliente.it",
    });
  });
  it("sottodomini su più livelli non valgono come academy", () => {
    expect(resolveHost(`a.b.${ROOT}`, ROOT)).toEqual({ kind: "root" });
  });
});

describe("cookie e URL", () => {
  it("cookie condivisi tra le academy del dominio principale", () => {
    expect(cookieDomainFor(`x.${ROOT}`, ROOT)).toBe(`.${ROOT}`);
    expect(cookieDomainFor("academy.cliente.it", ROOT)).toBeUndefined();
    expect(cookieDomainFor("localhost:3000", ROOT)).toBeUndefined();
  });
  it("URL dell'academy", () => {
    expect(tenantUrl("mario", ROOT, "/admin")).toBe(`https://mario.${ROOT}/admin`);
  });
});

describe("marchio", () => {
  it("senza dati usa il marchio Nexora", () => {
    expect(parseBrand(null)).toEqual(DEFAULT_BRAND);
  });
  it("un colore troppo chiaro viene scurito fino a essere leggibile", () => {
    const giallo = "#ffd400";
    expect(contrast(giallo, "#ffffff")).toBeLessThan(4.5);
    expect(contrast(readablePrimary(giallo), "#ffffff")).toBeGreaterThanOrEqual(4.5);
  });
  it("scarta valori non validi e logo non https", () => {
    const b = parseBrand({
      primary: "red;}body{display:none",
      logo_url: "javascript:alert(1)",
      logo_text: "pizzeria mario",
    });
    expect(b.primary).toBe(DEFAULT_BRAND.primary);
    expect(b.logoUrl).toBeNull();
    expect(b.logoText).toBe("PIZZERIA MARIO");
  });
  it("il CSS contiene solo colori validati", () => {
    const css = brandCss(parseBrand({ primary: "#7a1fa2" }));
    expect(css).toMatch(
      /^:root\{--color-nexora-blue:#[0-9a-f]{6};--color-nexora-blue-deep:#[0-9a-f]{6};--color-nexora-blue-bright:#[0-9a-f]{6};--color-graphite-deep:#[0-9a-f]{6}\}$/,
    );
  });
  it("l'accento chiaro si legge sul fondo scuro del cliente", () => {
    const b = parseBrand({ primary: "#0f766e", dark: "#132a27" });
    expect(contrast(b.primaryBright, b.dark)).toBeGreaterThanOrEqual(4.5);
  });
});

import { academyUrlFrom, slugify } from "@/lib/tenant-host";

describe("academyUrlFrom e slugify", () => {
  it("in sviluppo usa slug.localhost con la porta", () => {
    expect(academyUrlFrom("localhost:3000", "mario", ROOT, "/admin")).toBe(
      "http://mario.localhost:3000/admin",
    );
  });
  it("in produzione usa il sottodominio", () => {
    expect(academyUrlFrom(ROOT, "mario", ROOT, "/admin")).toBe(`https://mario.${ROOT}/admin`);
  });
  it("sulle anteprime Vercel non c'è sottodominio", () => {
    expect(academyUrlFrom("x.vercel.app", "mario", ROOT)).toBeNull();
  });
  it("slug dal nome", () => {
    expect(slugify("Pizzeria Da Mario!")).toBe("pizzeria-da-mario");
    expect(slugify("Caffè & Più")).toBe("caffe-piu");
  });
});
