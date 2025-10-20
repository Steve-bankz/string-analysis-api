import express from "express";
import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import analyzeRoutes from "./routes/analyzeRoutes.js";
import 'dotenv/config';
import fs from 'fs';
import rateLimit from 'express-rate-limit';

const app = express();
app.use(express.json());
const PORT = process.env.PORT || 3000;

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per window
  message: {
    status: 429,
    error: 'Too Many Requests: please try again later',
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

app.use(limiter);


const dbPath = './db.json';
if (!fs.existsSync(dbPath)) {
  fs.writeFileSync(dbPath, JSON.stringify({ analyses: [] }, null, 2));
  console.log(" db.json created automatically");
}

const adapter = new JSONFile("db.json");
const db = new Low(adapter, { analyses: [] });
await db.read();

app.use((req, res, next) => {
  req.db = db;
  next();
});

app.use("/strings", analyzeRoutes);

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
