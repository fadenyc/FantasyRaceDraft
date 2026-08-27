import { customAlphabet } from "nanoid";
import { randomHex } from "./fairness/hash";

// Unambiguous alphabet (no 0/O/1/I/l) since this token appears in a URL people read aloud/type.
const nanoidPublic = customAlphabet(
  "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz",
  8,
);

/** Shareable, non-secret token identifying a season's public page. */
export function generatePublicToken(): string {
  return nanoidPublic();
}

/** Secret credential embedded in the commissioner's admin URL. Must be unguessable. */
export function generateAdminToken(): string {
  return randomHex(32);
}
