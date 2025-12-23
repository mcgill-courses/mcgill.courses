import type { Review } from '../lib/types';
import type { Course } from '../lib/types';

export type GetCourseWithReviewsPayload = {
  course: Course;
  reviews: Review[];
};
