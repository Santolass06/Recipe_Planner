import Modal from "./Modal";
import { useI18n } from "../../i18n";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}

export default function ConfirmDialog({
  open,
  title,
  body,
  onConfirm,
  onCancel,
  danger,
}: ConfirmDialogProps) {
  const { t } = useI18n();
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onCancel}>
            {t("common.cancel")}
          </button>
          <button
            className={`btn ${danger ? "btn-icon danger" : "btn-primary"}`}
            onClick={onConfirm}
            style={danger ? { width: "auto", padding: "7px 13px" } : {}}
          >
            {t("common.confirm")}
          </button>
        </>
      }
    >
      <p className="text-1">{body}</p>
    </Modal>
  );
}
