import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { CATEGORY_LABELS } from '../lib/categories';

interface MatchEntry {
  id: string;
  category: string;
  createdAt: string;
  user: { id: string; firstName: string };
}

export default function MatchesPage() {
  const [matches, setMatches] = useState<MatchEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/matches')
      .then((res) => setMatches(res.data))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-4 text-2xl font-bold text-purple-700">Mes matchs</h1>
      {loading && <p>Chargement...</p>}
      {!loading && matches.length === 0 && <p className="text-gray-600">Pas encore de match.</p>}
      <ul className="flex flex-col gap-3">
        {matches.map((match) => (
          <li key={match.id} className="rounded-xl border border-gray-200 p-4 shadow-sm">
            <Link to={`/messages/${match.id}`} className="flex items-center justify-between">
              <span className="font-semibold">{match.user.firstName}</span>
              <span className="text-xs text-gray-500">
                {CATEGORY_LABELS[match.category as keyof typeof CATEGORY_LABELS] ?? match.category}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
