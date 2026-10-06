import * as vscode from "vscode";
import { fetchCodexUsage } from "./codexCli";
import { CodexUsageStatusBar } from "./statusBar";

let refreshTimer: NodeJS.Timeout | undefined;
let refreshing = false;

export function activate(
  context: vscode.ExtensionContext
): void {
  const statusBar = new CodexUsageStatusBar();
  context.subscriptions.push(statusBar);

  const refresh = async (
    showNotification = false
  ): Promise<void> => {
    if (refreshing) {
      return;
    }

    refreshing = true;
    statusBar.showLoading();

    try {
      const result = await fetchCodexUsage();

      if (result.usage) {
        statusBar.showUsage(result.usage);

        if (showNotification) {
          vscode.window.showInformationMessage(
            "Codex usage refreshed."
          );
        }
      } else {
        statusBar.showError(
          result.error ?? "Unknown error."
        );

        if (showNotification) {
          vscode.window.showWarningMessage(
            result.error ??
              "Unable to read Codex usage."
          );
        }
      }
    } catch (error) {
      statusBar.showError(error instanceof Error ? error.message : "Unable to refresh Codex usage.");
    } finally {
      refreshing = false;
    }
  };

  const scheduleRefresh = (): void => {
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = undefined;
    }

    const config =
      vscode.workspace.getConfiguration("codexUsage");

    const seconds = Math.max(
      15,
      config.get<number>(
        "refreshIntervalSeconds",
        60
      )
    );

    refreshTimer = setInterval(
      () => void refresh(false),
      seconds * 1000
    );
  };

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "codexUsage.refresh",
      () => refresh(true)
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "codexUsage.openUsagePage",
      async () => {
        await vscode.env.openExternal(
          vscode.Uri.parse(
            "https://chatgpt.com/codex/settings/usage"
          )
        );
      }
    )
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(
      event => {
        if (
          event.affectsConfiguration("codexUsage")
        ) {
          scheduleRefresh();
          void refresh(false);
        }
      }
    )
  );

  context.subscriptions.push({
    dispose: () => {
      if (refreshTimer) {
        clearInterval(refreshTimer);
      }
    }
  });

  scheduleRefresh();
  void refresh(false);
}

export function deactivate(): void {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = undefined;
  }
}
