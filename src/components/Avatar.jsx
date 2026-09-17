import { useEffect, useState } from 'react';

function getInitials(name = 'Lifys') {
  const parts = name.split(' ').filter(Boolean).slice(0, 2);
  return parts.map((part) => part.charAt(0).toUpperCase()).join('') || 'L';
}

export default function Avatar({ src, name, className = '', altPrefix = 'Avatar de' }) {
  const [hasError, setHasError] = useState(!src);

  useEffect(() => {
    setHasError(!src);
  }, [src]);

  if (hasError) {
    return (
      <div className={`avatar-fallback ${className}`.trim()} aria-label={`${altPrefix} ${name}`} role="img">
        <span>{getInitials(name)}</span>
      </div>
    );
  }

  return (
    <img
      className={className}
      src={src}
      alt={`${altPrefix} ${name}`}
      onError={() => setHasError(true)}
    />
  );
}
