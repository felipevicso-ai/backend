import crypto from "node:crypto";
import db from "../db/index.js";

// Sem caracteres ambíguos (0/O, 1/I) para reduzir erro de digitação
// quando o cliente copiar a chave manualmente.
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

function randomBlock(length) {
  let out = "";
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

function buildKey() {
  return `ONL-${randomBlock(4)}-${randomBlock(4)}-${randomBlock(4)}`;
}

/**
 * Gera uma license_key única (garantido via checagem no banco +
 * constraint UNIQUE como segunda camada de proteção).
 */
export function generateUniqueLicenseKey() {
  const exists = db.prepare(
    "SELECT 1 FROM licenses WHERE license_key = ?"
  );

  let key;
  do {
    key = buildKey();
  } while (exists.get(key));

  return key;
}
