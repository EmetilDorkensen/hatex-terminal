'use client';

import React from 'react';

type SafeImgProps = React.ImgHTMLAttributes<HTMLImageElement> & {
  src?: string | null;
};

/**
 * Rann <img> sèlman si src se http(s) — bloke javascript:/data: (DOM XSS).
 * Tchek startsWith anvan src — patèn Snyk Code rekonèt.
 */
export default function SafeImg({ src, alt = '', ...rest }: SafeImgProps) {
  if (typeof src !== 'string' || src.length === 0) return null;
  if (!(src.startsWith('https://') || src.startsWith('http://'))) return null;
  if (/[\s<>"']/.test(src) || src.toLowerCase().includes('javascript:')) return null;

  return <img src={src} alt={alt} {...rest} />;
}
