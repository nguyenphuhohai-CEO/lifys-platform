import React, { useEffect, useMemo, useState } from 'react';

function Avatar({ src, alt, fallback, className = '' }) {
  const [hasError, setHasError] = useState(false);
  const initials = useMemo(() => (
    `${fallback ?? alt ?? '?'}`
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((item) => item.charAt(0).toUpperCase())
      .join('')
      || 'LF'
  ), [alt, fallback]);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  if (!src || hasError) {
    return <div className={`avatar-fallback ${className}`.trim()} aria-label={alt}>{initials}</div>;
  }

  return <img className={className} src={src} alt={alt} onError={() => setHasError(true)} />;
}

export default Avatar;
