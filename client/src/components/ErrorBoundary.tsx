import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary] Caught error:", error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = "/";
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "2rem",
            backgroundColor: "var(--bg-primary, #090c15)",
            color: "var(--text-main, #f8fafc)",
            fontFamily: "var(--font-sans, system-ui, sans-serif)",
          }}
        >
          <div
            className="glass-panel"
            style={{
              maxWidth: "520px",
              width: "100%",
              padding: "2.5rem",
              borderRadius: "var(--radius-lg, 16px)",
              textAlign: "center",
              border: "1px solid rgba(244, 63, 94, 0.3)",
              background: "rgba(18, 24, 38, 0.95)",
              boxShadow: "0 20px 40px rgba(0, 0, 0, 0.7)",
            }}
          >
            <div
              style={{
                width: "60px",
                height: "60px",
                borderRadius: "50%",
                background: "rgba(244, 63, 94, 0.15)",
                color: "#fb7185",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.75rem",
                margin: "0 auto 1.25rem",
              }}
            >
              ⚠
            </div>
            <h2
              style={{
                fontSize: "1.5rem",
                fontWeight: 700,
                marginBottom: "0.75rem",
                fontFamily: "var(--font-display, inherit)",
              }}
            >
              Something went wrong
            </h2>
            <p
              style={{
                color: "var(--text-muted, #94a3b8)",
                fontSize: "0.9rem",
                lineHeight: "1.5",
                marginBottom: "1.5rem",
              }}
            >
              The application encountered an unexpected error. You can reload the page or return to the lobby.
            </p>
            {this.state.error?.message && (
              <div
                style={{
                  background: "rgba(0, 0, 0, 0.35)",
                  padding: "0.75rem 1rem",
                  borderRadius: "var(--radius-sm, 6px)",
                  fontSize: "0.8rem",
                  color: "#fda4af",
                  fontFamily: "var(--font-mono, monospace)",
                  marginBottom: "1.75rem",
                  textAlign: "left",
                  overflowX: "auto",
                  border: "1px solid rgba(255, 255, 255, 0.06)",
                }}
              >
                {this.state.error.message}
              </div>
            )}
            <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
              <button
                onClick={this.handleReload}
                className="btn-primary"
                style={{ padding: "0.65rem 1.5rem", fontSize: "0.9rem" }}
              >
                Reload Page
              </button>
              <button
                onClick={this.handleGoHome}
                className="btn-secondary"
                style={{ padding: "0.65rem 1.5rem", fontSize: "0.9rem" }}
              >
                Return to Lobby
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
