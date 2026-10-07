# Printing workflow

Every existing frontend print surface uses `PrintButton` or `PrintDialogActions`. Local previews keep their existing workflow. Final printing uses the shared `printBrand.ts` infrastructure, an isolated iframe, the fixed paper palette, and the device's native print dialog.

| Existing surface | Entry and preview | Existing layout choices |
| --- | --- | --- |
| Browse booking confirmation | Print token slip stays in the booking panel's fixed footer | A4 token template |
| Staff check-in kiosk | Print token slip beside the completed check-in actions | Existing token template |
| Dashboard appointments | Token confirmation and prescription preview use fixed print footers | Existing token and prescription templates |
| Patient bills | Preview receipt from the invoice row or mobile card; print from its fixed footer | Existing receipt template |
| Billing | Preview invoice/receipt from rows, menus, or cards; print in the preview footer | Existing invoice and receipt templates |
| Cashier reconciliation | Print daily report is disabled until a report has been generated | Existing shift report layout |
| Laboratory | Preview verified report from existing order actions; print in its footer | Existing diagnostic report layout |
| Queue | Existing prescription/token preview actions use the shared print control | Unified documents and thermal slip preview |
| SOAP note editor | Unsaved notes retain their local preview; saved prescriptions use the authenticated server endpoint | Existing clinical prescription rendering |
| Unified clinical documents | Fixed Print/Close footer for prescription, invoice, report, discharge summary, certificate, referral, and token documents | Plain A4 or preprinted clinic pad with the existing 65mm offset |
| Thermal token slip | Print stays disabled while its QR code loads; failed codes offer retry | 58mm and 80mm paper controls stay available above the preview |
| Location QR poster | Existing preview, Copy join link, and fixed Print/Close actions | Existing A4 poster layout |
| ABDM standee | Print poster beside its existing scan/share actions | Existing A4 standee |
| Patient tracker | Fetch the private prescription through its existing capability and print using the shared lifecycle | Existing server prescription rendering |

Use explicit document names on entries. In an already-labelled preview, the visible final action is simply Print; its accessible label still names the document. The printer icon changes to one loading indicator while preparing, the button width remains stable, and unrelated actions remain available. Printing does not claim that a job succeeded: the native dialog may be cancelled.

Preparation waits for required images, styles, and fonts. A stalled or failed asset ends preparation with a contextual retry message instead of producing a partial document. Missing documents, unavailable printing, permission failures, and unavailable server documents have shared user-facing messages. Internal server wording is not shown.

Retain the isolated frame until afterprint, with a fallback cleanup for mobile engines that omit the event. Restore focus after cleanup. Existing HTML templates keep their content and layout; legacy scripts and inline event handlers are removed before printing so one action cannot open competing print dialogs. There are no frontend print popups or separate template auto-print scripts.
