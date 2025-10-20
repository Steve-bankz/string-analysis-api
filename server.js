import express from "express";
import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import analyzeRoutes from "./routes/analyzeRoutes.js";
import 'dotenv/config';
import fs from 'fs';

const dbPath = './db.json';
if (!fs.existsSync(dbPath)) {
  fs.writeFileSync(dbPath, JSON.stringify({ analyses: [] }, null, 2));
  console.log("✅ db.json created automatically");
}


const app = express();
app.use(express.json());
const PORT = process.env.PORT || 3000;

const adapter = new JSONFile("db.json");
const db = new Low(adapter, { analyses: [] });
await db.read();

app.use((req, res, next) => {
  req.db = db;
  next();
});

app.use("/strings", analyzeRoutes);

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
