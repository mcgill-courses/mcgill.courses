import { Helmet } from 'react-helmet-async';

import { Layout } from '../components/layout';
import { Paragraph } from '../components/ui/paragraph';

export const PrivacyPolicy = () => {
  const h2 = 'text-2xl font-bold text-neutral-700 dark:text-gray-300 mb-4';
  const h1 = 'text-4xl font-bold text-neutral-700 dark:text-gray-300';

  return (
    <Layout>
      <Helmet>
        <title>Privacy Policy - mcgill.courses</title>

        <meta property='og:type' content='website' />
        <meta property='og:url' content={`https://mcgill.courses/privacy`} />
        <meta property='og:title' content={`Privacy Policy - mcgill.courses`} />

        <meta
          property='twitter:url'
          content={`https://mcgill.courses/privacy`}
        />
        <meta
          property='twitter:title'
          content={`Privacy Policy - mcgill.courses`}
        />
      </Helmet>

      <div className='m-auto my-10 flex max-w-[800px] flex-col gap-9 px-2'>
        <h1 className={h1}>Privacy Policy</h1>
        <Paragraph>
          mcgill.courses is an Open-Sourced app. This service is provided at no
          cost and is intended for use as is. This page is used to inform
          visitors regarding our policies with the collection, use, and
          disclosure of Personal Information if anyone decided to use our
          Service. If you choose to use our Service, then you agree to this
          policy. The terms used in this Privacy Policy have the same meanings
          as in our Terms and Conditions, which are accessible at mcgill.courses
          unless otherwise defined in this Privacy Policy.
        </Paragraph>

        <div>
          <h2 className={h2}>Cookies</h2>

          <Paragraph>
            Cookies are files with a small amount of data that are commonly used
            as anonymous unique identifiers. These are sent to your browser from
            the websites that you visit and are stored on your device's internal
            memory. mcgill.courses uses Microsoft OAuth for user identification
            purposes. When you log in to our Service using your Microsoft
            account, a cookie is stored on your device's internal memory. This
            cookie allows us to maintain your login session and cache the fact
            that you are logged in for a certain period of time. Please note
            that we do not store any personal data through these cookies. The
            cookie solely serves the purpose of facilitating a seamless login
            experience and maintaining your session on our Service. We do not
            have access to or retain any personally identifiable information
            from Microsoft OAuth. You have the option to disable or delete these
            cookies through your browser settings.
          </Paragraph>
        </div>

        <div>
          <h2 className={h2}>Changes to This Privacy Policy</h2>

          <Paragraph>
            We may update our Privacy Policy from time to time. Thus, you are
            advised to review this page periodically for any changes. We will
            notify you of any changes by posting the new Privacy Policy on this
            page. This policy is effective as of 2023-12-17.
          </Paragraph>
        </div>

        <div>
          <h2 className={h2}>Contact Us</h2>
          <Paragraph>
            If you have any questions or suggestions about our Privacy Policy,
            do not hesitate to contact us at on{' '}
            <span className='underline'>
              <a href='https://discord.gg/d67aYpC7'>Discord</a>
            </span>{' '}
            or at{' '}
            <span className='underline'>
              <a href='mailto:admin@mcgill.courses'>admin@mcgill.courses</a>
            </span>
            .
          </Paragraph>
        </div>
      </div>
    </Layout>
  );
};
