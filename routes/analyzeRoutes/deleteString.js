import express from "express";
import crypto from "crypto";
import db from "../../db.js";

const router = express.Router();

router.delete("/:value", (req, res) => {
  const { value } = req.params;

  if (!value?.trim()) {
    return res.status(400).json({ error: "Missing or invalid 'value'" });
  }

  const id = crypto.createHash("sha256").update(value.trim()).digest("hex");
  const existing = db.prepare("SELECT * FROM analyses WHERE id = ?").get(id);

  if (!existing) {
    return res.status(404).json({ error: "String not found" });
  }

  db.prepare("DELETE FROM analyses WHERE id = ?").run(id);
  res.status(204).send();
});

export default router;
