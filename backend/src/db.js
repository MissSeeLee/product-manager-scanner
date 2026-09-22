import pg from "pg";

const { Pool } = pg;

function createPool() {
  if (process.env.DATABASE_URL) {
    return new Pool({
      connectionString: process.env.DATABASE_URL,
    });
  }

  const requiredVariables = [
    "POSTGRES_DB",
    "POSTGRES_USER",
    "POSTGRES_PASSWORD",
  ];

  for (const variable of requiredVariables) {
    if (!process.env[variable]) {
      throw new Error(`${variable} environment variable is required`);
    }
  }

  const port = Number(process.env.POSTGRES_PORT || 5433);

  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error("POSTGRES_PORT must be a valid TCP port");
  }

  return new Pool({
    host: process.env.POSTGRES_HOST || "127.0.0.1",

    port,

    database: process.env.POSTGRES_DB,

    user: process.env.POSTGRES_USER,

    password: process.env.POSTGRES_PASSWORD,
  });
}

const pool = createPool();

export default pool;
