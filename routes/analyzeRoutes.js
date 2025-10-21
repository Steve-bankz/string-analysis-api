import express from "express";
import crypto from "crypto";
import db from "../db.js";
const router = express.Router();
function sha256(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}
function analyzeString(text) {
  const length = text.length;
  const reversed = text.split("").reverse().join("");
  const is_palindrome = text.toLowerCase() === reversed.toLowerCase();
  const unique_characters = new Set(text).size;
  const word_count = text.split(/\s+/).filter(Boolean).length;
  const freq = {};
  for (const ch of text) {
    freq[ch] = (freq[ch] || 0) + 1;
  }
  const sha = sha256(text);
  return {
    length,
    is_palindrome,
    unique_characters,
    word_count,
    sha256_hash: sha,
    character_frequency_map: freq,
  };
}
router.post("/", (req, res) => {
  const { value } = req.body;
  if (value === undefined || value === null) {
    return res.status(400).json({ error: 'Bad Request: missing "value" field' });
  }
  if (typeof value !== "string") {
    return res
      .status(422)
      .json({ error: 'Unprocessable Entity: "value" must be of type string' });
  }
  if (!value.trim()) {
    return res.status(400).json({ error: 'Bad Request: "value" cannot be empty' });
  }
  const trimmed = value.trim();
  const id = crypto.createHash("sha256").update(trimmed).digest("hex");
  // Check if already exists
  const existing = db.prepare("SELECT * FROM analyses WHERE id = ?").get(id);
  if (existing) {
    return res
      .status(409)
      .json({ error: "Conflict: string already exists in the system" });
  }
  const properties = analyzeString(trimmed);
  const createdAt = new Date().toISOString();
  // Insert record
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
  const record = {
    id,
    value: trimmed,
    properties,
    created_at: createdAt,
  };
  return res.status(201).json(record);
});
router.get("/filter-by-natural-language", (req, res) => {
  const { query } = req.query;
  if (!query || typeof query !== "string" || query.trim().length === 0) {
    return res.status(400).json({
      status: 400,
      error: "Bad Request: unable to parse natural language query",
    });
  }
  const q = query.toLowerCase();
  const parsedFilters = {};
  const conflicts = [];
  try {
    // Detect palindrome filters
    if (q.includes("palindrome")) {
      if (q.includes("not palindrome") || q.includes("non-palindrome")) {
        parsedFilters.is_palindrome = 0;
      } else {
        parsedFilters.is_palindrome = 1;
      }
    }
    // Word count patterns
    if (q.includes("single word")) {
      parsedFilters.word_count = 1;
    } else {
      const wordsMatch = q.match(/(\d+) words?/);
      if (wordsMatch) parsedFilters.word_count = parseInt(wordsMatch[1]);
    }
    // Length-based filters
    const longerMatch = q.match(/longer than (\d+)/);
    const shorterMatch = q.match(/shorter than (\d+)/);
    const exactlyMatch = q.match(/exactly (\d+) characters?/);
    if (longerMatch) parsedFilters.min_length = parseInt(longerMatch[1]) + 1;
    if (shorterMatch) parsedFilters.max_length = parseInt(shorterMatch[1]) - 1;
    if (exactlyMatch) {
      parsedFilters.min_length = parseInt(exactlyMatch[1]);
      parsedFilters.max_length = parseInt(exactlyMatch[1]);
    }
    // Contains character - handle multiple patterns
    let containsMatch = q.match(/containing (?:the )?(?:letter |character )?['"]?([a-zA-Z0-9])['"]?/);
    if (!containsMatch) {
      containsMatch = q.match(/contains (?:the )?(?:letter |character )?['"]?([a-zA-Z0-9])['"]?/);
    }
    // Handle "first vowel" as 'a'
    if (q.includes("first vowel")) {
      parsedFilters.contains_character = "a";
    } else if (containsMatch) {
      parsedFilters.contains_character = containsMatch[1];
    }
    // Check for conflicts (example: palindrome + not palindrome)
    if (q.includes("palindrome") && q.includes("not palindrome")) {
      conflicts.push("is_palindrome");
    }
    if (conflicts.length > 0) {
      return res.status(422).json({
        status: 422,
        error: "Unprocessable Entity: Query parsed but resulted in conflicting filters",
      });
    }
    if (Object.keys(parsedFilters).length === 0) {
      return res.status(400).json({
        status: 400,
        error: "Bad Request: unable to parse natural language query",
      });
    }
    // 🔍 Build dynamic SQL query
    let sql = "SELECT * FROM analyses WHERE 1=1";
    const params = [];
    if (parsedFilters.is_palindrome !== undefined) {
      sql += " AND is_palindrome = ?";
      params.push(parsedFilters.is_palindrome);
    }
    if (parsedFilters.min_length !== undefined) {
      sql += " AND length >= ?";
      params.push(parsedFilters.min_length);
    }
    if (parsedFilters.max_length !== undefined) {
      sql += " AND length <= ?";
      params.push(parsedFilters.max_length);
    }
    if (parsedFilters.word_count !== undefined) {
      sql += " AND word_count = ?";
      params.push(parsedFilters.word_count);
    }
    if (parsedFilters.contains_character !== undefined) {
      sql += " AND LOWER(value) LIKE ?";
      params.push(`%${parsedFilters.contains_character.toLowerCase()}%`);
    }
    const results = db.prepare(sql).all(...params);
    // Convert frequency map string back to object
    const formattedResults = results.map(r => ({
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
    return res.status(200).json({
      data: formattedResults,
      count: formattedResults.length,
      interpreted_query: {
        original: query,
        parsed_filters: parsedFilters,
      },
    });
  } catch (error) {
    console.error("NLP Query error:", error);
    return res.status(400).json({
      status: 400,
      error: "Bad Request: unable to parse natural language query",
    });
  }
});
router.get("/", (req, res) => {
  const { is_palindrome, min_length, max_length, word_count, contains_character } = req.query;
  const filtersApplied = {};
  const params = [];
  let sql = "SELECT * FROM analyses WHERE 1=1";
  try {
    // 🔹 is_palindrome
    if (is_palindrome !== undefined) {
      if (is_palindrome !== "true" && is_palindrome !== "false") {
        return res.status(400).json({
          status: 400,
          error: 'Bad Request: invalid query parameter "is_palindrome" (must be true or false)',
        });
      }
      const boolVal = is_palindrome === "true" ? 1 : 0;
      sql += " AND is_palindrome = ?";
      params.push(boolVal);
      filtersApplied.is_palindrome = boolVal === 1;
    }
    // 🔹 min_length
    if (min_length !== undefined) {
      const min = parseInt(min_length);
      if (isNaN(min) || min < 0) {
        return res.status(400).json({
          status: 400,
          error: 'Bad Request: invalid "min_length" (must be a non-negative number)',
        });
      }
      sql += " AND length >= ?";
      params.push(min);
      filtersApplied.min_length = min;
    }
    // 🔹 max_length
    if (max_length !== undefined) {
      const max = parseInt(max_length);
      if (isNaN(max) || max < 0) {
        return res.status(400).json({
          status: 400,
          error: 'Bad Request: invalid "max_length" (must be a non-negative number)',
        });
      }
      sql += " AND length <= ?";
      params.push(max);
      filtersApplied.max_length = max;
    }
    // 🔹 word_count
    if (word_count !== undefined) {
      const wc = parseInt(word_count);
      if (isNaN(wc) || wc < 0) {
        return res.status(400).json({
          status: 400,
          error: 'Bad Request: invalid "word_count" (must be a non-negative number)',
        });
      }
      sql += " AND word_count = ?";
      params.push(wc);
      filtersApplied.word_count = wc;
    }
    // 🔹 contains_character
    if (contains_character !== undefined) {
      if (typeof contains_character !== "string" || contains_character.length === 0) {
        return res.status(400).json({
          status: 400,
          error: 'Bad Request: invalid "contains_character" (must be a non-empty string)',
        });
      }
      const char = contains_character.toLowerCase();
      sql += " AND LOWER(value) LIKE ?";
      params.push(`%${char}%`);
      filtersApplied.contains_character = char;
    }
    // 🔍 Run the query
    const results = db.prepare(sql).all(...params);
    // 🧠 Format for output
    const formattedResults = results.map((r) => ({
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
    return res.status(200).json({
      data: formattedResults,
      count: formattedResults.length,
      filters_applied: filtersApplied,
    });
  } catch (err) {
    console.error("Query processing error:", err);
    return res.status(400).json({
      status: 400,
      error: "Bad Request: invalid query parameter values or types",
    });
  }
});
router.get("/:value", (req, res) => {
  const { value } = req.params;
  // 🔹 Validate input
  if (!value || typeof value !== "string") {
    return res.status(400).json({
      status: 400,
      error: 'Bad Request: missing or invalid "value" parameter',
    });
  }
  // 🔹 Generate SHA-256 ID for lookup
  const id = crypto.createHash("sha256").update(value.trim()).digest("hex");
  // 🔹 Query the database
  const record = db.prepare("SELECT * FROM analyses WHERE id = ?").get(id);
  // 🔹 Handle not found
  if (!record) {
    return res.status(404).json({
      status: 404,
      error: "Not Found: string does not exist in the system",
    });
  }
  // 🔹 Reformat result to match original response structure
  const result = {
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
  };
  // ✅ Success
  return res.status(200).json(result);
});
router.delete("/:value", (req, res) => {
  const { value } = req.params;
  // 🔹 Validate
  if (!value || typeof value !== "string") {
    return res.status(400).json({
      status: 400,
      error: 'Bad Request: missing or invalid "value" parameter',
    });
  }
  // 🔹 Compute SHA-256 hash to identify the record
  const id = crypto.createHash("sha256").update(value.trim()).digest("hex");
  // 🔹 Check if record exists
  const existing = db.prepare("SELECT * FROM analyses WHERE id = ?").get(id);
  if (!existing) {
    return res.status(404).json({
      status: 404,
      error: "Not Found: string does not exist in the system",
    });
  }
  // 🔹 Delete it
  db.prepare("DELETE FROM analyses WHERE id = ?").run(id);
  // ✅ 204 No Content
  return res.status(204).send();
});
export default router;