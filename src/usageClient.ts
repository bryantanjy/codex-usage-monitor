import { spawn, ChildProcessWithoutNullStreams } from "node:child_process";
import { CodexUsage, UsageWindow } from "./types";

function toWindow(label: string, source: any): UsageWindow | undefined {
  if (!source || !Number.isFinite(source.usedPercent)) return undefined;
  const usedPercent = Math.min(100, Math.max(0, source.usedPercent));
  const duration = source.windowDurationMins;
  if (Number.isFinite(duration) && duration > 0) {
    label = duration === 10080 ? "Weekly limit"
      : duration % 60 === 0 ? `${duration / 60}-hour limit` : `${duration}-minute limit`;
  }
  return {
    label, usedPercent, remainingPercent: 100 - usedPercent,
    resetsAt: Number.isFinite(source.resetsAt) ? source.resetsAt : undefined,
    windowDurationMins: Number.isFinite(duration) ? duration : undefined
  };
}

export function parseUsage(result: any, account: any): CodexUsage {
  const limits = result?.rateLimitsByLimitId?.codex ?? result?.rateLimits;
  if (!limits) throw new Error("No Codex limits were returned. Sign in to Codex CLI with your ChatGPT account.");
  const count = result.rateLimitResetCredits?.availableCount;
  return {
    primary: toWindow("Primary limit", limits.primary),
    weekly: toWindow("Secondary limit", limits.secondary),
    credits: limits.credits ?? undefined,
    availableResets: Number.isInteger(count) && count >= 0 ? count : undefined,
    planType: typeof limits.planType === "string" ? limits.planType : account?.planType,
    account: typeof account?.email === "string" ? account.email : undefined,
    rawSource: "app-server", fetchedAt: new Date()
  };
}

// Read-only account RPCs; no threads, inference turns, or reset redemption.
export function readCodexUsage(executable: string, timeout: number): Promise<CodexUsage> {
  return new Promise((resolve, reject) => {
    let child: ChildProcessWithoutNullStreams;
    const windows = process.platform === "win32";
    if (!executable.trim() || /["\r\n%!]/.test(executable)) {
      reject(new Error("Set codexUsage.codexPath to an executable path without quotes or shell expansions."));
      return;
    }
    if (windows && !/\.exe$/i.test(executable)) {
      child = spawn(process.env.ComSpec || "cmd.exe",
        ["/d", "/s", "/c", `""${executable}" app-server"`],
        { windowsHide: true, windowsVerbatimArguments: true });
    } else {
      child = spawn(executable, ["app-server"], { windowsHide: true });
    }
    let done = false;
    let buffer = "";
    let account: any;
    const finish = (error?: Error, usage?: CodexUsage): void => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      child.stdin.end();
      if (windows && child.pid) {
        const killer = spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
        killer.on("error", () => child.kill());
      } else child.kill();
      if (error) reject(error); else resolve(usage!);
    };
    const timer = setTimeout(() => finish(new Error("Codex usage lookup timed out. Check your connection or increase codexUsage.commandTimeoutMs.")), timeout);
    const send = (message: object): void => {
      if (!done) child.stdin.write(JSON.stringify(message) + "\n");
    };
    child.on("error", () => finish(new Error("Codex CLI could not start. Install it or set codexUsage.codexPath.")));
    child.stdin.on("error", () => finish(new Error("Codex app-server connection closed.")));
    child.on("close", () => finish(new Error("Codex app-server exited before returning usage. Check your CLI installation and login.")));
    child.stderr.resume();
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      buffer += chunk;
      if (buffer.length > 1024 * 1024) {
        finish(new Error("Codex app-server response exceeded the size limit."));
        return;
      }
      let newline: number;
      while (!done && (newline = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        let message: any;
        try { message = JSON.parse(line); } catch { continue; }
        if (![1, 2, 3].includes(message.id)) continue;
        if (message.error) {
          finish(new Error(`Codex usage lookup failed: ${message.error.message ?? "RPC error"}`));
          return;
        }
        if (message.id === 1) {
          send({ method: "initialized" });
          send({ id: 2, method: "account/read", params: { refreshToken: false } });
        } else if (message.id === 2) {
          account = message.result?.account;
          if (!account || account.type !== "chatgpt") {
            finish(new Error("Usage limits require a ChatGPT login. Run 'codex login' (Windows: 'codex.cmd login')."));
            return;
          }
          send({ id: 3, method: "account/rateLimits/read" });
        } else {
          try { finish(undefined, parseUsage(message.result, account)); }
          catch (error) { finish(error as Error); }
        }
      }
    });
    send({ id: 1, method: "initialize", params: {
      clientInfo: { name: "codex_usage_monitor", title: "Codex Usage Monitor", version: "0.1.0" }
    } });
  });
}
