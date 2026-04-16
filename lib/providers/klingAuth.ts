import { createHmac } from "node:crypto";

type KlingAuthInput = {
  apiKey?: string;
  accessKey?: string;
  secretKey?: string;
  nowSeconds?: number;
};

type KlingJwtDescription = {
  token: string;
  authorization: string;
  issuedTo: string;
  notBefore: number;
  expiresAt: number;
  ttlSeconds: number;
};

export function buildKlingAuthorization(input: KlingAuthInput): string | undefined {
  if (input.accessKey && input.secretKey) {
    return `Bearer ${createKlingJwt(input.accessKey, input.secretKey, input.nowSeconds)}`;
  }

  if (input.apiKey) {
    return `Bearer ${input.apiKey}`;
  }

  return undefined;
}

export function createKlingJwt(accessKey: string, secretKey: string, nowSeconds = Math.floor(Date.now() / 1000)): string {
  const header = {
    alg: "HS256",
    typ: "JWT"
  };
  const payload = {
    iss: accessKey,
    exp: nowSeconds + 1800,
    nbf: nowSeconds - 5
  };

  const unsigned = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(payload))}`;
  const signature = createHmac("sha256", secretKey).update(unsigned).digest("base64url");
  return `${unsigned}.${signature}`;
}

export function describeKlingJwt(accessKey: string, secretKey: string, nowSeconds = Math.floor(Date.now() / 1000)): KlingJwtDescription {
  const token = createKlingJwt(accessKey, secretKey, nowSeconds);
  return {
    token,
    authorization: `Bearer ${token}`,
    issuedTo: accessKey,
    notBefore: nowSeconds - 5,
    expiresAt: nowSeconds + 1800,
    ttlSeconds: 1800
  };
}

function base64Url(value: string): string {
  return Buffer.from(value).toString("base64url");
}
