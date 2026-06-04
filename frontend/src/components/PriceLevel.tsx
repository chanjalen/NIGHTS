interface PriceLevelProps {
  level: 1 | 2 | 3 | 4 | null;
}

export default function PriceLevel({ level }: PriceLevelProps) {
  if (level === null || level === undefined) return null;
  const labels = ['$', '$$', '$$$', '$$$$'];
  return (
    <span className="price-level" aria-label={`Price level ${level} out of 4`}>
      {Array.from({ length: 4 }, (_, i) => (
        <span key={i} className={i < level ? 'price-active' : 'price-inactive'}>
          $
        </span>
      ))}
    </span>
  );
}
