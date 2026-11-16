# EKAVYU landing page: design review and implemented refinement

9 November 2026. This is a refinement of the existing page, not a new template or a change to application workflows.

## What needed work

| Priority | Observed weakness | Why it mattered | Implemented change |
| --- | --- | --- | --- |
| High | Several headings used abstract phrases such as “A considered counter workflow” and “Room for your team.” | Visitors had to read supporting paragraphs to understand the product. | Rewrote headlines around doctors, appointments, inventory, prescriptions and practice plans. Kept the established “Care, connected.” identity. |
| High | The full-width clinic screenshot dominated the page while the other product previews were smaller. | The clinic section broke the page’s proportions and required a long scroll. | Added a 200px workflow navigation column beside the preview on desktop. Preserved the five real screen alternatives and their full-size links. |
| High | The principles section repeated practice details, connected work and permissions already explained elsewhere. | It added length without helping visitors make a new decision. | Removed the section. The relevant permission explanation stays beside the clinic workflow. |
| High | Phones stacked three patient steps before showing product evidence; the narrow tablet preview used a desktop screenshot at a small scale. | The product appeared late on phones and was harder to inspect on tablets. | Put the patient preview between the introduction and steps below 900px. Tablet steps use three columns; phone steps remain a readable list. |
| Medium | The phone clinic selector partly hid “Patient updates” in a horizontal scroller. | A relevant capability was easy to miss, and Axe could not assess the clipped label’s contrast. | Show every selector in a balanced two-row layout at 390px; use three rows at 320px. All controls retain at least 44px height. |
| Medium | Almost every major heading used the same forced two-line construction. | Repetition made distinct sections feel interchangeable. | Allowed natural wrapping for patient, clinic, setup, pricing and closing headings. Retained deliberate hero and pharmacy line breaks. |
| Medium | The footer was a flat collection of links; closing copy gave little direction. | The final part of the page was less useful than the audience-specific sections. | Grouped footer links into Explore and Get started, and replaced the closing headline with a clear patient/team choice. |
| Medium | Large section gaps and repeated framing weakened the continuous composition. | The page felt longer than its substance required. | Reduced the large-screen spacing cap from 112px to 96px, tightened the hero and aligned screenshot framing and captions. |

## Reference research

References were used for principles, not copied layouts, content, assets or claims. These observations are design judgments, not evidence of conversion improvements.

| Reference | Study and useful principle | Application to EKAVYU |
| --- | --- | --- |
| [Linear](https://linear.app/) | Rendered hero, middle and lower layouts: disciplined alignment, product evidence and consistent chapter spacing. | More controlled section rhythm and a workflow selector beside the clinic preview. |
| [Stripe](https://stripe.com/) | Rendered hero and product sections: clear product categories beneath one platform proposition. | Concrete audience descriptions under the shared brand; no borrowed gradients, statistics or financial claims. |
| [Notion](https://www.notion.com/) | Rendered hero, feature compositions and lower page: short task-oriented headings paired with substantial product views. | More direct copy and less repetition around screenshots. |
| [Fresha for business](https://www.fresha.com/for-business) | Rendered hero, operational features and lower page: product views tied to the work a business performs. | Clinic and pharmacy descriptions explain actual work rather than generic benefits. |
| [Airbnb](https://www.airbnb.com/) | Public page structure was readable; the browser render stayed in a loading skeleton. | Task-first discovery is relevant, but a complete visual comparison could not be verified. |
| [Doctolib](https://www.doctolib.fr/) and [Zocdoc](https://www.zocdoc.com/) | Public page text/structure exposed patient search and distinct provider entry points. Direct browser rendering was blocked by anti-bot challenges. | Reinforced a clear care entry and separate team paths. No claim of a complete visual audit of these sites. |
| [Practo](https://www.practo.com/) | Main and consultation routes returned challenges or access errors. | No layout conclusions were drawn from unavailable content. |
| [Awwwards SaaS collection](https://www.awwwards.com/websites/saas/) | Rendered the collection and reviewed visible compositions, including Eleken and Bugsnag previews. | Used for composition comparison, not as conversion or accessibility evidence. |
| [Behance healthcare project](https://www.behance.net/gallery/242610351/LANDING-PAGE-FOR-HEALTHCARE-PROJECT) | Search listing was readable; project rendering returned 403. | Concept work was not treated as a verified implemented experience. |
| [Pinterest search](https://www.pinterest.com/search/pins/?q=saas%20landing%20page) | Search access was unavailable; the attempted ideas route returned an error page. | No unverified Pinterest-specific visual conclusions were used. |

Local research captures are in the ignored `.next/brand-handoff/reference-study/` directory. Third-party imagery was not added to the product or public assets.

## Final page flow

Navigation → shared proposition and real dashboard preview → three audience choices → patient discovery and booking evidence → clinic workflow → pharmacy inventory → next steps for each audience → dynamic clinic plans → FAQ → final action → grouped footer and development disclosure.

The page explains one platform with different workspaces. It does not imply that an independent pharmacy automatically shares patient records with a clinic.

Patient browsing, clinic setup requests, pharmacy onboarding, authentication redirects and dynamic plan data retain their existing routes and contracts. Shared logo, theme controls, buttons and plan cards remain in use. No dependencies, remote fonts, transactions, analytics or integrations were added. Product images remain captures of implemented screens with fictional records; this pass changed their presentation rather than manufacturing new screens.

## Visual and functional review

- Reviewed the continuous page and individual sections at **1440px, 768px and 390px**, including the FAQ, closing action and footer. Also checked 320px phones and dark mode.
- Final captured heights with the same synthetic plan catalogue: desktop **7024px** versus **7644px** before; mobile **9888px** versus **10291px** before. These measurements describe page length, not conversion or speed.
- Rechecked all five clinic views and both patient views. Image-frame height stays steady while switching; all clinic selectors remain visible.
- Preserved native FAQ disclosures, the skip link, keyboard activation, menu Escape/focus recovery, menu resize dismissal and direct messaging-answer links.
- Image-failure recovery was checked for patient and clinic previews in light desktop, dark desktop and dark phone layouts. Retry succeeds; recovery actions fit inside the frame. The messaging fragment also works with JavaScript disabled.

## Verification

Highest source-change risk: **Level 2**, local presentation and controls. A production build and local Lighthouse run were also performed because the brief explicitly requested build stability and performance verification.

| Check | Result |
| --- | --- |
| Changed-file ESLint and `git diff --check` | Passed |
| Homepage, product evidence and pricing Vitest files | **20 tests passed** |
| Isolated Next production build, including TypeScript | Passed |
| Production browser scenarios | **8 passed**: desktop, 768px tablet, 390px phone, 320px phone, reduced motion, no JavaScript, dark desktop and dark phone |
| Axe WCAG A/AA checks in default and changed states | **Zero violations and zero incomplete checks** in JavaScript-enabled scenarios |
| Read-only entry journeys | **8 passed**: care, pricing, assisted clinic setup and pharmacy onboarding at desktop/phone widths |
| Extra recovery/fragment checks | **7 passed**, including failure-state accessibility checks with zero violations/incomplete checks |
| Lighthouse desktop | Performance **100**, accessibility **100**, best practices **100**, LCP **0.78s**, CLS **0** |
| Lighthouse mobile | Performance **94**, accessibility **100**, best practices **100**, LCP **2.97s**, CLS **0** |

Lighthouse results are single local production-preview lab samples with synthetic API data. Mobile LCP remains above the 2.5s target; these samples do not establish an improvement over the earlier 3.03s observation. Local SEO scored 66 because the preview is deliberately `noindex`; that protection was preserved. No live transaction, external message delivery, assistive-technology certification or deployment was performed.

The preview had no server-side backend listening at `127.0.0.1:5127`. Server-side public-profile reads logged connection errors during the route checks; the browser’s directory data came from intercepted fixtures. The eight entry-page journeys passed, but full facility/doctor server rendering was not validated by those journeys. Backend and clinical workflow code were unchanged.

Current evidence: [desktop](connected/review/desktop-full.png), [tablet](connected/review/tablet-full.png), [mobile](connected/review/mobile-full.png), [dark desktop](connected/review/dark-desktop-full.png), [browser results](connected/review/refinement-results.json), [recovery checks](connected/review/refinement-failure-states.json), [journeys](connected/journeys/journeys.json), and [Lighthouse measurements](connected/lighthouse-refinement-2026-11-09.json). Superseded landing and browse visual reports have been removed; the current account/discovery evidence is linked from [public-pages-review.md](../public-pages-review.md).

Raw production review: `.next/brand-handoff/refinement-final/`. Read-only journey output: `.next/landing-refinement-final-review/`. No application source changed after the successful production build.
