import { Course } from '../model/course';

export const uniqueTermInstructors = (course: Course) => {
  const termInstructors = course.instructors.filter((i) =>
    course.terms.includes(i.term)
  );

  const unique = [];
  const filledTerms = new Set();

  for (const instructor of termInstructors) {
    if (!filledTerms.has(instructor.term)) {
      unique.push(instructor);
      filledTerms.add(instructor.term);
    }
  }

  const order = ['Fall', 'Winter', 'Summer'];
  unique.sort((a, b) => order.indexOf(a.term) - order.indexOf(b.term));

  return unique;
};
