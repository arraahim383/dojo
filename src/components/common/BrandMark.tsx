import React from 'react';

export const BrandMark: React.FC<{ className?: string }> = ({ className = 'h-10 w-10' }) => (
  <svg className={className} viewBox="0 0 48 48" role="img" aria-label="Daba Dojo">
    <rect width="48" height="48" rx="14" fill="#173d32" />
    <path d="M10 16.5c5.9-2.2 10.7-1.5 14 2v17c-3.4-3.2-8.1-4-14-2.1v-16.9Zm28 0c-5.9-2.2-10.7-1.5-14 2v17c3.4-3.2 8.1-4 14-2.1v-16.9Z" fill="#f3eedf" />
    <path d="M24 18.8v16.7M14.3 21.6c2.3-.3 4.6.1 6.4 1.1M33.7 21.6c-2.3-.3-4.6.1-6.4 1.1" fill="none" stroke="#173d32" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M17 12.4h14" fill="none" stroke="#d7b56d" strokeWidth="2.4" strokeLinecap="round" />
    <circle cx="24" cy="11.5" r="2.2" fill="#d7b56d" />
  </svg>
);
