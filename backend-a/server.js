const express = require("express");
const app = express();
const PORT = 3001;

app.get("/", (req, res) => {
  res.set("X-Backend", "A");
  res.set("Cache-Control", "public, max-age=30");
  res.send("Hello from Backend A");
});

app.get("/api/status", (req, res) => {
  res.set("X-Backend", "A");
  res.set("Cache-Control", "public, max-age=30");
  res.json({ backend: "A", status: "healthy" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("Backend A running on port " + PORT);
});
