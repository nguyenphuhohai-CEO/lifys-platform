export function toPublicUser(user: {
  id: string;
  firstName: string;
  age: number;
  gender?: string | null;
  bio?: string | null;
  interests?: string[];
  location?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  categories?: string[];
  verificationStatus?: string;
  photos?: unknown;
  categoryProfiles?: unknown;
  createdAt?: Date;
  updatedAt?: Date;
}) {
  return {
    id: user.id,
    firstName: user.firstName,
    age: user.age,
    gender: user.gender ?? null,
    bio: user.bio ?? null,
    interests: user.interests ?? [],
    location: user.location ?? null,
    latitude: user.latitude ?? null,
    longitude: user.longitude ?? null,
    categories: user.categories ?? [],
    verificationStatus: user.verificationStatus ?? 'UNVERIFIED',
    photos: user.photos ?? [],
    categoryProfiles: user.categoryProfiles ?? [],
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
