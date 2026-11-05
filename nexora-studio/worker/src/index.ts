/**
 * Worker di Nexora Studio: preleva i job dalla coda su Postgres e li esegue
 * (trascrizione, edit_spec, render FFmpeg, pubblicazione).
 *
 * Fase 0: solo scheletro. Ciclo di polling, controllo di FFmpeg e spegnimento pulito.
 * La tabella `jobs` e gli handler arrivano nelle Fasi 1-3.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { JOB_MAX_ATTEMPTS } from "@nexora/shared";

import { loadConfig } from "./config.js";

const run = promisify(execFile);

async function checkFfmpeg(): Promise<string | null> {
  try {
    const { stdout } = await run("ffmpeg", ["-version"]);
    return stdout.split("\n")[0] ?? "ffmpeg";
  } catch {
    return null;
  }
}

async function main() {
  const config = loadConfig();
  const ffmpeg = await checkFfmpeg();

  console.log(
    JSON.stringify({
      msg: "worker avviato",
      ffmpeg: ffmpeg ?? "NON TROVATO",
      pollIntervalMs: config.pollIntervalMs,
      concurrency: config.concurrency,
      maxAttempts: JOB_MAX_ATTEMPTS,
    }),
  );

  let stopping = false;
  const stop = (signal: string) => {
    console.log(JSON.stringify({ msg: "spegnimento", signal }));
    stopping = true;
  };
  process.on("SIGINT", () => stop("SIGINT"));
  process.on("SIGTERM", () => stop("SIGTERM"));

  while (!stopping) {
    // TODO Fase 3: claim di un job (FOR UPDATE SKIP LOCKED) ed esecuzione dell'handler.
    await new Promise((resolve) => setTimeout(resolve, config.pollIntervalMs));
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ msg: "errore fatale", error: String(error) }));
  process.exit(1);
});
