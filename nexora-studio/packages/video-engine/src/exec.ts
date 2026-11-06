import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { availableParallelism } from "node:os";

/**
 * CPU davvero disponibili nel container (quota cgroup), non quelle della macchina:
 * su Railway os.cpus() vede decine di core e FFmpeg creerebbe un thread per ognuno.
 */
export function containerCpus(): number {
  try {
    const [quota, period] = readFileSync("/sys/fs/cgroup/cpu.max", "utf8").trim().split(/\s+/);
    if (quota !== "max") return Math.max(1, Math.floor(Number(quota) / Number(period)));
  } catch {
    // nessun cgroup v2: si usa il valore del sistema
  }
  return availableParallelism();
}

/** Thread per FFmpeg: FFMPEG_THREADS, altrimenti le CPU del container fino a 4 (memoria contenuta). */
export function ffmpegThreads(): string {
  const forced = Number(process.env.FFMPEG_THREADS);
  return String(forced > 0 ? Math.floor(forced) : Math.min(containerCpus(), 4));
}

/** Esegue un comando e restituisce stdout; errore con le ultime righe di stderr. */
export function execCommand(cmd: string, args: string[], opts: { cwd?: string; timeoutMs?: number } = {}) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: opts.cwd, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => {
      err += d;
      if (err.length > 20000) err = err.slice(-10000);
    });
    const timer = opts.timeoutMs
      ? setTimeout(() => {
          child.kill("SIGKILL");
          reject(new Error(`${cmd}: tempo scaduto dopo ${opts.timeoutMs} ms`));
        }, opts.timeoutMs)
      : null;
    child.on("error", reject);
    child.on("close", (code, signal) => {
      if (timer) clearTimeout(timer);
      if (code === 0) return resolve(out);
      const tail = err.trim().split("\n").slice(-6).join(" | ");
      if (signal) {
        const hint = signal === "SIGKILL" ? " (probabile memoria esaurita)" : "";
        return reject(new Error(`${cmd} è stato terminato dal segnale ${signal}${hint}: ${tail}`));
      }
      reject(new Error(`${cmd} è uscito con codice ${code}: ${tail}`));
    });
  });
}
