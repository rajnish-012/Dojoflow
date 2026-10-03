"use client";

import { ReactNode } from "react";

import Button from "./Button";
import Modal from "./Modal";

type ConfirmationDialogProps = {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: "primary" | "danger";
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

export default function ConfirmationDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmVariant = "danger",
  loading = false,
  onConfirm,
  onClose,
}: ConfirmationDialogProps) {
  return (
    <Modal
      open={open}
      onClose={() => !loading && onClose()}
      title={title}
      description={typeof description === "string" ? description : undefined}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>{cancelLabel}</Button>
          <Button variant={confirmVariant} onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
        </>
      }
    >
      {typeof description === "string" ? null : description}
    </Modal>
  );
}
