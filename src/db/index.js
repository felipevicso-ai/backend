import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Em produção, aponte DB_PATH para um disco persistente (ex: volume do
// Railway/Render/Fly). Em dev, cria um arquivo local onlive.db.
const dbPath = process.env.DB_PATH || path.join(__dirname, "onlive.db");

export const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
db.exec(schema);

export default db;
