import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/700.css';
import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { ErrorBoundary } from 'react-error-boundary';
import { HelmetProvider } from 'react-helmet-async';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';

import App from './App';
import './index.css';
import { ErrorPage } from './pages/ErrorPage';
import AuthProvider from './providers/AuthProvider';
import { DarkModeProvider } from './providers/DarkModeProvider';
import ExploreFilterStateProvider from './providers/ExploreFilterStateProvider';

const Root = () => {
  // When an error occurs, we want all of the state in the app
  // to reset to prevent further errors
  //
  // One way to do this is just to assign a different key to <App />,
  // which will make React treat it as a different component and
  // rerender it from scratch, with the initial state.
  const [key, setKey] = useState(0);

  return (
    <React.StrictMode>
      <HelmetProvider>
        <BrowserRouter>
          <DarkModeProvider>
            <ErrorBoundary
              FallbackComponent={ErrorPage}
              onReset={() => setKey(key + 1)}
            >
              <AuthProvider>
                <ExploreFilterStateProvider>
                  <Toaster richColors />
                  <App key={key} />
                </ExploreFilterStateProvider>
              </AuthProvider>
            </ErrorBoundary>
          </DarkModeProvider>
        </BrowserRouter>
      </HelmetProvider>
    </React.StrictMode>
  );
};

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <Root />
);
