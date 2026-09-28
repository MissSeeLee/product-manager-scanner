import pg from "pg";

import appPool from "./db.js";

const { Pool } = pg;

function createPublicPool() {
  if (process.env.PUBLIC_DATABASE_URL) {
    return new Pool({
      connectionString: process.env.PUBLIC_DATABASE_URL,
      ssl:
        process.env.PUBLIC_DATABASE_SSL === "true"
          ? { rejectUnauthorized: false }
          : undefined,
    });
  }

  if (
    process.env.PUBLIC_POSTGRES_USER &&
    process.env.PUBLIC_POSTGRES_PASSWORD
  ) {
    return new Pool({
      host:
        process.env.PUBLIC_POSTGRES_HOST ||
        process.env.POSTGRES_HOST ||
        "127.0.0.1",
      port: Number(
        process.env.PUBLIC_POSTGRES_PORT ||
          process.env.POSTGRES_PORT ||
          5432,
      ),
      database:
        process.env.PUBLIC_POSTGRES_DB ||
        process.env.POSTGRES_DB ||
        "product_manager",
      user: process.env.PUBLIC_POSTGRES_USER,
      password: process.env.PUBLIC_POSTGRES_PASSWORD,
      ssl:
        process.env.PUBLIC_DATABASE_SSL === "true"
          ? { rejectUnauthorized: false }
          : undefined,
    });
  }

  if (process.env.NODE_ENV !== "production") {
    return appPool;
  }

  return null;
}

const publicPool = createPublicPool();

export function getPublicPool() {
  if (!publicPool) {
    const error = new Error(
      "Public Viewer database credentials are not configured.",
    );
    error.code = "PUBLIC_DATABASE_NOT_CONFIGURED";
    throw error;
  }

  return publicPool;
}
