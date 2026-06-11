import { ImageResponse } from "next/og";

export const alt = "Holo Card Studio — create your World Cup 2026 holographic trading card";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(145deg, #060709 0%, #10131a 42%, #060709 100%)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse 80% 60% at 50% 18%, rgba(232,200,77,.18), transparent 62%), radial-gradient(ellipse 70% 50% at 82% 88%, rgba(184,160,106,.12), transparent 58%)",
          }}
        />

        <div
          style={{
            position: "absolute",
            top: 48,
            left: 64,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <div
            style={{
              fontSize: 22,
              letterSpacing: "0.28em",
              textTransform: "uppercase",
              color: "rgba(215,219,228,.72)",
            }}
          >
            World Cup 2026
          </div>
          <div
            style={{
              fontSize: 72,
              fontWeight: 800,
              letterSpacing: "0.02em",
              textTransform: "uppercase",
              lineHeight: 0.95,
              background: "linear-gradient(165deg, #ffffff 0%, #e7ebf2 38%, #e8c84d 100%)",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            Holo Card Studio
          </div>
          <div
            style={{
              marginTop: 10,
              fontSize: 28,
              color: "rgba(238,241,246,.82)",
              maxWidth: 560,
              lineHeight: 1.35,
            }}
          >
            Design your holographic trading card. Upload a photo, pick your country, download a free holo video.
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            right: 72,
            top: "50%",
            transform: "translateY(-50%)",
            width: 280,
            height: 392,
            borderRadius: 22,
            border: "3px solid rgba(232,200,77,.55)",
            background:
              "linear-gradient(160deg, rgba(24,27,34,.95) 0%, rgba(10,11,15,.98) 55%, rgba(24,27,34,.92) 100%)",
            boxShadow:
              "0 40px 80px rgba(0,0,0,.65), 0 0 0 1px rgba(255,255,255,.06) inset, 0 0 48px rgba(232,200,77,.16)",
            display: "flex",
            flexDirection: "column",
            padding: "22px 20px",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ fontSize: 11, color: "rgba(238,241,246,.55)", letterSpacing: "0.14em" }}>
                WORLD CUP
              </div>
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 800,
                  color: "#eef1f6",
                  letterSpacing: "0.04em",
                }}
              >
                2026
              </div>
            </div>
            <div
              style={{
                width: 36,
                height: 24,
                borderRadius: 4,
                background: "linear-gradient(180deg, #ffdf00 0%, #009b3a 55%, #002776 100%)",
              }}
            />
          </div>

          <div
            style={{
              alignSelf: "center",
              width: 132,
              height: 132,
              borderRadius: "50%",
              background:
                "radial-gradient(circle at 35% 30%, rgba(255,255,255,.22), rgba(255,255,255,.04) 42%, transparent 58%), linear-gradient(135deg, rgba(232,200,77,.35), rgba(120,140,180,.25))",
              border: "2px solid rgba(255,255,255,.12)",
            }}
          />

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div
              style={{
                fontSize: 26,
                fontWeight: 800,
                color: "#eef1f6",
                letterSpacing: "0.06em",
              }}
            >
              YOUR NAME
            </div>
            <div style={{ fontSize: 13, color: "#e8c84d", fontStyle: "italic" }}>
              Vamos, Brasil!
            </div>
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            bottom: 44,
            left: 64,
            fontSize: 20,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "rgba(232,200,77,.88)",
          }}
        >
          wccard.xyz
        </div>
      </div>
    ),
    { ...size }
  );
}
