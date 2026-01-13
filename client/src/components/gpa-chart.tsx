import { useMemo } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { Grade, TermAverage } from '../lib/term-average';
import { compareTerms } from '../lib/utils';

const gradeToGPA: Record<Grade, number> = {
  A: 4.0,
  'A-': 3.7,
  'B+': 3.3,
  B: 3.0,
  'B-': 2.7,
  'C+': 2.3,
  C: 2.0,
  'C-': 1.7,
  D: 1.0,
  F: 0,
};

type GPAChartProps = {
  averages: TermAverage[];
};

type DataPoint = {
  term: string;
  shortTerm: string;
  gpa: number;
  grade: Grade;
};

const formatShortTerm = (term: string): string => {
  const [season, year] = term.split(' ');
  const seasonAbbrev = season[0];
  const yearAbbrev = year?.slice(-2) ?? '';
  return `${seasonAbbrev}${yearAbbrev}`;
};

const calculateTrendLine = (
  points: DataPoint[]
): { slope: number; intercept: number } => {
  const n = points.length;
  if (n < 2) return { slope: 0, intercept: points[0]?.gpa ?? 0 };

  const indices = points.map((_, i) => i);
  const sumX = indices.reduce((acc, x) => acc + x, 0);
  const sumY = points.reduce((acc, p) => acc + p.gpa, 0);
  const sumXY = points.reduce((acc, p, i) => acc + i * p.gpa, 0);
  const sumX2 = indices.reduce((acc, x) => acc + x * x, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  return { slope, intercept };
};

type CustomTooltipProps = {
  active?: boolean;
  payload?: Array<{ payload: DataPoint }>;
};

const CustomTooltip = ({ active, payload }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className='rounded-md border border-gray-200 bg-white px-3 py-2 shadow-lg dark:border-neutral-700 dark:bg-neutral-800'>
        <p className='font-medium text-gray-900 dark:text-gray-100'>
          {data.term}
        </p>
        <p className='text-sm text-gray-600 dark:text-gray-400'>
          Grade: <span className='font-semibold'>{data.grade}</span>
        </p>
        <p className='text-sm text-gray-600 dark:text-gray-400'>
          GPA: <span className='font-semibold'>{data.gpa.toFixed(1)}</span>
        </p>
      </div>
    );
  }
  return null;
};

export const GPAChart = ({ averages }: GPAChartProps) => {
  const dataPoints = useMemo((): DataPoint[] => {
    return [...averages]
      .sort((a, b) => compareTerms(a.term, b.term))
      .map((avg) => ({
        term: avg.term,
        shortTerm: formatShortTerm(avg.term),
        gpa: gradeToGPA[avg.average],
        grade: avg.average,
      }));
  }, [averages]);

  const trendLineData = useMemo(() => {
    if (dataPoints.length < 2) return null;

    const { slope, intercept } = calculateTrendLine(dataPoints);
    const startGPA = Math.max(0, Math.min(4, intercept));
    const endGPA = Math.max(
      0,
      Math.min(4, intercept + slope * (dataPoints.length - 1))
    );

    return dataPoints.map((point, index) => ({
      ...point,
      trend: Math.max(0, Math.min(4, intercept + slope * index)),
      trendStart: index === 0 ? startGPA : undefined,
      trendEnd: index === dataPoints.length - 1 ? endGPA : undefined,
    }));
  }, [dataPoints]);

  const chartData = trendLineData ?? dataPoints;

  return (
    <div className='w-full'>
      <ResponsiveContainer width='100%' height={220}>
        <LineChart
          data={chartData}
          margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
        >
          <CartesianGrid
            strokeDasharray='3 3'
            className='stroke-gray-200 dark:stroke-neutral-700'
          />
          <XAxis
            dataKey='shortTerm'
            tick={{ fontSize: 11 }}
            className='fill-gray-500 dark:fill-gray-400'
            tickLine={false}
            axisLine={{ className: 'stroke-gray-300 dark:stroke-neutral-600' }}
            interval={dataPoints.length > 8 ? 'equidistantPreserveStart' : 0}
          />
          <YAxis
            domain={[0, 4]}
            ticks={[0, 1, 2, 3, 4]}
            tick={{ fontSize: 11 }}
            className='fill-gray-500 dark:fill-gray-400'
            tickLine={false}
            axisLine={{ className: 'stroke-gray-300 dark:stroke-neutral-600' }}
            tickFormatter={(value) => value.toFixed(1)}
          />
          <Tooltip content={<CustomTooltip />} />

          {/* Reference lines for grade boundaries */}
          <ReferenceLine
            y={3.7}
            stroke='#22c55e'
            strokeDasharray='2 4'
            strokeOpacity={0.4}
          />
          <ReferenceLine
            y={3.0}
            stroke='#eab308'
            strokeDasharray='2 4'
            strokeOpacity={0.4}
          />
          <ReferenceLine
            y={2.0}
            stroke='#f97316'
            strokeDasharray='2 4'
            strokeOpacity={0.4}
          />

          {/* Trend line */}
          {trendLineData && (
            <Line
              type='linear'
              dataKey='trend'
              stroke='#3b82f6'
              strokeWidth={2}
              strokeDasharray='6 4'
              dot={false}
              activeDot={false}
              isAnimationActive={true}
            />
          )}

          {/* GPA line */}
          <Line
            type='monotone'
            dataKey='gpa'
            stroke='#ef4444'
            strokeWidth={2}
            dot={{
              fill: '#ef4444',
              strokeWidth: 0,
              r: 3,
            }}
            activeDot={{
              fill: '#dc2626',
              strokeWidth: 0,
              r: 5,
            }}
            isAnimationActive={true}
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className='mt-1 flex items-center justify-center gap-6 text-xs text-gray-500 dark:text-gray-400'>
        <div className='flex items-center gap-1.5'>
          <div className='h-0.5 w-5 bg-red-500' />
          <span>GPA</span>
        </div>
        {trendLineData && (
          <div className='flex items-center gap-1.5'>
            <div className='h-0.5 w-5 border-t-2 border-dashed border-blue-500' />
            <span>Trend</span>
          </div>
        )}
      </div>
    </div>
  );
};
