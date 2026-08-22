import React from "react";
import { FlatList, StyleSheet, Text } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/context/AppContext";
import colors from "@/constants/colors";
import { Card } from "@/components";

const c = colors.light;

export default () => {
  const i = useSafeAreaInsets(),
    r = useRouter(),
    { saved, internships } = useApp(),
    list = internships.filter((x: any) => saved.includes(x.id));

  return (
    <FlatList
      data={list}
      keyExtractor={(x) => x.id}
      contentContainerStyle={[
        s.container,
        { paddingTop: i.top + 20, paddingBottom: 105 },
      ]}
      ListHeaderComponent={
        <>
          <Text style={s.title}>Your shortlist</Text>
          <Text style={s.sub}>Keep the roles that spark something.</Text>
          <Text style={s.kicker}>SAVED ROLES</Text>
        </>
      }
      renderItem={({ item }) => (
        <Card
          item={item}
          saved
          onPress={() => r.push(("/internship/" + item.id) as any)}
        />
      )}
      ListEmptyComponent={
        <Text style={s.empty}>
          Nothing saved yet{"\n"}Tap the bookmark on a role to keep it here.
        </Text>
      }
    />
  );
};

const s = StyleSheet.create({
  container: { paddingHorizontal: 20, backgroundColor: c.background },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 30,
    color: c.foreground,
    marginTop: 28,
  },
  sub: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: c.mutedForeground,
    marginTop: 5,
    marginBottom: 25,
  },
  kicker: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    letterSpacing: 1.5,
    color: c.primary,
    marginBottom: 14,
  },
  empty: {
    textAlign: "center",
    paddingTop: 90,
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    lineHeight: 24,
    color: c.mutedForeground,
  },
});