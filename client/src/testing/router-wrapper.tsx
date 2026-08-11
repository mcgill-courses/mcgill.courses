import { render } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';

type WrapperProps = {
  children: ReactNode;
};

const RouterWrapper = ({ children }: WrapperProps) => (
  <BrowserRouter>{children}</BrowserRouter>
);

export const renderWithRouter = (ui: ReactElement) =>
  render(ui, { wrapper: RouterWrapper });
