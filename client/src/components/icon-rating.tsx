type IconRatingProps = {
  rating: number;
  icon: React.ElementType;
};

export const IconRating = ({ rating, icon: Icon }: IconRatingProps) => {
  const icons = [];

  for (let i = 0; i < 5; i++) {
    icons.push(
      <Icon
        key={i}
        className={
          i < rating
            ? 'fill-red-600 stroke-none'
            : 'stroke-gray-300 dark:stroke-gray-600'
        }
        size={20}
      />
    );
  }

  return <div className='flex'>{...icons}</div>;
};
