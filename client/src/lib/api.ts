import type { Subscription } from '../lib/types';
import type { UserResponse } from '../lib/types';
import type { Notification } from '../lib/types';
import { InteractionKind } from '../lib/types';
import type { GetReviewsPayload } from '../lib/types';
import type { GetUserInteractionForCoursePayload } from '../lib/types';
import type { GetInteractionKindPayload } from '../lib/types';
import type { GetInstructorPayload } from '../lib/types';
import type { GetCoursesPayload } from '../lib/types';
import type { GetCourseByIdPayload } from '../lib/types';
import type { SearchResults } from './search-index';

const prefix = '/api';

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

interface Params {
  [key: string]: string | number | boolean | undefined;
}

const client = {
  buildQuery(baseURL: string, params?: Params): string {
    let query = baseURL;

    if (params) {
      const keys = Object.keys(params);

      query += `?${keys
        .filter((key) => params[key] !== undefined)
        .map((key) => `${key}=${params[key]}`)
        .join('&')}`;
    }

    return query;
  },

  async get(endpoint: string, init?: RequestInit): Promise<Response> {
    return fetch(prefix + endpoint, init);
  },

  async post(endpoint: string, init?: RequestInit): Promise<Response> {
    return fetch(prefix + endpoint, {
      method: 'POST',
      ...init,
    });
  },

  async put(endpoint: string, init?: RequestInit): Promise<Response> {
    return fetch(prefix + endpoint, {
      method: 'PUT',
      ...init,
    });
  },

  async delete(endpoint: string, init?: RequestInit): Promise<Response> {
    return fetch(prefix + endpoint, {
      method: 'DELETE',
      ...init,
    });
  },

  async deserialize<T>(
    method: Method,
    endpoint: string,
    init?: RequestInit
  ): Promise<T> {
    const run = async (
      fn: (endpoint: string, init?: RequestInit) => Promise<Response>
    ): Promise<T> => (await (await fn(endpoint, init)).json()) as T;

    switch (method) {
      case 'GET':
        return run(this.get);
      case 'POST':
        return run(this.post);
      case 'PUT':
        return run(this.put);
      case 'DELETE':
        return run(this.delete);
    }
  },
};

export const api = {
  async getSubscription(courseId: string): Promise<Subscription | null> {
    return client.deserialize<Subscription | null>(
      'GET',
      `/subscriptions?course_id=${courseId}`,
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  },

  async getSubscriptions(): Promise<Subscription[]> {
    return client.deserialize<Subscription[]>('GET', '/subscriptions', {
      headers: { 'Content-Type': 'application/json' },
    });
  },

  async addSubscription(courseId: string): Promise<Response> {
    return client.post('/subscriptions', {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ course_id: courseId }),
    });
  },

  async removeSubscription(courseId: string): Promise<Response> {
    return client.delete('/subscriptions', {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ course_id: courseId }),
    });
  },

  async getReviews(params?: {
    courseId?: string;
    instructorName?: string;
    limit?: number;
    offset?: number;
    sorted?: boolean;
    userId?: string;
    withUserCount?: boolean;
  }): Promise<GetReviewsPayload> {
    return client.deserialize<GetReviewsPayload>(
      'GET',
      client.buildQuery('/reviews', {
        course_id: params?.courseId,
        instructor_name: params?.instructorName,
        limit: params?.limit,
        offset: params?.offset,
        sorted: params?.sorted,
        user_id: params?.userId,
        with_user_count: params?.withUserCount,
      })
    );
  },

  async addReview(courseId: string, values: any): Promise<Response> {
    return client.post(`/reviews`, {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        course_id: courseId,
        ...values,
      }),
    });
  },

  async updateReview(courseId: string, values: any): Promise<Response> {
    return client.put(`/reviews`, {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        course_id: courseId,
        ...values,
      }),
    });
  },

  async deleteReview(courseId: string): Promise<Response> {
    return client.delete('/reviews', {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ course_id: courseId }),
    });
  },

  async getInteractions(
    courseId: string,
    userId: string,
    referrer: string | undefined
  ): Promise<GetInteractionKindPayload> {
    return client.deserialize<GetInteractionKindPayload>(
      'GET',
      `/interactions?course_id=${courseId}&user_id=${userId}&referrer=${referrer}`
    );
  },

  async getUserInteractionsForCourse(
    courseId: string,
    referrer: string
  ): Promise<GetUserInteractionForCoursePayload> {
    return client.deserialize<GetUserInteractionForCoursePayload>(
      'GET',
      `/interactions/${courseId}/referrer/${referrer}`
    );
  },

  async addInteraction(
    kind: InteractionKind,
    courseId: string,
    userId: string,
    referrer: string | undefined
  ): Promise<Response> {
    return client.post('/interactions', {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind,
        course_id: courseId,
        user_id: userId,
        referrer,
      }),
    });
  },

  async removeInteraction(
    courseId: string,
    userId: string,
    referrer: string | undefined
  ): Promise<Response> {
    return client.delete('/interactions', {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        course_id: courseId,
        user_id: userId,
        referrer,
      }),
    });
  },

  async getNotifications(): Promise<Notification[]> {
    return client.deserialize<Notification[]>('GET', '/notifications');
  },

  async updateNotification(
    courseId: string,
    creatorId: string,
    seen: boolean
  ): Promise<Response> {
    return client.put('/notifications', {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        course_id: courseId,
        creator_id: creatorId,
        seen: seen,
      }),
    });
  },

  async deleteNotification(courseId: string): Promise<Response> {
    return client.delete('/notifications', {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ course_id: courseId }),
    });
  },

  async search(query: string): Promise<SearchResults> {
    return client.deserialize<SearchResults>(
      'GET',
      `/search?query=${encodeURIComponent(query)}`
    );
  },

  async getCourseById(
    id: string | undefined
  ): Promise<GetCourseByIdPayload | null> {
    return client.deserialize<GetCourseByIdPayload | null>(
      'GET',
      `/courses/${id}?with_reviews=true`
    );
  },

  async getCourses(
    limit: number,
    offset: number,
    withCourseCount?: boolean,
    filters?: any
  ): Promise<GetCoursesPayload> {
    return client.deserialize<GetCoursesPayload>(
      'POST',
      client.buildQuery(`/courses`, {
        limit,
        offset,
        with_course_count: withCourseCount,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(filters),
      }
    );
  },

  async getInstructor(name: string): Promise<GetInstructorPayload> {
    return client.deserialize<GetInstructorPayload>(
      'GET',
      `/instructors/${decodeURIComponent(name)}`
    );
  },

  async getUser(): Promise<UserResponse> {
    return client.deserialize<UserResponse>('GET', '/user', {
      credentials: 'include',
    });
  },
};
