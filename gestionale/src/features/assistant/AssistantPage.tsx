import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Copy, Mic, Send, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/shared/PageHeader";
import { useAuth } from "@/features/auth/AuthProvider";
import { friendlyError } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { askAssistant, type ChatMessage } from "@/services/assistant";

export const suggestions = [
  "Chi devo richiamare oggi?",
  "Quali immobili sono fermi da più tempo?",
  "Quali incarichi scadono nel prossimo mese?",
  "A quali proprietari devo mandare il report?",
  "Quali documenti mancano?",
  "Quali sono i lead migliori della settimana?",
];

const storageKey = (uid: string) => `mattonio.assistente.${uid}`;

/** Assistente: domande in italiano sui tuoi dati, risposte brevi con i collegamenti alle schede */
export function AssistantPage() {
  const { agent } = useAuth();
  const uid = agent?.id ?? "anon";
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      return JSON.parse(sessionStorage.getItem(storageKey(uid)) ?? "[]");
    } catch {
      return [];
    }
  });
  const [params, setParams] = useSearchParams();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState<number | null>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey(uid), JSON.stringify(messages.slice(-20)));
    } catch {
      // archivio del browser non disponibile: la conversazione resta solo in questa pagina
    }
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, uid]);

  // Domanda arrivata da un suggerimento (es. dalla pagina Oggi): parte subito, una volta sola
  const asked = useRef(false);
  useEffect(() => {
    const q = params.get("chiedi");
    if (q && !asked.current) {
      asked.current = true;
      setParams({}, { replace: true });
      send(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function send(question = text) {
    const q = question.trim();
    if (!q || busy) return;
    const history: ChatMessage[] = [...messages, { role: "utente", text: q }];
    setMessages(history);
    setText("");
    setBusy(true);
    try {
      const r = await askAssistant(history);
      setMessages([...history, { role: "assistente", text: r.answer }]);
      setLeft(r.left);
    } catch (e) {
      toast.error("Nessuna risposta", { description: friendlyError(e) });
      setMessages(messages);
      setText(q);
    }
    setBusy(false);
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col">
      <PageHeader
        title="Assistente"
        subtitle="Chiedi quello che vuoi sui tuoi immobili, clienti e appuntamenti"
        action={
          messages.length ? (
            <Button variant="outline" size="lg" onClick={() => setMessages([])} disabled={busy}>
              <Trash2 aria-hidden />
              Nuova conversazione
            </Button>
          ) : undefined
        }
      />

      {messages.length === 0 ? (
        <div className="space-y-3">
          <p className="text-[17px] text-muted-foreground">Prova con una di queste, oppure scrivi o detta la tua domanda:</p>
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => send(s)}
              className="flex min-h-12 w-full items-center gap-3 rounded-lg border bg-card px-4 py-3 text-left text-[17px] hover:border-primary/40"
            >
              <Sparkles className="size-5 shrink-0 text-primary" aria-hidden />
              {s}
            </button>
          ))}
          <p className="pt-2 text-[15px] text-muted-foreground">
            Può anche scrivere per te: "Scrivi un WhatsApp a Maria Rossi per proporle la visita di sabato" oppure "Scrivi l'annuncio di Via Roma 48".
          </p>
        </div>
      ) : (
        <ul className="space-y-4" aria-live="polite">
          {messages.map((m, i) => (
            <li key={i} className={cn("flex", m.role === "utente" ? "justify-end" : "justify-start")}>
              {m.role === "utente" ? (
                <p className="max-w-[85%] whitespace-pre-line rounded-2xl rounded-br-md bg-primary px-4 py-3 text-[17px] text-white">{m.text}</p>
              ) : (
                <div className="max-w-[95%] space-y-2 rounded-2xl rounded-bl-md border bg-card px-4 py-3 text-[17px] leading-relaxed shadow-card">
                  <Answer text={m.text} />
                </div>
              )}
            </li>
          ))}
          {busy && (
            <li className="flex justify-start">
              <p className="rounded-2xl rounded-bl-md border bg-card px-4 py-3 text-[17px] text-muted-foreground">Sto guardando i tuoi dati…</p>
            </li>
          )}
        </ul>
      )}
      <div ref={end} className="scroll-mb-72 lg:scroll-mb-56" />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="sticky bottom-20 mt-6 space-y-2 rounded-xl border bg-background/95 p-3 shadow-card backdrop-blur lg:bottom-4"
      >
        <Textarea
          aria-label="La tua domanda"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Scrivi una domanda…"
          className="min-h-14"
          maxLength={2000}
        />
        <div className="flex gap-2">
          <VoiceButton onText={(t) => setText((x) => (x ? `${x} ${t}` : t))} disabled={busy} />
          <Button type="submit" size="lg" className="flex-1" disabled={busy || !text.trim()}>
            <Send aria-hidden />
            {busy ? "Attendi…" : "Chiedi"}
          </Button>
        </div>
        <p className="text-center text-sm text-muted-foreground">
          Legge solo i dati che vedi anche tu e non modifica nulla.{left != null && left <= 10 ? ` Ti restano ${left} domande oggi.` : ""}
        </p>
      </form>
    </div>
  );
}

/* ---------- Dettatura (dove il telefono la supporta) ---------- */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Recognizer = any;

function VoiceButton({ onText, disabled }: { onText: (t: string) => void; disabled: boolean }) {
  const [listening, setListening] = useState(false);
  const rec = useRef<Recognizer>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const SR = typeof window !== "undefined" ? ((window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition) : undefined;
  if (!SR) return null;

  function toggle() {
    if (listening) {
      rec.current?.stop();
      return;
    }
    const r: Recognizer = new SR();
    r.lang = "it-IT";
    r.interimResults = false;
    r.onresult = (e: Recognizer) => onText(String(e.results?.[0]?.[0]?.transcript ?? "").trim());
    r.onerror = () => toast.error("Non ho sentito bene", { description: "Riprova oppure scrivi la domanda." });
    r.onend = () => setListening(false);
    rec.current = r;
    setListening(true);
    r.start();
  }

  return (
    <Button type="button" variant={listening ? "default" : "outline"} size="lg" onClick={toggle} disabled={disabled}>
      <Mic aria-hidden />
      {listening ? "Ti ascolto…" : "Parla"}
    </Button>
  );
}

/* ---------- Risposta: testo semplice, elenchi, grassetto, link alle schede, testi da copiare ---------- */
function Answer({ text }: { text: string }) {
  const parts = text.split(/<<<\s*\n?([\s\S]*?)\n?\s*>>>/g);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <CopyBlock key={i} text={part.trim()} />
        ) : (
          <Prose key={i} text={part} />
        ),
      )}
    </>
  );
}

function CopyBlock({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-primary/30 bg-primary-soft/40 p-3">
      <p className="whitespace-pre-line text-[16px]">{text}</p>
      <Button
        type="button"
        variant="outline"
        className="mt-3 w-full bg-card"
        onClick={() => navigator.clipboard.writeText(text).then(() => toast.success("Testo copiato")).catch(() => toast.error("Copia non riuscita"))}
      >
        <Copy aria-hidden />
        Copia il testo
      </Button>
    </div>
  );
}

function Prose({ text }: { text: string }) {
  const lines = text.trim().split("\n");
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) {
      blocks.push(
        <ul key={`l${blocks.length}`} className="list-disc space-y-1 pl-5">
          {list.map((l, i) => (
            <li key={i}>{inline(l)}</li>
          ))}
        </ul>,
      );
      list = [];
    }
  };
  for (const raw of lines) {
    const l = raw.trim();
    if (/^[-•*]\s+/.test(l) || /^\d+[.)]\s+/.test(l)) list.push(l.replace(/^([-•*]|\d+[.)])\s+/, ""));
    else {
      flush();
      if (l) blocks.push(<p key={`p${blocks.length}`}>{inline(l.replace(/^#+\s*/, ""))}</p>);
    }
  }
  flush();
  return <>{blocks}</>;
}

/** **grassetto** e [testo](/percorso-interno): i link esterni restano testo */
function inline(s: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|\[([^\]]+)\]\((\/[^)\s]*)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index));
    if (m[1]) out.push(<strong key={m.index}>{m[1]}</strong>);
    else
      out.push(
        <Link key={m.index} to={m[3]} className="font-semibold text-primary-strong underline underline-offset-2">
          {m[2]}
        </Link>,
      );
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}
