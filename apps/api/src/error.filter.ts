import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Request, Response } from "express";

@Catch()
export class ApiErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiErrorFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const request = host.switchToHttp().getRequest<Request>();
    const response = host.switchToHttp().getResponse<Response>();
    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    if (statusCode >= 500) {
      this.logger.error({
        event: "http_server_error",
        path: request.path,
        exception: exception instanceof Error ? exception.name : "UnknownError",
      });
    }
    const error = String(HttpStatus[statusCode] ?? "Error")
      .replaceAll("_", " ")
      .toLowerCase()
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;
    const message =
      statusCode >= 500
        ? "An unexpected error occurred."
        : typeof exceptionResponse === "string"
          ? exceptionResponse
          : typeof exceptionResponse === "object" &&
              exceptionResponse &&
              "message" in exceptionResponse
            ? String(exceptionResponse.message)
            : "Request failed.";
    response.status(statusCode).json({
      statusCode,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.path,
    });
  }
}
