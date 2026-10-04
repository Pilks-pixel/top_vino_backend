import { createLogger } from "./loggerCore.ts";

export {
  DEFAULT_REDACT_PATHS,
  createLogger,
  resolveLogLevel,
  serializeRequest,
  serializeResponse,
} from "./loggerCore.ts";

export const logger = createLogger();
