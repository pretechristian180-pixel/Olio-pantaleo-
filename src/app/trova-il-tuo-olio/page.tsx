import type { Metadata } from "next";
import { QuizFlow } from "@/components/QuizFlow";
import { GroveHorizon } from "@/components/illustrations/GroveHorizon";

export const metadata: Metadata = {
  title: "Trova il tuo olio",
  description:
    "Rispondi a quattro domande e scopri quale olio extravergine Pantaleo si adatta di più alle tue abitudini in cucina.",
};

export default function TrovaIlTuoOlioPage() {
  return (
    <>
      <section className="relative overflow-hidden bg-forest-900 py-6 text-paper bg-grain">
        <GroveHorizon className="absolute inset-x-0 bottom-0 h-16 w-full text-forest-800" />
      </section>
      <section className="container-editorial min-h-[70vh] py-20">
        <QuizFlow />
      </section>
    </>
  );
}
