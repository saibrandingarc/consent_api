import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const requestId = response.getHeader('x-request-id') as string | undefined;

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const message =
        typeof body === 'string'
          ? body
          : ((body as { message?: string | string[] }).message ?? 'Request failed');
      const code =
        typeof body === 'object' && body !== null && 'code' in body
          ? String((body as { code: string }).code)
          : 'REQUEST_FAILED';

      response.status(status).json({
        ok: false,
        error: {
          code,
          message: Array.isArray(message) ? message.join(', ') : message,
          details: typeof body === 'object' ? body : undefined,
        },
        requestId,
      });
      return;
    }

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message:
          process.env.NODE_ENV === 'production'
            ? 'Internal server error'
            : exception instanceof Error
              ? exception.message
              : 'Internal server error',
      },
      requestId,
    });
    if (exception instanceof Error) {
      console.error('[cmp-api] Unhandled error:', exception.message, exception.stack);
    } else {
      console.error('[cmp-api] Unhandled error:', exception);
    }
  }
}
