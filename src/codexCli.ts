import * as vscode from "vscode";
import { readCodexUsage } from "./usageClient";
import { UsageResult } from "./types";

export async function fetchCodexUsage(): Promise<UsageResult> {
  const config = vscode.workspace.getConfiguration("codexUsage");
  try {
    return { usage: await readCodexUsage(
      config.get<string>("codexPath", "codex"),
      config.get<number>("commandTimeoutMs", 10000)
    ) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to read Codex usage." };
  }
}
