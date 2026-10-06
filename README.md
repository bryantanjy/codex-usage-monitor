# Codex Usage Viewer

Keep an eye on your Codex usage without leaving VS Code. A compact status bar item shows your remaining allowance, with details available on hover.

```text
Codex 82% left
```

An independent community extension by **LephicBryan**. This project is not affiliated with or endorsed by OpenAI.

## Features

- **Remaining usage at a glance:** displays the lowest remaining percentage across your available primary and weekly windows by default.
- **Hover for details:** see used and remaining percentages, time until reset, reset date/time, and your plan and account when available.
- **Available resets:** shows the earned reset count returned by Codex, separately from quota reset times.
- **Credit balance:** appears when provided by your account.
- **Automatic refresh:** every 60 seconds by default; click the status item to refresh immediately.
- **Low-usage indicators:** a warning at 20% remaining or less and an error indicator at 0%.

The percentage represents remaining quota, rather than an exact token or message count. Window labels follow the durations returned by Codex; these are commonly a 5-hour window and a weekly window.

## Before installing

You need:

- **VS Code 1.96.0 or newer.**
- **Codex CLI installed** in the environment where the extension runs, with support for the app-server account methods.
- **A ChatGPT account signed into the CLI.** API-key-only accounts are not supported by this version.
- **An internet connection** to retrieve current limits.

Signing into the Codex IDE extension alone does not guarantee that the separate CLI is signed in. Use the same ChatGPT account in both if you want to monitor that account.

For CLI installation, follow the [official Codex CLI guide](https://learn.chatgpt.com/docs/codex/cli).

Verify your CLI and sign in from a terminal:

**Windows / PowerShell**

```powershell
codex.cmd --version
codex.cmd login
```

**macOS / Linux**

```sh
codex --version
codex login
```

Choose ChatGPT sign-in when prompted. Restart VS Code if you installed the CLI while VS Code was already open, so it can pick up the updated PATH.

## Install

### From the VS Code Marketplace

Once the extension is published:

1. Open **Extensions** in VS Code (`Ctrl+Shift+X`, or `Cmd+Shift+X` on macOS).
2. Search for **Codex Usage Viewer** and check that the publisher is **LephicBryan**.
3. Select **Install**.
4. Look for **Codex** on the right side of the bottom status bar.

### From a VSIX file

1. Obtain a `.vsix` built from this project's source or supplied by the maintainer.
2. Open **Extensions > ... > Install from VSIX...**.
3. Select the file and reload VS Code if prompted.

The source code is available in the [GitHub repository](https://github.com/bryantanjy/codex-usage-monitor).

## Use the monitor

Hover over the status item to inspect your limits. Click it to request a fresh lookup.

For example, if the primary window has **82% left** and the weekly window has **45% left**, the default status item shows **Codex 45% left**. Change `displayLimit` if you prefer to track one window.

Reset dates use your system's local time. Countdown text updates when usage is refreshed; it is not a live clock. A reset marked as due is checked on the next lookup.

If Codex does not return a plan, quota window, or reset count, the tooltip says it is unavailable. **An unavailable reset count does not mean zero resets.** Available resets are displayed only; this extension does not redeem them.

Open the Command Palette (`Ctrl+Shift+P`, or `Cmd+Shift+P` on macOS) for:

| Command | Action |
| --- | --- |
| `Codex Usage: Refresh` | Fetch current account and usage details. |
| `Codex Usage: Open Usage Page` | Open the official ChatGPT Codex usage page in your browser. |

## Privacy and account access

The extension's usage lookup is available for inspection in [src/usageClient.ts](https://github.com/bryantanjy/codex-usage-monitor/blob/main/src/usageClient.ts).

- It starts your installed `codex app-server`, reads account information and rate limits, then stops the process.
- It uses the CLI's existing login. The extension itself does not read your authentication files or ask you to paste API keys or access tokens.
- It keeps fetched account and usage information in memory for display; it does not save a usage history.
- It does not read your editor documents or upload your source code as part of the usage lookup.
- It has no added analytics or maintainer-operated data collection service. The Codex CLI has its own configuration and network behavior, which remain separate from this extension.

Your account email may appear in the tooltip when returned by the CLI. Hide it before sharing screenshots or screen recordings.

### Does refreshing use my allowance?

The monitor sends account lookup requests, not prompts or model turns. These requests are expected not to consume model tokens or inference quota; the official documentation does not explicitly guarantee quota-free polling. Refreshing also does not redeem earned resets.

Each refresh uses network traffic and briefly runs a CLI process. Hovering displays the fetched result without making another request. You can increase the refresh interval to reduce polling.

The lookup uses `account/read` and `account/rateLimits/read` from the [documented Codex app-server interface](https://learn.chatgpt.com/docs/app-server).

## Settings

Open VS Code Settings and search for `codexUsage`, or edit your user `settings.json`:

```json
{
  "codexUsage.refreshIntervalSeconds": 60,
  "codexUsage.codexPath": "codex",
  "codexUsage.displayLimit": "lowest",
  "codexUsage.showIcon": true,
  "codexUsage.commandTimeoutMs": 10000
}
```

| Setting | Default | Description |
| --- | --- | --- |
| `codexUsage.refreshIntervalSeconds` | `60` | Refresh interval, from 15 to 3,600 seconds. |
| `codexUsage.codexPath` | `codex` | CLI executable name or full path. |
| `codexUsage.displayLimit` | `lowest` | `lowest`, `primary`, or `weekly`. |
| `codexUsage.showIcon` | `true` | Show the usage indicator icon. |
| `codexUsage.commandTimeoutMs` | `10000` | Lookup timeout, from 1,000 to 60,000 milliseconds. |

If the CLI is not found on Windows, set the path to your npm launcher. Replace `YOUR_NAME` with your Windows username:

```json
{
  "codexUsage.codexPath": "C:\\Users\\YOUR_NAME\\AppData\\Roaming\\npm\\codex.cmd"
}
```

Use an executable you trust. Enter the path without surrounding quote characters or shell commands. On macOS/Linux, use the full path to your `codex` executable if necessary.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| `Codex ?` | Hover over the item to read the error, then click to retry. |
| CLI cannot start | Verify the CLI is installed, restart VS Code, or set `codexUsage.codexPath`. |
| ChatGPT login required | Run `codex login` (`codex.cmd login` on Windows) and use ChatGPT sign-in. |
| PowerShell says scripts are disabled | Use `codex.cmd` instead of `codex`; changing execution policy is unnecessary for this launcher. |
| Lookup timed out | Check your connection and increase `codexUsage.commandTimeoutMs`, for example to `30000`. |
| Missing plan, credits, or reset count | These fields depend on the account and the information returned by the service. |
| Figures differ from another Codex client | Check the account in the tooltip and click to refresh. This extension uses the CLI account. |
| App-server exits or rejects a method | Check your CLI version and update it using the official installation instructions. |

The app-server interface is experimental and can change. Automated checks cover parsing, RPC handling, error cleanup, and tooltip content; they do not guarantee compatibility with every CLI version or account plan. Remote development environments such as WSL, SSH, and containers have not been independently verified for this project.

## Build from source

With Node.js 20 or newer and npm installed, clone the repository and run:

```sh
npm install
npm test
npm run package
```

On Windows PowerShell, use `npm.cmd` if your script policy blocks `npm`.

To debug the extension, open the project in VS Code and press **F5**. The Extension Development Host opens with the monitor enabled. Packaging creates a `.vsix` file in the project folder.

## Support and license

Report bugs or request features through [GitHub Issues](https://github.com/bryantanjy/codex-usage-monitor/issues). Include your operating system, VS Code version, CLI version, and the error shown in the tooltip. Remove account emails, access tokens, and other personal information before sharing logs or screenshots.

Licensed under the [MIT License](https://github.com/bryantanjy/codex-usage-monitor/blob/main/LICENSE).
