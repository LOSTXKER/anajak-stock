-- Migration: Granular Movement Notifications
-- Changes from 2 generic movement notification types to 10 type-specific notification types
-- Types: RECEIVE, ISSUE, TRANSFER, ADJUST, RETURN
-- Statuses: Pending, Posted

-- Step 1: Add new columns with defaults
ALTER TABLE "user_notification_preferences"
-- RECEIVE (รับเข้า)
ADD COLUMN "receivePendingWeb" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "receivePendingLine" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "receivePendingEmail" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "receivePostedWeb" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "receivePostedLine" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "receivePostedEmail" BOOLEAN NOT NULL DEFAULT false,
-- ISSUE (เบิกออก)
ADD COLUMN "issuePendingWeb" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "issuePendingLine" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "issuePendingEmail" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "issuePostedWeb" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "issuePostedLine" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "issuePostedEmail" BOOLEAN NOT NULL DEFAULT false,
-- TRANSFER (โอนย้าย)
ADD COLUMN "transferPendingWeb" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "transferPendingLine" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "transferPendingEmail" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "transferPostedWeb" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "transferPostedLine" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "transferPostedEmail" BOOLEAN NOT NULL DEFAULT false,
-- ADJUST (ปรับปรุง)
ADD COLUMN "adjustPendingWeb" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "adjustPendingLine" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "adjustPendingEmail" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "adjustPostedWeb" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "adjustPostedLine" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "adjustPostedEmail" BOOLEAN NOT NULL DEFAULT false,
-- RETURN (คืนของ)
ADD COLUMN "returnPendingWeb" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "returnPendingLine" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "returnPendingEmail" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "returnPostedWeb" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "returnPostedLine" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "returnPostedEmail" BOOLEAN NOT NULL DEFAULT false;

-- Step 2: Migrate existing data (preserve user settings)
-- Copy old movementPending* and movementPosted* values to all new type-specific columns
UPDATE "user_notification_preferences" SET
  -- RECEIVE
  "receivePendingWeb" = "movementPendingWeb",
  "receivePendingLine" = "movementPendingLine",
  "receivePendingEmail" = "movementPendingEmail",
  "receivePostedWeb" = "movementPostedWeb",
  "receivePostedLine" = "movementPostedLine",
  "receivePostedEmail" = "movementPostedEmail",
  -- ISSUE
  "issuePendingWeb" = "movementPendingWeb",
  "issuePendingLine" = "movementPendingLine",
  "issuePendingEmail" = "movementPendingEmail",
  "issuePostedWeb" = "movementPostedWeb",
  "issuePostedLine" = "movementPostedLine",
  "issuePostedEmail" = "movementPostedEmail",
  -- TRANSFER
  "transferPendingWeb" = "movementPendingWeb",
  "transferPendingLine" = "movementPendingLine",
  "transferPendingEmail" = "movementPendingEmail",
  "transferPostedWeb" = "movementPostedWeb",
  "transferPostedLine" = "movementPostedLine",
  "transferPostedEmail" = "movementPostedEmail",
  -- ADJUST
  "adjustPendingWeb" = "movementPendingWeb",
  "adjustPendingLine" = "movementPendingLine",
  "adjustPendingEmail" = "movementPendingEmail",
  "adjustPostedWeb" = "movementPostedWeb",
  "adjustPostedLine" = "movementPostedLine",
  "adjustPostedEmail" = "movementPostedEmail",
  -- RETURN
  "returnPendingWeb" = "movementPendingWeb",
  "returnPendingLine" = "movementPendingLine",
  "returnPendingEmail" = "movementPendingEmail",
  "returnPostedWeb" = "movementPostedWeb",
  "returnPostedLine" = "movementPostedLine",
  "returnPostedEmail" = "movementPostedEmail";

-- Step 3: Drop old columns
ALTER TABLE "user_notification_preferences"
DROP COLUMN "movementPostedWeb",
DROP COLUMN "movementPostedLine",
DROP COLUMN "movementPostedEmail",
DROP COLUMN "movementPendingWeb",
DROP COLUMN "movementPendingLine",
DROP COLUMN "movementPendingEmail";
