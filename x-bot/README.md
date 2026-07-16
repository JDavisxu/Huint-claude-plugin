# Huint X bot

Posts an AI-generated engagement tweet about Huint every 2 hours via
[`.github/workflows/x-bot.yml`](../.github/workflows/x-bot.yml). Runs entirely
in GitHub Actions — no local process or Claude session needs to stay open.

Each run:
1. Reads the last few posts from `history.jsonl` so it doesn't repeat itself.
2. Asks Claude to write one post from a rotating set of angles (explainer,
   build-in-public update, hot take, example task, rebrand teaser, one-liner).
3. Publishes it to X with your developer keys.
4. Commits the new `history.jsonl` entry back to the repo.

## One-time setup

**Note:** scheduled workflows only fire from the repository's default branch,
so this only runs automatically once merged to `main`.

1. **X developer app** — create/use an app at
   [developer.x.com](https://developer.x.com) with **Read and Write**
   permissions, OAuth 1.0a enabled, and generate:
   - API Key & Secret (consumer key/secret)
   - Access Token & Secret (for your own account, with write access)
2. **Anthropic API key** — from [console.anthropic.com](https://console.anthropic.com).
3. Add all five as **repo secrets** (Settings → Secrets and variables →
   Actions → New repository secret):
   - `X_API_KEY`
   - `X_API_SECRET`
   - `X_ACCESS_TOKEN`
   - `X_ACCESS_TOKEN_SECRET`
   - `ANTHROPIC_API_KEY`
4. Settings → Actions → General → Workflow permissions → set to
   **Read and write permissions** (needed for the bot to commit
   `history.jsonl` back).

## Test it

Actions tab → **X bot post** → Run workflow. Tick `dry_run` to generate a
post without publishing, and check the job log for the generated text.

## Tuning voice / content

Edit `PRODUCT_FACTS` and `CONTENT_PILLARS` in [`post.mjs`](./post.mjs) — the
facts block is what keeps the bot from inventing features or numbers that
aren't real, and the pillars control the rotation of angles. Update
`PRODUCT_FACTS` once the rebrand (name, positioning) is locked in.

## Local run

```bash
cd x-bot
npm install
ANTHROPIC_API_KEY=... X_API_KEY=... X_API_SECRET=... X_ACCESS_TOKEN=... X_ACCESS_TOKEN_SECRET=... DRY_RUN=true node post.mjs
```
