import { useState } from 'react';
import { AVATAR_FALLBACK } from '../constants';

function AvatarImage({ src, alt, className = '' }) {
  const [errored, setErrored] = useState(false);

  return (
    <img
      src={errored || !src ? AVATAR_FALLBACK : src}
      alt={alt}
      className={className}
      onError={() => setErrored(true)}
      loading="lazy"
    />
  );
}

export default AvatarImage;
