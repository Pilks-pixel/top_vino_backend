# Phase 1: Complete Error Handling System

**Priority:** CRITICAL  
**Estimated Time:** 1-2 days  
**Status:** Ready to Start

---

## 🎯 Objective

Complete the centralized error handling system that was left mid-implementation. The goal is to have a robust, production-ready error handling infrastructure that properly catches and transforms all errors (especially Prisma database errors), provides consistent error responses, and differentiates between development and production environments.

---

## 📋 Current State

### What's Already Done ✅

1. **Basic Error Classes** (`src/utils/appError.ts`)

   - `AppError` base class with status code support
   - `ValidationError` subclass with details field
   - Both extend native Error class

2. **Global Error Handler** (`src/middlewares/errorHandler.ts`)

   - Basic error handler middleware registered in app.ts
   - Catches errors and sends JSON responses
   - **BUT**: Very basic - doesn't handle Prisma errors, no logging, no env differentiation

3. **Validation Middleware** (`src/middlewares/validationMiddleware.ts`)

   - Uses Zod for schema validation
   - **BUT**: Sends response directly instead of throwing ValidationError
   - Not integrated with error handler

4. **Usage in Services** (`src/services/user.service.ts`)
   - Service layer throws `AppError` for business logic errors
   - 404 errors properly thrown with status codes

### What's Incomplete ❌

1. **Error Handler Doesn't Handle Prisma Errors**

   - TODO comment explicitly states this: `// ToDo: Handle prisma errors`
   - Prisma errors like P2002 (unique constraint) return as 500 instead of 409
   - P2025 (record not found) returns 500 instead of 404
   - Other Prisma errors not transformed at all

2. **No Error Logging**

   - Errors aren't logged with stack traces
   - No differentiation between operational vs programming errors
   - No monitoring/alerting capability

3. **No Development vs Production Handling**

   - Stack traces always/never exposed (unclear from code)
   - Should show detailed errors in dev, sanitized in production

4. **Validation Errors Not Using Error System**

   - `validationMiddleware.ts` responds directly instead of throwing `ValidationError`
   - Error handler never processes validation errors

5. **Try-Catch Blocks in Every Controller**
   - Controllers have repetitive try-catch blocks
   - Should use async wrapper utility to DRY this up

---

## 🔨 What Needs to Be Done

### Task 1: Enhance Error Classes

**File:** `src/utils/appError.ts`

**Requirements:**

- Add `isOperational` boolean flag to distinguish expected errors from bugs
- Create specific error subclasses:
  - `NotFoundError` (404)
  - `ConflictError` (409)
  - `UnauthorizedError` (401)
  - `ForbiddenError` (403)
  - `BadRequestError` (400)
- Update `ValidationError` to extend `BadRequestError`
- Export all error classes

**Example:**

```typescript
export class NotFoundError extends AppError {
  constructor(resource: string, identifier?: string) {
    const message = identifier
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;
    super(message, 404);
    this.isOperational = true;
  }
}
```

---

### Task 2: Create Prisma Error Handler

**File:** `src/utils/prismaErrorHandler.ts` (NEW FILE)

**Requirements:**

- Create utility function `handlePrismaError(error: any): AppError`
- Map Prisma error codes to appropriate error classes:
  - `P2002`: Unique constraint violation → `ConflictError`
  - `P2025`: Record not found → `NotFoundError`
  - `P2003`: Foreign key constraint failed → `BadRequestError`
  - `P2014`: Relation violation → `BadRequestError`
  - Other codes: Return generic `AppError` with 500
- Extract field names from Prisma error metadata for better messages

**Example:**

```typescript
export function handlePrismaError(error: any): AppError {
  if (error.code === "P2002") {
    const fields = error.meta?.target || "field";
    return new ConflictError(`${fields} already exists`);
  }
  // ... handle other codes
}
```

---

### Task 3: Upgrade Error Handler Middleware

**File:** `src/middlewares/errorHandler.ts`

**Requirements:**

- Check if error is from Prisma → transform using `handlePrismaError`
- Check if error is `AppError` with `isOperational` flag
- Log all errors with appropriate detail:
  - Operational errors: log message and status
  - Programming errors: log full stack trace
- Different responses for development vs production:
  - **Development**: Include stack trace and full error details
  - **Production**: Sanitize error messages, no stack traces
- Return consistent error response format:
  ```json
  {
    "status": "error",
    "statusCode": 404,
    "message": "User not found",
    "stack": "..." // only in development
  }
  ```
- Handle Zod validation errors (from ValidationError)
- Catch-all for unexpected errors (return 500)

**Environment Check:**

```typescript
const isDevelopment = process.env.NODE_ENV !== "production";
```

---

### Task 4: Update Validation Middleware

**File:** `src/middlewares/validationMiddleware.ts`

**Requirements:**

- Instead of sending response directly, throw `ValidationError`
- Pass Zod error details to ValidationError constructor
- Remove direct response logic (`res.status(400).json(...)`)
- Let error handler manage the response

**Example:**

```typescript
if (!result.success) {
  throw new ValidationError("Validation failed", result.error.format());
}
```

---

### Task 5: Create Async Error Wrapper Utility

**File:** `src/utils/catchAsync.ts` (NEW FILE)

**Requirements:**

- Create `catchAsync` higher-order function
- Wraps async route handlers
- Automatically catches errors and passes to `next()`
- Eliminates need for try-catch in controllers

**Example:**

```typescript
export const catchAsync = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
```

---

### Task 6: Refactor Controllers to Use catchAsync

**Files:** `src/routes/user/user.controller.ts`

**Requirements:**

- Remove all try-catch blocks
- Wrap each handler with `catchAsync`
- Simplify controller code

**Before:**

```typescript
async function httpGetUsers(req: Request, res: Response, next: NextFunction) {
  try {
    const users = await readUsers();
    res.status(200).json(users);
  } catch (error) {
    next(error);
  }
}
```

**After:**

```typescript
const httpGetUsers = catchAsync(async (req: Request, res: Response) => {
  const users = await readUsers();
  res.status(200).json(users);
});
```

---

### Task 7: Update Services to Use New Error Classes

**Files:** `src/services/user.service.ts`

**Requirements:**

- Replace generic `AppError` with specific error classes
- Use `NotFoundError` instead of `AppError("...", 404)`
- Improve error messages with context

**Example:**

```typescript
async function readUser(email: string) {
  const user = await getUserByEmail(email);
  if (!user) {
    throw new NotFoundError("User", email);
  }
  return user;
}
```

---

## ✅ Acceptance Criteria

### Functional Requirements

- [ ] All Prisma errors are properly caught and transformed to appropriate HTTP errors
- [ ] Validation errors return 400 status with detailed field errors
- [ ] 404 errors include resource name in message
- [ ] 409 errors clearly indicate constraint violations
- [ ] No try-catch blocks remain in controllers
- [ ] Error handler differentiates between dev and production environments

### Technical Requirements

- [ ] Error logging implemented with appropriate detail levels
- [ ] Stack traces only exposed in development mode
- [ ] Consistent error response format across all endpoints
- [ ] `isOperational` flag distinguishes expected vs unexpected errors
- [ ] All existing endpoints maintain current functionality

### Testing Checklist

Test these scenarios manually:

- [ ] Create user with duplicate email → 409 Conflict
- [ ] Get user with non-existent ID → 404 Not Found
- [ ] Create user with invalid data → 400 Validation Error
- [ ] Trigger database error → Proper error response
- [ ] Check error response in production mode → No stack trace
- [ ] Check error response in dev mode → Includes stack trace

---

## 🗂️ Files to Create/Modify

### Create:

- `src/utils/catchAsync.ts`
- `src/utils/prismaErrorHandler.ts`

### Modify:

- `src/utils/appError.ts` - Add error classes
- `src/middlewares/errorHandler.ts` - Complete implementation
- `src/middlewares/validationMiddleware.ts` - Integrate with error system
- `src/routes/user/user.controller.ts` - Use catchAsync wrapper
- `src/services/user.service.ts` - Use specific error classes

---

## 📚 Reference Implementation Pattern

The User module is complete and can be used as reference, but needs to be refactored to use the new error handling:

1. **Model Layer** (`usersModel.ts`): No changes needed
2. **Service Layer** (`user.service.ts`): Use new error classes
3. **Controller Layer** (`user.controller.ts`): Use catchAsync wrapper
4. **Router** (`user.router.ts`): No changes needed

---

## 🚀 Next Steps After Completion

Once Phase 1 is complete:

1. Test all user endpoints with new error handling
2. Verify error responses in both dev and production modes
3. Move to Phase 2: Implement Deck and Card modules using completed pattern
4. Apply same error handling pattern to all future modules

---

## 💡 Implementation Tips

1. Start with error classes - foundation for everything else
2. Implement Prisma error handler next - needed by error middleware
3. Update error middleware - this is the core piece
4. Create catchAsync utility - makes controller refactor easy
5. Refactor one controller as a test - ensure it works
6. Update validation middleware last - least critical change

---

## 🔍 Common Prisma Error Codes

| Code  | Meaning                       | HTTP Status | Error Class     |
| ----- | ----------------------------- | ----------- | --------------- |
| P2002 | Unique constraint failed      | 409         | ConflictError   |
| P2025 | Record not found              | 404         | NotFoundError   |
| P2003 | Foreign key constraint failed | 400         | BadRequestError |
| P2014 | Relation violation            | 400         | BadRequestError |
| P2021 | Table does not exist          | 500         | AppError        |
| P2022 | Column does not exist         | 500         | AppError        |

Full list: https://www.prisma.io/docs/reference/api-reference/error-reference

---

## Environment Variables Needed

Ensure `.env` has:

```bash
NODE_ENV=development  # or 'production'
DATABASE_URL=postgresql://...
PORT=8000
```
