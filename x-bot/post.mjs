#!/usr/bin/env node
// Generates a short engagement post about Huint via the Claude API and
// publishes it to X. Designed to run unattended on a schedule (see
// .github/workflows/x-bot.yml) — no human in the loop per post.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TwitterApi } from "twitter-api-v2";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HISTORY_PATH = path.join(__dirname, "history.jsonl");
const HISTORY_CONTEXT_SIZE = 8;
const MAX_TWEET_LENGTH = 280;
const CLAUDE_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
const DRY_RUN = process.env.DRY_RUN === "true";

const PRODUCT_FACTS = `
Huint lets an AI agent (an "operator") request passive real-world photo
verification. The operator sends a real person (a "Tasker") to an exact GPS
coordinate through the Huint iOS app; the Tasker photographs the target, and
Huint verifies GPS proximity (and optionally an AI vision gate) before
releasing a bounty from escrow. It's infrastructure for AI agents to get
ground-truth photo proof of physical places or objects in the real world —
think "verification as a tool call." Huint is currently going through a
rebrand, so posts can tease that something new is coming without inventing
specific names, dates, or features that aren't confirmed.
`.trim();

const CONTENT_PILLARS = [
  "a punchy explainer of what Huint does, written for people who've never heard of it",
  "a build-in-public style update on momentum/progress, vague on specifics but energetic",
  "a provocative question or hot take about AI agents needing ground-truth from the physical world",
  "a short, vivid hypothetical example of a task an AI agent might ask Huint to verify",
  "a teaser about the upcoming rebrand that builds curiosity without revealing details",
  "a witty one-liner or meme-adjacent observation about the gap between digital AI agents and the physical world",
];

function assertEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function loadRecentHistory() {
  if (!existsSync(HISTORY_PATH)) return [];
  const raw = await readFile(HISTORY_PATH, "utf8");
  const lines = raw.split("\n").filter(Boolean);
  return lines
    .slice(-HISTORY_CONTEXT_SIZE)
    .map((line) => JSON.parse(line));
}

async function appendHistory(entry) {
  await mkdir(path.dirname(HISTORY_PATH), { recursive: true });
  await writeFile(HISTORY_PATH, JSON.stringify(entry) + "\n", { flag: "a" });
}

function pickPillar(historyCount) {
  return CONTENT_PILLARS[historyCount % CONTENT_PILLARS.length];
}

async function generateTweet(recentPosts, pillar) {
  const apiKey = assertEnv("ANTHROPIC_API_KEY");

  const avoidRepeats = recentPosts.length
    ? `Do not repeat the wording, structure, or angle of these recent posts:\n${recentPosts
        .map((p) => `- ${p.text}`)
        .join("\n")}`
    : "This is the first post — no history to avoid yet.";

  const systemPrompt = `You are writing a single X (Twitter) post to drive engagement for Huint, an early-stage startup. Facts you can rely on:\n\n${PRODUCT_FACTS}\n\nRules:\n- Output ONLY the post text, nothing else — no quotes, no preamble, no hashtags spam (0-1 relevant hashtag max, usually 0).\n- Hard limit ${MAX_TWEET_LENGTH} characters.\n- Sound like a real founder/builder, not corporate marketing copy.\n- Do not invent specific numbers, customer names, dates, or features that weren't given to you.\n- Today's angle: ${pillar}.\n${avoidRepeats}`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 300,
      system: systemPrompt,
      messages: [
        { role: "user", content: "Write today's post." },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Claude API error ${response.status}: ${body}`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text?.trim();
  if (!text) throw new Error("Claude API returned no text content");

  return text.length > MAX_TWEET_LENGTH
    ? text.slice(0, MAX_TWEET_LENGTH - 1) + "…"
    : text;
}

async function postToX(text) {
  const client = new TwitterApi({
    appKey: assertEnv("X_API_KEY"),
    appSecret: assertEnv("X_API_SECRET"),
    accessToken: assertEnv("X_ACCESS_TOKEN"),
    accessSecret: assertEnv("X_ACCESS_TOKEN_SECRET"),
  });

  const { data } = await client.v2.tweet(text);
  return data;
}

async function main() {
  const recentPosts = await loadRecentHistory();
  const pillar = pickPillar(recentPosts.length);
  const text = await generateTweet(recentPosts, pillar);

  console.log(`Generated (${text.length} chars, pillar: "${pillar}"):\n${text}\n`);

  if (DRY_RUN) {
    console.log("DRY_RUN=true — skipping actual post to X.");
    return;
  }

  const tweet = await postToX(text);
  console.log(`Posted: https://x.com/i/web/status/${tweet.id}`);

  await appendHistory({
    timestamp: new Date().toISOString(),
    text,
    pillar,
    tweetId: tweet.id,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
