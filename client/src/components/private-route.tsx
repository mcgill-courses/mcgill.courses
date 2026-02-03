import { PropsWithChildren } from 'react';
import { Navigate } from 'react-router-dom';

import { useAuth } from '../hooks/use-auth';

export const PrivateRoute = ({ children }: PropsWithChildren) => {
  return !useAuth() ? <Navigate to='/' replace /> : children;
};
