import React from "react";
import { ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { useApp } from "@/context/AppContext";
import colors from "@/constants/colors";

import { supabase } from "../../lib/supabase";

const c = colors.light;

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { profile, savedIds, appliedIds, signOut } = useApp();

  const handleSignOut = async () => {
    try {
      console.log("[Profile] Signing out with Supabase Auth...");
      await signOut();
      router.replace("/login");
    } catch (err) {
      console.error("[Profile] Sign out error:", err);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={[
        s.container,
        { paddingTop: insets.top + 20, paddingBottom: 120 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={s.title}>Your profile</Text>

      <View style={s.identity}>
        <View style={s.avatar}>
          <Text style={s.avatarT}>
            {profile?.name
              ? profile.name
                  .split(" ")
                  .map((x: string) => x[0])
                  .join("")
              : "U"}
          </Text>
        </View>
        <Text style={s.name}>{profile?.name || "Student"}</Text>
        <Text style={s.degree}>
          {profile?.degree || "Undergraduate"} · {profile?.year || "Student"}
        </Text>
        <Pressable onPress={() => router.push("/onboarding")} style={s.editBtn}>
          <Text style={s.edit}>Edit profile  ›</Text>
        </Pressable>
      </View>

      <View style={s.stats}>
        <Stat n={String(savedIds.length)} t="saved" />
        <Stat n={String(appliedIds.length)} t="applied" />
      </View>

      <Text style={s.kicker}>YOUR DIRECTION</Text>
      <Text style={s.section}>What you’re aiming for</Text>
      <View style={s.info}>
        <Text style={s.label}>Career goal</Text>
        <Text style={s.value}>{profile?.goal || "Not set"}</Text>
        <Text style={s.label}>Location & Mode</Text>
        <Text style={s.value}>
          {profile?.location || "Not set"} · {profile?.workMode || "Not set"}
        </Text>
      </View>

      <Text style={s.kicker}>YOUR TOOLKIT</Text>
      <Text style={s.section}>Skills</Text>
      <View style={s.tags}>
        {(profile?.skills || []).map((x: string) => (
          <Text style={s.tag} key={x}>
            {x}
          </Text>
        ))}
      </View>

      {/* Account Settings & Actions per PRD */}
      <Text style={[s.kicker, { marginTop: 32 }]}>ACCOUNT SETTINGS</Text>
      <Text style={s.section}>Account Actions</Text>
      <View style={s.accountBox}>
        <Pressable onPress={() => router.push("/onboarding")} style={s.actionRow}>
          <View style={s.actionLeft}>
            <Feather name="edit-3" size={16} color={c.foreground} />
            <Text style={s.actionText}>Edit Onboarding Preferences</Text>
          </View>
          <Feather name="chevron-right" size={16} color={c.mutedForeground} />
        </Pressable>

        <View style={s.divider} />

        <Pressable onPress={handleSignOut} style={s.actionRow}>
          <View style={s.actionLeft}>
            <Feather name="log-out" size={16} color={c.destructive} />
            <Text style={[s.actionText, { color: c.destructive }]}>Sign Out & Reset Session</Text>
          </View>
          <Feather name="chevron-right" size={16} color={c.destructive} />
        </Pressable>
      </View>
    </ScrollView>
  );
}

function Stat({ n, t }: { n: string; t: string }) {
  return (
    <View>
      <Text style={s.statN}>{n}</Text>
      <Text style={s.statT}>{t}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    backgroundColor: c.background,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 30,
    color: c.foreground,
    marginTop: 28,
  },
  identity: {
    alignItems: "center",
    marginTop: 32,
  },
  avatar: {
    height: 82,
    width: 82,
    borderRadius: 30,
    backgroundColor: c.foreground,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarT: {
    fontFamily: "Inter_700Bold",
    fontSize: 25,
    color: c.accent,
  },
  name: {
    fontFamily: "Inter_700Bold",
    fontSize: 24,
    color: c.foreground,
    marginTop: 14,
  },
  degree: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: c.mutedForeground,
    marginTop: 4,
  },
  editBtn: {
    marginTop: 10,
  },
  edit: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: c.primary,
  },
  stats: {
    backgroundColor: c.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#EEE8DF",
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 18,
    marginTop: 25,
    marginBottom: 30,
  },
  statN: {
    fontFamily: "Inter_700Bold",
    fontSize: 21,
    color: c.foreground,
    textAlign: "center",
  },
  statT: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: c.mutedForeground,
    textAlign: "center",
    marginTop: 3,
  },
  kicker: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    letterSpacing: 1.5,
    color: c.primary,
    marginBottom: 5,
  },
  section: {
    fontFamily: "Inter_700Bold",
    fontSize: 23,
    color: c.foreground,
    marginBottom: 14,
  },
  info: {
    backgroundColor: c.card,
    borderRadius: 20,
    padding: 15,
    borderWidth: 1,
    borderColor: "#EEE8DF",
    marginBottom: 28,
  },
  label: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: c.mutedForeground,
    marginTop: 5,
  },
  value: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: c.foreground,
    marginTop: 3,
    marginBottom: 10,
  },
  tags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tag: {
    backgroundColor: c.secondary,
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 9,
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: c.secondaryForeground,
  },
  accountBox: {
    backgroundColor: c.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#EEE8DF",
    marginBottom: 30,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
  },
  actionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  actionText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: c.foreground,
  },
  divider: {
    height: 1,
    backgroundColor: "#EEE8DF",
  },
});