import { useEffect, useMemo, useState } from 'react';

function getInitials(name) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

export default function Avatar({ src, alt, name, className = '' }) {
  const [hasError, setHasError] = useState(!src);

  useEffect(() => {
    setHasError(!src);
  }, [src]);

  const initials = useMemo(() => getInitials(name || 'Lifys'), [name]);

  if (!src || hasError) {
    return (
      <div className={`avatar-fallback ${className}`.trim()} aria-label={alt}>
        <span>{initials}</span>
      </div>
    );
  }

  return <img className={className} src={src} alt={alt} loading="lazy" onError={() => setHasError(true)} />;
}
