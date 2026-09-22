import { useId } from "react";
import { useTranslation } from "react-i18next";
import { CPU_SPIRIT_IDS, SPIRITS, type SpiritId, spirit } from "../characters/spirits";
import type { Language } from "../i18n";
import {
  DEFAULT_SEATS,
  PREFETCH_MAX_IN_FLIGHT_OPTIONS,
  type SeatSetting,
  type Settings,
  SPEEDS,
  validateSettings,
} from "./storage";
import { VoiceSettings } from "./VoiceSettings";

interface Props {
  settings: Settings;
  language: Language;
  hasConnection: boolean;
  onChange: (settings: Settings) => void;
  onStart: () => void;
  onOpenConnection: () => void;
}

/** A spirit not yet seated, preferring the five who speak; あるじどの last. */
function freeSpirit(seats: readonly SeatSetting[]): SpiritId {
  const taken = new Set(seats.map((s) => s.spiritId));
  return [...CPU_SPIRIT_IDS, "arujidono" as const].find((id) => !taken.has(id)) ?? "arujidono";
}

export function Setup({
  settings,
  language,
  hasConnection,
  onChange,
  onStart,
  onOpenConnection,
}: Props) {
  const { t } = useTranslation();
  const id = useId();
  const problem = validateSettings(settings);
  const spectator = settings.seats.every((s) => s.kind === "cpu");
  const canStart = hasConnection && problem === null;

  const updateSeat = (index: number, patch: Partial<SeatSetting>) => {
    const seats = settings.seats.map((s, i) => (i === index ? { ...s, ...patch } : s));
    onChange({ ...settings, seats });
  };

  const setSeatCount = (count: number) => {
    const seats: SeatSetting[] = [];
    for (let i = 0; i < count; i++) {
      const kept = settings.seats[i] ?? DEFAULT_SEATS[i];
      seats.push(
        kept !== undefined && !seats.some((s) => s.spiritId === kept.spiritId)
          ? kept
          : { name: spirit(freeSpirit(seats)).name.ja, kind: "cpu", spiritId: freeSpirit(seats) },
      );
    }
    onChange({ ...settings, seats });
  };

  const number = (key: "startingStack" | "smallBlind" | "bigBlind") => (
    <label className="field">
      <span>{t(`setup.${key}`)}</span>
      <input
        type="number"
        min={1}
        value={settings[key]}
        onChange={(e) => onChange({ ...settings, [key]: Number(e.target.value) })}
      />
    </label>
  );

  return (
    <section className="setup habutae">
      <h2>{t("setup.title")}</h2>
      <div className="grid">
        <label className="field" htmlFor={`${id}-seats`}>
          <span>{t("setup.seats")}</span>
          <select
            id={`${id}-seats`}
            value={settings.seats.length}
            onChange={(e) => setSeatCount(Number(e.target.value))}
          >
            {[2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        {number("startingStack")}
        {number("smallBlind")}
        {number("bigBlind")}
        <label className="field">
          <span>{t("setup.speed")}</span>
          <select
            value={settings.speed}
            onChange={(e) => onChange({ ...settings, speed: e.target.value as Settings["speed"] })}
          >
            {SPEEDS.map((speed) => (
              <option key={speed} value={speed}>
                {t(`setup.speed_${speed}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>
            <input
              type="checkbox"
              checked={settings.prefetch}
              onChange={(e) => onChange({ ...settings, prefetch: e.target.checked })}
            />{" "}
            {t("setup.prefetch")}
          </span>
        </label>
        {settings.prefetch && (
          <label className="field">
            <span>{t("setup.prefetchMaxInFlight")}</span>
            <select
              value={settings.prefetchMaxInFlight}
              onChange={(e) =>
                onChange({ ...settings, prefetchMaxInFlight: Number(e.target.value) })
              }
            >
              {PREFETCH_MAX_IN_FLIGHT_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <VoiceSettings settings={settings} onChange={onChange} />

      <table className="seats">
        <thead>
          <tr>
            <th>#</th>
            <th>{t("setup.seatKind")}</th>
            <th>{t("setup.persona")}</th>
            <th>{t("setup.seatName")}</th>
          </tr>
        </thead>
        <tbody>
          {settings.seats.map((seat, index) => {
            const who = spirit(seat.spiritId);
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: seats have no stable id
              <tr key={`${id}-seat-${index}`}>
                <td>{index + 1}</td>
                <td>
                  <select
                    aria-label={`${t("setup.seatKind")} ${index + 1}`}
                    value={seat.kind}
                    onChange={(e) =>
                      updateSeat(index, { kind: e.target.value as SeatSetting["kind"] })
                    }
                  >
                    <option value="human">{t("setup.human")}</option>
                    <option value="cpu">{t("setup.cpu")}</option>
                  </select>
                </td>
                <td>
                  <div className="seat-pick">
                    <img className="seat-pick-face" src={who.icon} alt="" width={40} height={40} />
                    <select
                      aria-label={`${t("setup.persona")} ${index + 1}`}
                      value={seat.spiritId}
                      onChange={(e) => {
                        const spiritId = e.target.value as SpiritId;
                        updateSeat(index, { spiritId, name: spirit(spiritId).name.ja });
                      }}
                    >
                      {SPIRITS.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name[language]} — {s.tagline[language]}
                        </option>
                      ))}
                    </select>
                  </div>
                </td>
                <td>
                  {seat.kind === "human" ? (
                    <input
                      aria-label={`${t("setup.seatName")} ${index + 1}`}
                      value={seat.name}
                      onChange={(e) => updateSeat(index, { name: e.target.value })}
                    />
                  ) : (
                    <span className="muted">{who.copy[language]}</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {problem !== null && <p className="error">{t(`setup.${problem}`)}</p>}
      {!hasConnection && (
        <p className="error">
          {t("setup.needConnection")}{" "}
          <button type="button" className="link" onClick={onOpenConnection}>
            {t("app.connection")}
          </button>
        </p>
      )}
      <div className="row">
        <button type="button" onClick={onStart} disabled={!canStart}>
          {spectator ? t("setup.spectate") : t("setup.start")}
        </button>
      </div>
    </section>
  );
}
