import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding ClinIQ Lite database...\n');

  // ============================================
  // 1. Create/Update Admin User
  // ============================================
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@local' },
    update: {},
    create: {
      email: 'admin@local',
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
  // Summary
  // ============================================
  console.log('\n========================================');
  console.log('Seeding completed successfully!');
  console.log('========================================');
  console.log('\nDemo Credentials:');
  console.log('  Email: admin@local');
  console.log('  Password: admin123');
  console.log('\nDemo Data:');
  console.log(`  Clinic: ${demoClinic.name}`);
  console.log(`  Doctor: ${demoDoctor.fullName}`);
  console.log('  Shift Templates: Morning, Evening, Night');
  console.log('  Weekly Schedule: Mon-Fri (Morning + Evening)');
  console.log('  Time Off: Feb 4, 10, 11-12, 24-25');
  console.log(`  Patient: ${demoPatient.fullName}`);
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
