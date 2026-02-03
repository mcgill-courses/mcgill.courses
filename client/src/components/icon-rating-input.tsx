type IconRatingInputProps = {
  name: string;
  rating: number;
  icon: React.ElementType;
  setFieldValue: (name: string, value: number) => void;
};

export const IconRatingInput = ({
  name,
  rating,
  icon: Icon,
  setFieldValue,
}: IconRatingInputProps) => {
  const icons = [];

  for (let i = 0; i < 5; i++) {
    icons.push(
      <div
        className='cursor-pointer'
        onClick={() => setFieldValue(name, i + 1)}
      >
        <Icon
          className={i < rating ? 'fill-red-500' : 'fill-gray-200'}
          id={`${name}-star-${i}`}
          key={i}
          size={22}
          strokeWidth={0}
        />
      </div>
    );
  }

  return <div className='flex'>{...icons}</div>;
};
