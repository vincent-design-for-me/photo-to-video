import { describeKlingJwt } from "../lib/providers/klingAuth";

const accessKey = process.env.KLING_ACCESS_KEY;
const secretKey = process.env.KLING_SECRET_KEY;

if (!accessKey || !secretKey) {
  throw new Error("Set KLING_ACCESS_KEY and KLING_SECRET_KEY in .env.local before generating a Kling JWT.");
}

const jwt = describeKlingJwt(accessKey, secretKey);

console.log("Kling API Token generated.");
console.log(`Access Key: ${mask(accessKey)}`);
console.log(`Not before: ${new Date(jwt.notBefore * 1000).toISOString()}`);
console.log(`Expires at: ${new Date(jwt.expiresAt * 1000).toISOString()}`);
console.log("");
console.log(jwt.token);
console.log("");
console.log("Use this request header:");
console.log(jwt.authorization);

function mask(value: string): string {
  if (value.length <= 8) {
    return "********";
  }
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}
