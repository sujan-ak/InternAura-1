/**
 * Root layout
 * REPLACES: artifacts/internaura/app/_layout.tsx
 *
 * TWO CHANGES vs. the original
 * ----------------------------
 * 1. FIX (gap #8): calls initApi() before anything renders. This is the missing
 *    link that made the whole API unauthenticated — setAuthTokenGetter() has
 *    existed in lib/api-client-react/src/custom-fetch.ts since day one and was
 *    NEVER CALLED anywhere in the repo, so every request went out without a JWT
 *    and the server had to guess who the caller was from query params.
 *    It also calls setBaseUrl() unconditionally; the old code only did so when
 *    Platform.OS !== "web", which split the app across two different base URLs.
 *
 * 2. De-minified. The original was a single 1,100-character line, which is why
 *    nobody noticed the missing init call. Same component, same behaviour.
 *
 * Also adds sensible React Query defaults — the old QueryClient took none, so
 * every screen re-fetched on focus with no retry policy.
 */

import React, { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppProvider } from "@/context/AppContext";
import { initApi } from "@/lib/api";

// Must run before any query fires. Idempotent, safe at module scope.
initApi();

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // A 401 or 404 will not succeed on retry — only retry transient failures.
      retry: (failureCount, error) => {
        const status = (error as { status?: number })?.status;
        if (status && status >= 400 && status < 500) return false;
        return failureCount < 2;
      },
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <AppProvider>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <KeyboardProvider>
                <Stack screenOptions={{ headerShown: false }} />
              </KeyboardProvider>
            </GestureHandlerRootView>
          </AppProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
