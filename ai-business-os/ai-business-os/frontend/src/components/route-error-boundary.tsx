import { Component, type ErrorInfo, type ReactNode } from "react";
import { ErrorState } from "@/components/ui/error-state";
import { logger } from "@/lib/logger";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/** Catches render errors in a route chunk — shell stays alive (§5.20). */
export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logger.error("Route render error", { message: error.message, stack: info.componentStack });
  }

  private reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <ErrorState
          title="Something went wrong on this page"
          description="This section hit an unexpected error. The rest of the app is still available."
          onRetry={this.reset}
        />
      );
    }
    return this.props.children;
  }
}
