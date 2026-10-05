const crypto = require("crypto");

const getEncryptionKey = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("Email credentials cannot be protected because JWT_SECRET is not configured.");
  return crypto.createHash("sha256").update(secret).digest();
};

const encryptEmailPassword = (password) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(password, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${tag.toString("base64")}.${ciphertext.toString("base64")}`;
};

const decryptEmailPassword = (encrypted) => {
  const [ivPart, tagPart, ciphertextPart] = String(encrypted || "").split(".");
  if (!ivPart || !tagPart || !ciphertextPart) throw new Error("Stored email credentials are invalid.");
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(ivPart, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tagPart, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextPart, "base64")),
    decipher.final(),
  ]).toString("utf8");
};

module.exports = { encryptEmailPassword, decryptEmailPassword };
