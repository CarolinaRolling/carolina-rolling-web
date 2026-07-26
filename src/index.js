import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    {/* Outermost net. Per-route boundaries in App.js catch almost everything; this one exists
        so a failure in routing, auth context, or layout still shows a usable message rather
        than a blank white page. */}
    <ErrorBoundary label="the application">
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
