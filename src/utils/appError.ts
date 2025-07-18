export class AppError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// export class ValidationError extends AppError {
//     details
//   constructor(message: string, details: any) {
//     super(message, 400);
//     this.details = details; // Additional validation details
//   }
// }
