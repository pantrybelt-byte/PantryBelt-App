-- PantryBelt — BigQuery Reporting Views
--
-- Prerequisite (not run by this file): install the official "Stream Firestore
-- to BigQuery" extension for each analytics_* collection listed below. That
-- requires the Firebase project to be on the Blaze (pay-as-you-go) plan:
--
--   firebase ext:install firebase/firestore-bigquery-export
--
-- Run it once per collection (COLLECTION_PATH = analytics_referrals, then
-- again for analytics_pantry_engagements, etc.). The installer will ask for
-- a BigQuery dataset name — pick one name and reuse it for every instance
-- (this file assumes `firestore_export`; find/replace if you choose another).
--
-- Each instance creates `<collection>_raw_changelog` (append-only write log)
-- and a `<collection>_raw_latest` view (current state of every still-live
-- document, which is what these views build on — no double-counting from
-- historical changelog rows).
--
-- Point Looker Studio at the views below (or query them directly via
-- "Custom Query" data sources) rather than the raw_latest views, so report
-- viewers see typed columns instead of a JSON blob.
--
-- Replace `firestore_export` with your actual dataset name before running.

-- ─────────────────────────────────────────────────────────────────────────
-- GAP 2 + GAP 3 — SNAP/WIC Referral Count & Emergency Help Requests
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW `firestore_export.v_referrals` AS
SELECT
  document_id,
  timestamp,
  JSON_EXTRACT_SCALAR(data, '$.referralType') AS referral_type,
  JSON_EXTRACT_SCALAR(data, '$.source')       AS source,
  JSON_EXTRACT_SCALAR(data, '$.county')       AS county,
  CAST(JSON_EXTRACT_SCALAR(data, '$.isEmergency') AS BOOL) AS is_emergency,
  CAST(JSON_EXTRACT_SCALAR(data, '$.hourOfDay') AS INT64)  AS hour_of_day,
  CAST(JSON_EXTRACT_SCALAR(data, '$.dayOfWeek') AS INT64)  AS day_of_week,
  JSON_EXTRACT_SCALAR(data, '$.monthYear')    AS month_year
FROM `firestore_export.analytics_referrals_raw_latest`;

-- ─────────────────────────────────────────────────────────────────────────
-- GAP 1 + GAP 6 — Successful Connections & Pantry-Level Utilization
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW `firestore_export.v_pantry_engagements` AS
SELECT
  document_id,
  timestamp,
  JSON_EXTRACT_SCALAR(data, '$.pantryId')   AS pantry_id,
  JSON_EXTRACT_SCALAR(data, '$.pantryName') AS pantry_name,
  JSON_EXTRACT_SCALAR(data, '$.county')     AS county,
  JSON_EXTRACT_SCALAR(data, '$.city')       AS city,
  JSON_EXTRACT_SCALAR(data, '$.action')     AS action,
  CAST(JSON_EXTRACT_SCALAR(data, '$.hourOfDay') AS INT64) AS hour_of_day,
  CAST(JSON_EXTRACT_SCALAR(data, '$.dayOfWeek') AS INT64) AS day_of_week,
  JSON_EXTRACT_SCALAR(data, '$.monthYear')  AS month_year
FROM `firestore_export.analytics_pantry_engagements_raw_latest`;

-- ─────────────────────────────────────────────────────────────────────────
-- GAP 7 — Search-to-Success Rate
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW `firestore_export.v_search_outcomes` AS
SELECT
  document_id,
  timestamp,
  JSON_EXTRACT_SCALAR(data, '$.topic')   AS topic,
  JSON_EXTRACT_SCALAR(data, '$.outcome') AS outcome,
  JSON_EXTRACT_SCALAR(data, '$.county')  AS county,
  CAST(JSON_EXTRACT_SCALAR(data, '$.success') AS BOOL) AS success,
  JSON_EXTRACT_SCALAR(data, '$.monthYear') AS month_year
FROM `firestore_export.analytics_search_outcomes_raw_latest`;

-- ─────────────────────────────────────────────────────────────────────────
-- Pete AI query volume (feeds the success-rate view below + general
-- topic-demand reporting). Deliberately excludes rawMessage — a county
-- report needs topic/volume, not the sanitized-but-still-user-authored
-- text of each conversation.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW `firestore_export.v_pete_searches` AS
SELECT
  document_id,
  timestamp,
  JSON_EXTRACT_SCALAR(data, '$.topic')  AS topic,
  JSON_EXTRACT_SCALAR(data, '$.source') AS source,
  JSON_EXTRACT_SCALAR(data, '$.county') AS county,
  CAST(JSON_EXTRACT_SCALAR(data, '$.hourOfDay') AS INT64) AS hour_of_day,
  CAST(JSON_EXTRACT_SCALAR(data, '$.dayOfWeek') AS INT64) AS day_of_week,
  JSON_EXTRACT_SCALAR(data, '$.monthYear') AS month_year
FROM `firestore_export.analytics_searches_raw_latest`;

-- Search-to-success rate is only meaningful alongside search volume by topic:
CREATE OR REPLACE VIEW `firestore_export.v_search_to_success_rate` AS
SELECT
  s.topic,
  s.month_year,
  COUNT(*) AS total_searches,
  COUNTIF(o.outcome IN ('map_opened', 'pantry_viewed')) AS followed_up,
  SAFE_DIVIDE(COUNTIF(o.outcome IN ('map_opened', 'pantry_viewed')), COUNT(*)) AS success_rate
FROM `firestore_export.v_pete_searches` s
LEFT JOIN `firestore_export.v_search_outcomes` o
  ON o.topic = s.topic AND o.month_year = s.month_year
GROUP BY s.topic, s.month_year;

-- ─────────────────────────────────────────────────────────────────────────
-- GAP 5 — Return Sessions / Sustained Impact
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW `firestore_export.v_sessions` AS
SELECT
  document_id AS device_id,
  timestamp AS last_seen,
  CAST(JSON_EXTRACT_SCALAR(data, '$.sessionCount') AS INT64) AS session_count,
  JSON_EXTRACT_SCALAR(data, '$.monthYear') AS month_year
FROM `firestore_export.analytics_sessions_raw_latest`;

-- ─────────────────────────────────────────────────────────────────────────
-- Food desert detection (zero-pantry locations) & geographic reach
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW `firestore_export.v_food_deserts` AS
SELECT
  document_id,
  timestamp,
  JSON_EXTRACT_SCALAR(data, '$.county') AS county,
  JSON_EXTRACT_SCALAR(data, '$.city')   AS city,
  CAST(JSON_EXTRACT_SCALAR(data, '$.lat') AS FLOAT64) AS lat,
  CAST(JSON_EXTRACT_SCALAR(data, '$.lng') AS FLOAT64) AS lng,
  JSON_EXTRACT_SCALAR(data, '$.monthYear') AS month_year
FROM `firestore_export.analytics_food_deserts_raw_latest`;

CREATE OR REPLACE VIEW `firestore_export.v_user_counties` AS
SELECT
  document_id,
  timestamp,
  JSON_EXTRACT_SCALAR(data, '$.county') AS county,
  JSON_EXTRACT_SCALAR(data, '$.city')   AS city,
  JSON_EXTRACT_SCALAR(data, '$.source') AS source,
  JSON_EXTRACT_SCALAR(data, '$.monthYear') AS month_year
FROM `firestore_export.analytics_user_counties_raw_latest`;

-- ─────────────────────────────────────────────────────────────────────────
-- GAP 8 — Monthly County Impact Summary (Contract Deliverable)
-- Already pre-aggregated by updateMonthlySummary() in the app; this view
-- just gives it typed columns. This is the primary table for the Looker
-- Studio "Monthly County Report" page — one row per county per month.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW `firestore_export.v_monthly_county_summary` AS
SELECT
  JSON_EXTRACT_SCALAR(data, '$.county')     AS county,
  JSON_EXTRACT_SCALAR(data, '$.monthYear')  AS month_year,
  CAST(JSON_EXTRACT_SCALAR(data, '$.sessions')    AS INT64) AS sessions,
  CAST(JSON_EXTRACT_SCALAR(data, '$.searches')    AS INT64) AS searches,
  CAST(JSON_EXTRACT_SCALAR(data, '$.referrals')   AS INT64) AS referrals,
  CAST(JSON_EXTRACT_SCALAR(data, '$.emergencies') AS INT64) AS emergencies,
  CAST(JSON_EXTRACT_SCALAR(data, '$.pantryViews') AS INT64) AS pantry_views,
  CAST(JSON_EXTRACT_SCALAR(data, '$.directions')  AS INT64) AS directions,
  CAST(JSON_EXTRACT_SCALAR(data, '$.calls')       AS INT64) AS calls,
  CAST(JSON_EXTRACT_SCALAR(data, '$.foodDeserts') AS INT64) AS food_deserts,
  timestamp AS last_updated
FROM `firestore_export.analytics_monthly_summary_raw_latest`;
