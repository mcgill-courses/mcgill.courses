import { Layout } from '../components/layout';
import { Spinner } from '../components/ui/spinner';

export const Loading = () => (
  <Layout>
    <div className='flex min-h-screen items-center justify-center'>
      <div className='text-center'>
        <Spinner />
      </div>
    </div>
  </Layout>
);
