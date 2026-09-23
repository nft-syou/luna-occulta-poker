import { useTranslation } from "react-i18next";
import { CPU_SPIRIT_IDS, spirit } from "../characters/spirits";
import type { Language } from "../i18n";
import { RATES, type TableChoice, type TableMode } from "./tableChoice";

interface Props {
  mode: TableMode;
  choice: TableChoice;
  language: Language;
  busy: boolean;
  error: string | null;
  onChange: (choice: TableChoice) => void;
  onStart: () => void;
  onBack: () => void;
}

interface CardProps {
  checked: boolean;
  onSelect: () => void;
  label: string;
  note?: string;
  icon?: string;
}

/** One 式札-style radio option, in a `radiogroup` row. */
function Card({ checked, onSelect, label, note, icon }: CardProps) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: a 式札 card needs a button's layout, not an input
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      className={checked ? "fuda checked" : "fuda"}
      onClick={onSelect}
    >
      {icon !== undefined && <img className="fuda-face" src={icon} alt="" width={56} height={56} />}
      <span className="fuda-label">{label}</span>
      {note !== undefined && <span className="fuda-note">{note}</span>}
    </button>
  );
}

/** The table's form, made of cards: table format, an opponent heads-up, and the stakes. */
export function TableSetup({
  mode,
  choice,
  language,
  busy,
  error,
  onChange,
  onStart,
  onBack,
}: Props) {
  const { t } = useTranslation();
  const set = (patch: Partial<TableChoice>) => onChange({ ...choice, ...patch });
  const play = mode === "play";
  return (
    <section className="table-setup habutae">
      <h2>{play ? t("tableSetup.titlePlay") : t("tableSetup.titleWatch")}</h2>
      {play && (
        <div className="fuda-row" role="radiogroup" aria-label={t("tableSetup.format")}>
          <Card
            checked={choice.format === "six"}
            onSelect={() => set({ format: "six" })}
            label={t("tableSetup.six")}
            note={t("tableSetup.sixNote")}
          />
          <Card
            checked={choice.format === "hu"}
            onSelect={() => set({ format: "hu" })}
            label={t("tableSetup.hu")}
            note={t("tableSetup.huNote")}
          />
        </div>
      )}
      {play && choice.format === "hu" && (
        <div className="fuda-row" role="radiogroup" aria-label={t("tableSetup.opponent")}>
          {CPU_SPIRIT_IDS.map((id) => {
            const s = spirit(id);
            return (
              <Card
                key={id}
                checked={choice.opponent === id}
                onSelect={() => set({ opponent: id })}
                icon={s.icon}
                label={s.name[language]}
                note={s.tagline[language]}
              />
            );
          })}
        </div>
      )}
      <div className="fuda-row" role="radiogroup" aria-label={t("tableSetup.rate")}>
        {RATES.map((r) => (
          <Card
            key={r.id}
            checked={choice.rate === r.id}
            onSelect={() => set({ rate: r.id })}
            label={t(`tableSetup.rate_${r.id}`)}
            note={t(`tableSetup.rate_${r.id}Note`)}
          />
        ))}
      </div>
      {error !== null && <p className="error">{error}</p>}
      <div className="row">
        <button type="button" onClick={onStart} disabled={busy}>
          {busy ? t("tableSetup.preparing") : play ? t("tableSetup.start") : t("tableSetup.watch")}
        </button>
        <button type="button" className="secondary" onClick={onBack}>
          {t("tableSetup.back")}
        </button>
      </div>
    </section>
  );
}
