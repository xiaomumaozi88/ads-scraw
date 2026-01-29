import { useState, useEffect } from 'react';

export function usePlatform() {
  const [platform, setPlatform] = useState(() => {
    return localStorage.getItem('selectedPlatform') || 'insightrackr';
  });

  useEffect(() => {
    localStorage.setItem('selectedPlatform', platform);
  }, [platform]);

  return { platform, setPlatform };
}
