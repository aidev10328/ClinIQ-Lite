-- Rename AFTERNOON to EVENING in ShiftType enum
-- This is a safe migration that adds EVENING and migrates existing data

-- Step 1: Add EVENING to the enum
ALTER TYPE "ShiftType" ADD VALUE IF NOT EXISTS 'EVENING';

-- Step 2: Update existing data from AFTERNOON to EVENING
UPDATE "DoctorShiftTemplate" SET "shiftType" = 'EVENING' WHERE "shiftType" = 'AFTERNOON';
UPDATE "DoctorWeeklyShift" SET "shiftType" = 'EVENING' WHERE "shiftType" = 'AFTERNOON';
UPDATE "Slot" SET "shiftType" = 'EVENING' WHERE "shiftType" = 'AFTERNOON';

-- Note: PostgreSQL doesn't support removing enum values directly.
-- The AFTERNOON value will remain in the enum but won't be used.
-- This is safe as new code only uses EVENING.
