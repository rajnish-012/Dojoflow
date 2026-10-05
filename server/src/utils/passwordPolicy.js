const MIN_PASSWORD_LENGTH = 12;
const MAX_PASSWORD_BYTES = 72; // bcrypt processes at most 72 UTF-8 bytes.

const validatePassword = (password) => {
  if (typeof password !== "string") return "Password is required.";
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must contain at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (Buffer.byteLength(password, "utf8") > MAX_PASSWORD_BYTES) {
    return `Password must not exceed ${MAX_PASSWORD_BYTES} UTF-8 bytes.`;
  }
  return null;
};

const sessionInvalidationTime = () => new Date(Date.now() + 1000);

module.exports = { MIN_PASSWORD_LENGTH, MAX_PASSWORD_BYTES, validatePassword, sessionInvalidationTime };
