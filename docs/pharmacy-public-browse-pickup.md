# Public pharmacy browsing and pickup

Reviewed 14 November 2026. Frontend and backend changes must ship together.

## Owner setup

1. Publish the physical location from Locations → Public page. Select Pharmacy as its facility type for a standalone pharmacy. No doctor, consultation fee or online booking subscription is required for its public contact page.
2. Open Pharmacy → More → Public medicine list. Publishing the list and accepting pickup requests are separate opt-in switches, initially off.
3. A simple list requires an enabled pharmacy and reviewed general products with explicit units. Pickup additionally requires the existing reviewed billing issuer profile. Restricted/prescription products keep their existing pharmacist workflows and are excluded from this public list.
4. Authorized counter staff use Pharmacy → More → Medicine pickups. Collect-only staff can inspect requests and record bill payments; preparation/handover additionally requires counter sales permission.

Pharmacy, diagnostic and other service-only pages show contact/services information rather than a missing-doctor warning. Actual doctors remain visible at mixed locations, alongside an independently published medicine list. Directory links, profile descriptions and organization setup guidance follow the same distinction. Opening hours do not imply emergency or OPD services.

## Customer and staff journey

- Browse a branch's published medicines. The public response exposes names, strength, units and an availability indicator; acquisition costs, exact stock counts, barcodes and review evidence remain private. Search is bounded and paginated.
- When the owner permits it, select up to 25 medicines, enter whole base-unit quantities and contact details, then request collection. This creates a request, not a reservation, sale or online payment.
- The customer receives `/pickup#<secret>` with a locally generated QR, branch details, medicine quantities and current status. Status refreshes every 15 seconds while the page is visible and the ticket is active. Tickets expire after 48 hours. Customers should keep the link and wait for Ready before travelling.
- Staff open the request, issue its exact medicines/quantities through the existing Counter sale, then enter that saved bill number and mark the parcel Ready. This uses the existing stock, tax, audit and payment authority.
- At collection, staff scan the QR using a keyboard/USB scanner, paste the ticket link, or type the PK reference. Inspect the parcel, record payment through View bill / record payment if needed, and confirm handover. The server requires a fully settled, uncorrected original bill and valid batches. A repeated QR shows Collected and cannot hand over twice.
- A request can be cancelled without cancelling its invoice. Billed returns/refunds remain in the existing Returns workflow. Turning publication or new requests off preserves access to existing tickets.

## Persistence and authorization

Public catalogue and request endpoints resolve published public slugs; private branch IDs do not grant publication. Requests recheck current product review, units and batch availability on the server. Personal contact fields are encrypted and are returned only to authorized staff at the owning branch.

The QR contains a 256-bit secret in a URL fragment. Status lookup sends it in a POST body; the secret is hashed at rest, omitted from query strings, audit payloads and public DTOs, and never sent to an external QR service. Ticket pages are noindex with no-referrer metadata. Staff references require authenticated, branch-scoped access.

Creation and transitions use recorded operation keys, required transactional audits and revision checks. An interrupted browser submission freezes its payload and retries the same key. Preparation and handover pin the invoice and product documents against simultaneous payment, return, classification and unit changes. Each invoice links to at most one pickup; handover never deducts stock a second time.

## Verification

Focused backend coverage includes publication defaults, catalogue-only setup, restricted/unreviewed products, stale units and quantities, encrypted contacts, private tickets, same-key retries, disabled publication, tenant/permission isolation, exact bill matching, unpaid/expired handover, reused invoices, changed classification, expired billed batches and audit rollback. Public browse/catalogue and counter checkout regression suites are included.

Frontend coverage includes doctorless and mixed facilities, public setup guidance, list-only mode, quantities, validation, uncertain retries, QR status, publication revisions and staff permissions. An isolated synthetic browser review covers customer request → QR → staff scan → preparation → handover at 1440px and 390px, with no horizontal overflow, browser errors or WCAG A/AA findings in the inspected views. It does not submit requests to the developer's actual API or exercise physical scanner hardware.
