import { cleanup, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Operator } from '../lib/types';
import type { Course } from '../lib/types';
import { CourseGraph } from './course-graph';

const navigateMock = vi.fn();
const darkModeState = { value: false };
const setDarkModeMock = vi.fn();
const focusMock = vi.fn();
const setOptionsMock = vi.fn();

let latestVisProps: any;

vi.mock('react-router-dom', async () => {
  const actual =
    await vi.importActual<typeof import('react-router-dom')>(
      'react-router-dom'
    );

  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('react-vis-graph-wrapper', () => {
  const MockVisGraph = (props: any) => {
    latestVisProps = props;

    props.getNetwork?.({
      focus: focusMock,
      setOptions: setOptionsMock,
    });

    return <div data-testid='vis-graph-mock' />;
  };

  return {
    __esModule: true,
    default: MockVisGraph,
  };
});

vi.mock('../hooks/use-dark-mode', () => ({
  useDarkMode: () => [darkModeState.value, setDarkModeMock] as const,
}));

const baseCourse: Course = {
  _id: 'COMP202',
  title: 'Foundations of Programming',
  credits: '3',
  subject: 'COMP',
  code: '202',
  url: '',
  department: 'Computer Science',
  faculty: 'Science',
  terms: [],
  description: 'Learn programming basics.',
  instructors: [],
  prerequisites: [],
  corequisites: [],
  logicalPrerequisites: {
    type: 'group',
    data: {
      operator: Operator.And,
      groups: [
        { type: 'course', data: 'MATH 133' },
        {
          type: 'group',
          data: {
            operator: Operator.Or,
            groups: [
              { type: 'course', data: 'COMP 101' },
              { type: 'course', data: 'COMP 102' },
            ],
          },
        },
      ],
    },
  },
  logicalCorequisites: { type: 'course', data: 'PHYS 101' },
  leadingTo: ['COMP303'],
  restrictions: '',
  schedule: [],
  avgRating: 0,
  avgDifficulty: 0,
  reviewCount: 0,
};

describe('CourseGraph', () => {
  beforeEach(() => {
    latestVisProps = undefined;
    darkModeState.value = false;
    focusMock.mockClear();
    setOptionsMock.mockClear();
    navigateMock.mockClear();
    setDarkModeMock.mockClear();
    cleanup();
  });

  it('builds the graph data and focuses the active course on mount', () => {
    render(<CourseGraph course={baseCourse} />);

    const nodes = latestVisProps.graph.nodes;
    const edges = latestVisProps.graph.edges;

    expect(nodes.find((node: any) => node.id === 'COMP202')).toMatchObject({
      label: 'COMP 202',
      title: 'Learn programming basics.',
    });

    expect(nodes.find((node: any) => node.id === 'MATH 133')).toMatchObject({
      color: 'rgb(252 165 165)',
    });

    expect(nodes.find((node: any) => node.id === 'COMP 303')).toBeDefined();

    expect(nodes.find((node: any) => node.label === 'AND')).toMatchObject({
      shape: 'hexagon',
    });

    expect(nodes.find((node: any) => node.id === 'PHYS 101')).toMatchObject({
      color: 'rgb(134 239 172)',
    });

    expect(edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ to: 'COMP202' }),
        expect.objectContaining({ from: 'COMP202', to: 'COMP 303' }),
      ])
    );

    expect(focusMock).toHaveBeenCalledWith(
      'COMP202',
      expect.objectContaining({
        scale: 0.7,
        offset: expect.objectContaining({ x: 60, y: 0 }),
      })
    );

    expect(setOptionsMock).toHaveBeenCalled();
  });

  it('navigates when a course node is selected', () => {
    render(<CourseGraph course={baseCourse} />);

    latestVisProps.events.select?.({ nodes: ['MATH 133'] });

    expect(navigateMock).toHaveBeenCalledWith('/course/math-133');
  });

  it('updates the network options when the dark mode value changes', () => {
    const { rerender } = render(<CourseGraph course={baseCourse} />);

    setOptionsMock.mockClear();

    darkModeState.value = true;

    rerender(<CourseGraph course={{ ...baseCourse }} />);

    expect(setOptionsMock).toHaveBeenCalledWith({
      edges: { color: '#919191' },
      nodes: {
        color: 'rgb(212 212 212)',
        font: { color: '#FFFFFF' },
      },
    });
  });
});
