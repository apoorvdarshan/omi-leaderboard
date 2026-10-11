# Omi Leaderboard

[Open the leaderboard](https://apoorvdarshan.github.io/omi-leaderboard/)

A community-built leaderboard for [BasedHardware/omi](https://github.com/BasedHardware/omi). Explore merged PRs, lines changed, commits, and weekly rank movement. Enter a GitHub username to find and share your rank. The homepage starts with no person selected.

## Automatic updates

GitHub Actions fetches public contribution data and deploys a static snapshot to GitHub Pages on every push to `master`, on manual workflow runs, and at minutes **17 and 47 of every hour (UTC)**. No running laptop or separate backend is needed. An open page checks for updated data every five minutes and when you return to its tab. Refresh loads the latest published snapshot.

The “Updated” timestamp reflects the last successful data sync. Failed builds leave the previous deployment online. GitHub can delay scheduled runs and automatically disables schedules in public repositories after 60 days without repository activity; re-enable the workflow in the Actions tab if that happens. [GitHub schedule documentation](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).

Only public PR metadata and contributor counts are published. The workflow uses its temporary `GITHUB_TOKEN` during the build; no token is included in the site. An incremental Actions cache avoids fetching the entire history every time.

## Run locally

Requires Node.js 22 or later and either an authenticated [GitHub CLI](https://cli.github.com/) (`gh auth login`) or `GITHUB_TOKEN` in the environment. There are no npm dependencies.

```sh
npm start
```

Open http://localhost:3000. Local mode serves data through the Node server and can request an immediate GitHub sync.

```sh
npm test
npm run build
python3 -m http.server 3001 --directory dist
```

The build writes a standalone site into `dist/`. All asset and data paths work beneath a GitHub Pages project path. Local cache and generated output are ignored by Git.

## Ranking definitions

- **Merged PRs:** pull requests merged into the Omi repository, grouped by author.
- **Lines changed:** additions plus deletions in those merged PRs; not a measure of code quality.
- **Commits:** GitHub's contributor counts on the default branch, available for all time.
- **Weekly movement:** comparison with the same ranking window seven days earlier; unavailable for commits.
- Equal totals share a competition rank. Bots are hidden by default.

This is an independent community project, not an official Omi product. Omi branding belongs to its respective owners; the studio hero artwork was generated for this site.
