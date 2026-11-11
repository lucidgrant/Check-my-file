import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Check MyFile Uncaught Error caught by ErrorBoundary:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen w-full flex items-center justify-center p-6 bg-slate-950 text-slate-100 font-sans">
          <div className="max-w-lg w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white tracking-tight">
                  Incident d'affichage intercepté
                </h2>
                <p className="text-xs text-slate-400">
                  Une erreur imprévue a été neutralisée par le système de sécurité de Check MyFile.
                </p>
              </div>
            </div>

            {this.state.error && (
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 font-mono text-[11px] text-rose-300 overflow-x-auto space-y-1">
                <p className="font-semibold">{this.state.error.name}: {this.state.error.message}</p>
                {this.state.error.stack && (
                  <pre className="text-[10px] text-slate-500 overflow-x-auto max-h-36 whitespace-pre-wrap">
                    {this.state.error.stack.split('\n').slice(0, 5).join('\n')}
                  </pre>
                )}
              </div>
            )}

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                onClick={this.handleReset}
                className="px-4 py-2 text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 rounded-xl transition-colors inline-flex items-center gap-2 cursor-pointer shadow-lg shadow-cyan-900/20"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Recharger l'application</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
