type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rot: number;
  spin: number;
  life: number;
  ttl: number;
  wobble: number;
};

const DEFAULT_PALETTE = ["#e8c84d", "#6bbf59", "#4cc9f0"];

function runConfetti(particles: Particle[], maxFrames = 150) {
  const canvas = document.createElement("canvas");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.style.cssText =
    "position:fixed;inset:0;z-index:10000;pointer-events:none;width:100%;height:100%;";
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    canvas.remove();
    return;
  }

  let frame = 0;
  const tick = () => {
    frame += 1;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let alive = 0;
    for (const p of particles) {
      p.life += 1;
      if (p.life > p.ttl) continue;
      alive += 1;
      p.vx *= 0.992;
      p.vy += 0.09;
      p.vx += Math.sin(p.life * 0.08 + p.wobble) * 0.04;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.spin;

      const alpha = 1 - p.life / p.ttl;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.55);
      ctx.restore();
    }

    if (alive > 0 && frame < maxFrames) {
      requestAnimationFrame(tick);
    } else {
      canvas.remove();
    }
  };

  requestAnimationFrame(tick);
}

function pickColor(palette: string[]) {
  return palette[Math.floor(Math.random() * palette.length)];
}

/** Full-screen confetti shower in the selected country's kit colors. */
export function celebrateTeamConfetti(colors: string[], count = 160) {
  if (typeof window === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const palette = colors.length ? colors : DEFAULT_PALETTE;
  const w = window.innerWidth;
  const h = window.innerHeight;

  const particles: Particle[] = Array.from({ length: count }, () => ({
    x: Math.random() * w,
    y: -16 - Math.random() * h * 0.2,
    vx: (Math.random() - 0.5) * 4.2,
    vy: 1.8 + Math.random() * 3.6,
    size: 4 + Math.random() * 5,
    color: pickColor(palette),
    rot: Math.random() * Math.PI,
    spin: (Math.random() - 0.5) * 0.24,
    life: 0,
    ttl: 70 + Math.random() * 50,
    wobble: Math.random() * Math.PI * 2,
  }));

  runConfetti(particles, 180);
}

/** Small burst from a button corner — kit-colored. */
export function burstTeamConfetti(
  anchor: HTMLElement,
  colors: string[],
  count = 42
) {
  if (typeof window === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const rect = anchor.getBoundingClientRect();
  const originX = rect.right - 10;
  const originY = rect.bottom - 10;
  const palette = colors.length ? colors : DEFAULT_PALETTE;

  const particles: Particle[] = Array.from({ length: count }, () => {
    const angle = Math.PI + Math.random() * Math.PI * 0.55 + Math.PI * 0.12;
    const speed = 2.4 + Math.random() * 4.8;
    return {
      x: originX + (Math.random() - 0.5) * 10,
      y: originY + (Math.random() - 0.5) * 8,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - (1.2 + Math.random() * 2.4),
      size: 3 + Math.random() * 4.5,
      color: pickColor(palette),
      rot: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 0.28,
      life: 0,
      ttl: 52 + Math.random() * 34,
      wobble: Math.random() * Math.PI * 2,
    };
  });

  runConfetti(particles, 120);
}
