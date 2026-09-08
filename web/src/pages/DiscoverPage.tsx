import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { CATEGORY_LABELS, DATING_CATEGORIES, type DatingCategory } from '../lib/categories';
import { useAuth } from '../context/AuthContext';

interface Candidate {
  id: string;
  firstName: string;
  age: number;
  bio: string | null;
  photos: { id: string; url: string }[];
}

export default function DiscoverPage() {
  const { user } = useAuth();
  const defaultCategory = (user?.categories[0] as DatingCategory) || 'AMICAL';
  const [category, setCategory] = useState<DatingCategory>(defaultCategory);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .get('/discover', { params: { category } })
      .then((res) => {
        if (!cancelled) setCandidates(res.data);
      })
      .catch(() => {
        if (!cancelled) setError('Impossible de charger les profils.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [category]);

  async function act(userId: string, action: 'like' | 'super-like' | 'pass') {
    setFeedback(null);
    if (action === 'pass') {
      setCandidates((prev) => prev.filter((c) => c.id !== userId));
      return;
    }

    const path = action === 'like' ? `/likes/${userId}` : `/super-likes/${userId}`;
    try {
      const res = await api.post(path, { category });
      setCandidates((prev) => prev.filter((c) => c.id !== userId));
      setFeedback(res.data.match ? "C'est un match ! 🎉" : 'Like envoyé.');
    } catch {
      setFeedback("Une erreur est survenue.");
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-4 text-2xl font-bold text-purple-700">Découvrir</h1>
      <div className="mb-6 flex flex-wrap gap-2">
        {DATING_CATEGORIES.map((c) => (
          <button
            type="button"
            key={c}
            onClick={() => setCategory(c)}
            className={`rounded-full border px-3 py-1 text-sm ${
              category === c ? 'border-purple-600 bg-purple-600 text-white' : 'border-gray-300 text-gray-700'
            }`}
          >
            {CATEGORY_LABELS[c]}
          </button>
        ))}
      </div>

      {feedback && <p className="mb-4 text-sm font-medium text-purple-700">{feedback}</p>}
      {loading && <p>Chargement des profils...</p>}
      {error && <p className="text-red-600">{error}</p>}
      {!loading && !error && candidates.length === 0 && (
        <p className="text-gray-600">Aucun profil disponible pour cette catégorie.</p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {candidates.map((candidate) => (
          <div key={candidate.id} className="rounded-xl border border-gray-200 p-4 shadow-sm">
            <h2 className="text-lg font-semibold">
              {candidate.firstName}, {candidate.age}
            </h2>
            <p className="mt-1 text-sm text-gray-600">{candidate.bio}</p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => act(candidate.id, 'pass')}
                className="rounded-lg bg-gray-100 px-3 py-1 text-sm text-gray-700"
              >
                Passer
              </button>
              <button
                type="button"
                onClick={() => act(candidate.id, 'like')}
                className="rounded-lg bg-pink-500 px-3 py-1 text-sm font-semibold text-white"
              >
                J'aime
              </button>
              <button
                type="button"
                onClick={() => act(candidate.id, 'super-like')}
                className="rounded-lg bg-blue-500 px-3 py-1 text-sm font-semibold text-white"
              >
                Super Like
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
