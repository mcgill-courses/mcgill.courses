import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/700.css';
import { LazyMotion, domAnimation } from 'framer-motion';
import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { ErrorBoundary } from 'react-error-boundary';
import { HelmetProvider } from 'react-helmet-async';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';

import App from './app';
import './index.css';
import { ErrorPage } from './pages/error-page';
import AuthProvider from './providers/auth-provider';
import { DarkModeProvider } from './providers/dark-mode-provider';
import ExploreFilterStateProvider from './providers/explore-filter-state-provider';
import QueryProvider from './providers/query-provider';

const routerFutureConfig = {
  v7_startTransition: true,
  v7_relativeSplatPath: true,
};

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
        <BrowserRouter future={routerFutureConfig}>
          <DarkModeProvider>
            <LazyMotion features={domAnimation}>
              <ErrorBoundary
                FallbackComponent={ErrorPage}
                onReset={() => setKey((prev) => prev + 1)}
              >
                <QueryProvider>
                  <AuthProvider>
                    <ExploreFilterStateProvider>
                      <Toaster richColors />
                      <App key={key} />
                    </ExploreFilterStateProvider>
                  </AuthProvider>
                </QueryProvider>
              </ErrorBoundary>
            </LazyMotion>
          </DarkModeProvider>
        </BrowserRouter>
      </HelmetProvider>
    </React.StrictMode>
  );
};

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <Root />
);
