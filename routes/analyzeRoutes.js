import express from "express";
import crypto from "crypto";


const router = express.Router();

function sha256(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function analyzeString(text) {
  const clean = text.trim();
  const length = clean.length;
  const reversed = clean.split("").reverse().join("");
  const is_palindrome = clean.toLowerCase() === reversed.toLowerCase();
  const unique_characters = new Set(clean.toLowerCase().replace(/\s+/g, "")).size;
  const word_count = clean.split(/\s+/).filter(Boolean).length;

  const freq = {};
  for (const ch of clean.replace(/\s+/g, "").toLowerCase()) {
    freq[ch] = (freq[ch] || 0) + 1;
  }

  const sha = sha256(clean);

  return {
    length,
    is_palindrome,
    unique_characters,
    word_count,
    sha256_hash: sha,
    character_frequency_map: freq,
  };
}

router.post("/", async (req, res) => {
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

  const db = req.db;
  const trimmed = value.trim();
  const id = sha256(trimmed);

  const existing = db.data.analyses.find(item => item.id === id);
  if (existing) {
    return res.status(409).json({ error: "Conflict: string already exists in the system" });
  }

  const properties = analyzeString(trimmed);
  const createdAt = new Date().toISOString();

  const record = {
    id,
    value: trimmed,
    properties,
    createdAt,
  };

  db.data.analyses.push(record);
  await db.write();

  return res.status(201).json(record);
});

router.get("/filter-by-natural-language", async (req, res) => {
  const db = req.db;
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
    if (q.includes("palindrome")) {
      if (q.includes("not palindrome") || q.includes("non-palindrome")) {
        parsedFilters.is_palindrome = false;
      } else {
        parsedFilters.is_palindrome = true;
      }
    }

    const longerMatch = q.match(/longer than (\d+)/);
    const shorterMatch = q.match(/shorter than (\d+)/);
    const exactlyMatch = q.match(/exactly (\d+) characters?/);

    if (longerMatch) parsedFilters.min_length = parseInt(longerMatch[1]);
    if (shorterMatch) parsedFilters.max_length = parseInt(shorterMatch[1]);
    if (exactlyMatch) {
      parsedFilters.min_length = parseInt(exactlyMatch[1]);
      parsedFilters.max_length = parseInt(exactlyMatch[1]);
    }

    // Word count
    const wordsMatch = q.match(/(\d+) words?/);
    if (wordsMatch) parsedFilters.word_count = parseInt(wordsMatch[1]);

    // Contains character
    const containsMatch = q.match(/containing ['"]?([a-zA-Z0-9])['"]?/);
    if (containsMatch) parsedFilters.contains_character = containsMatch[1];

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

    // If nothing was parsed
    if (Object.keys(parsedFilters).length === 0) {
      return res.status(400).json({
        status: 400,
        error: "Bad Request: unable to parse natural language query",
      });
    }

    // Apply filters to DB
    let results = db.data.analyses;

    if (parsedFilters.is_palindrome !== undefined)
      results = results.filter(
        (r) => r.properties.is_palindrome === parsedFilters.is_palindrome
      );

    if (parsedFilters.min_length !== undefined)
      results = results.filter(
        (r) => r.properties.length >= parsedFilters.min_length
      );

    if (parsedFilters.max_length !== undefined)
      results = results.filter(
        (r) => r.properties.length <= parsedFilters.max_length
      );

    if (parsedFilters.word_count !== undefined)
      results = results.filter(
        (r) => r.properties.word_count === parsedFilters.word_count
      );

    if (parsedFilters.contains_character !== undefined)
      results = results.filter((r) =>
        r.value
          .toLowerCase()
          .includes(parsedFilters.contains_character.toLowerCase())
      );

    return res.status(200).json({
      data: results,
      count: results.length,
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

router.get("/", async (req, res) => {
  const db = req.db;
  const { is_palindrome, min_length, max_length, word_count, contains_character } = req.query;

  const filtersApplied = {};
  let results = db.data.analyses;

  try {
    if (is_palindrome !== undefined) {
      if (is_palindrome !== "true" && is_palindrome !== "false") {
        return res.status(400).json({
          status: 400,
          error: 'Bad Request: invalid query parameter "is_palindrome" (must be true or false)',
        });
      }
      const boolVal = is_palindrome === "true";
      results = results.filter((item) => item.properties.is_palindrome === boolVal);
      filtersApplied.is_palindrome = boolVal;
    }

    // min_length
    if (min_length !== undefined) {
      const min = parseInt(min_length);
      if (isNaN(min) || min < 0) {
        return res.status(400).json({
          status: 400,
          error: 'Bad Request: invalid "min_length" (must be a non-negative number)',
        });
      }
      results = results.filter((item) => item.properties.length >= min);
      filtersApplied.min_length = min;
    }

    // max_length
    if (max_length !== undefined) {
      const max = parseInt(max_length);
      if (isNaN(max) || max < 0) {
        return res.status(400).json({
          status: 400,
          error: 'Bad Request: invalid "max_length" (must be a non-negative number)',
        });
      }
      results = results.filter((item) => item.properties.length <= max);
      filtersApplied.max_length = max;
    }

    // word_count
    if (word_count !== undefined) {
      const wc = parseInt(word_count);
      if (isNaN(wc) || wc < 0) {
        return res.status(400).json({
          status: 400,
          error: 'Bad Request: invalid "word_count" (must be a non-negative number)',
        });
      }
      results = results.filter((item) => item.properties.word_count === wc);
      filtersApplied.word_count = wc;
    }

    // contains_character
    if (contains_character !== undefined) {
      if (typeof contains_character !== "string" || contains_character.length === 0) {
        return res.status(400).json({
          status: 400,
          error: 'Bad Request: invalid "contains_character" (must be a non-empty string)',
        });
      }
      const char = contains_character.toLowerCase();
      results = results.filter((item) =>
        item.value.toLowerCase().includes(char)
      );
      filtersApplied.contains_character = char;
    }

    // Return matched data
    return res.status(200).json({
      data: results,
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


router.get("/:value", async (req, res) => {
  const { value } = req.params;
  const db = req.db;

  // Validate that value is a non-empty string
  if (!value || typeof value !== "string") {
    return res.status(400).json({
      status: 400,
      error: 'Bad Request: missing or invalid "value" parameter',
    });
  }

  // Hash it to match stored record IDs (sha256 of value)
  const id = crypto.createHash("sha256").update(value).digest("hex");

  // Search for matching record
  const result = db.data.analyses.find((item) => item.id === id);

  if (!result) {
    return res.status(404).json({
      status: 404,
      error: "Not Found: string does not exist in the system",
    });
  }

  res.status(200).json(result);
});

router.delete("/:value", async (req, res) => {
  const { value } = req.params;
  const db = req.db;

  // Validate
  if (!value || typeof value !== "string") {
    return res.status(400).json({
      status: 400,
      error: 'Bad Request: missing or invalid "value" parameter',
    });
  }

  // Compute hash ID
  const id = crypto.createHash("sha256").update(value).digest("hex");

  // Find index of the record
  const index = db.data.analyses.findIndex((item) => item.id === id);

  if (index === -1) {
    return res.status(404).json({
      status: 404,
      error: "Not Found: string does not exist in the system",
    });
  }

  // Remove from DB
  db.data.analyses.splice(index, 1);
  await db.write();

  // 204 No Content — empty body
  return res.status(204).send();
});

export default router;
