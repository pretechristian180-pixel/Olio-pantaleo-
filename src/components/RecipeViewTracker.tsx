"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics";

export function RecipeViewTracker({ slug }: { slug: string }) {
  useEffect(() => {
    track({ name: "recipe_view", params: { slug } });
  }, [slug]);

  return null;
}
