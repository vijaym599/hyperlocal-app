import { Component } from 'react';
import { ErrorState } from './ui/StatePanel';

export default class AppErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, details) {
    console.error('Application render error', error, details);
  }

  render() {
    if (this.state.failed) return <main className="flex min-h-[100dvh] items-center justify-center px-4 py-12"><ErrorState error={{ status: 500 }} onRetry={() => window.location.reload()} /></main>;
    return this.props.children;
  }
}
