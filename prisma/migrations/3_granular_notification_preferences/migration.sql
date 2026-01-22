-- Migration: Granular Notification Preferences
-- Changes from simple toggles to per-channel per-type settings

-- Step 1: Add new columns with defaults
ALTER TABLE "user_notification_preferences"
ADD COLUMN "lowStockWeb" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "lowStockLine" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "lowStockEmail" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "expiringWeb" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "expiringLine" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "expiringEmail" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "movementPostedWeb" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "movementPostedLine" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "movementPostedEmail" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "prPendingWeb" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "prPendingLine" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "prPendingEmail" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "prApprovedWeb" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "prApprovedLine" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "prApprovedEmail" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "prRejectedWeb" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "prRejectedLine" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "prRejectedEmail" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "poPendingWeb" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "poPendingLine" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "poPendingEmail" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "poApprovedWeb" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "poApprovedLine" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "poApprovedEmail" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "poRejectedWeb" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "poRejectedLine" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "poRejectedEmail" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "poReceivedWeb" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "poReceivedLine" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "poReceivedEmail" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "grnCreatedWeb" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "grnCreatedLine" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "grnCreatedEmail" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "stockTakeWeb" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "stockTakeLine" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "stockTakeEmail" BOOLEAN NOT NULL DEFAULT false;

-- Step 2: Migrate existing data (preserve user settings)
-- If the old field was true and channel was enabled, set new field to true
-- Otherwise set to false

UPDATE "user_notification_preferences" SET
  -- Low Stock
  "lowStockWeb" = "notifyLowStock" AND "webEnabled",
  "lowStockLine" = "notifyLowStock" AND "lineEnabled",
  "lowStockEmail" = "notifyLowStock" AND "emailEnabled",
  -- Expiring
  "expiringWeb" = "notifyExpiring" AND "webEnabled",
  "expiringLine" = "notifyExpiring" AND "lineEnabled",
  "expiringEmail" = "notifyExpiring" AND "emailEnabled",
  -- Movement Posted
  "movementPostedWeb" = "notifyMovementPosted" AND "webEnabled",
  "movementPostedLine" = "notifyMovementPosted" AND "lineEnabled",
  "movementPostedEmail" = "notifyMovementPosted" AND "emailEnabled",
  -- PR Pending
  "prPendingWeb" = "notifyPRPending" AND "webEnabled",
  "prPendingLine" = "notifyPRPending" AND "lineEnabled",
  "prPendingEmail" = "notifyPRPending" AND "emailEnabled",
  -- PR Approved
  "prApprovedWeb" = "notifyPRApproved" AND "webEnabled",
  "prApprovedLine" = "notifyPRApproved" AND "lineEnabled",
  "prApprovedEmail" = "notifyPRApproved" AND "emailEnabled",
  -- PR Rejected
  "prRejectedWeb" = "notifyPRRejected" AND "webEnabled",
  "prRejectedLine" = "notifyPRRejected" AND "lineEnabled",
  "prRejectedEmail" = "notifyPRRejected" AND "emailEnabled",
  -- PO Pending
  "poPendingWeb" = "notifyPOPending" AND "webEnabled",
  "poPendingLine" = "notifyPOPending" AND "lineEnabled",
  "poPendingEmail" = "notifyPOPending" AND "emailEnabled",
  -- PO Approved
  "poApprovedWeb" = "notifyPOApproved" AND "webEnabled",
  "poApprovedLine" = "notifyPOApproved" AND "lineEnabled",
  "poApprovedEmail" = "notifyPOApproved" AND "emailEnabled",
  -- PO Rejected
  "poRejectedWeb" = "notifyPORejected" AND "webEnabled",
  "poRejectedLine" = "notifyPORejected" AND "lineEnabled",
  "poRejectedEmail" = "notifyPORejected" AND "emailEnabled",
  -- PO Received
  "poReceivedWeb" = "notifyPOReceived" AND "webEnabled",
  "poReceivedLine" = "notifyPOReceived" AND "lineEnabled",
  "poReceivedEmail" = "notifyPOReceived" AND "emailEnabled";

-- Step 3: Drop old columns
ALTER TABLE "user_notification_preferences"
DROP COLUMN "webEnabled",
DROP COLUMN "lineEnabled",
DROP COLUMN "emailEnabled",
DROP COLUMN "notifyLowStock",
DROP COLUMN "notifyPRPending",
DROP COLUMN "notifyPRApproved",
DROP COLUMN "notifyPRRejected",
DROP COLUMN "notifyPOPending",
DROP COLUMN "notifyPOApproved",
DROP COLUMN "notifyPORejected",
DROP COLUMN "notifyPOReceived",
DROP COLUMN "notifyMovementPosted",
DROP COLUMN "notifyExpiring";
