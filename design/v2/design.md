# Omi leaderboard visual spec — v2

Generated with the built-in imagegen tool on 2026-10-11. Direction selected for implementation from the user's request to improve the existing UI. This was not a separate user approval round.

## Source concepts and production media
- Hero: [hero-concept.png](hero-concept.png), 1505 × 1045.
- Rankings: [rankings-concept.png](rankings-concept.png), 1467 × 1072.
- Production hero: [omi-studio-v2.png](../../public/assets/omi-studio-v2.png), a separate imagegen pass referenced to the concept and original Omi product photo.
- Original Omi logo retained. Real GitHub avatars replace all concept sample portraits.
- Media is a single dark studio photograph, 4:3, rounded 24px frame, no color overlays, no artificial glow layers. It stays the same in both themes.
- The concepts are design references; none is used as a UI screenshot in production.

## Design system before implementation
- Light: true white page and surfaces; #f6f7f9 rankings band; #101113 text; #636b7b muted; #e1e5eb dividers; #1768ee accent; #178144 positive movement.
- Dark extension: #0b0c0f page, #101216 band, #17191e surfaces, #f5f6f8 text, #a0a7b5 muted, #2b2f39 dividers, #80aaff accent, #69d69a positive movement. Theme defaults to system; user choice persists.
- Manrope 400–800; hero 82px max, -0.055em tracking, 1.08 line height; section 48px, -0.05em; profile numbers 46px; UI 14px/600; body 16px/500; table 14px; metadata 12px.
- Container max1400px plus outer 52px gutters; spacing 8/16/24/32/40/56/64; 1px borders, corner radii 12px controls/20px panels/24px media. CTA pill radius999px.
- Header: quiet white/theme page, Omi + divider + Leaderboard on left, GitHub, three theme buttons, refresh on right.
- Hero: left aligned heading/description/actions, right studio photograph. Personal contribution strip below spans full width. One facts rail before next section.
- Profile strip: avatar/username/change control, rank/top percentage, metric value, weekly rank change, share action. Long names must fit; never clip.
- Rankings: section heading/repo link, underlined metric buttons/time select, three horizontal leader cards. Winner charcoal, other cards white in light. Search/bots/find-me toolbar above table; open merged-PR timeline beside it.
- Table: rank, avatar/username, 12-week bars, value, weekly movement. Highlight current user in blue. 4 initial non-podium rows plus current user pinned (the ellipsis shows omitted rows); show-more reveals 20 further contributors.
- Footer: existing Omi logo, community attribution, GitHub link.
- Icon family: 24px viewBox, 1.7–1.8px outline, rounded caps/joins, mostly 18px display. Arrow-up-right external links; arrow-down explore; upload/share rank; download for PNG; pencil identity; monitor/sun/moon; refresh circular arrows; search magnifier; crosshair find-me; Git merge purple timeline. GitHub filled brand glyph retained.
- Motion: brief button/row hover transitions, optional media entrance, rank-row highlight; no perpetual shimmer/number animation after data loads; reduced-motion respected.

## Responsive and functional continuation
- Desktop matches the reference; table/feed moves to one column below1100px.
- Mobile stacks hero copy, photo, profile; 3 metrics remain in a row with identity and CTA each spanning the width. Keep target sizes44px. Leaders become horizontal rows, table hides only optional activity/movement columns at narrow widths; contributor and primary metric always remain readable. Feed follows table.
- Share dialog and username dialog are functional continuations using the same surface/typography/button families. Native dialogs provide focus containment and Escape dismissal. Share preview is a real 1200×630 PNG canvas using the same photo, with download, copy text and copy link actions.
- Retain real API refresh, search, merged PR/lines/commit rankings, time ranges, bot filter, personal identity, share links and card download. Commit mode explicitly all time.
- Empty and API-error states must have a clear recovery path; failed refresh keeps the previous data and reports the error.

## Allowed first viewport copy
omi; Leaderboard; GitHub; Every merged PR, remembered.; The people behind your second brain. Explore the contributions moving Omi forward.; Explore leaderboard; Contribute on GitHub; real username; Your contribution; Your rank; Top [n]%; Merged PRs / Lines changed / Commits; Places this week; Share my rank; [n] merged PRs; [n] contributors; [n] lines changed; Updated [relative time].
Theme/refresh/change controls have accessible names/tooltips, without adding visual labels.

## Intentional data/functional differences from raster concepts
- All numeric totals, avatars, PR titles and timestamps come from the API, including the lines total (the concept's 19.2M is illustrative).
- Competition ranks are shown, including ties, rather than assuming three unique places.
- Time/bot filters affect the profile strip and rankings. Context for the selected period is displayed under the metric.
- Username editing, share preview, empty states, loading/error state and keyboard behavior are necessary functional states extended from the same design system.
- Real movement is shown for every row, replacing neutral sample dashes.
- Small header refresh icon and theme controls retain existing capabilities; system default remains intact.

## Prompt set
### Hero concept
Use case: ui-mockup. Create a premium, production-ready desktop website design screenshot for the Omi open source contributor leaderboard. This is section 1 of 2: the COMPLETE first viewport, header, hero, personal contribution strip, and community totals. Canvas 1440 x 1000, straight-on browser screenshot with no browser frame, no mockup perspective. Section 2 (rankings and latest merged feed) is designed separately next.

Audience: Omi hardware/software contributors, including apoorvdarshan who wants to see and share their GitHub rank. Visual identity: omi.me, bold Manrope-like rounded geometric sans, pure white background, black and graphite, one electric cornflower-blue accent from the pendant LED. Airy editorial precision, beautiful restrained product brand website. Not a generic SaaS dashboard. No eyebrow above the main heading. Excellent typography, legible native controls. Layout easy to recreate in HTML/CSS. All UI text must be code-native in implementation; photo is a separable asset.

Reference image 1 is the actual Omi pendant, preserve its identity: round translucent graphite shell, circular silver-gray central face with one tiny blue LED, small loop at top. Do not make it a smartwatch or invent product markings. Use this hardware in a cinematic studio photograph for the hero on the right: pendant at 3/4 angle floating above a charcoal black plane, black lanyard curving in from top, fine cool rim light, subtle soft blue LED reflected on the dark plane, no text. A single 540x440px dark photograph with 28px corners. No tint on top of the finished photo.

Header 80px, white, subtle hairline beneath, content gutters80. Left real-style bold black lowercase omi wordmark and small divider then 'Leaderboard'. Right text link 'GitHub' with small northeast arrow and compact three-choice theme control (monitor, sun, moon) and icon-only refresh. Sparse, no excessive buttons.

Below, 64px whitespace then a two-column hero. Left a big beautifully tight 76px black heading on 3 lines: 'Every merged' / 'PR, remembered.' (use 2 lines if fitting). Exact headline text 'Every merged PR, remembered.' Left text area about600px. Below it gray 17px paragraph, 3 short lines max: 'The people behind your second brain. Explore the contributions moving Omi forward.' Then black rounded button 'Explore leaderboard' with downward arrow and adjacent quiet 'Contribute on GitHub' with northeast arrow. The right is the dramatic pendant photograph described above. Image and headline visually balanced. Do not use huge empty top margins.

Below hero, separated by 40px, one horizontal full-width profile strip: thin gray border, white surface, radius20, no nested cards. Left small GitHub avatar circle with name 'apoorvdarshan' and muted 'Your contribution' below, small pencil icon to change username. Next a large blue '#19' with label 'Your rank' and small 'Top 6%'. Next black '40' with label 'Merged PRs'. Next green '+2' with label 'Places this week'. Right black button 'Share my rank' with share/upload icon. Keep all values clear and aligned, generous side spacing.
Then an understated bottom horizontal stats rail: '9,887 merged PRs', '365 contributors', '19.2M lines changed' with proper separators, and far right a tiny green dot 'Updated 11 min ago'. Sample numbers only; implementation will replace with real GitHub data. Do not introduce any other statistics.
At bottom edge preview next section background #f6f7f9 and heading 'The people who ship Omi'.

Spacing system multiples8; strokes 1px #e6e8ed; body16px, UI14px semibold; beautiful large type, black pill CTAs, outlines 1.7px. No gold gradients, confetti, bento grids, badges, fake charts, noisy shadows, neon grids, unnecessary labels, or invented navigation. Sophisticated, polished and distinctly Omi.

### Rankings concept
Use case: ui-mockup. Design SECTION 2 of the Omi contributor leaderboard website, a fresh large readable desktop screenshot of the rankings section and footer. Reference image 1 is the approved visual direction for the preceding hero, match its Manrope typography, pure white surfaces, charcoal text, thin cool gray strokes, rounded geometry, blue accent and polished editorial restraint. New image not a crop. Canvas around1504x1100px, all controls readable. No browser frame.

Background #f6f7f9. Content width1400 with52px gutters matching reference. Top heading at52,60: 'The people who ship Omi', bold48px tight tracking. Subtitle gray16px 'Ranked by what landed on main. The blue light marks you.' Far right heading area quiet label 'BasedHardware/omi' with GitHub icon. No extra eyebrow.
Below at y170 a full row of controls: flat underlined tabs 'Merged PRs' selected black text with black underline, 'Lines changed', 'Commits'; right rounded white select 'All time' chevron. Beneath filters three horizontal featured contributor cards (not tall podium towers), equal width, 140px high, gaps16, corners20. First dark charcoal with white text, others white with gray border. Inside each: small rank '#1', circular avatar48px, username and muted 'merged PRs', large value aligned right. Exact samples: '#1 Git-on-my-level 2,294', '#2 beastoin 1,549', '#3 kodjima33 1,196'. No crowns, trophies or colored medal outlines.

Below cards at y390: main table ~1000px width left, narrow latest-merged sidebar~340px right with gap24. Table panel white surface radius20, thin border. Toolbar at top: left search field icon and placeholder 'Find a contributor…'; right simple checkbox 'Hide bots', then small 'Find me' button target icon. Table header gray13px: 'Rank', 'Contributor', 'Last 12 weeks', 'Merged PRs', '7d'. Rows 64px tall, ample room for usernames. Row sample 4 mdmohsin7 923; 5 krushnarout 266; 6 ZachL111 219; 7 tianmind-studio 216; then ellipsis; blue-tinted highlighted row 19 apoorvdarshan 40 with tiny text 'you' next to username. Real-looking small avatar photographs; blue accent only highlights current user. Small activity bar sparklines from real weekly PR counts, muted gray. Values right aligned, rank movement +2 green only for current user, other movement neutral dash. Under table centered 'Show more contributors' rounded outline button. No nested cards inside table, no horizontal clipping.

Sidebar: open surface matching gray section (not another boxed card), heading 'Just merged' with tiny green dot, right external link arrow. Timeline-style list of 4 PR entries separated by thin dividers, each with small purple merge icon, two-line PR title and gray username and PR number/time. Sample titles: 'Improve conversation processing', 'Fix Bluetooth reconnection', 'Update iOS recording controls', 'Improve battery diagnostics'; these are sample layout content, actual implementation substitutes live GitHub titles. Footer sidebar link 'View all merged PRs' with northeast arrow. Below the list small subtle explanatory text 'GitHub data, refreshed every 30 minutes.' No extra cards.

At bottom footer thin top border on white, black omi wordmark left with muted 'Built by the community.' and right 'Contribute on GitHub' northeast arrow. All text and controls code-native in implementation; screenshot is visual spec only, not production image. No hero repeated, no dark nav, no fake metrics, no decorative badges, no giant rounded wrapper around section, no warm beige. Match exact cohesive visual system and sharp typography from reference.

### Production photograph
Use case: product-mockup. Generate the standalone production photograph for the right-side hero in reference image1 (the website concept). Reference image2 is the real Omi pendant and must preserve the device's recognizable identity.

Output ONLY the photograph, no UI, no screenshot, no rounded corners, no white margin, no text or logo. Landscape near4:3 aspect, around1600x1200. Recreate the hero art faithfully: an Omi pendant suspended centrally above a dark charcoal finely textured surface, round translucent smoky graphite outer shell with layered rim, silver charcoal circular slightly textured inner face, tiny vivid blue center LED with a fine pale ring. One small transparent graphite loop on top, attached to a woven black lanyard that curves naturally out of the top edge. Device hangs at a subtle 3/4 angle, face visible, occupies about60% of image height including the loop, centered x50% y49%. Pendant bottom at80% of frame, soft blue LED reflection in floor at90%. Background is a soft dark neutral graphite seamless studio, black on edges, cool gray rim lights. Rich real material textures, excellent industrial product photography, refined highlights, no overexposed metal, no exaggerated cyan glow. Deep natural shadows, shallow depth of field, tack sharp device. Preserve photograph's lighting and composition from concept, no color tint wash, no gradient decoration, no floating particles, no second pendant, no wrist strap, no smartwatch display, no text, no fake marks.


## Final verification and fidelity ledger

Verified 2026-10-11 with headless, logged-out **agent-browser MCP**, supplemented by the same agent-browser CLI for viewport/media emulation, accessibility scans and download verification. No Playwright fallback was needed. A selector screenshot bug produced incorrect clips; final review uses normal viewport screenshots instead. No application behavior was changed to obtain screenshots.

Final review artifacts:
- [Desktop preview](preview-desktop.png), 1505 × 1045, same native viewport as the hero concept.
- [Rankings preview](preview-rankings.png), 1467 × 1072, same native viewport as the rankings concept; the real page includes its sticky header.
- [Mobile dark preview](preview-mobile-dark.png), 390px wide full-page browser capture.

Both source concepts and the latest desktop/rankings screenshots were opened using `view_image` together for direct visual comparison. Mobile light, mobile dark, desktop dark and both desktop/mobile share dialogs were also visually inspected. The implementation was faithfully verified against the selected design direction; no remaining material visual issues were found in the checked states. This is an implementation review, not a claim of literal pixel identity with a generative mockup.

| Comparison | Concept evidence | Render evidence and resolution |
| --- | --- | --- |
| Copy and hierarchy | Hero headline, two-line description, Explore/Contribute actions, profile strip before totals | Exact static copy matches after whitespace normalization. No added hero badges or kicker text. Live values are intentional substitutions. |
| Hero composition | Split editorial type/photo, equal columns, top image at about126px, profile strip below | Native1505px render retains columns, 52px gutters, photo frame and strip order. Fixed a three-line headline wrap by fitting the desktop type to its column. |
| Typography | Large Manrope-like geometric headline, bold rank, readable control text | Explicit Manrope throughout. Desktop headline resolves to86px at1505px (max88px), section heading58px, profile numbers52px. Enlarged initially undersized table, profile and feed text. Mobile sizes use their own scale. |
| Palette and contrast | True white/light-gray bands, charcoal leader, blue personal rank | White stayed #fff, band #f6f7f9, no cream tint. Green was slightly darkened to #14773e to pass contrast over the blue personal row. Dark extension preserves the same hierarchy. |
| Product artwork | Graphite Omi pendant, black lanyard, blue center LED, soft reflected blue on floor | Separate built-in imagegen asset faithfully carries the subject, lighting and composition. No CSS color overlay or fake glow. Original logo and real GitHub avatars replace generated example portraits. |
| Ranking containers | Three horizontal leader cards, white table, open timeline sidebar | Preserved all three families, winner treatment, four initial rows, separator and pinned current user. Sidebar gets room for genuine two-line PR titles. Wider contributor names take priority over matching example column coordinates. |
| Icons and interaction states | Outline theme/search/share/refresh/arrow glyphs, purple merge nodes | One1.8px stroke family with24px viewBox. Explicit focus, selected, disabled and hover styles; real semantic buttons and table. GitHub is a filled brand glyph. |
| Responsive continuation | Same typography, media and contribution hierarchy | Checked320×740,390×844,768×1024,1280×800,1505×1045 with no page overflow. Mobile stacks horizontal leader rows and hides only optional table columns. |

### Above-the-fold copy diff

Passed for headline, lede, action labels, profile labels, navigation, and totals labels. No unapproved static additions or renamed controls in the default view. Intentional variable differences: real username/avatar,13M source lines instead of illustrative19.2M, changing freshness time, filtered metrics and rank changes. Accessible-only labels are not visible copy.

### Functional checks

- Merged PR, changed-line and commit rankings, all-time and7-day ranges, and bot inclusion change the actual API-backed data. Commit mode shows all time, disables unsupported date ranges and links to commits.
- Current default snapshot: apoorvdarshan, rank19,40 merged PRs;7-day view rank6 with3 merged PRs; commit view rank39 with43 commits. These are timestamped observations, not hardcoded values.
- Search returns the current user's single matching row without changing the hero totals; unmatched input offers Clear search. Find me clears the query and focuses the highlighted row. Show more increased visible rows from4 plus pin to24.
- Username dialog rejects consecutive hyphens, accepts a valid username, updates/persists its rank, and restores the current user after QA. Escape closes native dialogs.
- System theme follows emulated light/dark settings. Explicit light/dark controls work. Screenshots and accessibility checked in both schemes.
- Share preview created a real2400×1260 canvas; downloaded PNG dimensions verified. Copy text succeeded. Mobile share dialog fits390×844. Card generation uses a request guard so an older render cannot overwrite a newer identity.
- Real Refresh completed successfully. A simulated503 refresh preserved rank19, restored the refresh button and displayed the cached-data message; the mock was removed afterward.
- `npm test`:8 meaningful model regressions passed (ties, bot filtering, rolling periods/boundaries, line totals/weekly buckets, commits, personal target score, case-insensitive authors, URL validation).
- JavaScript/server syntax checks and `git diff --check` passed.
- axe via agent-browser, WCAG2A/AA:0 violations and0 incomplete checks for desktop light, desktop dark and mobile dark. This is automated coverage, not a full accessibility certification.

Remaining intentional deviations: live data and avatars, darker accessible green, real PR titles producing a taller feed, sticky navigation in the scrolled screenshot, functional username/share/error states, and responsive/dark extensions. These are documented product adaptations. No unresolved clipping, broken media, inert controls, or horizontal overflow was found.

Final previews are retained as design handoff artifacts. Temporary screenshots, test downloads and machine-readable QA reports were removed. The repository has no Git remote configured; the implementation can be committed locally but cannot be pushed until a remote exists.
