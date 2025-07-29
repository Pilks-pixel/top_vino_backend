export class AppError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export class ValidationError extends AppError {
  details: string | object;
  constructor(message: string, details: string | object) {
    super(message, 400);
    this.details = details; // Additional validation details
  }
}
