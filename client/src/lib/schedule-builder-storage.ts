const SCHEDULE_BUILDER_STORAGE_KEY = 'mcgill.courses.schedule-builder';

export type StoredTermSchedule = {
  allowConflicts: boolean;
  pinnedOptions: Record<string, string>;
  selectedCourseIds: string[];
  selectedResultId?: string;
};

export type StoredSchedule = {
  schedulesByTerm: Record<string, StoredTermSchedule>;
  selectedTerm: string;
};

const getStorage = () => {
  if (typeof window === 'undefined') return undefined;

  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readPinnedOptions = (value: unknown) =>
  isRecord(value)
    ? Object.fromEntries(
        Object.entries(value).filter(
          (entry): entry is [string, string] =>
            typeof entry[0] === 'string' && typeof entry[1] === 'string'
        )
      )
    : {};

const readSelectedCourseIds = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((value): value is string => typeof value === 'string')
    : [];

const readTermSchedule = (
  value: Record<string, unknown>
): StoredTermSchedule => ({
  allowConflicts:
    typeof value.allowConflicts === 'boolean' ? value.allowConflicts : false,
  pinnedOptions: readPinnedOptions(value.pinnedOptions),
  selectedCourseIds: readSelectedCourseIds(value.selectedCourseIds),
  selectedResultId:
    typeof value.selectedResultId === 'string'
      ? value.selectedResultId
      : undefined,
});

const readSchedulesByTerm = (value: unknown) => {
  if (!isRecord(value)) return {};

  return Object.fromEntries(
    Object.entries(value)
      .filter((entry): entry is [string, Record<string, unknown>] =>
        isRecord(entry[1])
      )
      .map(([term, schedule]) => [term, readTermSchedule(schedule)])
  );
};

export const readStoredSchedule = (
  currentTerms: readonly string[]
): StoredSchedule | undefined => {
  const storage = getStorage();

  if (storage === undefined) return undefined;

  try {
    const rawValue = storage.getItem(SCHEDULE_BUILDER_STORAGE_KEY);

    if (rawValue === null) return undefined;

    const value = JSON.parse(rawValue) as unknown;

    if (!isRecord(value)) return undefined;
    if (!isRecord(value.schedulesByTerm)) return undefined;

    const selectedTerm =
      typeof value.selectedTerm === 'string' &&
      currentTerms.includes(value.selectedTerm)
        ? value.selectedTerm
        : (currentTerms[0] ?? '');
    const schedulesByTerm = readSchedulesByTerm(value.schedulesByTerm);

    return {
      schedulesByTerm,
      selectedTerm,
    };
  } catch {
    return undefined;
  }
};

export const writeStoredSchedule = (schedule: StoredSchedule) => {
  const storage = getStorage();

  if (storage === undefined) return;

  try {
    storage.setItem(SCHEDULE_BUILDER_STORAGE_KEY, JSON.stringify(schedule));
  } catch {
    return;
  }
};
