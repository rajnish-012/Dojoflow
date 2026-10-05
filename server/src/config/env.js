const ALLOWED_ENVIRONMENTS = new Set(["development", "test", "production"]);
const isLocalHostname = (hostname) => {
  const host = String(hostname || "").toLowerCase().replace(/\.$/, "").replace(/^\[|\]$/g, "");
  return host === "localhost" || host.endsWith(".localhost") || host === "::1" || host === "0.0.0.0" || /^127(?:\.\d{1,3}){3}$/.test(host);
};
const isPlaceholderHostname = (hostname) => /(^|\.)(example\.(com|org|net)|invalid|test)$/i.test(String(hostname || "").replace(/\.$/, ""));

const validateServerEnv = (env = process.env) => {
  const errors = [];
  const nodeEnv = env.NODE_ENV;
  if (!nodeEnv) errors.push("NODE_ENV must be set explicitly.");
  if (!ALLOWED_ENVIRONMENTS.has(nodeEnv)) errors.push("NODE_ENV must be development, test, or production.");
  if (!env.MONGO_URI) errors.push("MONGO_URI is required.");
  else if (!/^mongodb(?:\+srv)?:\/\//i.test(env.MONGO_URI)) errors.push("MONGO_URI must use mongodb:// or mongodb+srv://.");
  else if (nodeEnv === "production") {
    try {
      const mongoHost = new URL(env.MONGO_URI).hostname;
      if (isLocalHostname(mongoHost) || isPlaceholderHostname(mongoHost)) {
        errors.push("MONGO_URI must point to a real remote database in production.");
      }
    } catch {
      errors.push("MONGO_URI is invalid.");
    }
  }
  if (!env.JWT_SECRET) errors.push("JWT_SECRET is required.");
  else if (Buffer.byteLength(env.JWT_SECRET, "utf8") < 32 || /replace|change|example|your[_ -]/i.test(env.JWT_SECRET)) errors.push("JWT_SECRET must be a generated secret of at least 32 bytes, not a placeholder.");

  const port = env.PORT === undefined || env.PORT === "" ? 5000 : Number(env.PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) errors.push("PORT must be an integer between 1 and 65535.");
  const proxyHops = env.TRUST_PROXY_HOPS === undefined || env.TRUST_PROXY_HOPS === "" ? 0 : Number(env.TRUST_PROXY_HOPS);
  if (!Number.isInteger(proxyHops) || proxyHops < 0 || proxyHops > 10) errors.push("TRUST_PROXY_HOPS must be an integer between 0 and 10.");

  const rawOrigins = env.CLIENT_URL || (nodeEnv === "development" ? "http://localhost:3000" : "");
  if (!rawOrigins) errors.push("CLIENT_URL is required outside development.");
  else {
    const origins = rawOrigins.split(",").map((item) => item.trim()).filter(Boolean);
    if (!origins.length) errors.push("CLIENT_URL must contain at least one origin.");
    for (const origin of origins) {
      try {
        const parsed = new URL(origin);
        if (parsed.origin !== origin.replace(/\/$/, "") || !["http:", "https:"].includes(parsed.protocol)) {
          errors.push("CLIENT_URL entries must be valid origins without a path.");
          break;
        }
        if (nodeEnv === "production" && (parsed.protocol !== "https:" || isLocalHostname(parsed.hostname) || isPlaceholderHostname(parsed.hostname))) {
          errors.push("CLIENT_URL entries must use a real HTTPS production hostname.");
          break;
        }
      } catch {
        errors.push("CLIENT_URL contains an invalid origin.");
        break;
      }
    }
  }

  if (errors.length) throw new Error(`Invalid server environment configuration:\n- ${errors.join("\n- ")}`);
  return {
    nodeEnv,
    port,
    proxyHops,
    mongoUri: env.MONGO_URI,
    clientOrigins: rawOrigins.split(",").map((value) => new URL(value.trim()).origin),
  };
};

module.exports = { validateServerEnv };
