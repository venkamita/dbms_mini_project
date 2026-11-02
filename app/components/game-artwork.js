'use client';
import { useState } from 'react';
import Image from 'next/image';

export default function GameArtwork({ src, title, screenshot = false, hero = false, eager = false }) {
  const [failedSource, setFailedSource] = useState(null);
  const valid = typeof src === 'string' && (/^\/(?!\/)/.test(src) || /^https?:\/\//.test(src));
  if (!valid || failedSource === src) return <div className="game-mark" role="img" aria-label={`${title}: artwork unavailable`}>{title.split(' ').map(word => word[0]).slice(0, 2).join('')}</div>;
  return <Image className={screenshot ? 'game-screenshot' : 'game-cover'} src={src} alt={screenshot ? `${title} gameplay screenshot` : `${title} cover art`} width={screenshot ? 1200 : 920} height={screenshot ? 675 : 430} sizes={screenshot ? '(max-width: 800px) 100vw, 550px' : hero ? '(max-width: 800px) 100vw, 740px' : '(max-width: 600px) 100vw, (max-width: 1000px) 50vw, 360px'} loading={hero || eager ? 'eager' : 'lazy'} fetchPriority={hero || eager ? 'high' : undefined} unoptimized={!src.startsWith('/')} onError={() => setFailedSource(src)} />;
}
