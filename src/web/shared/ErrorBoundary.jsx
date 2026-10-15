import { Component } from "react";
export class ErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed) {
      return (
        <section role="alert">
          <p>{"error.generic".tr}</p>
          <button onClick={() => location.reload()}>{"common.retry".tr}</button>
        </section>
      );
    }
    return this.props.children;
  }
}
