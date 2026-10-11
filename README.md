# Omi Leaderboard

[Open the leaderboard](https://omi-leaderboard.apoorvdarshan.com/)

A community-built leaderboard for [BasedHardware/omi](https://github.com/BasedHardware/omi). Explore merged PRs, lines changed, commits, and weekly rank movement. Enter a GitHub username to find and share your rank. The homepage defaults to **Past 30 days**, with no person selected. Other time ranges remain available; commit counts are all-time only.

## Automatic updates

Cloudflare Workers serves the website at `omi-leaderboard.apoorvdarshan.com`, with ranking snapshots stored in Cloudflare KV. GitHub Actions fetches public contribution data and publishes it to Cloudflare on every push to `master`, on manual workflow runs, and at minutes **17 and 47 of every hour (UTC)**. No running laptop is needed. An open page checks for updated data every five minutes and when you return to its tab. Refresh loads the latest published snapshot; KV updates may take about a minute to reach other regions.

The “Updated” timestamp reflects the last successful data sync. Failed or invalid publishes preserve the previous snapshot, and the deployment includes a fallback snapshot for KV outages. GitHub can delay scheduled runs and automatically disables schedules in public repositories after 60 days without repository activity; re-enable the workflow in the Actions tab if that happens. [GitHub schedule documentation](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).

Only public PR metadata and contributor counts are published. The workflow uses its temporary `GITHUB_TOKEN` to collect data. A separate `OMI_PUBLISH_TOKEN`, stored as a Worker secret and a GitHub Actions secret, authorizes updates to this leaderboard's snapshot. No token is included in the site. An incremental Actions cache avoids fetching the entire history every time.

## Run locally

Requires Node.js 22 or later and either an authenticated [GitHub CLI](https://cli.github.com/) (`gh auth login`) or `GITHUB_TOKEN` in the environment. Wrangler is the development dependency used for Cloudflare deployments.

```sh
npm start
```

Open http://localhost:3000. Local mode serves data through the Node server and can request an immediate GitHub sync.

```sh
npm test
npm run build
python3 -m http.server 3001 --directory dist
```

The build writes a standalone site into `dist/`. Local cache and generated output are ignored by Git.

## Deploy website changes

The scheduled workflow updates ranking data. To publish frontend or Worker code changes, use the Cloudflare account configured in `wrangler.jsonc`:

```sh
npm ci
npx wrangler login
npm run deploy
```

Wrangler deploys the static assets, Worker code, KV binding, and custom domain together. Cloudflare manages the subdomain's DNS and HTTPS certificate. Existing Worker secrets survive deployments. `npm run publish:data` publishes a built snapshot when `OMI_PUBLISH_TOKEN` is provided in the environment; the Actions workflow does this automatically.

When rotating the publish token, update both `wrangler secret put OMI_PUBLISH_TOKEN` and the repository's `OMI_PUBLISH_TOKEN` Actions secret to the same random value.

## Ranking definitions

- **Merged PRs:** pull requests merged into the Omi repository, grouped by author.
- **Lines changed:** additions plus deletions in those merged PRs; not a measure of code quality.
- **Commits:** GitHub's contributor counts on the default branch, available for all time.
- **Weekly movement:** comparison with the same ranking window seven days earlier; unavailable for commits.
- Equal totals share a competition rank. Bots are hidden by default.

This is an independent community project, not an official Omi product. Omi branding belongs to its respective owners; the studio hero artwork was generated for this site.
