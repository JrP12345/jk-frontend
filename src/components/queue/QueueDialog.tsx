"use client";

import Modal, { type ModalProps } from "@/components/ui/Modal";
import { cn } from "@/components/ui/utils";
import styles from "./QueueDialog.module.css";

/** Consistent reception and clinical dialog layout; Modal owns focus and dismissal. */
export default function QueueDialog({ className, bodyClassName, headerClassName, footerClassName, contentClassName, size = "md", presentation = "sheet", ...props }: ModalProps) {
  return <Modal {...props} size={size} presentation={presentation}
    className={cn(styles.dialog, styles[size === "2xl" ? "wide" : size], className)}
    headerClassName={cn(styles.header, headerClassName)}
    bodyClassName={cn(styles.body, bodyClassName)}
    contentClassName={cn(styles.content, contentClassName)}
    footerClassName={cn(styles.footer, footerClassName)} />;
}
