/**
 * Single API entry point — fixes gaps #25 and #8 (client half).
 * PLACE AT: artifacts/internaura/lib/api.ts
 *
 * THE BUGS THIS FIXES
 * -------------------
 * There were THREE different base URLs in the app:
 *   AppContext.tsx:17  EXPO_PUBLIC_API_URL || "http://localhost:5000"
 *   login.tsx:59       EXPO_PUBLIC_API_URL || "http://<a dev machine's LAN IP>:5000"
 *                      <- hardcoded and committed to the repo
 *   AppContext.tsx:20  setBaseUrl() called ONLY when Platform.OS !== "web", so on
 *                      web the generated orval client used relative paths while
 *                      studentQuery used an absolute URL. Deploy the web build
 *                      anywhere but :5000 and half the calls break.
 *
 * And setAuthTokenGetter() — which already exists in
 * lib/api-client-react/src/custom-fetch.ts:43 — was NEVER CALLED anywhere in the
 * repo, so every request went out unauthenticated. That is the client side of
 * gap #8.
 *
 * Call initApi() once, at the top of app/_layout.tsx, before anything renders.
 */

import { Platform } from "react-native";
import Constants from "expo-constants";
import { setBaseUrl, setAuthTokenGetter } from "@workspace/api-client-react";
import { supabase } from "./supabase";

function resolveBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, "");

  // Web served from the same origin as the API: relative paths are correct.
  if (Platform.OS === "web") return "";

  // Dev convenience only: derive the LAN host Metro is already serving from, so
  // a physical device can reach the laptop without anyone hardcoding an IP.
  if (__DEV__) {
    const hostUri =
      Constants.expoConfig?.hostUri ??
      (Constants.manifest2 as { extra?: { expoGo?: { debuggerHost?: string } } })?.extra?.expoGo
        ?.debuggerHost;
    const host = hostUri?.split(":")[0];
    if (host) return `http://${host}:5000`;
  }

  // Simulators only. A physical device cannot reach the host's localhost.
  return "http://localhost:5000";
}

export const API_BASE_URL = resolveBaseUrl();

/** Build an absolute URL for the few places that still need raw fetch. */
export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${p}`;
}

let initialised = false;

export function initApi(): void {
  if (initialised) return;
  initialised = true;

  // Set unconditionally — the old code skipped this on web, which is what split
  // the app across two base URLs.
  setBaseUrl(API_BASE_URL || null);

  // THE MISSING LINK. Every generated hook now sends the Supabase JWT, so the
  // server can identify the caller instead of guessing from query params.
  setAuthTokenGetter(async () => {
    // getSession() refreshes an expired token automatically.
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  });
}

/** Authenticated fetch for endpoints not yet in the OpenAPI spec (gap #24). */
export async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  if (init.body && typeof init.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(apiUrl(path), { ...init, headers });
}
