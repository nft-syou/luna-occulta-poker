import { useId } from "react";
import { useTranslation } from "react-i18next";
import type { StopReason } from "../jev/gameBackend";

interface Props {
  /** Why the table stopped; `null` while it runs. */
  reason: StopReason | null;
  onLeave: () => void;
}

/** The table has stopped for the night (or cannot be reached): the only way on is to stand up. */
export function TonightOverDialog({ reason, onLeave }: Props) {
  const { t } = useTranslation();
  const id = useId();
  if (reason === null) return null;
  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`}>
        <h2 id={`${id}-title`}>
          {reason === "tonight" ? t("tonight.title") : t("tonight.unavailableTitle")}
        </h2>
        <p>{reason === "tonight" ? t("tonight.body") : t("tonight.unavailableBody")}</p>
        <div className="row">
          <button type="button" onClick={onLeave}>
            {t("tonight.leave")}
          </button>
        </div>
      </div>
    </div>
  );
}
