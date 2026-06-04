export interface City {
  id: string;
  name: string;
  slug: string;
  lat: number;
  lng: number;
  venue_count: number;
}

export interface Venue {
  id: string;
  name: string;
  slug: string;
  city_name: string;
  city_slug: string;
  neighborhood: string | null;
  overall_rating: string;
  total_ratings: number;
  price_level: 1 | 2 | 3 | 4 | null;
  music_tags: string[];
  crowd_tags: string[];
  photo_url: string | null;
  active_checkin_count: number;
}

export interface VenueDetail extends Venue {
  address: string;
  lat: number;
  lng: number;
  typical_cover: number | null;
  timezone: string;
}

export interface RatingMedia {
  id: string;
  media_type: 'image' | 'video';
  status: 'processing' | 'ready' | 'removed' | 'failed';
  file_url: string;
  thumbnail_url: string;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
}

export interface Rating {
  id: string;
  user_display_name: string;
  user_avatar_url: string | null;
  overall: number;
  day_of_week: string | null;
  price_level: 1 | 2 | 3 | 4 | null;
  music_tags: string[];
  crowd_tags: string[];
  has_cover: boolean | null;
  cover_amount: number | null;
  would_go_back: boolean | null;
  comment: string | null;
  media: RatingMedia[];
  checkin_verified: boolean;
  created_at: string;
}
