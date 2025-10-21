import express from "express";
import 'dotenv/config';
import rateLimit from 'express-rate-limit';
import cors from "cors";
import db from "./db.js";
import analyzeRoutes from "./routes/analyzeRoutes/index.js";



const app = express();
app.use(cors());
app.use(express.json());
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);
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

app.use((req, res, next) => {
  req.db = db;
  next();
});

app.use("/strings", analyzeRoutes);

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
