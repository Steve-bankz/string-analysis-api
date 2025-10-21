import express from "express";
import crypto from "crypto";
import db from "../../db.js";

const router = express.Router();

router.get("/:value", (req, res) => {
  const { value } = req.params;

  if (!value?.trim()) {
    return res.status(400).json({ error: "Missing or invalid 'value'" });
  }

  const id = crypto.createHash("sha256").update(value.trim()).digest("hex");
  const record = db.prepare("SELECT * FROM analyses WHERE id = ?").get(id);

  if (!record) {
    return res.status(404).json({ error: "String not found" });
  }

  res.json({
    id: record.id,
    value: record.value,
    properties: {
      length: record.length,
      is_palindrome: !!record.is_palindrome,
      unique_characters: record.unique_characters,
      word_count: record.word_count,
      sha256_hash: record.sha256_hash,
      character_frequency_map: JSON.parse(record.character_frequency_map),
    },
    created_at: record.created_at,
  });
});

export default router;
