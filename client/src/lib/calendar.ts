export const ICS_TIMEZONE = 'America/Toronto';

const padNumber = (value: number) => value.toString().padStart(2, '0');

const formatIcsDateTime = (date: Date) =>
  [
    date.getFullYear(),
    padNumber(date.getMonth() + 1),
    padNumber(date.getDate()),
    'T',
    padNumber(date.getHours()),
    padNumber(date.getMinutes()),
    padNumber(date.getSeconds()),
  ].join('');

const formatIcsDateTimeUTC = (date: Date) =>
  [
    date.getUTCFullYear(),
    padNumber(date.getUTCMonth() + 1),
    padNumber(date.getUTCDate()),
    'T',
    padNumber(date.getUTCHours()),
    padNumber(date.getUTCMinutes()),
    padNumber(date.getUTCSeconds()),
    'Z',
  ].join('');

const escapeIcsText = (value: string) =>
  value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');

export type IcsEventOptions = {
  start: Date;
  end?: Date | null;
  summary: string;
  description?: string | null;
  location?: string | null;
  url?: string | null;
  uid: string;
  rrule?: string;
};

type BuildIcsContentOptions = {
  events: IcsEventOptions[];
  prodId?: string;
};

export const buildIcsContent = ({
  events,
  prodId = '-//mcgill.courses//Calendar//EN',
}: BuildIcsContentOptions) => {
  if (!events.length) {
    throw new Error('buildIcsContent requires at least one event.');
  }

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${prodId}`,
    'CALSCALE:GREGORIAN',
  ];

  for (const event of events) {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${event.uid}`);
    lines.push(`DTSTAMP:${formatIcsDateTimeUTC(new Date())}`);
    lines.push(
      `DTSTART;TZID=${ICS_TIMEZONE}:${formatIcsDateTime(event.start)}`
    );

    if (event.end) {
      lines.push(`DTEND;TZID=${ICS_TIMEZONE}:${formatIcsDateTime(event.end)}`);
    }

    if (event.rrule) {
      lines.push(`RRULE:${event.rrule}`);
    }

    lines.push(`SUMMARY:${escapeIcsText(event.summary)}`);

    if (event.description) {
      lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
    }

    if (event.location) {
      lines.push(`LOCATION:${escapeIcsText(event.location)}`);
    }

    if (event.url) {
      lines.push(`URL:${escapeIcsText(event.url)}`);
    }

    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');

  return lines.join('\r\n');
};

export const downloadIcsFile = (filename: string, content: string) => {
  if (typeof window === 'undefined') return;

  const blob = new Blob([content], { type: 'text/calendar' });
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(downloadUrl);
};

export const sanitizeForFilename = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
