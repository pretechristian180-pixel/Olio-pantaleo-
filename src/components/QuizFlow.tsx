"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { quizQuestions, computeQuizResult } from "@/lib/data/quiz";
import { getProductBySlug, minPrice, formatEUR } from "@/lib/data/products";
import { BottleGlyph } from "@/components/illustrations/BottleGlyph";
import { accentBg } from "@/lib/accent";
import { track } from "@/lib/analytics";

export function QuizFlow() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<string[][]>([]);
  const [started, setStarted] = useState(false);

  const totalSteps = quizQuestions.length;
  const done = step >= totalSteps;
  const resultSlug = done ? computeQuizResult(answers.flat()) : null;

  useEffect(() => {
    if (started) track({ name: "quiz_start", params: {} });
  }, [started]);

  useEffect(() => {
    if (done && resultSlug) {
      track({ name: "quiz_complete", params: { risultato: resultSlug } });
    }
  }, [done, resultSlug]);

  function handleAnswer(tags: string[]) {
    const next = [...answers];
    next[step] = tags;
    setAnswers(next);
    setStep(step + 1);
  }

  function reset() {
    setStep(0);
    setAnswers([]);
    setStarted(false);
  }

  if (!started) {
    return (
      <div className="mx-auto max-w-xl text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-clay-600">Trova il tuo olio</p>
        <h2 className="mt-4 font-serif text-3xl text-ink sm:text-4xl">
          Qual è il tuo modo di vivere l&apos;olio?
        </h2>
        <p className="mt-4 text-bark">
          Quattro domande veloci per capire quale referenza Pantaleo si adatta meglio alle tue
          abitudini in cucina.
        </p>
        <button
          type="button"
          onClick={() => setStarted(true)}
          className="mt-8 bg-ink px-8 py-3.5 text-sm tracking-wide text-paper hover:bg-olive-800"
        >
          Inizia il quiz
        </button>
      </div>
    );
  }

  if (done && resultSlug) {
    const product = getProductBySlug(resultSlug);
    if (!product) return null;

    return (
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-clay-600">Il tuo risultato</p>
        <h2 className="mt-4 font-serif text-3xl text-ink sm:text-4xl">
          Il tuo Pantaleo è {product.nome}.
        </h2>
        <p className="mt-4 text-bark">{product.tagline}</p>

        <div
          className={`mx-auto mt-10 flex aspect-[4/3] max-w-sm items-center justify-center ${accentBg[product.accent]}`}
        >
          <BottleGlyph accent={product.accent} className="h-3/4 w-auto" />
        </div>

        <p className="mt-6 text-sm text-bark">Da {formatEUR(minPrice(product))}</p>

        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Link
            href={`/prodotti/${product.slug}`}
            className="bg-ink px-7 py-3.5 text-sm tracking-wide text-paper hover:bg-olive-800"
          >
            SCOPRI IL PRODOTTO
          </Link>
          <button
            type="button"
            onClick={reset}
            className="border border-ink px-7 py-3.5 text-sm tracking-wide text-ink hover:bg-ink hover:text-paper"
          >
            Rifai il quiz
          </button>
        </div>
      </div>
    );
  }

  const question = quizQuestions[step];

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-8 flex items-center gap-2" aria-hidden="true">
        {quizQuestions.map((_, i) => (
          <span
            key={i}
            className={`h-1 flex-1 rounded-full ${i <= step ? "bg-olive-600" : "bg-sand"}`}
          />
        ))}
      </div>
      <p className="text-xs uppercase tracking-wide text-bark">
        Domanda {step + 1} di {totalSteps}
      </p>
      <h2 className="mt-3 font-serif text-2xl text-ink sm:text-3xl">{question.domanda}</h2>
      <div className="mt-8 space-y-3">
        {question.opzioni.map((opzione) => (
          <button
            key={opzione.id}
            type="button"
            onClick={() => handleAnswer(opzione.tags)}
            className="block w-full border border-stone px-5 py-4 text-left text-ink transition-colors hover:border-ink hover:bg-ivory"
          >
            {opzione.label}
          </button>
        ))}
      </div>
      {step > 0 && (
        <button
          type="button"
          onClick={() => setStep(step - 1)}
          className="mt-6 text-sm text-bark underline underline-offset-4"
        >
          ← Torna indietro
        </button>
      )}
    </div>
  );
}
