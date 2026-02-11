-- Add CHECKED_IN to AppointmentStatus enum
ALTER TYPE "AppointmentStatus" ADD VALUE IF NOT EXISTS 'CHECKED_IN' AFTER 'BOOKED';
