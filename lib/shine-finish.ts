import type { Finish, Shine } from "./card";

/** Per-shine foil tuning — intensity matches rainbow; gradients differ in CSS. */
const SHINE_STRENGTH = {
  opMul: 1,
  holo2OpMul: 1,
  brightMul: 1,
  satMul: 1,
  hueMul: 1,
  idleGlow: 0.18,
} as const;

export const SHINE_TUNING: Record<
  Shine,
  {
    opMul: number;
    holo2OpMul: number;
    brightMul: number;
    satMul: number;
    hueMul: number;
    idleGlow: number;
  }
> = {
  rainbow: { ...SHINE_STRENGTH },
  diamond: { ...SHINE_STRENGTH },
  sapphire: { ...SHINE_STRENGTH },
  emerald: { ...SHINE_STRENGTH },
  ruby: { ...SHINE_STRENGTH },
};

/** Gloss vs matte holo layer intensity. */
export const FINISH_TUNING: Record<
  Finish,
  {
    pointerGlowMin: number;
    pointerGlowRange: number;
    idleGlow: number;
    holoBase: number;
    holoRange: number;
    holo2Base: number;
    holo2Range: number;
    glareBase: number;
    glareRange: number;
    holoBrightBase: number;
    holoBrightRange: number;
    holoSat: number;
    holoHueMul: number;
    sweepOpacity: number;
  }
> = {
  gloss: {
    pointerGlowMin: 0.4,
    pointerGlowRange: 0.48,
    idleGlow: 0.18,
    holoBase: 0.16,
    holoRange: 0.336,
    holo2Base: 0.04,
    holo2Range: 0.224,
    glareBase: 0.18,
    glareRange: 0.44,
    holoBrightBase: 0.22,
    holoBrightRange: 0.496,
    holoSat: 1.4,
    holoHueMul: 1,
    sweepOpacity: 0.55,
  },
  matte: {
    pointerGlowMin: 0.14,
    pointerGlowRange: 0.24,
    idleGlow: 0.14,
    holoBase: 0.14,
    holoRange: 0.2,
    holo2Base: 0.04,
    holo2Range: 0.14,
    glareBase: 0.06,
    glareRange: 0.16,
    holoBrightBase: 0.5,
    holoBrightRange: 0.38,
    holoSat: 1.08,
    holoHueMul: 0.45,
    sweepOpacity: 0.22,
  },
};

export function buildShineFinishVars(shine: Shine, finish: Finish) {
  const s = SHINE_TUNING[shine];
  const f = FINISH_TUNING[finish];
  return {
    "--shineOpMul": s.opMul,
    "--shineHolo2OpMul": s.holo2OpMul,
    "--shineBrightMul": s.brightMul,
    "--shineSatMul": s.satMul,
    "--shineHueMul": s.hueMul,
    "--finishHoloBase": f.holoBase,
    "--finishHoloRange": f.holoRange,
    "--finishHolo2Base": f.holo2Base,
    "--finishHolo2Range": f.holo2Range,
    "--finishGlareBase": f.glareBase,
    "--finishGlareRange": f.glareRange,
    "--finishHoloBrightBase": f.holoBrightBase,
    "--finishHoloBrightRange": f.holoBrightRange,
    "--finishHoloSat": f.holoSat,
    "--finishHoloHueMul": f.holoHueMul,
    "--finishSweepOpacity": f.sweepOpacity,
  } as const;
}

export function pointerGlow(finish: Finish, gloss: number) {
  const f = FINISH_TUNING[finish];
  return f.pointerGlowMin + gloss * f.pointerGlowRange;
}

export function idleGlow(shine: Shine, finish: Finish) {
  if (finish === "matte") {
    return FINISH_TUNING.matte.idleGlow;
  }
  return SHINE_TUNING[shine].idleGlow;
}
