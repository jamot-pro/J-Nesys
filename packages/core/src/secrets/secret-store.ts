import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const KEY_LENGTH = 32;
const SALT = "jamot-secret-store-v1";

export interface SecretStore {
  encrypt(plaintext: string): string;
  decrypt(ciphertext: string): string;
}

export interface SecretStoreOptions {
  encryptionKey?: string;
}

function decodeKey(raw: string): Buffer {
  const key = Buffer.from(raw, "base64");
  if (key.length !== KEY_LENGTH) {
    throw new Error(
      "SECRET_ENCRYPTION_KEY must be a base64-encoded 32-byte key",
    );
  }
  return key;
}

function resolveKey(opts: SecretStoreOptions): Buffer {
  if (opts.encryptionKey) return decodeKey(opts.encryptionKey);
  const envKey = process.env.SECRET_ENCRYPTION_KEY;
  if (envKey) return decodeKey(envKey);
  const sessionSecret = process.env.SESSION_SECRET;
  if (sessionSecret) {
    return scryptSync(sessionSecret, SALT, KEY_LENGTH);
  }
  throw new Error(
    "No secret encryption key configured. Set SECRET_ENCRYPTION_KEY (base64 32-byte key) " +
      "or SESSION_SECRET (used to derive a key via scrypt).",
  );
}

export function createSecretStore(opts: SecretStoreOptions = {}): SecretStore {
  const key = resolveKey(opts);

  return {
    encrypt(plaintext) {
      const iv = randomBytes(IV_LENGTH);
      const cipher = createCipheriv(ALGORITHM, key, iv);
      const data = Buffer.concat([
        cipher.update(plaintext, "utf8"),
        cipher.final(),
      ]);
      const tag = cipher.getAuthTag();
      return [iv.toString("base64"), tag.toString("base64"), data.toString("base64")].join(".");
    },

    decrypt(ciphertext) {
      const parts = ciphertext.split(".");
      if (parts.length !== 3) {
        throw new Error("Malformed ciphertext");
      }
      const [ivB64, tagB64, dataB64] = parts as [string, string, string];
      const iv = Buffer.from(ivB64, "base64");
      const tag = Buffer.from(tagB64, "base64");
      const data = Buffer.from(dataB64, "base64");
      const decipher = createDecipheriv(ALGORITHM, key, iv);
      decipher.setAuthTag(tag);
      const out = Buffer.concat([decipher.update(data), decipher.final()]);
      return out.toString("utf8");
    },
  };
}
