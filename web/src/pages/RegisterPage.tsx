import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { CATEGORY_LABELS, DATING_CATEGORIES, type DatingCategory } from '../lib/categories';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [age, setAge] = useState(18);
  const [categories, setCategories] = useState<DatingCategory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function toggleCategory(category: DatingCategory) {
    setCategories((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (categories.length === 0) {
      setError('Sélectionnez au moins une catégorie.');
      return;
    }

    setLoading(true);
    try {
      await register({ email, password, firstName, age, categories });
      navigate('/discover');
    } catch {
      setError("Impossible de créer le compte. L'email est peut-être déjà utilisé.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <h1 className="mb-6 text-3xl font-bold text-purple-700">Rejoindre Lifys</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          type="text"
          required
          placeholder="Prénom"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          className="rounded-lg border border-gray-300 px-4 py-2"
        />
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-lg border border-gray-300 px-4 py-2"
        />
        <input
          type="password"
          required
          minLength={8}
          placeholder="Mot de passe (min. 8 caractères)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-lg border border-gray-300 px-4 py-2"
        />
        <label className="text-sm text-gray-600">
          Âge
          <input
            type="number"
            required
            min={18}
            value={age}
            onChange={(e) => setAge(Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-gray-300 px-4 py-2"
          />
        </label>

        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-gray-700">
            Choisissez 1 à 5 catégories
          </legend>
          <div className="flex flex-wrap gap-2">
            {DATING_CATEGORIES.map((category) => (
              <button
                type="button"
                key={category}
                onClick={() => toggleCategory(category)}
                className={`rounded-full border px-3 py-1 text-sm ${
                  categories.includes(category)
                    ? 'border-purple-600 bg-purple-600 text-white'
                    : 'border-gray-300 text-gray-700'
                }`}
              >
                {CATEGORY_LABELS[category]}
              </button>
            ))}
          </div>
        </fieldset>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-purple-600 px-4 py-2 font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
        >
          {loading ? 'Création...' : 'Créer mon compte'}
        </button>
      </form>
    </div>
  );
}
