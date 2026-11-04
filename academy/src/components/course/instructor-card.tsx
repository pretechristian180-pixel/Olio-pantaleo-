import { Eyebrow } from "@/components/ui/eyebrow";
import { initials } from "@/components/ui/avatar";

export function InstructorCard({ nome, bio }: { nome: string; bio: string | null }) {
  const [n, ...c] = nome.split(" ");
  return (
    <section aria-labelledby="docente" className="rounded-lg border border-line bg-surface p-7">
      <Eyebrow className="text-[11px]">Chi ti accompagna</Eyebrow>
      <span
        aria-hidden
        className="mt-4 flex size-18 items-center justify-center rounded-full bg-graphite text-xl font-bold text-white"
      >
        {initials(n, c.join(" "))}
      </span>
      <h2 id="docente" className="mt-4 font-semibold">
        {nome}
      </h2>
      {bio && <p className="mt-3 text-sm leading-6 text-ink-muted">{bio}</p>}
    </section>
  );
}
