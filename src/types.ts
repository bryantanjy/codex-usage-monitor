export interface UsageWindow {
  usedPercent?: number;
  remainingPercent?: number;
  resetsAt?: number;
  windowDurationMins?: number;
  label: string;
}

export interface CreditInfo {
  hasCredits?: boolean;
  unlimited?: boolean;
  balance?: string | number | null;
}

export interface CodexUsage {
  primary?: UsageWindow;
  weekly?: UsageWindow;
  credits?: CreditInfo;
  planType?: string;
  account?: string;
  availableResets?: number;
  rawSource: "app-server";
  fetchedAt: Date;
}

export interface UsageResult {
  usage?: CodexUsage;
  error?: string;
}
