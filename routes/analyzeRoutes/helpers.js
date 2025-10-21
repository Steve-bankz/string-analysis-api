import crypto from "crypto";

export function sha256(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

export function analyzeString(text) {
  const length = text.length;
  const reversed = text.split("").reverse().join("");
  const is_palindrome = text.toLowerCase() === reversed.toLowerCase();
  const unique_characters = new Set(text).size;
  const word_count = text.split(/\s+/).filter(Boolean).length;

  const freq = {};
  for (const ch of text) freq[ch] = (freq[ch] || 0) + 1;

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
