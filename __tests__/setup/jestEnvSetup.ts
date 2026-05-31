/**
 * Runs in every Jest worker before any module is loaded.
 * Forces DATABASE_URL to the test database, overriding any .env value.
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.test", override: true });
