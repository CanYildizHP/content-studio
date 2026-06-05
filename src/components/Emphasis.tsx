import React from 'react';

// Copied from can-yildiz.com (src/app/components/posts/Emphasis.tsx).
// The signature single-word flourish: Nabla COLR chromatic, per-letter slide-up.
// In a thumbnail capture the page sets [data-still] so letters render at rest.

type Tone = 'orange' | 'ink' | 'bone';

type Props = {
  word: string;
  delay?: number;
  chromatic?: boolean;
  tone?: Tone;
};

export function Emphasis({ word, delay = 0, chromatic = true, tone = 'orange' }: Props) {
  const classes = ['brand-emphasis'];
  if (chromatic) classes.push('brand-emphasis--chromatic');
  if (tone !== 'orange') classes.push(`brand-emphasis--${tone}`);
  return (
    <span
      className={classes.join(' ')}
      aria-label={word}
      style={{ ['--brand-emphasis-delay' as string]: `${delay}ms` }}
    >
      {Array.from(word).map((letter, index) => (
        <span
          key={`${letter}-${index}`}
          className="brand-emphasis__letter"
          style={{ ['--letter-index' as string]: index }}
          aria-hidden="true"
        >
          {letter}
        </span>
      ))}
    </span>
  );
}
