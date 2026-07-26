import React from 'react';

/**
 * Catches render errors so one bad component cannot blank the whole application.
 *
 * Without this, a single unexpected data shape — a null where an object was expected, a part
 * with a field the form did not anticipate — unmounts the entire React tree and leaves a white
 * screen. On the shop floor that reads as "the system is down."
 *
 * Wrap the whole app once for the safety net, and wrap individual panels where a failure should
 * stay contained to that panel.
 *
 * Props:
 *   label     - what failed, shown to the user (e.g. "the parts list")
 *   compact   - render a small inline notice instead of a full-page one
 *   onReset   - optional; called when the user clicks Try Again
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, showDetail: false };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Keep this in the browser console — it is often the only record of what actually broke.
    console.error('[ErrorBoundary]', this.props.label || 'app', error, info?.componentStack);
  }

  handleReset = () => {
    this.setState({ error: null, showDetail: false });
    if (this.props.onReset) this.props.onReset();
  };

  render() {
    const { error, showDetail } = this.state;
    if (!error) return this.props.children;

    const what = this.props.label || 'this screen';

    if (this.props.compact) {
      return (
        <div style={{
          background: '#fff3e0', border: '1px solid #ffcc80', borderRadius: 8,
          padding: 12, fontSize: '0.85rem', color: '#e65100'
        }}>
          <strong>Couldn't display {what}.</strong>{' '}
          <button type="button" onClick={this.handleReset}
            style={{ background: 'none', border: 'none', color: '#bf360c', textDecoration: 'underline', cursor: 'pointer', padding: 0, font: 'inherit' }}>
            Try again
          </button>
          <div style={{ marginTop: 4, color: '#8d6e63' }}>
            The rest of the page still works. Nothing was lost.
          </div>
        </div>
      );
    }

    return (
      <div style={{ maxWidth: 620, margin: '64px auto', padding: 28, textAlign: 'center' }}>
        <div style={{ fontSize: '2.6rem', marginBottom: 8 }}>🛠️</div>
        <h2 style={{ margin: '0 0 8px', color: '#333' }}>Something went wrong on {what}</h2>
        <p style={{ color: '#666', lineHeight: 1.5, margin: '0 0 20px' }}>
          Nothing was saved incorrectly and nothing was lost — this screen just failed to draw.
          Try again, or reload the page.
        </p>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 20 }}>
          <button type="button" onClick={this.handleReset}
            style={{ background: '#795548', color: 'white', border: 'none', borderRadius: 6, padding: '10px 20px', cursor: 'pointer', fontWeight: 600 }}>
            Try Again
          </button>
          <button type="button" onClick={() => window.location.reload()}
            style={{ background: 'white', color: '#795548', border: '1px solid #795548', borderRadius: 6, padding: '10px 20px', cursor: 'pointer', fontWeight: 600 }}>
            Reload Page
          </button>
        </div>

        <button type="button" onClick={() => this.setState({ showDetail: !showDetail })}
          style={{ background: 'none', border: 'none', color: '#999', fontSize: '0.8rem', cursor: 'pointer', textDecoration: 'underline' }}>
          {showDetail ? 'Hide' : 'Show'} technical details
        </button>
        {showDetail && (
          <pre style={{
            textAlign: 'left', background: '#fafafa', border: '1px solid #eee', borderRadius: 6,
            padding: 12, marginTop: 10, fontSize: '0.72rem', color: '#666',
            overflow: 'auto', maxHeight: 220, whiteSpace: 'pre-wrap'
          }}>
            {String(error && (error.stack || error.message || error))}
          </pre>
        )}
      </div>
    );
  }
}
