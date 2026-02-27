import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding ClinIQ Lite database...\n');

  // ============================================
  // 1. Create/Update Admin User
  // ============================================
  const adminPassword = await bcrypt.hash('Admin123!', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@cliniq.local' },
    update: {},
    create: {
      email: 'admin@cliniq.local',
      passwordHash: adminPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMIN',
    },
  });
  console.log('1. Admin user:', admin.email);

  // ============================================
  // 2. Create Platform Selectables (Dropdowns)
  // ============================================
  console.log('\n2. Creating platform selectables...');

  // Specializations
  const specializations = [
    'General Practice',
    'Cardiology',
    'Dermatology',
    'Orthopedics',
    'Pediatrics',
    'Gynecology',
    'ENT',
    'Ophthalmology',
    'Psychiatry',
    'Neurology',
  ];

  for (let i = 0; i < specializations.length; i++) {
    await prisma.platformSelectable.upsert({
      where: { id: `spec-${i + 1}` },
      update: { value: specializations[i], sortOrder: i },
      create: {
        id: `spec-${i + 1}`,
        key: 'SPECIALIZATION',
        value: specializations[i],
        sortOrder: i,
        isActive: true,
      },
    });
  }
  console.log(`   - Created ${specializations.length} specializations`);

  // Appointment durations
  const durations = [10, 15, 20, 30, 45, 60];

  for (let i = 0; i < durations.length; i++) {
    await prisma.platformSelectable.upsert({
      where: { id: `dur-${i + 1}` },
      update: { value: `${durations[i]}`, sortOrder: i },
      create: {
        id: `dur-${i + 1}`,
        key: 'APPOINTMENT_DURATION',
        value: `${durations[i]}`,
        sortOrder: i,
        isActive: true,
      },
    });
  }
  console.log(`   - Created ${durations.length} appointment durations`);

  // ============================================
  // 3. Create Demo Clinic
  // ============================================
  console.log('\n3. Creating demo clinic...');

  const demoClinic = await prisma.clinic.upsert({
    where: { id: 'demo-clinic-001' },
    update: {},
    create: {
      id: 'demo-clinic-001',
      name: 'ClinIQ Demo Clinic',
      phone: '555-123-4567',
      countryCode: 'US',
      street: '123 Medical Center Drive, Suite 100',
      city: 'Chicago',
      state: 'IL',
      postalCode: '60601',
      country: 'United States',
      timezone: 'America/Chicago',
      authMode: 'PASSWORD',
      isActive: true,
    },
  });
  console.log(`   - Clinic: ${demoClinic.name}`);

  // ============================================
  // 4. Map Admin User as Clinic Manager
  // ============================================
  console.log('\n4. Creating clinic user mapping...');

  const clinicUser = await prisma.clinicUser.upsert({
    where: {
      clinicId_userId: {
        clinicId: demoClinic.id,
        userId: admin.id,
      },
    },
    update: {},
    create: {
      clinicId: demoClinic.id,
      userId: admin.id,
      role: 'CLINIC_MANAGER',
      isActive: true,
    },
  });
  console.log(`   - ${admin.email} -> CLINIC_MANAGER at ${demoClinic.name}`);

  // ============================================
  // 5. Create Demo Doctor
  // ============================================
  console.log('\n5. Creating demo doctor...');

  const demoDoctor = await prisma.doctor.upsert({
    where: { id: 'demo-doctor-001' },
    update: {},
    create: {
      id: 'demo-doctor-001',
      clinicId: demoClinic.id,
      fullName: 'Dr. Sarah Johnson',
      specialization: 'General Practice',
      appointmentDurationMin: 15,
      isActive: true,
    },
  });
  console.log(`   - Doctor: ${demoDoctor.fullName} (${demoDoctor.specialization})`);

  // ============================================
  // 6. Create Doctor Schedule (Mon-Fri, 9am-5pm)
  // ============================================
  console.log('\n6. Creating doctor schedule...');

  // Monday = 1, Tuesday = 2, ..., Friday = 5
  const workDays = [1, 2, 3, 4, 5];
  const dayNames = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

  for (const dayOfWeek of workDays) {
    // Morning session: 09:00 - 13:00
    await prisma.doctorSchedule.upsert({
      where: {
        doctorId_dayOfWeek_startTime_endTime: {
          doctorId: demoDoctor.id,
          dayOfWeek,
          startTime: '09:00',
          endTime: '13:00',
        },
      },
      update: {},
      create: {
        clinicId: demoClinic.id,
        doctorId: demoDoctor.id,
        dayOfWeek,
        startTime: '09:00',
        endTime: '13:00',
        isEnabled: true,
      },
    });

    // Evening session: 14:00 - 17:00
    await prisma.doctorSchedule.upsert({
      where: {
        doctorId_dayOfWeek_startTime_endTime: {
          doctorId: demoDoctor.id,
          dayOfWeek,
          startTime: '14:00',
          endTime: '17:00',
        },
      },
      update: {},
      create: {
        clinicId: demoClinic.id,
        doctorId: demoDoctor.id,
        dayOfWeek,
        startTime: '14:00',
        endTime: '17:00',
        isEnabled: true,
      },
    });

    console.log(`   - ${dayNames[dayOfWeek]}: 09:00-13:00, 14:00-17:00`);
  }

  // ============================================
  // 7. Create Doctor Shift Templates
  // ============================================
  console.log('\n7. Creating doctor shift templates...');

  // Morning: 10:30 - 13:00
  await prisma.doctorShiftTemplate.upsert({
    where: {
      doctorId_shiftType: {
        doctorId: demoDoctor.id,
        shiftType: 'MORNING',
      },
    },
    update: {},
    create: {
      clinicId: demoClinic.id,
      doctorId: demoDoctor.id,
      shiftType: 'MORNING',
      startTime: '10:30',
      endTime: '13:00',
    },
  });
  console.log('   - Morning: 10:30-13:00');

  // Evening: 16:00 - 20:30
  await prisma.doctorShiftTemplate.upsert({
    where: {
      doctorId_shiftType: {
        doctorId: demoDoctor.id,
        shiftType: 'EVENING',
      },
    },
    update: {},
    create: {
      clinicId: demoClinic.id,
      doctorId: demoDoctor.id,
      shiftType: 'EVENING',
      startTime: '16:00',
      endTime: '20:30',
    },
  });
  console.log('   - Evening: 16:00-20:30');

  // ============================================
  // 8. Create Doctor Weekly Shifts
  // ============================================
  console.log('\n8. Creating doctor weekly shifts...');

  const weekDayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const shiftTypes: Array<'MORNING' | 'EVENING'> = ['MORNING', 'EVENING'];

  for (let dayOfWeek = 0; dayOfWeek <= 6; dayOfWeek++) {
    // Mon-Fri: Morning + Evening enabled
    // Sat-Sun: All disabled
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;

    for (const shiftType of shiftTypes) {
      const isEnabled = isWeekday;

      await prisma.doctorWeeklyShift.upsert({
        where: {
          doctorId_dayOfWeek_shiftType: {
            doctorId: demoDoctor.id,
            dayOfWeek,
            shiftType,
          },
        },
        update: { isEnabled },
        create: {
          clinicId: demoClinic.id,
          doctorId: demoDoctor.id,
          dayOfWeek,
          shiftType,
          isEnabled,
        },
      });
    }

    if (isWeekday) {
      console.log(`   - ${weekDayNames[dayOfWeek]}: Morning ✓, Evening ✓, Night ✗`);
    } else {
      console.log(`   - ${weekDayNames[dayOfWeek]}: All shifts disabled`);
    }
  }

  // ============================================
  // 9. Create Doctor Time Off entries
  // ============================================
  console.log('\n9. Creating doctor time off entries...');

  // Feb 4, 2026 - Break
  await prisma.doctorTimeOff.create({
    data: {
      clinicId: demoClinic.id,
      doctorId: demoDoctor.id,
      startDate: new Date('2026-02-04'),
      endDate: new Date('2026-02-04'),
      type: 'BREAK',
      reason: 'Personal appointment',
    },
  });
  console.log('   - Feb 4, 2026: Break (Personal appointment)');

  // Feb 10, 2026 - Break
  await prisma.doctorTimeOff.create({
    data: {
      clinicId: demoClinic.id,
      doctorId: demoDoctor.id,
      startDate: new Date('2026-02-10'),
      endDate: new Date('2026-02-10'),
      type: 'BREAK',
      reason: 'Conference',
    },
  });
  console.log('   - Feb 10, 2026: Break (Conference)');

  // Feb 11-12, 2026 - Break
  await prisma.doctorTimeOff.create({
    data: {
      clinicId: demoClinic.id,
      doctorId: demoDoctor.id,
      startDate: new Date('2026-02-11'),
      endDate: new Date('2026-02-12'),
      type: 'BREAK',
      reason: 'Family event',
    },
  });
  console.log('   - Feb 11-12, 2026: Break (Family event)');

  // Feb 24-25, 2026 - Vacation
  await prisma.doctorTimeOff.create({
    data: {
      clinicId: demoClinic.id,
      doctorId: demoDoctor.id,
      startDate: new Date('2026-02-24'),
      endDate: new Date('2026-02-25'),
      type: 'VACATION',
      reason: 'Winter vacation',
    },
  });
  console.log('   - Feb 24-25, 2026: Vacation (Winter vacation)');

  // ============================================
  // 10. Create Demo Patient (for testing)
  // ============================================
  console.log('\n10. Creating demo patient...');

  const demoPatient = await prisma.patient.upsert({
    where: {
      phone: '+15559876543',
    },
    update: {},
    create: {
      clinicId: demoClinic.id,
      fullName: 'John Smith',
      phone: '+15559876543',
    },
  });
  console.log(`   - Patient: ${demoPatient.fullName} (${demoPatient.phone})`);

  // ============================================
  // 11. Create Initial Changelog Entries
  // ============================================
  console.log('\n11. Creating initial changelog entries...');

  // Bug Fix 1: Duplicate Token Numbers
  await prisma.changeLog.upsert({
    where: { number: 1 },
    update: {},
    create: {
      type: 'BUG_FIX',
      title: 'Fix duplicate token numbers in Daily Queue',
      description: 'In some cases, the same token number was being allocated to two patients - one completed and one in the waitlist. This occurred when multiple patients were checking in simultaneously.',
      rootCause: 'Position queries for determining the next token number were running outside database transactions, allowing race conditions when multiple patients check in at the same time.',
      resolution: 'Moved all position queries inside database transactions using tx.queueEntry.findFirst() instead of this.prisma.queueEntry.findFirst(). Fixed in three locations:\n1. appointments.service.ts - markNoShow() function\n2. appointments.service.ts - checkinAppointment() function\n3. queue.service.ts - createWalkin() function',
      changedFiles: [
        'apps/api/src/v1/appointments/appointments.service.ts',
        'apps/api/src/v1/queue/queue.service.ts',
      ],
      impact: 'No impact on existing functionality. Token numbers will now be unique within each doctor\'s queue for the day.',
      reportedBy: 'User',
      resolvedBy: 'Claude Code',
      resolvedAt: new Date(),
    },
  });
  console.log('   - Bug Fix #1: Duplicate token numbers');

  // Bug Fix 2: Doctor Availability Status
  await prisma.changeLog.upsert({
    where: { number: 2 },
    update: {},
    create: {
      type: 'BUG_FIX',
      title: 'Fix incorrect "Doctor is Available" status on patient link',
      description: 'The patient-facing queue status page was showing "Doctor is Available" even when the doctor had not checked in for the day.',
      rootCause: 'The getQueueByToken() function in queue.service.ts only checked if the doctor was currently busy with a patient (isDoctorBusy), but did not verify whether the doctor had actually checked in for the day.',
      resolution: 'Added a query to DoctorDailyCheckIn table to verify doctor check-in status. Added isDoctorCheckedIn boolean to the response. Updated the patient page UI to show three states:\n- "Not Available" (gray) - Doctor hasn\'t checked in\n- "In Session" (amber) - Doctor is with a patient\n- "Available" (green) - Doctor is checked in and ready',
      changedFiles: [
        'apps/api/src/v1/queue/queue.service.ts',
        'apps/web/lib/api.ts',
        'apps/web/app/p/[token]/page.tsx',
      ],
      impact: 'Improved patient experience - they now see accurate doctor availability status.',
      reportedBy: 'User',
      resolvedBy: 'Claude Code',
      resolvedAt: new Date(),
    },
  });
  console.log('   - Bug Fix #2: Doctor availability status');

  // Feature: Changelog System
  await prisma.changeLog.upsert({
    where: { number: 3 },
    update: {},
    create: {
      type: 'FEATURE',
      title: 'Add Change Log tracking system for admin',
      description: 'Added a comprehensive changelog tracking system that allows administrators to document and view all bug fixes, features, and enhancements made to the system.',
      resolution: 'Created new ChangeLog table in database with fields for number, timestamp, type, description, root cause, resolution, changed files, and impact. Built admin API endpoints for CRUD operations and statistics. Created admin UI page at /admin/changelog with filtering, search, and detail views.',
      changedFiles: [
        'apps/api/prisma/schema.prisma',
        'apps/api/src/admin/admin-changelog.service.ts',
        'apps/api/src/admin/admin-changelog.controller.ts',
        'apps/api/src/admin/admin.module.ts',
        'apps/web/lib/api.ts',
        'apps/web/app/admin/changelog/page.tsx',
        'apps/api/prisma/seed.ts',
      ],
      impact: 'New feature - provides visibility into all changes made to the system for audit and tracking purposes.',
      reportedBy: 'User',
      resolvedBy: 'Claude Code',
      resolvedAt: new Date(),
    },
  });
  console.log('   - Feature #3: Changelog tracking system');

  // ============================================
  // Summary
  // ============================================
  console.log('\n========================================');
  console.log('Seeding completed successfully!');
  console.log('========================================');
  console.log('\nDemo Credentials:');
  console.log('  Email: admin@cliniq.local');
  console.log('  Password: Admin123!');
  console.log('\nDemo Data:');
  console.log(`  Clinic: ${demoClinic.name}`);
  console.log(`  Doctor: ${demoDoctor.fullName}`);
  console.log('  Shift Templates: Morning, Evening, Night');
  console.log('  Weekly Schedule: Mon-Fri (Morning + Evening)');
  console.log('  Time Off: Feb 4, 10, 11-12, 24-25');
  console.log(`  Patient: ${demoPatient.fullName}`);
  console.log('  Changelog: 3 initial entries');
  console.log('========================================\n');
}

main()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
