type SkeletonProps = {
  width?: number | string;
  height?: number | string;
  className?: string;
  count?: number;
};

export const Skeleton = ({
  width,
  height,
  className = '',
  count = 1,
}: SkeletonProps) => {
  return Array.from({ length: count }, (_, i) => (
    <div
      key={i}
      className={`animate-pulse bg-slate-50 dark:bg-neutral-800 ${className}`}
      style={{ width, height }}
    />
  ));
};
