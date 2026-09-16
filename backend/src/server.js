import app from "./app.js";

const port = Number(process.env.BACKEND_PORT || 3001);

if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  throw new Error("BACKEND_PORT must be a valid TCP port");
}

app.listen(port, () => {
  console.log(`Backend server running on http://localhost:${port}`);
});
