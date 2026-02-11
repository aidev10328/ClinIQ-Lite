/**
 * Script to regenerate all slots for all doctors based on their current schedules.
 * This will:
 * 1. Delete ALL existing slots (both available and booked)
 * 2. Generate new slots for all configured doctors from today until Dec 31st
 *
 * Usage: npx ts-node scripts/regenerate-all-slots.ts
 */

import { PrismaClient, ShiftType, SlotStatus } from '@prisma/client';

const prisma = new PrismaClient();

// Helper to format time from HH:MM to minutes since midnight
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

// Generate slots for a doctor for a specific date
function generateSlotsForDate(
  clinicId: string,
  doctorId: string,
  date: Date,
  timezone: string,
  durationMin: number,
  shiftTemplates: Array<{ shiftType: ShiftType; startTime: string; endTime: string }>,
  weeklyShifts: Array<{ dayOfWeek: number; shiftType: ShiftType; isEnabled: boolean }>,
): Array<{
  clinicId: string;
  doctorId: string;
  date: Date;
  startsAt: Date;
  endsAt: Date;
  shiftType: ShiftType;
  status: SlotStatus;
}> {
  const slots: Array<{
    clinicId: string;
    doctorId: string;
    date: Date;
    startsAt: Date;
    endsAt: Date;
    shiftType: ShiftType;
    status: SlotStatus;
  }> = [];

  const dayOfWeek = date.getDay();

  // Get enabled shifts for this day
  const enabledShifts = weeklyShifts.filter(
    (ws) => ws.dayOfWeek === dayOfWeek && ws.isEnabled,
  );

  for (const enabledShift of enabledShifts) {
    // Find the template for this shift type
    const template = shiftTemplates.find(
      (t) => t.shiftType === enabledShift.shiftType,
    );
    if (!template) continue;

    const startMinutes = timeToMinutes(template.startTime);
    const endMinutes = timeToMinutes(template.endTime);

    // Generate slots within this shift
    let currentMinutes = startMinutes;
    while (currentMinutes + durationMin <= endMinutes) {
      const slotStartHours = Math.floor(currentMinutes / 60);
      const slotStartMins = currentMinutes % 60;

      const slotEndMinutes = currentMinutes + durationMin;
      const slotEndHours = Math.floor(slotEndMinutes / 60);
      const slotEndMins = slotEndMinutes % 60;

      // Create UTC datetime for the slot
      // Note: This is simplified - in production you'd want proper timezone handling
      const startsAt = new Date(date);
      startsAt.setHours(slotStartHours, slotStartMins, 0, 0);

      const endsAt = new Date(date);
      endsAt.setHours(slotEndHours, slotEndMins, 0, 0);

      slots.push({
        clinicId,
        doctorId,
        date: new Date(date.toISOString().split('T')[0]),
        startsAt,
        endsAt,
        shiftType: enabledShift.shiftType,
        status: SlotStatus.AVAILABLE,
      });

      currentMinutes += durationMin;
    }
  }

  return slots;
}

async function main() {
  console.log('=== Slot Regeneration Script ===\n');

  // Step 1: Delete all existing slots
  console.log('Step 1: Deleting all existing slots...');
  const deleteResult = await prisma.slot.deleteMany({});
  console.log(`  Deleted ${deleteResult.count} slots\n`);

  // Step 2: Get all clinics
  const clinics = await prisma.clinic.findMany({
    where: { isActive: true },
    select: { id: true, name: true, timezone: true },
  });
  console.log(`Step 2: Found ${clinics.length} active clinics\n`);

  // Step 3: Process each clinic
  let totalSlotsCreated = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // End of year
  const endDate = new Date(today.getFullYear(), 11, 31); // Dec 31st

  for (const clinic of clinics) {
    console.log(`Processing clinic: ${clinic.name}`);

    // Get all doctors with configured schedules (has shift templates and weekly shifts)
    const doctors = await prisma.doctor.findMany({
      where: {
        clinicId: clinic.id,
        isActive: true,
        hasLicense: true,
      },
      include: {
        shiftTemplates: true,
        weeklyShifts: true,
        timeOffs: {
          where: {
            endDate: { gte: today },
          },
        },
      },
    });

    console.log(`  Found ${doctors.length} active licensed doctors`);

    for (const doctor of doctors) {
      // Check if doctor has a configured schedule
      if (doctor.shiftTemplates.length === 0 || doctor.weeklyShifts.length === 0) {
        console.log(`  - ${doctor.fullName}: No schedule configured, skipping`);
        continue;
      }

      // Check if any weekly shift is enabled
      const hasEnabledShift = doctor.weeklyShifts.some((ws) => ws.isEnabled);
      if (!hasEnabledShift) {
        console.log(`  - ${doctor.fullName}: No shifts enabled, skipping`);
        continue;
      }

      console.log(`  - ${doctor.fullName}: Generating slots...`);

      // Build time-off date set for quick lookup
      const timeOffDates = new Set<string>();
      for (const timeOff of doctor.timeOffs) {
        const start = new Date(timeOff.startDate);
        const end = new Date(timeOff.endDate);
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          timeOffDates.add(d.toISOString().split('T')[0]);
        }
      }

      // Generate slots for each day
      const allSlots: Array<{
        clinicId: string;
        doctorId: string;
        date: Date;
        startsAt: Date;
        endsAt: Date;
        shiftType: ShiftType;
        status: SlotStatus;
      }> = [];

      for (let d = new Date(today); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];

        // Skip time-off days
        if (timeOffDates.has(dateStr)) {
          continue;
        }

        const daySlots = generateSlotsForDate(
          clinic.id,
          doctor.id,
          new Date(d),
          clinic.timezone,
          doctor.appointmentDurationMin,
          doctor.shiftTemplates,
          doctor.weeklyShifts,
        );

        allSlots.push(...daySlots);
      }

      // Insert slots in batches
      if (allSlots.length > 0) {
        const BATCH_SIZE = 500;
        for (let i = 0; i < allSlots.length; i += BATCH_SIZE) {
          const batch = allSlots.slice(i, i + BATCH_SIZE);
          await prisma.slot.createMany({
            data: batch,
            skipDuplicates: true,
          });
        }

        // Update doctor's scheduleConfiguredAt if not set
        if (!doctor.scheduleConfiguredAt) {
          await prisma.doctor.update({
            where: { id: doctor.id },
            data: { scheduleConfiguredAt: new Date() },
          });
        }

        console.log(`    Created ${allSlots.length} slots`);
        totalSlotsCreated += allSlots.length;
      } else {
        console.log(`    No slots generated (check schedule configuration)`);
      }
    }

    console.log('');
  }

  console.log('=== Summary ===');
  console.log(`Total slots created: ${totalSlotsCreated.toLocaleString()}`);
  console.log(`Date range: ${today.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
