import { render } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';

export const routerFutureConfig = {
  v7_startTransition: true,
  v7_relativeSplatPath: true,
};

type WrapperProps = {
  children: ReactNode;
};

const RouterWrapper = ({ children }: WrapperProps) => (
  <BrowserRouter future={routerFutureConfig}>{children}</BrowserRouter>
);

export const renderWithRouter = (ui: ReactElement) =>
  render(ui, { wrapper: RouterWrapper });
