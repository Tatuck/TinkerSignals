import { Component, type ReactNode } from 'react';

/**
 * Si un componente falla al pintarse (por ejemplo, la vista de un bloque
 * nuevo con un bug), solo se rompe esa parte y no toda la página.
 */
export class ErrorBoundary extends Component<
  { children: ReactNode; label: string },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error(`[ui] Falló «${this.props.label}»`, error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="ui-crash" role="alert">
        <strong>No se ha podido mostrar {this.props.label}.</strong>
        <code>{this.state.error.message}</code>
        <button className="btn" onClick={() => this.setState({ error: null })}>
          Reintentar
        </button>
      </div>
    );
  }
}
