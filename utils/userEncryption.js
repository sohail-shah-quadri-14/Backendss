import { encrypt, decrypt } from "./cryptoUtil.js";

// Encrypt User Data
const encryptUserData = (userData) => {
  return {
    FullName: userData.FullName ? encrypt(userData.FullName) : null,
    Email: userData.Email ? userData.Email : null, // No encryption for email
    Phone: userData.Phone ? encrypt(userData.Phone) : null,
    Account_Type: userData.Account_Type ? encrypt(userData.Account_Type) : null,
    Address: userData.Address ? encrypt(userData.Address) : null,
  };
};

// Decrypt User Data
const decryptUserData = (encryptedData) => {
  return {
    FullName: encryptedData.FullName ? decrypt(encryptedData.FullName) : null,
    Email: encryptedData.Email ? encryptedData.Email : null, // No decryption needed for email
    Phone: encryptedData.Phone ? decrypt(encryptedData.Phone) : null,
    Account_Type: encryptedData.Account_Type ? decrypt(encryptedData.Account_Type) : null,
    Address: encryptedData.Address ? decrypt(encryptedData.Address) : null,
    amount: encryptedData.amount ? parseFloat(decrypt(encryptedData.amount)) : null,
  };
};

export { encryptUserData, decryptUserData };
