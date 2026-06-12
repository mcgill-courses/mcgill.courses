export const SCHEDULE_BUILDER_STORAGE_KEY = 'mcgill.courses.schedule-builder';

export type StoredSchedule = {
  selectedCourseIds: string[];
  selectedResultId?: string;
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

    return {
      selectedCourseIds: Array.isArray(value.selectedCourseIds)
        ? value.selectedCourseIds.filter(
            (value): value is string => typeof value === 'string'
          )
        : [],
      selectedResultId:
        typeof value.selectedResultId === 'string'
          ? value.selectedResultId
          : undefined,
      selectedTerm:
        typeof value.selectedTerm === 'string' &&
        currentTerms.includes(value.selectedTerm)
          ? value.selectedTerm
          : (currentTerms[0] ?? ''),
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
