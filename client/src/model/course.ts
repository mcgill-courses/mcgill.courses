import { Instructor } from './instructor';
import { Schedule } from './schedule';

export type Course = {
  _id: string;
  title: string;
  credits: string;
  subject: string;
  code: string;
  level: string;
  url: string;
  department: string;
  faculty: string;
  facultyUrl: string;
  terms: string[];
  description: string;
  instructors: Instructor[];
  prerequisites: string[];
  corequisites: string[];
  restrictions: string;
  schedule: Schedule[];
};
