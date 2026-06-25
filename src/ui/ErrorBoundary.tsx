import { Component, type ErrorInfo, type ReactNode } from "react";
import { clearDiagnostics, recordDiagnostic, readDiagnostics } from "./diagnostics";

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  error?: Error;
  errorInfo?: ErrorInfo;
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {};

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    recordDiagnostic("render", error.message, errorInfo.componentStack || undefined);
    this.setState({ error, errorInfo });
  }

  render() {
    const { error, errorInfo } = this.state;
    if (!error) return this.props.children;

    const diagnostics = readDiagnostics();

    return (
      <div className="app-error-shell">
        <div className="app-error-card">
          <span>页面出错</span>
          <b>当前界面已中断，避免继续黑屏</b>
          <p>{error.message}</p>
          {errorInfo?.componentStack && <pre>{errorInfo.componentStack}</pre>}
          {diagnostics.length > 0 && (
            <section className="app-error-diagnostics">
              <strong>最近诊断</strong>
              {diagnostics.slice(-6).map((entry) => (
                <div key={entry.id}>
                  <span>{entry.kind}</span>
                  <small>{entry.message}{entry.detail ? ` · ${entry.detail}` : ""}</small>
                </div>
              ))}
            </section>
          )}
          <div className="app-error-actions">
            <button type="button" onClick={() => window.location.reload()}>重新加载</button>
            <button type="button" onClick={() => {
              clearDiagnostics();
              window.location.reload();
            }}>
              清除诊断并重载
            </button>
          </div>
        </div>
      </div>
    );
  }
}
