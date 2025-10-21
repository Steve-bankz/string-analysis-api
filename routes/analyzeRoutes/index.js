import express from "express";
import createString from "./createString.js";
import getAllStrings from "./getAllStrings.js";
import getByValue from "./getByValue.js";
import deleteString from "./deleteString.js";
import filterNatural from "./filterNatural.js";

const router = express.Router();

router.use("/", createString);
router.use("/", getAllStrings);
router.use("/", filterNatural);
router.use("/", getByValue);
router.use("/", deleteString);

export default router;
