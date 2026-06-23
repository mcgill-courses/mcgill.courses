import { Route, Routes } from 'react-router-dom';

import { PrivateRoute } from './components/private-route';
import { About } from './pages/about';
import { Changelog } from './pages/changelog';
import { CoursePage } from './pages/course-page';
import { Explore } from './pages/explore';
import { Home } from './pages/home';
import { Instructor } from './pages/instructor';
import { NotFound } from './pages/not-found';
import { PrivacyPolicy } from './pages/privacy-policy';
import { Profile } from './pages/profile';
import { Reviews } from './pages/reviews';
import { ScheduleBuilder } from './pages/schedule-builder';
import { TermsAndConditions } from './pages/terms-and-conditions';

const App = () => {
  return (
    <Routes>
      <Route index element={<Home />} />
      <Route path='/about' element={<About />} />
      <Route path='/changelog' element={<Changelog />} />
      <Route path='/explore' element={<Explore />} />
      <Route path='/privacy' element={<PrivacyPolicy />} />
      <Route
        path='/profile'
        element={
          <PrivateRoute>
            <Profile />
          </PrivateRoute>
        }
      />
      <Route path='/reviews' element={<Reviews />} />
      <Route path='/schedule-builder' element={<ScheduleBuilder />} />
      <Route path='/tos' element={<TermsAndConditions />} />
      <Route path='course'>
        {' '}
        <Route path=':id' element={<CoursePage />} />{' '}
      </Route>
      <Route path='instructor'>
        {' '}
        <Route path=':name' element={<Instructor />} />{' '}
      </Route>
      <Route path='*' element={<NotFound />} />
    </Routes>
  );
};

export default App;
