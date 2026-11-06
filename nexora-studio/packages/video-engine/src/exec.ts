import { spawn } from "node:child_process";

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
