import * as vscode from "vscode";
import { CodexUsage, UsageWindow } from "./types";

function percentText(
  value: number | undefined
): string {
  return value === undefined
    ? "N/A"
    : `${Math.round(value)}%`;
}

function formatReset(
  unixSeconds: number | undefined
): string {
  if (!unixSeconds) {
    return "Unknown";
  }

  const date = new Date(unixSeconds * 1000);

  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function windowLine(
  window: UsageWindow | undefined
): string {
  if (!window) {
    return "Not available";
  }

  const remaining = percentText(window.remainingPercent);
  const used = percentText(window.usedPercent);
  const reset = formatReset(window.resetsAt);

  const minutes = window.resetsAt === undefined ? undefined
    : Math.max(0, Math.ceil((window.resetsAt * 1000 - Date.now()) / 60000));
  const countdown = minutes === undefined ? "Reset time unavailable"
    : minutes === 0 ? "Reset due; refresh to check"
    : `Resets in ${Math.floor(minutes / 1440) ? `${Math.floor(minutes / 1440)}d ` : ""}${Math.floor(minutes % 1440 / 60)}h ${minutes % 60}m`;
  return `Remaining **${remaining}** · Used ${used}  \n${countdown}  \nReset: ${reset}`;
}

function getDisplayedRemaining(
  usage: CodexUsage
): number | undefined {
  const config = vscode.workspace.getConfiguration("codexUsage");
  const mode = config.get<string>("displayLimit", "lowest");

  const primary = usage.primary?.remainingPercent;
  const weekly = usage.weekly?.remainingPercent;

  if (mode === "primary") {
    return primary;
  }

  if (mode === "weekly") {
    return weekly;
  }

  const available = [primary, weekly].filter(
    (value): value is number =>
      typeof value === "number"
  );

  return available.length > 0
    ? Math.min(...available)
    : undefined;
}

function iconForRemaining(
  remaining: number | undefined
): string {
  const showIcon = vscode.workspace
    .getConfiguration("codexUsage")
    .get<boolean>("showIcon", true);

  if (!showIcon) {
    return "";
  }

  if (remaining === undefined) {
    return "$(question) ";
  }

  if (remaining <= 0) {
    return "$(error) ";
  }

  if (remaining <= 20) {
    return "$(warning) ";
  }

  return "$(pulse) ";
}

export class CodexUsageStatusBar
  implements vscode.Disposable {
  private readonly item: vscode.StatusBarItem;

  constructor() {
    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );

    this.item.command = "codexUsage.refresh";
    this.item.name = "Codex Usage";
    this.item.text = "$(sync~spin) Codex";
    this.item.tooltip = "Loading Codex usage…";
    this.item.show();
  }

  showLoading(): void {
    this.item.text = "$(sync~spin) Codex";
    this.item.tooltip = "Refreshing Codex usage…";
  }

  showUsage(usage: CodexUsage): void {
    const remaining = getDisplayedRemaining(usage);
    const icon = iconForRemaining(remaining);

    this.item.text =
      remaining === undefined
        ? `${icon}Codex`
        : `${icon}Codex ${Math.round(remaining)}% left`;

    const md = new vscode.MarkdownString();
    md.isTrusted = false;
    md.supportHtml = false;

    md.appendMarkdown("### Codex Usage\n\n");

    if (usage.account) {
      md.appendMarkdown(
        `**Account:** ${escapeMarkdown(usage.account)}\n\n`
      );
    }

    {
      md.appendMarkdown(
        `**Plan:** ${escapeMarkdown(usage.planType ?? "Not available")}\n\n`
      );
    }

    md.appendMarkdown(
      `**${escapeMarkdown(usage.primary?.label ?? "Primary limit")}**  \n${windowLine(usage.primary)}\n\n`
    );

    md.appendMarkdown(
      `**${escapeMarkdown(usage.weekly?.label ?? "Weekly limit")}**  \n${windowLine(usage.weekly)}\n\n`
    );

    md.appendMarkdown(`**Available resets:** ${usage.availableResets ?? "Not provided by Codex"}\n\n`);

    if (usage.credits) {
      const balance =
        usage.credits.unlimited
          ? "Unlimited"
          : usage.credits.balance ?? "Unknown";

      md.appendMarkdown(
        `**Credits:** ${escapeMarkdown(String(balance))}\n\n`
      );
    }

    md.appendMarkdown(
      `---\nUpdated ${usage.fetchedAt.toLocaleTimeString()}\n\n`
    );

    md.appendMarkdown(
      "_Click the status item to refresh._"
    );

    this.item.tooltip = md;

    if (remaining !== undefined && remaining <= 0) {
      this.item.backgroundColor =
        new vscode.ThemeColor(
          "statusBarItem.errorBackground"
        );
    } else if (
      remaining !== undefined &&
      remaining <= 20
    ) {
      this.item.backgroundColor =
        new vscode.ThemeColor(
          "statusBarItem.warningBackground"
        );
    } else {
      this.item.backgroundColor = undefined;
    }
  }

  showError(message: string): void {
    this.item.text = "$(warning) Codex ?";
    this.item.backgroundColor =
      new vscode.ThemeColor(
        "statusBarItem.warningBackground"
      );

    const md = new vscode.MarkdownString();
    md.appendMarkdown("### Codex Usage\n\n");
    md.appendMarkdown(
      `Unable to read usage.\n\n${escapeMarkdown(message)}\n\n`
    );
    md.appendMarkdown(
      "_Click to try again. Run `Codex Usage: Open Usage Page` to view the official usage page._"
    );

    this.item.tooltip = md;
  }

  dispose(): void {
    this.item.dispose();
  }
}

function escapeMarkdown(value: string): string {
  return value.replace(
    /([\\`*_{}[\]()<>#+\-.!|])/g,
    "\\$1"
  );
}
