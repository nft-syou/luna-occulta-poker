import { useTranslation } from "react-i18next";

interface Props {
  onPlay: () => void;
  onWatch: () => void;
  onSettings: () => void;
}

/** The first thing a player sees: the name, the line, and three ways in. */
export function TitleScreen({ onPlay, onWatch, onSettings }: Props) {
  const { t } = useTranslation();
  return (
    <section className="title-screen">
      <h1 className="title-name">
        <img
          className="title-logo"
          src="/logo.webp"
          alt={t("app.title")}
          width={1600}
          height={864}
        />
      </h1>
      <p className="title-sub">{t("app.subtitle")}</p>
      <p className="title-tagline">{t("title.tagline")}</p>
      <div className="title-actions">
        <button type="button" className="title-play" onClick={onPlay}>
          {t("title.play")}
        </button>
        <button type="button" className="secondary" onClick={onWatch}>
          {t("title.watch")}
        </button>
        <button type="button" className="secondary" onClick={onSettings}>
          {t("title.settings")}
        </button>
      </div>
    </section>
  );
}
