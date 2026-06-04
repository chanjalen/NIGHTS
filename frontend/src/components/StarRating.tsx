interface StarRatingProps {
  value: number;
  max?: number;
  size?: number;
}

export default function StarRating({ value, max = 5, size = 16 }: StarRatingProps) {
  const rounded = Math.round(value);
  return (
    <span className="stars" style={{ fontSize: size }} aria-label={`${value} out of ${max} stars`}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={i < rounded ? 'star-filled' : 'star-empty'}>
          {i < rounded ? '★' : '☆'}
        </span>
      ))}
    </span>
  );
}
