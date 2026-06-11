"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import HoloCard from "@/components/HoloCard";
import BuyCardPanel from "@/components/BuyCardPanel";
import TeamBackground from "@/components/TeamBackground";
import {
  TEAMS,
  TEAM_NAMES,
  STYLES,
  SHINES,
  FINISHES,
  type CardStyle,
  type Shine,
  type Finish,
} from "@/lib/card";
import { removePhotoBackground } from "@/lib/removeBackground";
import { CARD_BUILD_MESSAGES } from "@/lib/cardBuildMessages";

import FlagImg from "@/components/FlagImg";

export default function Home() {
  const [name, setName] = useState("");
  const [team, setTeam] = useState("Brazil");
  const [cardStyle, setCardStyle] = useState<CardStyle>("prizm");
  const [shine, setShine] = useState<Shine>("rainbow");
  const [finish, setFinish] = useState<Finish>("gloss");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoCutout, setPhotoCutout] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [photoProgress, setPhotoProgress] = useState(0);
  const [buildMsgIdx, setBuildMsgIdx] = useState(0);
  const [countryOpen, setCountryOpen] = useState(false);
  const [countryQuery, setCountryQuery] = useState("");

  const objectUrlRef = useRef<string | null>(null);
  const processGenRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const countryDropdownRef = useRef<HTMLDivElement>(null);
  const countrySearchRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  const applyCutout = (blob: Blob) => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(blob);
    objectUrlRef.current = url;
    setPhotoUrl(url);
    setPhotoCutout(true);
  };

  const showRawPhoto = (blob: Blob) => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(blob);
    objectUrlRef.current = url;
    setPhotoUrl(url);
    setPhotoCutout(false);
  };

  const processPhoto = async (src: Blob | string) => {
    const gen = ++processGenRef.current;
    setBuildMsgIdx(Math.floor(Math.random() * CARD_BUILD_MESSAGES.length));
    setProcessing(true);
    setPhotoProgress(0);
    setPhotoCutout(false);

    try {
      const input =
        typeof src === "string"
          ? await fetch(src).then((r) => {
              if (!r.ok) throw new Error("Could not load photo");
              return r.blob();
            })
          : src;

      if (typeof src === "string") {
        setPhotoUrl(src);
      } else {
        showRawPhoto(input);
      }

      const cutout = await removePhotoBackground(input, {
        onProgress: setPhotoProgress,
        onPreview: (preview) => {
          if (gen !== processGenRef.current) return;
          applyCutout(preview);
          setProcessing(false);
        },
      });
      if (gen !== processGenRef.current) return;
      applyCutout(cutout);
    } catch (err) {
      console.error("Background removal failed:", err);
      if (gen !== processGenRef.current) return;
      if (typeof src === "string") {
        setPhotoUrl(src);
        setPhotoCutout(false);
      } else {
        if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
        const url = URL.createObjectURL(src);
        objectUrlRef.current = url;
        setPhotoUrl(url);
        setPhotoCutout(false);
      }
    } finally {
      if (gen === processGenRef.current) {
        setProcessing(false);
        setPhotoProgress(0);
      }
    }
  };

  useEffect(() => {
    if (!processing) return;
    const id = window.setInterval(() => {
      setBuildMsgIdx((i) => (i + 1) % CARD_BUILD_MESSAGES.length);
    }, 2400);
    return () => clearInterval(id);
  }, [processing]);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const get = (k: string) => p.get(k) || undefined;

    if (get("name")) setName(get("name")!);
    if (get("team")) setTeam(get("team")!);
    if (get("style")) setCardStyle(get("style") as CardStyle);
    if (get("shine")) setShine(get("shine") as Shine);
    if (get("finish")) setFinish(get("finish") as Finish);
    const photo = get("photo");
    if (photo) void processPhoto(photo);

    if (p.toString()) {
      window.history.replaceState({}, "", window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    void processPhoto(file);
  };

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
    e.target.value = "";
  };

  const teamsAlphabetical = useMemo(
    () => [...TEAM_NAMES].sort((a, b) => a.localeCompare(b)),
    []
  );

  const filteredTeams = useMemo(() => {
    const q = countryQuery.trim().toLowerCase();
    if (!q) return teamsAlphabetical;
    return teamsAlphabetical.filter((t) => t.toLowerCase().includes(q));
  }, [teamsAlphabetical, countryQuery]);

  useEffect(() => {
    if (!countryOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (
        countryDropdownRef.current &&
        !countryDropdownRef.current.contains(e.target as Node)
      ) {
        setCountryOpen(false);
        setCountryQuery("");
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [countryOpen]);

  useEffect(() => {
    if (countryOpen) countrySearchRef.current?.focus();
  }, [countryOpen]);

  const selectTeam = (t: string) => {
    setTeam(t);
    setCountryOpen(false);
    setCountryQuery("");
  };

  const teamCode = TEAMS[team]?.code ?? "un";

  return (
    <>
      <TeamBackground team={team} />
      <div className="shell">
        <header className="masthead">
          <span className="mastheadEyebrow">World Cup 2026</span>
          <h1 className="mastheadTitle">Holo Card Studio</h1>
        </header>
        <div className="composer">
        <div className="cardColumn">
          <div className="cardPreview">
            <HoloCard
              stageRef={stageRef}
              name={name}
              team={team}
              cardStyle={cardStyle}
              shine={shine}
              finish={finish}
              photoUrl={photoUrl}
              photoCutout={photoCutout}
              processing={processing}
              processingMessage={CARD_BUILD_MESSAGES[buildMsgIdx]}
              processingProgress={photoProgress}
            />
          </div>
          <div className="buyBar">
            <BuyCardPanel
              captureRef={stageRef}
              disabled={processing}
              name={name}
              team={team}
              cardStyle={cardStyle}
              shine={shine}
              finish={finish}
            />
          </div>
        </div>

        <div className="panel">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={onFileInput}
            disabled={processing}
            tabIndex={-1}
            aria-hidden
            className="photoInput"
          />
          <button
            type="button"
            className="photoBtn"
            disabled={processing}
            onClick={() => fileInputRef.current?.click()}
          >
            {photoUrl ? "Change photo" : "Upload photo"}
          </button>

          <label htmlFor="player-name">Name</label>
          <input
            id="player-name"
            type="text"
            value={name}
            placeholder="ENTER YOUR NAME"
            onChange={(e) => setName(e.target.value)}
          />

          <label>Country</label>
          <div className="countryPick" ref={countryDropdownRef}>
            <div className={`countryDropdown${countryOpen ? " open" : ""}`}>
              <button
                type="button"
                className="countryDropdownTrigger"
                aria-expanded={countryOpen}
                aria-haspopup="listbox"
                onClick={() => setCountryOpen((open) => !open)}
              >
                <FlagImg code={teamCode} size={32} priority />
                <span>{team}</span>
              </button>
              {countryOpen ? (
                <div className="countryDropdownPanel">
                  <input
                    ref={countrySearchRef}
                    id="country-search"
                    type="text"
                    className="countryDropdownSearch"
                    placeholder="Search countries…"
                    value={countryQuery}
                    onChange={(e) => setCountryQuery(e.target.value)}
                    aria-label="Search countries"
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        setCountryOpen(false);
                        setCountryQuery("");
                      }
                    }}
                  />
                  <div className="countryDropdownList" role="listbox" aria-label="Countries">
                    {filteredTeams.length === 0 ? (
                      <div className="countryDropdownEmpty">No matches</div>
                    ) : (
                      filteredTeams.map((t) => {
                        const code = TEAMS[t]?.code ?? "un";
                        return (
                          <button
                            key={t}
                            type="button"
                            role="option"
                            aria-selected={team === t}
                            className={`countryDropdownOption${team === t ? " active" : ""}`}
                            onClick={() => selectTeam(t)}
                          >
                            <FlagImg code={code} size={24} />
                            <span>{t}</span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <label>Card style</label>
          <div className="styles">
            {STYLES.map((st) => (
              <button
                key={st.id}
                type="button"
                className={`styleopt styleopt-${st.id}${cardStyle === st.id ? " active" : ""}`}
                onClick={() => setCardStyle(st.id)}
              >
                <b>{st.name}</b>
                <span>{st.blurb}</span>
              </button>
            ))}
          </div>

          <label>Shine</label>
          <div className="shines">
            {SHINES.map((sh) => (
              <button
                key={sh.id}
                type="button"
                title={sh.name}
                className={`shineopt${shine === sh.id ? " active" : ""}`}
                onClick={() => setShine(sh.id)}
              >
                <i style={{ background: sh.swatch }} />
                <span>{sh.name}</span>
              </button>
            ))}
          </div>

          <label>Finish</label>
          <div className="finishes">
            {FINISHES.map((fn) => (
              <button
                key={fn.id}
                type="button"
                className={`finishopt${finish === fn.id ? " active" : ""}`}
                onClick={() => setFinish(fn.id)}
              >
                {fn.name}
              </button>
            ))}
          </div>
        </div>
        </div>
      </div>
    </>
  );
}
