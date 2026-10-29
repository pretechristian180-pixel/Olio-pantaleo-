/**
 * Mockup del gestionale costruito in HTML/CSS (nessuna immagine):
 * dashboard "Oggi" e, sovrapposta, la chat WhatsApp dove l'AI risponde al lead e fissa il test drive.
 * Puramente decorativo: nascosto agli screen reader, con una descrizione testuale.
 */
export function Mockup() {
  return (
    <figure className="relative mx-auto max-w-[580px] pb-44 sm:pb-16">
      <figcaption className="sr-only">
        Anteprima di Sorpasso AI: la dashboard del mattino con i lead da richiamare e una chat WhatsApp in cui l'assistente AI
        risponde a un cliente e fissa un test drive.
      </figcaption>

      {/* Dashboard */}
      <div aria-hidden className="rounded-2xl border border-line-2 bg-[#f4f6fa] p-3 text-[#0d1526] shadow-[0_30px_80px_-20px_rgb(0_0_0/0.7)] sm:mr-28">
        <div className="flex items-center gap-1.5 px-1 pb-2.5">
          <span className="size-2.5 rounded-full bg-[#f87171]" />
          <span className="size-2.5 rounded-full bg-[#fbbf24]" />
          <span className="size-2.5 rounded-full bg-[#34d399]" />
          <span className="ml-3 text-[11px] font-medium text-[#5b6578]">Sorpasso AI · Oggi</span>
        </div>
        <div className="flex gap-3">
          <div className="hidden w-24 shrink-0 space-y-1.5 rounded-xl bg-[#0b1530] p-2.5 sm:block">
            {["Oggi", "Lead", "Stock", "Agenda", "Report"].map((v, i) => (
              <div key={v} className={`rounded-md px-2 py-1 text-[10px] font-medium ${i === 0 ? "bg-white/10 text-white" : "text-[#c9d3e6]"}`}>
                {v}
              </div>
            ))}
          </div>
          <div className="min-w-0 flex-1 space-y-2.5">
            <p className="text-[13px] font-bold">Buongiorno, Giuseppe</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                ["38", "Lead del mese"],
                ["4 min", "Prima risposta"],
                ["9", "Auto vendute"],
              ].map(([n, l]) => (
                <div key={l} className="rounded-lg border border-[#e5e9f0] bg-white p-2">
                  <p className="font-display text-[17px] font-extrabold leading-none">{n}</p>
                  <p className="mt-1 text-[9.5px] leading-tight text-[#5b6578]">{l}</p>
                </div>
              ))}
            </div>
            <div className="rounded-lg border border-[#e5e9f0] bg-white">
              <p className="flex items-center gap-1.5 border-b border-[#e5e9f0] px-2.5 py-1.5 text-[11px] font-semibold">
                Da contattare subito <span className="rounded-full bg-[#dc2626] px-1.5 text-[9px] text-white">2</span>
              </p>
              {[
                ["Luca R.", "Golf 2.0 TDI · AutoScout24", "In attesa da 3 min", true],
                ["Sara M.", "Yaris Hybrid · Facebook", "Arrivato ora", false],
              ].map(([n, a, t, rosso]) => (
                <div key={n as string} className={`flex items-center justify-between gap-2 px-2.5 py-2 ${rosso ? "bg-[#fef2f2]" : ""}`}>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold">{n}</p>
                    <p className="truncate text-[9.5px] text-[#5b6578]">{a}</p>
                    <p className={`text-[9.5px] font-medium ${rosso ? "text-[#dc2626]" : "text-[#5b6578]"}`}>{t}</p>
                  </div>
                  <span className="shrink-0 rounded-md bg-[#3d6bff] px-2 py-1 text-[9.5px] font-semibold text-white">Chiama</span>
                </div>
              ))}
            </div>
            <div className="rounded-lg border border-[#e5e9f0] bg-white px-2.5 py-2">
              <p className="text-[11px] font-semibold">Auto ferme da troppo</p>
              <div className="mt-1 flex items-center justify-between text-[10px]">
                <span>Jeep Renegade · 17.500 €</span>
                <span className="rounded-full bg-[#fef2f2] px-1.5 font-semibold text-[#dc2626]">96 gg</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Telefono con WhatsApp */}
      <div aria-hidden className="absolute bottom-0 right-0 w-[218px] rounded-[30px] border border-line-2 bg-[#050812] p-2 shadow-[0_30px_70px_-15px_rgb(0_0_0/0.85)] sm:w-[236px]">
        <div className="overflow-hidden rounded-[23px] bg-[#0b141a]">
          <div className="flex items-center gap-2 bg-[#1f2c34] px-3 py-2.5">
            <span className="flex size-7 items-center justify-center rounded-full bg-[#3d6bff] text-[10px] font-bold text-white">AL</span>
            <div>
              <p className="text-[11px] font-semibold text-white">Autosalone Levante</p>
              <p className="text-[9px] text-[#8696a0]">online</p>
            </div>
          </div>
          <div className="space-y-1.5 bg-[#0b141a] px-2.5 py-3 text-[10.5px] leading-snug">
            <Bolla lato="cliente" ritardo={0.2}>Buonasera, la Golf è ancora disponibile? Posso provarla?</Bolla>
            <Bolla lato="ai" ritardo={1.1}>
              Buonasera Luca! Sì, la Golf 2.0 TDI del 2021 con 58.200 km è disponibile. Le va bene sabato alle 10:30 per il test
              drive?
            </Bolla>
            <Bolla lato="cliente" ritardo={2}>Perfetto, sabato alle 10:30 👍</Bolla>
            <Bolla lato="ai" ritardo={2.9}>
              Fatto ✅ Test drive fissato sabato alle 10:30 con Marco. Le mando la posizione del salone.
            </Bolla>
            <div className="anim flex justify-center pt-1 opacity-0 [animation:entra_.5s_ease_3.6s_forwards]">
              <span className="rounded-full bg-[#3d6bff]/20 px-2 py-0.5 text-[9px] font-semibold text-[#8aa5ff]">
                Risposto in 42 secondi · in agenda
              </span>
            </div>
          </div>
        </div>
      </div>
    </figure>
  );
}

function Bolla({ lato, ritardo, children }: { lato: "cliente" | "ai"; ritardo: number; children: string }) {
  const ai = lato === "ai";
  return (
    <div
      className={`anim max-w-[88%] rounded-lg px-2 py-1.5 opacity-0 ${ai ? "ml-auto bg-[#005c4b] text-white" : "bg-[#202c33] text-[#e9edef]"}`}
      style={{ animation: `entra .5s ease ${ritardo}s forwards` }}
    >
      {ai && <span className="mb-0.5 block text-[8.5px] font-semibold text-[#7ee2c6]">Assistente AI</span>}
      {children}
    </div>
  );
}
