/**
 * Saved tab — CORRECTED
 * REPLACES: artifacts/internaura/app/(tabs)/saved.tsx
 *
 * FIX #4 — MOST SAVED ITEMS COULD NEVER APPEAR
 * --------------------------------------------
 * The old body was one line:
 *
 *     list = internships.filter((x) => saved.includes(x.id));
 *
 * `internships` is the raw seeded table from GET /api/internships. But Discover
 * renders `recommendations`, and the resume analyzer renders live Adzuna jobs
 * whose ids look like "adzuna-4718392" — not UUIDs, absent from that table. So
 * the entire live-jobs half of the product could never show up here.
 *
 * Now searches recommendations FIRST (they carry ATS scores and skill gaps) and
 * falls back to the internships list, so anything savable is displayable.
 *
 * Also adds: loading state, an unsave affordance, and an apply link for external
 * listings (fix #31 — redirectUrl was returned by the API and used on exactly
 * one screen, so there was no way to actually apply from the main flow).
 */

import React, { useMemo } from "react";
import { ActivityIndicator, FlatList, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { Card } from "@/components";

export default function SavedScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);

  const { savedIds, recommendations, internships, toggleSave, isLoading, profile } = useApp();

  const list = useMemo(() => {
    const byId = new Map<string, any>();
    // Recommendations first — they carry atsScore and skillGaps.
    for (const r of recommendations) byId.set(r.id, r);
    for (const i of internships) if (!byId.has(i.id)) byId.set(i.id, i);
    return savedIds.map((id) => byId.get(id)).filter(Boolean);
  }, [savedIds, recommendations, internships]);

  if (isLoading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={c.primary} />
      </View>
    );
  }

  // savedIds we couldn't resolve — surfaced honestly rather than silently dropped.
  const unresolved = savedIds.length - list.length;

  return (
    <FlatList
      data={list}
      keyExtractor={(x) => x.id}
      contentContainerStyle={[s.container, { paddingTop: insets.top + 20, paddingBottom: 105 }]}
      ListHeaderComponent={
        <>
          <Text style={s.title}>Your shortlist</Text>
          <Text style={s.sub}>Keep the roles that spark something.</Text>
          <Text style={s.kicker}>
            SAVED ROLES{list.length > 0 ? ` · ${list.length}` : ""}
          </Text>
        </>
      }
      renderItem={({ item }) => (
        <View>
          <Card
            item={item}
            saved
            selectedSkills={profile?.skills ?? []} /* fix #30: was never passed, so
                                                      the "Matches:" chips never rendered */
            onPress={() => router.push(`/internship/${item.id}` as any)}
          />
          <View style={s.rowActions}>
            <Pressable onPress={() => toggleSave(item.id)} style={s.actionBtn} hitSlop={8}>
              <Feather name="bookmark" size={14} color={c.primary} />
              <Text style={s.actionT}>Remove</Text>
            </Pressable>

            {item.redirectUrl ? (
              <Pressable
                onPress={() => Linking.openURL(item.redirectUrl).catch(() => {})}
                style={s.actionBtn}
                hitSlop={8}
              >
                <Feather name="external-link" size={14} color={c.primary} />
                <Text style={s.actionT}>Apply</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      )}
      ListFooterComponent={
        unresolved > 0 ? (
          <Text style={s.note}>
            {unresolved} saved {unresolved === 1 ? "role is" : "roles are"} no longer listed.
          </Text>
        ) : null
      }
      ListEmptyComponent={
        <Text style={s.empty}>
          Nothing saved yet{"\n"}Tap the bookmark on a role to keep it here.
        </Text>
      }
    />
  );
}

const makeStyles = (c: any) =>
  StyleSheet.create({
    center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.background },
    container: { paddingHorizontal: 20, backgroundColor: c.background },
    title: { fontFamily: "Inter_700Bold", fontSize: 30, color: c.foreground, marginTop: 28 },
    sub: { fontFamily: "Inter_400Regular", fontSize: 14, color: c.mutedForeground, marginTop: 5, marginBottom: 25 },
    kicker: { fontFamily: "Inter_600SemiBold", fontSize: 10, letterSpacing: 1.5, color: c.primary, marginBottom: 14 },
    rowActions: { flexDirection: "row", gap: 18, marginTop: -4, marginBottom: 14, paddingHorizontal: 4 },
    actionBtn: { flexDirection: "row", alignItems: "center", gap: 5 },
    actionT: { fontFamily: "Inter_500Medium", fontSize: 12, color: c.primary },
    note: { fontFamily: "Inter_400Regular", fontSize: 12, color: c.mutedForeground, textAlign: "center", marginTop: 16 },
    empty: { textAlign: "center", paddingTop: 90, fontFamily: "Inter_500Medium", fontSize: 15, lineHeight: 24, color: c.mutedForeground },
  });
