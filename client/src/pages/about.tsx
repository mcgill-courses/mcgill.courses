import { Disclosure } from '@headlessui/react';
import { AnimatePresence, m } from 'framer-motion';
import {
  ChevronDown,
  ExternalLink,
  GitBranch,
  Mail,
  MessageCircle,
} from 'lucide-react';
import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';

import McGillDesignConsultancyLogoUrl from '../assets/mcgill-design-consultancy.png';
import jeffImageUrl from '../assets/team/jeff.jpg';
import joeyImageUrl from '../assets/team/joey.jpg';
import liamImageUrl from '../assets/team/liam.jpg';
import samImageUrl from '../assets/team/sam.jpg';
import { Layout } from '../components/layout';

type Question = {
  title: string;
  content: React.ReactNode;
};

type PersonLink = {
  title: string;
  url: string;
};

type PersonProps = {
  name: string;
  imageUrl: string;
  links?: PersonLink[];
};

type ContactLink = {
  icon: React.ElementType;
  href: string;
  label: string;
  text: string;
};

const questions = [
  {
    title: 'How do we ensure review legitimacy?',
    content:
      'We require authentication with McGill email addresses via Microsoft Office 365, ensuring that only verified McGill students can submit reviews.',
  },
  {
    title: 'When will instructor ratings be available?',
    content:
      "Instructor ratings are currently our top priority and are in active development. We'll announce their availability as soon as they're ready!",
  },
  {
    title: 'Are there other similar tools for McGill students?',
    content: (
      <p>
        Yes. We encourage you to explore other student-made tools like{' '}
        <TextLink href='https://cloudberry.fyi'>cloudberry.fyi</TextLink> and{' '}
        <TextLink href='https://demetrios-koziris.github.io/McGillEnhanced/support'>
          McGill Enhanced
        </TextLink>
        .
      </p>
    ),
  },
];

const people = [
  {
    name: "Liam Scalzulli (CS '2025)",
    imageUrl: liamImageUrl,
    links: [
      { title: 'Github', url: 'https://github.com/terror' },
      { title: 'Linkedin', url: 'https://www.linkedin.com/in/liamscalzulli/' },
    ],
  },
  {
    name: "Jeff Zhang (Hons CS '2026)",
    imageUrl: jeffImageUrl,
    links: [
      { title: 'Github', url: 'https://github.com/39bytes' },
      { title: 'LinkedIn', url: 'https://www.linkedin.com/in/jeff-zhang72/' },
    ],
  },
  {
    name: "Sam Zhang (CS '2026)",
    imageUrl: samImageUrl,
    links: [{ title: 'Github', url: 'https://github.com/samzhang02' }],
  },
  {
    name: "Joey Yu (CS '2026)",
    imageUrl: joeyImageUrl,
    links: [{ title: 'Github', url: 'https://github.com/itsjoeoui' }],
  },
];

const contactLinks: ContactLink[] = [
  {
    icon: GitBranch,
    href: 'https://www.github.com/terror/mcgill.courses',
    label: 'GitHub',
    text: 'View the repository',
  },
  {
    icon: MessageCircle,
    href: 'https://discord.gg/d67aYpC7',
    label: 'Discord',
    text: 'Join the community',
  },
  {
    icon: Mail,
    href: 'mailto:admin@mcgill.courses',
    label: 'Email',
    text: 'Send feedback',
  },
];

const fadeInUp = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0 },
};

function TextLink({
  children,
  href,
}: {
  children: React.ReactNode;
  href: string;
}) {
  return (
    <a
      className='hover:text-mcgill-red hover:decoration-mcgill-red font-medium text-gray-950 underline decoration-slate-300 underline-offset-4 transition dark:text-gray-100 dark:decoration-neutral-600'
      href={href}
      target='_blank'
      rel='noopener noreferrer'
    >
      {children}
    </a>
  );
}

const SectionTitle = ({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: React.ReactNode;
}) => {
  return (
    <div>
      <p className='text-mcgill-red text-sm font-semibold tracking-wide uppercase'>
        {eyebrow}
      </p>
      <h2 className='mt-2 text-2xl font-bold text-gray-950 sm:text-3xl dark:text-gray-100'>
        {title}
      </h2>
      {children && (
        <p className='mt-3 max-w-2xl text-sm leading-6 text-gray-600 md:text-base dark:text-gray-400'>
          {children}
        </p>
      )}
    </div>
  );
};

const Person = ({ name, imageUrl, links }: PersonProps) => {
  return (
    <div className='group rounded-lg bg-white p-4 dark:bg-neutral-900'>
      <div className='flex items-center gap-4'>
        <img
          className='size-20 rounded-full object-cover ring-4 ring-slate-100 transition group-hover:ring-slate-200 dark:ring-neutral-900 dark:group-hover:ring-neutral-700'
          src={imageUrl}
          alt={name}
        />
        <div className='min-w-0'>
          <h3 className='text-base font-semibold text-gray-950 dark:text-gray-100'>
            {name}
          </h3>
          {links && (
            <div className='mt-2 flex flex-wrap gap-2'>
              {links.map((link) => (
                <a
                  key={link.url}
                  target='_blank'
                  rel='noopener noreferrer'
                  href={link.url}
                  className='hover:text-mcgill-red inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-gray-600 transition hover:border-slate-300 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 dark:border-neutral-700 dark:bg-neutral-900/60 dark:text-gray-300 dark:hover:border-neutral-600 dark:hover:bg-neutral-900'
                >
                  {link.title}
                  <ExternalLink className='size-3' aria-hidden='true' />
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const Questions = ({ input }: { input: Question[] }) => {
  return (
    <div className='space-y-3'>
      {input.map((item) => (
        <Disclosure as='div' key={item.title}>
          {({ open }) => (
            <div className='overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-neutral-700 dark:bg-neutral-800'>
              <Disclosure.Button className='flex w-full cursor-pointer items-center justify-between gap-4 px-4 py-3 text-left text-sm font-semibold text-gray-800 transition hover:bg-slate-50 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 sm:px-5 dark:text-gray-200 dark:hover:bg-neutral-700'>
                <span>{item.title}</span>
                <m.div
                  animate={{ rotate: open ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronDown
                    className='size-4 text-gray-500 dark:text-gray-400'
                    aria-hidden='true'
                  />
                </m.div>
              </Disclosure.Button>
              <AnimatePresence initial={false}>
                {open && (
                  <m.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                  >
                    <Disclosure.Panel
                      static
                      className='border-t border-slate-200 px-4 py-4 text-sm leading-6 text-gray-600 sm:px-5 dark:border-neutral-700 dark:text-gray-300'
                    >
                      {item.content}
                    </Disclosure.Panel>
                  </m.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </Disclosure>
      ))}
    </div>
  );
};

export const About = () => {
  return (
    <Layout>
      <Helmet>
        <title>About - mcgill.courses</title>
        <meta property='og:type' content='website' />
        <meta property='og:url' content='https://mcgill.courses/about' />
        <meta property='og:title' content='About - mcgill.courses' />
        <meta property='twitter:url' content='https://mcgill.courses/about' />
        <meta property='twitter:title' content='About - mcgill.courses' />
      </Helmet>

      <m.div
        initial='hidden'
        animate='visible'
        variants={{
          visible: {
            transition: {
              staggerChildren: 0.08,
            },
          },
        }}
        className='mx-auto max-w-5xl px-2 py-10 sm:px-4 lg:py-14'
      >
        <m.section
          variants={fadeInUp}
          className='grid gap-6 pt-4 lg:grid-cols-[0.8fr_1.2fr] lg:gap-10'
        >
          <div>
            <p className='text-mcgill-red text-sm font-semibold tracking-wide uppercase'>
              About
            </p>
            <h1 className='mt-3 text-3xl leading-tight font-bold text-gray-950 sm:text-4xl dark:text-gray-100'>
              Built for better course decisions
            </h1>
          </div>

          <div className='space-y-4 text-base leading-7 text-gray-700 dark:text-gray-200'>
            <p>
              <Link
                className='hover:text-mcgill-red hover:decoration-mcgill-red font-medium text-gray-950 underline decoration-slate-300 underline-offset-4 transition dark:text-gray-100 dark:decoration-neutral-600'
                to='/'
              >
                mcgill.courses
              </Link>{' '}
              began in{' '}
              <TextLink href='https://github.com/terror/mcgill.courses/commit/45268b4e39801a4d9531d7b8ad5654fcca5bb01d'>
                March 2023
              </TextLink>{' '}
              as a student-built hub for{' '}
              <TextLink href='https://www.mcgill.ca/'>
                McGill University
              </TextLink>{' '}
              course information and reviews. The goal has stayed the same: make
              course planning feel less opaque by putting practical student
              context in one place.
            </p>
            <p>
              Since then, it has grown through steady work from developers,
              designers, and contributors into an independent platform for
              course reviews, instructor feedback, and academic planning tools.
            </p>
            <p className='border-l-2 border-slate-300 pl-4 text-sm leading-6 text-gray-600 dark:border-neutral-700 dark:text-gray-400'>
              mcgill.courses is an independent initiative and is not affiliated
              with McGill University.
            </p>
            <Link
              to='/changelog'
              className='hover:text-mcgill-red mt-5 inline-flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-gray-700 transition hover:border-slate-300 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 dark:border-neutral-700 dark:bg-neutral-900/60 dark:text-gray-300 dark:hover:border-neutral-600 dark:hover:bg-neutral-900'
            >
              See the changelog
              <ExternalLink className='size-4' aria-hidden='true' />
            </Link>
          </div>
        </m.section>

        <m.section variants={fadeInUp} className='mt-14'>
          <SectionTitle
            eyebrow='Team'
            title='Meet the people behind the project'
          />
          <div className='mt-6 grid gap-4 sm:grid-cols-2'>
            {people.map((person) => (
              <Person key={person.name} {...person} />
            ))}
          </div>
        </m.section>

        <m.section
          variants={fadeInUp}
          className='mt-14 grid gap-6 lg:grid-cols-[0.85fr_1.15fr]'
        >
          <div>
            <SectionTitle eyebrow='Contributors' title='Logo design support'>
              Visual details matter too, and the site has benefited from design
              help beyond code.
            </SectionTitle>
          </div>
          <div className='flex flex-col gap-5 sm:flex-row sm:items-center'>
            <a
              href='https://www.instagram.com/mcgilldesignconsultancy'
              className='flex size-20 shrink-0 items-center justify-center rounded-lg bg-slate-50 ring-1 ring-slate-200 transition hover:ring-slate-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 dark:bg-neutral-900/60 dark:ring-neutral-700 dark:hover:ring-neutral-600'
              target='_blank'
              rel='noopener noreferrer'
              aria-label='McGill Design Consultancy'
            >
              <img
                src={McGillDesignConsultancyLogoUrl}
                className='size-14 object-contain'
                alt=''
              />
            </a>
            <p className='text-base leading-7 text-gray-700 dark:text-gray-200'>
              Thank you to <span className='font-medium'>Sebastien Chow</span>{' '}
              and{' '}
              <TextLink href='https://www.linkedin.com/in/guo-eugene/'>
                Eugene Guo
              </TextLink>{' '}
              from{' '}
              <TextLink href='https://www.instagram.com/mcgilldesignconsultancy'>
                McGill Design Consultancy
              </TextLink>{' '}
              for their work on the logo design.
            </p>
          </div>
        </m.section>

        <m.section
          variants={fadeInUp}
          className='mt-14 grid gap-6 lg:grid-cols-[0.85fr_1.15fr]'
        >
          <SectionTitle eyebrow='FAQ' title='Frequently asked questions'>
            A few details about review trust, upcoming ratings, and other
            student-built McGill tools.
          </SectionTitle>
          <Questions input={questions} />
        </m.section>

        <m.section
          variants={fadeInUp}
          className='mt-14 grid gap-6 lg:grid-cols-[0.85fr_1.15fr]'
        >
          <SectionTitle eyebrow='Contact' title='Get in touch'>
            Feedback, questions, and contributions are welcome.
          </SectionTitle>
          <div className='grid gap-3 sm:grid-cols-3'>
            {contactLinks.map(({ icon: Icon, href, label, text }) => (
              <a
                key={label}
                target='_blank'
                rel='noopener noreferrer'
                href={href}
                className='group flex min-h-32 flex-col justify-between rounded-lg border border-slate-200 bg-slate-50 p-4 transition hover:border-slate-300 hover:bg-white hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 dark:border-neutral-700 dark:bg-neutral-900/60 dark:hover:border-neutral-600 dark:hover:bg-neutral-900'
              >
                <Icon
                  className='group-hover:text-mcgill-red size-6 text-gray-500 transition dark:text-gray-400'
                  aria-hidden='true'
                />
                <span>
                  <span className='block text-sm font-semibold text-gray-950 dark:text-gray-100'>
                    {label}
                  </span>
                  <span className='mt-1 block text-sm leading-5 text-gray-600 dark:text-gray-400'>
                    {text}
                  </span>
                </span>
              </a>
            ))}
          </div>
        </m.section>
      </m.div>
    </Layout>
  );
};
