import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error('Lifys frontend crashed', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="fatal-error-panel">
          <section className="content-panel">
            <p className="eyebrow">Incident applicatif</p>
            <h1>Une erreur inattendue a interrompu l’interface.</h1>
            <p className="section-description">
              Rechargez la page. Si le problème persiste, reconnectez-vous ou contactez l’équipe d’exploitation.
            </p>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}
