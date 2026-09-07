import pg from "pg"

const { Pool } = pg

const pool = new Pool({
  host: "127.0.0.1",
  port: Number(process.env.POSTGRES_PORT),
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
})

export default pool
