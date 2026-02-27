import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // Validate required environment variables
  const requiredEnvVars = ['JWT_SECRET', 'DATABASE_URL'];
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      logger.error(`Missing required environment variable: ${envVar}`);
      process.exit(1);
    }
  }

  const app = await NestFactory.create(AppModule);

  // Security headers (helmet)
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        scriptSrc: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false, // Allow embedding for API
  }));

  // Enable CORS — support comma-separated origins for deployment
  const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';
  const origins = corsOrigin.includes(',')
    ? corsOrigin.split(',').map(o => o.trim())
    : corsOrigin;
  app.enableCors({
    origin: origins,
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true, // Reject requests with unknown properties
  }));

  // Global exception filter - prevents stack trace leakage
  app.useGlobalFilters(new GlobalExceptionFilter());

  const port = process.env.API_PORT || 4000;
  await app.listen(port);
  logger.log(`ClinIQ Lite API running on http://localhost:${port}`);
}

bootstrap();
