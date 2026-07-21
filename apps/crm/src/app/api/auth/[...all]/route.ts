import { auth } from "@/server/auth";
import { toNextJsHandler } from "better-auth/next-js";

// Mount the Better Auth endpoints (e.g. /api/auth/sign-in, /api/auth/session)
export const { GET, POST } = toNextJsHandler(auth);
