import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function NavBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  if (!user) return null;

  return (
    <nav className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
      <Link to="/discover" className="text-xl font-bold text-purple-700">
        Lifys
      </Link>
      <div className="flex items-center gap-4 text-sm">
        <Link to="/discover">Découvrir</Link>
        <Link to="/matches">Matchs</Link>
        <span className="text-gray-500">{user.firstName}</span>
        <button type="button" onClick={handleLogout} className="text-red-600">
          Déconnexion
        </button>
      </div>
    </nav>
  );
}
