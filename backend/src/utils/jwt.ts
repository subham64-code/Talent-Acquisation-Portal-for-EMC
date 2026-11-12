import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env";
import { ApiError } from "./ApiError";

export type SubjectType = "HR" | "CANDIDATE";

export interface AuthTokenPayload {
  sub: string;
  type: SubjectType;
  sid: string;
  iat?: number;
  exp?: number;
}

export function signAuthToken(payload: Omit<AuthTokenPayload, "iat" | "exp">, expiresIn?: string) {
  return jwt.sign(payload, env.jwtSecret, {
    expiresIn: expiresIn || env.jwtExpiresIn,
  } as SignOptions);
}

export function verifyAuthToken(token: string): AuthTokenPayload {
  try {
    return jwt.verify(token, env.jwtSecret) as AuthTokenPayload;
  } catch {
    throw ApiError.unauthorized("Your session is invalid or has expired. Please sign in again.");
  }
}

export interface PurposeTokenPayload extends jwt.JwtPayload {
  purpose: string;
}

export function signPurposeToken(
  payload: Record<string, unknown>,
  purpose: string,
  expiresIn: string,
): string {
  return jwt.sign({ ...payload, purpose }, env.jwtSecret, {
    expiresIn,
  } as SignOptions);
}

export function verifyPurposeToken(token: string, purpose: string): PurposeTokenPayload {
  let decoded: jwt.JwtPayload;
  try {
    decoded = jwt.verify(token, env.jwtSecret) as jwt.JwtPayload;
  } catch {
    throw ApiError.unauthorized("This secure link is invalid or has expired.");
  }
  if (decoded.purpose !== purpose) {
    throw ApiError.unauthorized("This secure link is not valid for this action.");
  }
  return decoded as PurposeTokenPayload;
}
