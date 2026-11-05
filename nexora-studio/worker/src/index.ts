/**
 * Worker di Nexora Studio: preleva i job dalla coda su Postgres e li esegue.
 * Fase 2: generazione degli script settimanali ed email del lunedì.
 * Fase 3: trascrizione, edit_spec e render FFmpeg.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import * as Sentry from "@sentry/node";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@nexora/shared";
import { createLLMProvider, type LLMProvider } from "@nexora/shared/server";

import { loadConfig } from "./config.js";
import { alertAdmins, handleJob, type HandlerDeps } from "./handlers.js";
import { log } from "./log.js";
import { onPublishJobFailed } from "./pipeline/publish.js";
import { isRetryable, onVideoJobFailed } from "./pipeline/video.js";
import { runScheduler } from "./scheduler.js";

const run = promisify(execFile);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
  const db = createClient<Database>(
    config.supabaseUrl,
    config.supabaseSecretKey,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  let llm: LLMProvider | null = null;
  const deps: HandlerDeps = {
    db,
    config,
    // Creato al primo uso: senza chiave il worker parte comunque (email, scheduler).
    llm: () => (llm ??= createLLMProvider()),
  };

  // Monitoraggio errori (Sentry): solo con SENTRY_DSN, senza dati personali.
  if (process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment:
        process.env.RAILWAY_ENVIRONMENT_NAME ??
        process.env.NODE_ENV ??
        "development",
      serverName: config.workerId,
      dataCollection: {
        userInfo: false,
        cookies: false,
        httpHeaders: false,
        httpBodies: [],
        urlQueryParams: false,
      },
      tracesSampleRate: 0,
      beforeSend: (event) => {
        const strip = (s?: string) =>
          s?.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]");
        event.message = strip(event.message);
        for (const ex of event.exception?.values ?? [])
          ex.value = strip(ex.value);
        return event;
      },
    });
  }

  log("info", "worker avviato", {
    worker: config.workerId,
    ffmpeg: (await checkFfmpeg()) ?? "NON TROVATO",
  });

  let stopping = false;
  const stop = (signal: string) => {
    log("info", "spegnimento", { signal });
    stopping = true;
  };
  process.on("SIGINT", () => stop("SIGINT"));
  process.on("SIGTERM", () => stop("SIGTERM"));

  let lastSchedule = 0;
  let scheduleLogged = false;
  while (!stopping) {
    if (Date.now() - lastSchedule >= config.scheduleIntervalMs) {
      lastSchedule = Date.now();
      try {
        const res = await runScheduler(db, config);
        // Le chiavi di deduplica rendono ripetibile ogni giro: log solo al primo.
        if (!scheduleLogged) log("info", "pianificazione attiva", res);
        scheduleLogged = true;
      } catch (e) {
        log("error", "pianificazione non riuscita", { error: String(e) });
      }
    }

    const { data: jobs, error } = await db.rpc("claim_job", {
      p_worker: config.workerId,
    });
    if (error) {
      log("error", "lettura coda non riuscita", { error: error.message });
      await sleep(config.pollIntervalMs);
      continue;
    }
    const job = jobs?.[0];
    if (!job) {
      await sleep(config.pollIntervalMs);
      continue;
    }

    const started = Date.now();
    try {
      await handleJob(job, deps);
      await db.rpc("complete_job", { p_job_id: job.id });
      log("info", "job completato", {
        job: job.id,
        type: job.type,
        ms: Date.now() - started,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      const retryable = isRetryable(e);
      const { data: outcome } = await db.rpc("fail_job", {
        p_job_id: job.id,
        p_error: message,
        p_retryable: retryable,
      });
      log("warn", "job non riuscito", {
        job: job.id,
        type: job.type,
        attempt: job.attempts,
        outcome,
        error: message,
      });
      if (outcome === "failed") {
        if (["transcribe", "edit", "render"].includes(job.type)) {
          await onVideoJobFailed(job, deps, message).catch((err) =>
            log("error", "stato errore non salvato", { error: String(err) }),
          );
        }
        if (job.type === "publish") {
          await onPublishJobFailed(job, deps, message).catch((err) =>
            log("error", "stato pubblicazione non salvato", {
              error: String(err),
            }),
          );
        }
        await alertAdmins(job, message, deps).catch(() => undefined);
        // Solo i fallimenti definitivi (dopo i tentativi automatici) arrivano a Sentry.
        Sentry.captureException(e, {
          tags: { job_type: job.type },
          extra: { job_id: job.id, attempts: job.attempts },
        });
      }
    }
  }
}

main().catch(async (error) => {
  log("error", "errore fatale", { error: String(error) });
  Sentry.captureException(error);
  await Sentry.flush(2000).catch(() => undefined);
  process.exit(1);
});
