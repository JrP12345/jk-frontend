# Pharmacy counter access review

Reviewed 11 November 2026. This is an extension of the existing organization roles, branch grants and pharmacy capabilities. No client accounts or database permissions are changed automatically.

## What the screenshots show

Vimal has the built-in `pharmacist` role. Its default grants include `MANAGE_MEDICINES`, `VIEW_EHR`, `VIEW_STAFF` and `VIEW_LOCATIONS`. That explains Inventory, Alerts, Add medicine, Team and Locations. It does not include `PHARMACY_SELL`, so Counter sale is absent. This is the wrong access configuration for a sales-only operator; changing the page styling cannot resolve it.

## Issues and solutions

| Issue | Solution in the existing system |
| --- | --- |
| Pharmacist and cashier job titles are easily mistaken for pharmacy access presets. | Explain the distinction in Members and on a pharmacist's pharmacy page. Keep built-in clinical roles intact. |
| The existing pharmacy cashier preset includes stock visibility. | Add a separate **Counter sales only** template with no inventory-screen permission. |
| Sales and collection grants implicitly allowed returns and finance reads. | Remove those implicit grants on the server. Return/refund and purchase/finance authority must be granted separately. |
| Closing a till also granted arbitrary cash movements. | Separate `PHARMACY_MOVE_TILL_CASH` from `PHARMACY_CLOSE_TILL`. The broader cashier template explicitly includes cash movements; the counter-only template does not. |
| A preset combiner could retain broad permissions while adding a narrow template. | Provide a clear counter-role action and a replacement template selector. Counter sales only is excluded from the additive combiner. Incomplete template/catalogue data blocks template use. |
| A role name alone could look like an access restriction. | Navigation is based on actual permissions; pharmacy tabs and writes remain controlled by current server capabilities and route guards. |
| Sales staff saw owner-oriented overview copy and branch setup navigation. | Give narrow sales roles a counter-focused home, desktop navigation and mobile navigation. Assigned branch selection remains available. |
| The page heading described inventory to sales-only staff. | Use Counter sales and a description of bills, payments and the drawer for narrow sales roles. |
| Custom role identifiers with underscores appeared in the dashboard title and account badge. | Show Counter sales for a narrow sales role and use readable words for other custom role labels. |
| Permission cards nested interactive checkboxes inside checkbox buttons, and selected permission codes had weak contrast. | Use one labelled shared Checkbox per permission, retain protected administrator grants and improve code contrast/wrapping. |
| Members had no direct explanation of how to get sales-only access. | Add Set up counter sales access, leading to the existing Roles & permissions section. |
| One literal screen would omit shift handling and payment recovery. | Keep only Counter sale, Cash drawer and Sales & collections for this role. Existing invoice/collection recovery and print evidence checks stay available. |
| Assigning a role does not restrict which branches it can use. | Keep the existing separate Location access control and verify unauthorized branch requests are denied. |

## Set up Vimal using the current UI

1. Sign in with the pharmacy owner's administrator account. Keep it separate from staff accounts on shared computers and phones.
2. Open **Organization → Members → Set up counter sales access**, or **Organization → Roles & permissions**.
3. Select **Create counter sales role**. Review the draft named `pharmacy_counter_sales`, then select **Create Custom Role**. If it already exists, inspect its saved permissions instead of recreating it.
4. Open **Member roles**, find Vimal and use **Edit Role**. Select `pharmacy_counter_sales` and save. This replaces that member's organization role; it does not add the new role on top of Pharmacist.
5. Return to **Members → Vimal → Location access**. Choose selected locations and grant only the pharmacy branch where Vimal works. Save.
6. Have Vimal sign out and sign back in so the browser receives the current role and permissions. Complete any existing MFA requirement using Vimal's own account.
7. On the sales computer or phone, Vimal opens **Counter sales**. Open the operator's own drawer, search or scan a reviewed product, review the quote, issue the bill and record money actually received. Close/reconcile the drawer at shift end.

The narrow template grants exactly `VIEW_LOCATIONS`, `PHARMACY_SELL`, `PHARMACY_COLLECT_PAYMENT` and `PHARMACY_CLOSE_TILL`. It does not grant stock administration, acquisition costs, CSV import, purchases, restricted dispensing, returns/refunds, finance reports, cash movements, staff or organization setup.

## Practical boundaries

- `VIEW_LOCATIONS` is needed to load assigned branches. Hiding the branch setup navigation does not remove the authorized read of assigned branch information. Editing issuer/licence/settings remains separately protected.
- Product search still shows available selling units and the bill shows selling prices and batch/expiry details. Those are needed to sell safely; acquisition costs are excluded from counter search.
- Sales & collections is **shared branch invoice history**, not a cashier-private sales history. This change does not promise to hide other staff's invoices at the same authorized branch. A separate own-sales-only contract is not built.
- The drawer service enforces current operator ownership. Mobile and desktop sessions for the same staff identity share that operator's active branch drawer; separate people should use separate identities. Never use the owner account as a shared till login.
- Counter-only permissions do not bypass product review, restricted-product rules, branch activation, commercial entitlement, MFA, stock revision checks or manual payment confirmation. The owner still prepares products and stock.
- Existing roles are not silently rewritten. Adding the template does not change Vimal until the owner assigns the role. Custom owner roles with only close-till permission now need the separate cash-movement grant if cash movements are part of their duties.

## Verification

Risk: Level 4, because server authorization changes. Focused checks cover capability denial, current branch grants, revoked permissions, ordinary-product lookup without costs, quote and issue, payment collection and own-drawer closing/opening. Frontend checks cover template replacement, incomplete catalogues, focused navigation and absence of management controls. Browser checks use synthetic data only.

Results: 128 focused frontend cases and 107 backend cases passed across the affected runs. Both package TypeScript checks passed. All 30 synthetic browser cases passed, covering the counter at 1440/390/320px and dark mode, plus owner Members, Roles and the role template at desktop/mobile widths. Changed-file lint has no errors and retains existing hook warnings. No live accounts, sales, stock or payments were changed; no production build or deployment was performed.
