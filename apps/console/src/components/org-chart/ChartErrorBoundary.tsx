"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { reportError } from "@/lib/report-error";

interface Props {
  children: ReactNode;
  /** Fallback rendered on error; defaults to an inline error panel. */
  fallback?: ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface State {
  error: Error | null;
}

/**
 * Catches render errors in the DREAM canvas so a crash surfaces the actual
 * message instead of Next.js's generic "Internal Server Error", and reports it
 * to the API /client-log sink for server-side diagnosis.
 */
export class ChartErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    void reportError({
      message: error.message,
      stack: error.stack ?? undefined,
      componentStack: info.componentStack ?? undefined,
    });
    this.props.onError?.(error, info);
  }

  override render(): ReactNode {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex h-full w-full items-center justify-center p-6">
          <div className="flex max-w-md flex-col items-start gap-2 rounded-lg border border-red-500/30 bg-card p-5 text-sm">
            <div className="flex items-center gap-2 font-semibold text-red-400">
              <AlertTriangle className="size-4" />
              The canvas failed to render
            </div>
            <code className="whitespace-pre-wrap break-words text-xs text-muted-foreground">
              {this.state.error.message}
              {"\n"}
              {this.state.error.stack}
            </code>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}