"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics";

export function ViewProductTracker({
  slug,
  nome,
  categoria,
}: {
  slug: string;
  nome: string;
  categoria: string;
}) {
  useEffect(() => {
    track({ name: "view_product", params: { slug, nome, categoria } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  return null;
}
