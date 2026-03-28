import React, { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, info: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, info.componentStack);
    this.props.onError?.(error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex flex-col items-center justify-center min-h-[40vh] p-8 text-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="h-7 w-7 text-destructive" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Algo deu errado</h2>
            <p className="text-sm text-muted-foreground max-w-sm">
              Esta seção encontrou um erro inesperado. Tente recarregar.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={this.handleReset}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Tentar novamente
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
