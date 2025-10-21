import express from "express";
import db from "../../db.js";

const router = express.Router();

router.get("/", (req, res) => {
  const { is_palindrome, min_length, max_length, word_count, contains_character } = req.query;
  const filters = {};
  const params = [];
  let sql = "SELECT * FROM analyses WHERE 1=1";

  try {
    if (is_palindrome !== undefined) {
      if (!["true", "false"].includes(is_palindrome)) {
        return res.status(400).json({
          error: 'Invalid "is_palindrome" — must be true or false',
        });
      }
      const val = is_palindrome === "true" ? 1 : 0;
      sql += " AND is_palindrome = ?";
      params.push(val);
      filters.is_palindrome = !!val;
    }

    if (min_length) {
      const min = parseInt(min_length);
      if (isNaN(min) || min < 0)
        return res.status(400).json({ error: 'Invalid "min_length"' });
      sql += " AND length >= ?";
      params.push(min);
      filters.min_length = min;
    }

    if (max_length) {
      const max = parseInt(max_length);
      if (isNaN(max) || max < 0)
        return res.status(400).json({ error: 'Invalid "max_length"' });
      sql += " AND length <= ?";
      params.push(max);
      filters.max_length = max;
    }

    if (word_count) {
      const wc = parseInt(word_count);
      if (isNaN(wc) || wc < 0)
        return res.status(400).json({ error: 'Invalid "word_count"' });
      sql += " AND word_count = ?";
      params.push(wc);
      filters.word_count = wc;
    }

    if (contains_character) {
      const char = contains_character.toLowerCase();
      sql += " AND LOWER(value) LIKE ?";
      params.push(`%${char}%`);
      filters.contains_character = char;
    }

    const rows = db.prepare(sql).all(...params);
    const data = rows.map(r => ({
      id: r.id,
      value: r.value,
      properties: {
        length: r.length,
        is_palindrome: !!r.is_palindrome,
        unique_characters: r.unique_characters,
        word_count: r.word_count,
        sha256_hash: r.sha256_hash,
        character_frequency_map: JSON.parse(r.character_frequency_map),
      },
      created_at: r.created_at,
    }));

    res.status(200).json({
      data,
      count: data.length,
      filters_applied: filters,
    });
  } catch (err) {
    console.error("Query error:", err);
    res.status(400).json({ error: "Bad Request" });
  }
});

export default router;
