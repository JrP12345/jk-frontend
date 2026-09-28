"use client";

import { Printer } from "lucide-react";
import Button, { type ButtonProps } from "./Button";
import { useToast } from "./Toast";
import { getPrintErrorMessage } from "@/lib/printBrand";

export interface PrintButtonProps extends Omit<ButtonProps, "onClick" | "icon" | "iconRight"> {
  documentName: string;
  onPrint: () => void | Promise<unknown>;
  preview?: boolean;
}

/** One print action for both document previews and the native print dialog. */
export default function PrintButton({ documentName, onPrint, preview = false, children, variant = "outline", loadingText = "Preparing…", ...props }: PrintButtonProps) {
  const { toast } = useToast();
  const label = `${preview ? "Preview" : "Print"} ${documentName}`;
  const report = (error: unknown) => toast({ title: `Could not prepare ${documentName}`, description: getPrintErrorMessage(error), variant: "error" });
  return <Button {...props} variant={variant} icon={<Printer aria-hidden="true" />} loadingText={loadingText}
    aria-label={props["aria-label"] || label} title={props.title || label}
    onClick={() => {
      try {
        const result = onPrint();
        if (result && typeof result.then === "function") return Promise.resolve(result).catch(report);
      } catch (error) { report(error); }
    }}>
    {children || label}
  </Button>;
}
