import type { Course } from '../lib/types';

export type GetCoursesPayload = {
  courses: Course[];
  courseCount?: number;
};
