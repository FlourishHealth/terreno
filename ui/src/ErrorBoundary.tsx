import React from "react";

import type {ErrorBoundaryProps} from "./Common";
import {ErrorPage} from "./ErrorPage";

interface State {
  error?: Error;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, State> {
  state: State = {error: undefined};

  static getDerivedStateFromError(error: Error): State {
    console.warn("[ErrorBoundary] Derived error", error);
    return {error};
  }

  componentDidCatch(error: Error, info: {componentStack: string}): void {
    console.warn("[ErrorBoundary] Caught error", error);

    if (this.props.onError) {
      this.props.onError(error, info.componentStack);
    }
  }

  resetError = (): void => {
    this.setState({error: undefined});
  };

  render(): React.ReactNode {
    const error = this.state.error;
    if (error) {
      return <ErrorPage error={error} resetError={this.resetError} />;
    }
    return this.props.children;
  }
}
