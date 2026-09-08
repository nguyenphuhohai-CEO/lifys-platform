import { Link } from 'react-router-dom';
import { CATEGORY_LABELS, DATING_CATEGORIES } from '../lib/categories';

export default function HomePage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-4 text-center">
      <h1 className="mb-4 text-5xl font-bold text-purple-700">Lifys</h1>
      <p className="mb-8 text-lg text-gray-600">
        La plateforme de rencontre complète : Amical, Amoureux, Sans Lendemain, Mariage et
        Professionnel.
      </p>
      <div className="mb-8 flex flex-wrap justify-center gap-2">
        {DATING_CATEGORIES.map((category) => (
          <span key={category} className="rounded-full bg-purple-100 px-3 py-1 text-sm text-purple-700">
            {CATEGORY_LABELS[category]}
          </span>
        ))}
      </div>
      <div className="flex gap-4">
        <Link to="/login" className="rounded-lg border border-purple-600 px-6 py-2 font-semibold text-purple-700">
          Se connecter
        </Link>
        <Link to="/register" className="rounded-lg bg-purple-600 px-6 py-2 font-semibold text-white">
          S'inscrire
        </Link>
      </div>
    </div>
  );
}
