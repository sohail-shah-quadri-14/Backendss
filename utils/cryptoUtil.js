import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

// AES-GCM encryption configuration
const algorithm = "aes-256-gcm";
const secretKey = Buffer.from(process.env.SECRET_KEY, "hex");

if (!process.env.SECRET_KEY || secretKey.length !== 32) {
  throw new Error("Invalid SECRET_KEY: Must be exactly 32 bytes (64 hex characters).");
}

// Generic Encryption Function
const encrypt = (text) => {
  try {
    if (!text || typeof text !== "string") {
      throw new Error("Invalid text provided for encryption.");
    }
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(algorithm, secretKey, iv);
    let encrypted = cipher.update(text, "utf-8", "hex");
    encrypted += cipher.final("hex");
    const authTag = cipher.getAuthTag().toString("hex");

    return `${iv.toString("hex")}:${encrypted}:${authTag}`;
  } catch (error) {
    console.error("Encryption error:", error.message);
    return null;
  }
};

// Generic Decryption Function
const decrypt = (encryptedText) => {
  try {
    if (!encryptedText || typeof encryptedText !== "string") {
      throw new Error("Invalid encrypted text provided.");
    }
    const parts = encryptedText.split(":");
    if (parts.length !== 3) {
      throw new Error("Invalid encrypted text format.");
    }

    const [ivHex, encryptedData, authTagHex] = parts;
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");

    const decipher = crypto.createDecipheriv(algorithm, secretKey, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedData, "hex", "utf-8");
    decrypted += decipher.final("utf-8");

    return decrypted;
  } catch (error) {
    console.error("Decryption error:", error.message);
    return null;
  }
};

export { encrypt, decrypt };
