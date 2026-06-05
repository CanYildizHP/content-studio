import type { CSSProperties } from 'react';
import './Thumbnail.css';
import { Emphasis } from '@/components/Emphasis';
import {
  type ThumbnailProps,
  type ThumbnailFormat,
  splitTitle,
  titleFontSize,
  FORMAT_BY_ID,
  orientOf,
  DEFAULTS,
} from './thumbnail-params';

// The canonical render target. Plain server component (no hooks) so it renders
// identically in the editor preview, the headless /render route, and the
// Playwright capture. Dimensions + layout adapt to the chosen format:
//   land (1.91:1, 16:9) photo  → portrait sits in a right ~38% column
//   square / portrait    photo → portrait is full-bleed behind a scrim
// Type-only is a single text column in all formats.

const TITLE_SCALE: Record<ThumbnailFormat, number> = {
  web: 1,
  'li-square': 1.08,
  'li-portrait': 1.14,
  'x-landscape': 1.26,
};

export function Thumbnail(props: ThumbnailProps) {
  const { kicker, title, emphasis, emphasisStyle, sub, byline, mode, portrait, variant, format, align, titleSize, subSize, nameSize, roleSize } = props;
  const spec = FORMAT_BY_ID[format] ?? FORMAT_BY_ID[DEFAULTS.format];
  const orient = orientOf(spec);
  const { before, word, after } = splitTitle(title, emphasis);
  const hasPortrait = (mode === 'photo' || mode === 'sketch' || mode === 'color-image') && !!portrait;
  const fullBleed = hasPortrait && orient !== 'land';

  // title size: manual override (literal px, no format scaling) or auto (length × format scale)
  const titleStyle: CSSProperties = titleSize
    ? { ['--title-size' as string]: `${titleSize}px`, ['--title-scale' as string]: 1 }
    : { ['--title-size' as string]: `${titleFontSize(title)}px` };

  return (
    <div
      id="thumb"
      className={`thumb thumb--${variant} thumb--${mode} thumb--align-${align}`}
      data-orient={orient}
      data-format={format}
      data-fullbleed={fullBleed ? '1' : undefined}
      data-still
      style={{
        width: spec.w,
        height: spec.h,
        ['--title-scale' as string]: TITLE_SCALE[format] ?? 1,
      }}
    >
      {hasPortrait ? (
        <div className="thumb__portrait">
          {/* plain <img> (not next/image) so the capture can await decode() deterministically */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="thumb__portrait-img" src={portrait} alt="" />
        </div>
      ) : null}
      {fullBleed ? <div className="thumb__scrim" /> : null}

      <div className="thumb__col">
        <div className="thumb__kicker">{kicker}</div>

        <div className="thumb__body">
          <h1 className="thumb__title" style={titleStyle}>
            {before}
            {word &&
              (emphasisStyle === 'chromatic' ? (
                <Emphasis word={word} chromatic tone="orange" />
              ) : (
                <span className="thumb__hot">{word}</span>
              ))}
            {after}
          </h1>
          {sub ? <p className="thumb__sub" style={subSize ? { fontSize: subSize } : undefined}>{sub}</p> : null}
        </div>

        <div className="thumb__byline">
          <span className="thumb__byline-meta">
            <span className="thumb__name" style={nameSize ? { fontSize: nameSize } : undefined}>{byline.name}</span>
            <span className="thumb__role" style={roleSize ? { fontSize: roleSize } : undefined}>{byline.role}</span>
          </span>
        </div>
      </div>

      <span className="thumb__star" aria-hidden="true" />

      {mode === 'sketch' ? (
        <svg className="thumb__defs" width="0" height="0" aria-hidden="true">
          <filter id="thumb-duotone" colorInterpolationFilters="sRGB">
            {/* luminance → grayscale, then map shadows→ink (#0E0E0E) / highlights→bone (#F4F2EE) */}
            <feColorMatrix
              type="matrix"
              values="0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0 0 0 1 0"
            />
            <feComponentTransfer>
              <feFuncR type="table" tableValues="0.055 0.957" />
              <feFuncG type="table" tableValues="0.055 0.949" />
              <feFuncB type="table" tableValues="0.055 0.933" />
            </feComponentTransfer>
          </filter>
        </svg>
      ) : null}
    </div>
  );
}
