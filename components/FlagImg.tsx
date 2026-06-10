"use client";

import { useEffect, useState } from "react";

/** flagcdn.com only serves a fixed set of widths (e.g. 160, 320) — not arbitrary sizes. */
function flagSources(code: string): string[] {
  return [
    `https://flagcdn.com/w160/${code}.png`,
    `https://flagcdn.com/w320/${code}.png`,
    `https://flagcdn.com/${code}.svg`,
  ];
}

type FlagImgProps = {
  code: string;
  size?: number;
  /** Use for always-visible flags (dropdown trigger, card). */
  priority?: boolean;
  crossOrigin?: "anonymous";
  className?: string;
};

export default function FlagImg({
  code,
  size = 36,
  priority = false,
  crossOrigin,
  className,
}: FlagImgProps) {
  const height = Math.round(size * (2 / 3));
  const sources = flagSources(code);
  const [sourceIndex, setSourceIndex] = useState(0);

  useEffect(() => {
    setSourceIndex(0);
  }, [code]);

  const src = sources[sourceIndex];
  const srcSet =
    sourceIndex === 0 ? `${sources[1]} 2x` : undefined;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={className}
      src={src}
      {...(srcSet ? { srcSet } : {})}
      alt=""
      width={size}
      height={height}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      draggable={false}
      {...(crossOrigin ? { crossOrigin } : {})}
      {...(priority ? { fetchPriority: "high" as const } : {})}
      onError={() => {
        setSourceIndex((i) => (i < sources.length - 1 ? i + 1 : i));
      }}
    />
  );
}
