import express from "express";
import db from "../../db.js";

const router = express.Router();

router.get("/filter-by-natural-language", (req, res) => {
  const { query } = req.query;
  if (!query?.trim()) {
    return res.status(400).json({ error: "Missing query parameter" });
  }

  const q = query.toLowerCase();
  const filters = {};
  const conflicts = [];

  try {
    if (q.includes("palindrome")) {
      if (q.includes("not palindrome") || q.includes("non-palindrome"))
        filters.is_palindrome = 0;
      else filters.is_palindrome = 1;
    }

    const wordsMatch = q.match(/(\d+) words?/);
    if (q.includes("single word")) filters.word_count = 1;
    else if (wordsMatch) filters.word_count = parseInt(wordsMatch[1]);

    const longer = q.match(/longer than (\d+)/);
    const shorter = q.match(/shorter than (\d+)/);
    const exactly = q.match(/exactly (\d+) characters?/);

    if (longer) filters.min_length = parseInt(longer[1]) + 1;
    if (shorter) filters.max_length = parseInt(shorter[1]) - 1;
    if (exactly) {
      filters.min_length = filters.max_length = parseInt(exactly[1]);
    }

    const contains = q.match(/containing ['"]?([a-zA-Z0-9])['"]?/);
    if (contains) filters.contains_character = contains[1];

    if (q.includes("palindrome") && q.includes("not palindrome"))
      conflicts.push("is_palindrome");

    if (conflicts.length)
      return res.status(422).json({ error: "Conflicting filters" });

    if (!Object.keys(filters).length)
      return res.status(400).json({ error: "Unable to parse query" });

    let sql = "SELECT * FROM analyses WHERE 1=1";
    const params = [];

    if (filters.is_palindrome !== undefined) {
      sql += " AND is_palindrome = ?";
      params.push(filters.is_palindrome);
    }
    if (filters.min_length) {
      sql += " AND length >= ?";
      params.push(filters.min_length);
    }
    if (filters.max_length) {
      sql += " AND length <= ?";
      params.push(filters.max_length);
    }
    if (filters.word_count) {
      sql += " AND word_count = ?";
      params.push(filters.word_count);
    }
    if (filters.contains_character) {
      sql += " AND LOWER(value) LIKE ?";
      params.push(`%${filters.contains_character.toLowerCase()}%`);
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

    res.json({
      data,
      count: data.length,
      interpreted_query: { original: query, parsed_filters: filters },
    });
  } catch (e) {
    console.error("NLP error:", e);
    res.status(400).json({ error: "Unable to process query" });
  }
});

export default router;
