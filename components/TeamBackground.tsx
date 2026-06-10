"use client";

import { useEffect, useRef } from "react";
import { TEAMS } from "@/lib/card";

type Props = { team: string };

export default function TeamBackground({ team }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = rootRef.current;
    const kit = TEAMS[team];
    if (!el || !kit) return;

    el.style.setProperty("--kit-c1", kit.c1);
    el.style.setProperty("--kit-c2", kit.c2);
    el.style.setProperty("--kit-accent", kit.accent);

    el.classList.remove("teamBackdrop--swap");
    void el.offsetWidth;
    el.classList.add("teamBackdrop--swap");
    const id = window.setTimeout(() => el.classList.remove("teamBackdrop--swap"), 720);
    return () => clearTimeout(id);
  }, [team]);

  const kit = TEAMS[team];
  const style = kit
    ? ({
        "--kit-c1": kit.c1,
        "--kit-c2": kit.c2,
        "--kit-accent": kit.accent,
      } as React.CSSProperties)
    : undefined;

  return (
    <div ref={rootRef} className="teamBackdrop" style={style} aria-hidden>
      <div className="teamBackdropBlobs">
        <div className="teamBackdropBlobInner" />
      </div>
    </div>
  );
}
