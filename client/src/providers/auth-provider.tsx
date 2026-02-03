import { PropsWithChildren, createContext, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { api } from '../lib/api';
import type { User } from '../lib/types';

export const AuthContext = createContext<User | undefined>(undefined);

const AuthProvider = ({ children }: PropsWithChildren) => {
  const [user, setUser] = useState<User>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);

    api
      .getUser()
      .then((data) => {
        setUser(data.user);
        setLoading(false);
      })
      .catch(() => toast.error('Failed to fetch user.'));
  }, []);

  return (
    <AuthContext.Provider value={user}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
