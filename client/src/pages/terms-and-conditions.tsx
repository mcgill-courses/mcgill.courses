import { Helmet } from 'react-helmet-async';

import { Layout } from '../components/layout';
import { Paragraph } from '../components/ui/paragraph';

export const TermsAndConditions = () => {
  const h2 = 'text-2xl font-bold text-neutral-700 dark:text-gray-300 mb-4';
  const h1 = 'text-4xl font-bold text-neutral-700 dark:text-gray-300';

  return (
    <Layout>
      <Helmet>
        <title>Terms and Conditions - mcgill.courses</title>

        <meta property='og:type' content='website' />
        <meta property='og:url' content={`https://mcgill.courses/tos`} />
        <meta
          property='og:title'
          content={`Terms and Conditions - mcgill.courses`}
        />

        <meta property='twitter:url' content={`https://mcgill.courses/tos`} />
        <meta
          property='twitter:title'
          content={`Terms and Conditions - mcgill.courses`}
        />
      </Helmet>

      <div className='m-auto my-10 flex max-w-[800px] flex-col gap-9 px-2'>
        <h1 className={h1}>Terms and Conditions</h1>

        <Paragraph>
          By using mcgill.courses, these terms will automatically apply to you –
          you should make sure therefore that you read them carefully before
          using the website. As the website is open-sourced, You are allowed to
          copy or modify the app as the licence indicates.
        </Paragraph>

        <div>
          <h2 className={h2}>General Usage</h2>
          <Paragraph>
            mcgill.courses is committed to ensuring that the website is as
            useful and efficient as possible. For that reason, we reserve the
            right to make changes to the website.
          </Paragraph>
        </div>

        <div>
          <h2 className={h2}>Community Guidelines</h2>
          <Paragraph>
            At mcgill.courses, we believe in fostering a positive and respectful
            community environment. We encourage users to follow these community
            guidelines when leaving reviews for courses offered at McGill
            University:
          </Paragraph>
        </div>

        <Paragraph>
          <b>Truthfulness:</b> All reviews must be truthful and accurately
          reflect your own experiences and opinions. Fabricated or misleading
          reviews are strictly prohibited.
        </Paragraph>

        <Paragraph>
          <b>Respect:</b> Show respect towards instructors and fellow students.
          Avoid personal attacks, hate speech, or any form of harassment in your
          reviews or interactions.
        </Paragraph>

        <Paragraph>
          <b>Constructive Feedback:</b> Provide constructive feedback that can
          help improve the course and the learning experience. Share your
          thoughts, opinions, and suggestions in a respectful manner.
        </Paragraph>

        <Paragraph>
          <b>Confidentiality:</b> Do not disclose any confidential or private
          information about individuals or specific course content that may
          violate privacy or academic integrity.
        </Paragraph>

        <Paragraph>
          <b>Non-Discrimination:</b> Refrain from making discriminatory remarks
          or engaging in any form of discrimination based on race, gender,
          religion, nationality, sexual orientation, or any other protected
          characteristic.
        </Paragraph>

        <Paragraph>
          Failure to comply with these community guidelines may result in the
          removal of reviews or temporary/permanent bans from our platform. We
          reserve the right to take appropriate action as deemed necessary to
          maintain a safe and inclusive community environment. By using
          mcgill.courses, you agree to abide by these community guidelines and
          understand the consequences for violating them.
        </Paragraph>

        <div>
          <h2 className={h2}>Changes to these Terms and Conditions</h2>
          <Paragraph>
            We may update our Terms and Conditions from time to time. Thus, you
            are advised to review this page periodically for any changes. If you
            have any questions or suggestions about our Terms and Conditions, do
            not hesitate to contact us on{' '}
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
