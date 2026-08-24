# Pantry verification task spec

You are verifying food-pantry listings for AccessBelt, an Alabama food-assistance app. The listings were bulk-imported from food-bank PDF exports and have never been individually confirmed. Your job: for each org in your assigned batch, use WebSearch to determine whether it still exists and plausibly still runs food assistance, and capture its official website if it has one.

## Input
Read your assigned batch file (path given in your prompt). It contains `{ batch, counties, rows: [{ id, name, phone, website, address }] }`.

## Research method
For each row, run searches like:
- `"<name>" <city> Alabama`
- `"<name>" food pantry`
- `"<name>" "<phone>"`

Look for: an official website, active social media, a current third-party pantry-directory listing (foodpantries.org, findhelp.org, feedam.org, Feeding America, 211), recent news/social mentions, a "permanently closed" flag, or evidence the org is defunct/merged/renamed/moved.

Batch your searches sensibly — you do not need three searches per row if the first is conclusive. Aim to finish the whole batch.

## Verdict rules (important)
- `active` — corroborating evidence found: own website, active social media presence, or a current third-party pantry-directory listing.
- `uncertain` — little or no web footprint. **This is the correct verdict for small rural church pantries with no web presence.** It is NOT a closure signal.
- `closed` — ONLY with positive evidence: a "permanently closed" tag, a dissolution notice, the address now occupied by an unrelated business with no trace of the org, or the listing clearly traces to a different org in a different city (bad import data).

When in doubt between `uncertain` and `closed`, choose `uncertain`. A wrongly-removed pantry is worse than an unverified one — someone hungry may be relying on it.

## Website rules
Record `website` ONLY if it is the org's own domain or an official program page on its parent org's domain (e.g. a denomination or association site).

Do NOT record: third-party directories (foodpantries.org, Yelp, GuideStar, Manta, chamberofcommerce.com, causeiq, dnb.com), bare Facebook/Instagram pages, or a generic denominational homepage that isn't about this specific location. If there is no qualifying site, use `null`.

Include the scheme (`https://...`). Prefer the food-pantry/ministry page over the bare homepage when the org has a dedicated one.

## Data issues
If the org is clearly active but the on-file data looks stale or wrong (phone differs from current published number, address changed, org renamed), note it in `dataIssue`. Otherwise `null`. Do not guess corrected values you did not actually see in a source.

## Output — REQUIRED
Write a JSON file to `/Users/Thad/Downloads/pantrybelt-v3-3/tools/.tmp/verify/result-<batch>.json` (use your batch number, e.g. `result-07.json`), with exactly this shape:

```json
{
  "batch": "07",
  "results": [
    {
      "id": "<the id from the input, unchanged>",
      "name": "<name>",
      "verdict": "active" | "uncertain" | "closed",
      "website": "https://example.org" | null,
      "evidence": "<one short line: what you found and where>",
      "dataIssue": "<short note>" | null
    }
  ]
}
```

Every input row must appear exactly once in `results`, with its `id` copied verbatim — the ids are Firestore document keys and are how results get applied.

After writing the file, reply with ONLY a one-line summary: `batch <n>: <x> active, <y> uncertain, <z> closed, <w> websites found`. Do not paste the table into your reply.
