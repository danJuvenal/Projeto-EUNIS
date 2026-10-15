export type MediaType = 'movie' | 'tv'

export interface GenreRef {
  slug: string
  name: string
}

export interface PublicUser {
  id: number
  username: string
  name: string
  bio: string
  avatar_hue: number
  plan: string
  is_demo: boolean
  online: boolean
  joined_at: string | null
}

export interface Me extends PublicUser {
  email: string
  show_online: boolean
  onboarded: boolean
  favorite_genres: GenreRef[]
}

export interface TitleSummary {
  id: number
  source: 'demo' | 'tmdb'
  media_type: MediaType
  title: string
  year: number | null
  poster_url: string | null
  backdrop_url: string | null
  palette: string[]
  genres: GenreRef[]
  tmdb_rating: number | null
  overview: string
  community: { count: number; avg: number | null }
  /** Presente quando há usuário logado. */
  library?: LibraryState
}

export interface LibraryState {
  watchlist: boolean
  watched: boolean
  favorite: boolean
  watched_at: string | null
}

export interface Review {
  id: number
  rating: number | null
  body: string
  spoilers: boolean
  created_at: string
  updated_at: string
  edited: boolean
  user: PublicUser
  title_id: number
  likes: number
  liked: boolean
  comments: number
  is_mine: boolean
  title?: TitleSummary
}

export interface TitleDetail extends TitleSummary {
  original_title: string | null
  overview: string
  runtime_min: number | null
  seasons: number | null
  director: string | null
  cast: string[]
  themes: string[]
  country: string | null
  tmdb_votes: number | null
  stats: {
    ratings: number
    avg: number | null
    distribution: Record<string, number>
    reviews: number
    watched: number
  }
  mine: { library: LibraryState; review: Review | null } | null
}

export interface Comment {
  id: number
  body: string
  created_at: string
  user: PublicUser
  is_mine: boolean
}

export interface ListSummary {
  id: number
  name: string
  description: string
  is_public: boolean
  created_at: string
  updated_at: string
  user: PublicUser
  count: number
  covers: TitleSummary[]
  is_mine: boolean
  has_title?: boolean
  items?: TitleSummary[]
}

export type ActivityKind =
  | 'review'
  | 'watched'
  | 'watchlist'
  | 'favorite'
  | 'list_created'
  | 'list_item'
  | 'follow'

export interface Activity {
  id: number
  kind: ActivityKind
  created_at: string
  user: PublicUser
  title: TitleSummary | null
  review: Review | null
  list: { id: number; name: string } | null
  target_user: PublicUser | null
}

export interface Profile extends PublicUser {
  last_seen_at: string | null
  stats: { watched: number; reviews: number; lists: number; followers: number; following: number }
  favorites: { movies: TitleSummary[]; series: TitleSummary[] }
  taste: { slug: string; name: string; count: number; share: number }[]
  is_me: boolean
  followed_by_me: boolean
  follows_me: boolean
}

export interface Compat {
  score: number | null
  enough_data: boolean
  co_rated: number
  min_co_rated: number
  rating_similarity: number | null
  genre_similarity: number | null
  shared_genres: string[]
  shared: { title_id: number; title: string; a: number; b: number }[]
}

export interface PresenceUser {
  user: Pick<PublicUser, 'id' | 'username' | 'name' | 'avatar_hue' | 'is_demo'>
  activity: { kind: string; label: string; title_id?: number }
  online_for_s: number
}

export interface MatchCard extends TitleSummary {
  overview: string
  reasons: string[]
}

export interface Paged<T> {
  results: T[]
  page?: number
  total_pages?: number
  source?: 'demo' | 'tmdb'
}
