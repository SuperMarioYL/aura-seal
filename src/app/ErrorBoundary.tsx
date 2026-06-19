import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Top-level guard so a runtime fault in the camera/vision/WebGL pipeline degrades
 * to a recoverable panel instead of a blank white screen (a real risk before this
 * existed: an unknown preset id made `createWebGLEffect` return undefined and the
 * `.group` access threw all the way up to the React root).
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surfaced for future monitoring (Sentry-class) in v1.0.
    console.error('[AuraSeal] uncaught error', error, info.componentStack);
  }

  private handleReload = () => {
    this.setState({ error: null });
    window.location.reload();
  };

  render() {
    if (this.state.error) {
      return (
        <div className="error-boundary" role="alert">
          <div className="error-card">
            <h1>出错了</h1>
            <p>灵印引擎遇到了一个意外错误,已停止以保护你的设备。</p>
            <pre className="error-detail">{this.state.error.message}</pre>
            <button className="primary-action" type="button" onClick={this.handleReload}>
              重新加载
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
