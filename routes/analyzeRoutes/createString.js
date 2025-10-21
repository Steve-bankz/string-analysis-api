import express from "express";
import crypto from "crypto";
import db from "../../db.js";
import { analyzeString } from "./helpers.js";

const router = express.Router();

router.post("/", (req, res) => {
  const { value } = req.body;

  if (typeof value !== "string" || !value.trim()) {
    return res.status(400).json({
      error: 'Bad Request: "value" must be a non-empty string',
    });
  }

  const trimmed = value.trim();
  const id = crypto.createHash("sha256").update(trimmed).digest("hex");

  const existing = db.prepare("SELECT * FROM analyses WHERE id = ?").get(id);
  if (existing) {
    return res.status(409).json({
      error: "Conflict: string already exists in the system",
    });
  }

  const properties = analyzeString(trimmed);
  const createdAt = new Date().toISOString();

  db.prepare(`
    INSERT INTO analyses (
      id, value, length, is_palindrome, unique_characters,
      word_count, sha256_hash, character_frequency_map, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    trimmed,
    properties.length,
    properties.is_palindrome ? 1 : 0,
    properties.unique_characters,
    properties.word_count,
    properties.sha256_hash,
    JSON.stringify(properties.character_frequency_map),
    createdAt
  );

  return res.status(201).json({
    id,
    value: trimmed,
    properties,
    created_at: createdAt,
  });
});

export default router;
