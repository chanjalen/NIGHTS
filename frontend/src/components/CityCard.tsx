import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { City } from '@/types';

interface CityCardProps {
  city: City;
}

export default function CityCard({ city }: CityCardProps) {
  return (
    <Link href={`/city/${city.slug}`} className="card city-card">
      <div className="city-card-top">
        <div className="city-card-name">
          {city.name}{city.state ? `, ${city.state}` : ''}
        </div>
        <ArrowUpRight className="city-card-arrow" size={22} />
      </div>
      <div className="city-card-count">
        <span className="city-card-num">{city.venue_count.toLocaleString()}</span>
        {city.venue_count === 1 ? 'venue' : 'venues'}
      </div>
    </Link>
  );
}
