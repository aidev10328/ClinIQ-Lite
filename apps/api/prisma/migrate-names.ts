/**
 * Data Migration: Split fullName into firstName/lastName
 * Run with: npx ts-node prisma/migrate-names.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateNames() {
  console.log('Starting name migration...');

  // Migrate Doctors
  const doctors = await prisma.doctor.findMany({
    where: {
      OR: [
        { firstName: '' },
        { lastName: '' },
      ],
    },
  });

  console.log(`Found ${doctors.length} doctors to migrate`);

  for (const doctor of doctors) {
    const fullName = doctor.fullName.trim();
    const lastSpaceIndex = fullName.lastIndexOf(' ');

    let firstName: string;
    let lastName: string;

    if (lastSpaceIndex > 0) {
      firstName = fullName.slice(0, lastSpaceIndex).trim();
      lastName = fullName.slice(lastSpaceIndex + 1).trim();
    } else {
      firstName = fullName;
      lastName = '';
    }

    await prisma.doctor.update({
      where: { id: doctor.id },
      data: { firstName, lastName },
    });

    console.log(`  Doctor: "${fullName}" -> "${firstName}" | "${lastName}"`);
  }

  // Migrate Patients
  const patients = await prisma.patient.findMany({
    where: {
      OR: [
        { firstName: '' },
        { lastName: '' },
      ],
    },
  });

  console.log(`Found ${patients.length} patients to migrate`);

  for (const patient of patients) {
    const fullName = patient.fullName.trim();
    const lastSpaceIndex = fullName.lastIndexOf(' ');

    let firstName: string;
    let lastName: string;

    if (lastSpaceIndex > 0) {
      firstName = fullName.slice(0, lastSpaceIndex).trim();
      lastName = fullName.slice(lastSpaceIndex + 1).trim();
    } else {
      firstName = fullName;
      lastName = '';
    }

    await prisma.patient.update({
      where: { id: patient.id },
      data: { firstName, lastName },
    });

    console.log(`  Patient: "${fullName}" -> "${firstName}" | "${lastName}"`);
  }

  console.log('Name migration complete!');
}

migrateNames()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
