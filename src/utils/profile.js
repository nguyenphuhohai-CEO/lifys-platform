import { formatInterests } from './format';

export function normalizeProfileDraft(profileForm) {
  const ageInput = `${profileForm.age ?? ''}`.trim();
  const parsedAge = ageInput === '' ? null : Number(ageInput);

  const profile = {
    ...profileForm,
    name: `${profileForm.name ?? ''}`.trim(),
    city: `${profileForm.city ?? ''}`.trim(),
    bio: `${profileForm.bio ?? ''}`.trim(),
    interests: formatInterests(profileForm.interests).join(', '),
    avatar: `${profileForm.avatar ?? ''}`.trim(),
    mode: `${profileForm.mode ?? 'amoureux'}`,
    age: parsedAge === null ? '' : parsedAge,
  };

  const errors = {};
  if (!profile.name) errors.name = 'Le prénom est requis.';
  if (!profile.city) errors.city = 'La ville est requise.';
  if (!profile.bio) errors.bio = 'La bio est requise.';
  if (parsedAge === null || Number.isNaN(parsedAge) || parsedAge < 18 || parsedAge > 80) {
    errors.age = 'L’âge doit être compris entre 18 et 80 ans.';
  }

  return { profile, errors };
}
