import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Global exception filter to handle all uncaught exceptions.
 * - Prevents stack trace leakage in production
 * - Provides consistent error response format
 * - Logs errors for debugging
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errorCode = 'INTERNAL_ERROR';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const responseObj = exceptionResponse as Record<string, unknown>;
        message = (responseObj.message as string) || message;
        errorCode = (responseObj.code as string) || errorCode;

        // Handle validation errors (array of messages)
        if (Array.isArray(responseObj.message)) {
          message = responseObj.message.join(', ');
        }
      }
    }

    // Log the error with details (but don't expose to client)
    const errorDetails = {
      path: request.url,
      method: request.method,
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      // Only log stack trace, don't send to client
      stack: exception instanceof Error ? exception.stack : undefined,
    };

    if (status >= 500) {
      this.logger.error('Server error', errorDetails);
    } else if (status >= 400) {
      this.logger.warn('Client error', { ...errorDetails, stack: undefined });
    }

    // Send sanitized response to client (no stack traces)
    response.status(status).json({
      statusCode: status,
      message,
      error: errorCode,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
