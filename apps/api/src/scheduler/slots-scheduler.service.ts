import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AdminSlotsService } from '../admin/admin-slots.service';

@Injectable()
export class SlotsSchedulerService {
  private readonly logger = new Logger(SlotsSchedulerService.name);

  constructor(private adminSlotsService: AdminSlotsService) {}

  /**
   * Scheduled job that runs at midnight on January 1st
   * Generates slots for all doctors across all clinics for the new year
   */
  @Cron('0 0 1 1 *', {
    name: 'yearly-slot-generation',
    timeZone: 'UTC',
  })
  async handleYearlySlotGeneration() {
    const newYear = new Date().getFullYear();
    this.logger.log(`Starting yearly slot generation for ${newYear}`);

    try {
      const result = await this.adminSlotsService.bulkGenerateSlotsForAllClinics(newYear);

      this.logger.log(
        `Yearly slot generation completed: ${result.processedClinics} clinics, ${result.totalSlotsCreated} slots created`,
      );

      // Log any errors
      for (const clinicResult of result.results) {
        if (clinicResult.errors.length > 0) {
          this.logger.warn(
            `Errors generating slots for clinic ${clinicResult.clinicName}: ${JSON.stringify(clinicResult.errors)}`,
          );
        }
      }
    } catch (error) {
      this.logger.error(`Failed to complete yearly slot generation: ${error}`);
    }
  }

  /**
   * Optional: Monthly check to ensure slots exist for the rest of the year
   * Runs at midnight on the 1st of every month
   * This is a safety net in case any slots were missed
   */
  @Cron('0 0 1 * *', {
    name: 'monthly-slot-check',
    timeZone: 'UTC',
  })
  async handleMonthlySlotCheck() {
    const currentYear = new Date().getFullYear();
    this.logger.log('Running monthly slot check...');

    try {
      // This will generate any missing slots for doctors who have configured schedules
      // but somehow don't have slots generated (e.g., new doctors added mid-year)
      const result = await this.adminSlotsService.bulkGenerateSlotsForAllClinics(currentYear);

      if (result.totalSlotsCreated > 0) {
        this.logger.log(
          `Monthly slot check created ${result.totalSlotsCreated} missing slots across ${result.processedClinics} clinics`,
        );
      } else {
        this.logger.log('Monthly slot check complete - no new slots needed');
      }
    } catch (error) {
      this.logger.error(`Failed to complete monthly slot check: ${error}`);
    }
  }
}
