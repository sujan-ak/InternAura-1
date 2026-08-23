import React, { useEffect, useState } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { Redirect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../lib/supabase";
import colors from "@/constants/colors";

const c = colors.light;

type AuthStatus = "loading" | "unauthenticated" | "onboarding" | "authenticated";

export default function RootIndex() {
  const [authStatus, setAuthStatus] = useState<AuthStatus>("loading");

  useEffect(() => {
    async function checkAuthAndOnboarding() {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!session || !session.user) {
          setAuthStatus("unauthenticated");
          return;
        }

        // Active session exists
        const hasOnboardedVal = await AsyncStorage.getItem("hasOnboarded");
        if (hasOnboardedVal === "true") {
          setAuthStatus("authenticated");
        } else {
          setAuthStatus("onboarding");
        }
      } catch (err) {
        console.warn("Error checking auth status:", err);
        setAuthStatus("unauthenticated");
      }
    }

    checkAuthAndOnboarding();
  }, []);

  if (authStatus === "loading") {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={c.primary} />
      </View>
    );
  }

  if (authStatus === "unauthenticated") {
    return <Redirect href="/login" />;
  }

  if (authStatus === "onboarding") {
    return <Redirect href="/onboarding" />;
  }

  return <Redirect href="/(tabs)" />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.background,
  },
});