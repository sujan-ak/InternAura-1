/**
 * AppContext — CORRECTED
 * REPLACES: artifacts/internaura/context/AppContext.tsx
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * FIX #3 — UN-SAVING WAS IMPOSSIBLE
 * ─────────────────────────────────────────────────────────────────────────────
 * The old toggleSave() was:
 *
 *     const isSaved = savedIds.includes(id);
 *     logInteraction(id, isSaved ? "view" : "save");
 *
 * `interactions` is append-only and there was no DELETE endpoint, so "unsave"
 * inserted a `view` row while the original `save` row survived. savedIds still
 * contained the id, and the bookmark snapped straight back to filled.
 * Now calls DELETE /interactions (added in patches/api-server/routes/interactions.ts).
 *
 * FIX #3b — savedIds/appliedIds were never de-duplicated, so tapping save 5 times
 * showed "5 saved" on Profile and Insights. Now deduped via a Set.
 *
 * FIX #8 — every request now carries the Supabase JWT via initApi(). All
 * `student_id` query params are gone; the server resolves identity from the token.
 *
 * FIX #13/#15 — removed `|| 85` and `parseInt(rec.score) || 85`. A missing score
 * is now `null` and screens render an empty state instead of a fabricated number.
 *
 * FIX #17f — skippedIds is exposed and actually honoured. The Discover screen had
 * its own local useState that shadowed this, so skips were forgotten on navigate.
 *
 * Optimistic updates are used for save/apply so the bookmark responds instantly
 * and rolls back if the request fails — the old version waited for a refetch.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../lib/supabase";
import { initApi, authedFetch } from "../lib/api";

initApi(); // wires base URL + JWT getter before any query runs

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SkillStatus = "Strong" | "Partial" | "Missing";

export interface AtsBreakdown {
  skillMatchPct: number;
  semanticSimPct: number;
  assessmentPerfPct: number;
  domainEduFitPct: number;
  locationPrefPct: number;
  atsScore: number;
  hasAssessments: boolean;
  semanticMethodUsed: string;
  weightsApplied: Record<string, number>;
}

export interface RecommendationView {
  id: string;
  title: string;
  company: string;
  domain: string;
  location: string;
  workMode: string;
  duration: string;
  stipend: string;
  description: string;
  /** null when the server did not compute a score. NEVER a placeholder. */
  atsScore: number | null;
  atsBreakdown: AtsBreakdown | null;
  reasons: string[];
  skillGaps: { skill: string; status: SkillStatus }[];
  requiredSkills: string[];
  preferredSkills: string[];
  experienceLevel: string;
  redirectUrl: string | null;
  source: "internal" | "adzuna";
}

export interface StudentProfile {
  id: string | null;
  name: string;
  degree: string;
  year: string;
  goal: string;
  location: string;
  workMode: string;
  stipendPreference: string;
  interests: string[];
  skills: string[];
}

interface AppContextType {
  authUserId: string | null;
  /** null until loaded, or when the account has no profile yet. */
  profile: StudentProfile | null;
  hasProfile: boolean;
  internships: RecommendationView[];
  recommendations: RecommendationView[];
  savedIds: string[];
  appliedIds: string[];
  skippedIds: string[];
  toggleSave: (id: string) => void;
  applyToInternship: (id: string) => void;
  skipInternship: (id: string, reason?: string) => void;
  unskipInternship: (id: string) => void;
  logView: (id: string) => void;
  isLoading: boolean;
  error: Error | null;
  refetchAll: () => void;
  signOut: () => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

function toView(rec: any): RecommendationView {
  const it = rec?.internship ?? rec ?? {};
  return {
    id: it.id ?? rec?.internshipId ?? "",
    title: it.title ?? "Untitled role",
    company: it.company ?? "Unknown company",
    domain: it.domain ?? "",
    location: it.location ?? "",
    workMode: it.workMode ?? "",
    duration: it.duration ?? "",
    stipend: it.stipend ?? "",
    description: it.description ?? "",
    // No `|| 85`. If the server didn't score it, we say so.
    atsScore: typeof rec?.atsScore === "number" ? rec.atsScore : null,
    atsBreakdown: rec?.atsBreakdown ?? null,
    reasons: Array.isArray(rec?.reasons) ? rec.reasons : [],
    skillGaps: Array.isArray(rec?.skillGap)
      ? rec.skillGap.map(([skill, status]: [string, string]) => ({
          skill,
          status: (status === "Strong" || status === "Partial" ? status : "Missing") as SkillStatus,
        }))
      : [],
    requiredSkills: it.requiredSkills ?? [],
    preferredSkills: it.preferredSkills ?? [],
    experienceLevel: it.experienceLevel ?? "",
    redirectUrl: it.redirectUrl ?? null,
    source: it.source === "adzuna" ? "adzuna" : "internal",
  };
}

async function getJson<T>(path: string): Promise<T | null> {
  const res = await authedFetch(path);
  // 404 + NO_PROFILE is expected before onboarding — not an error.
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AppProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setAuthUserId(data.session?.user?.id ?? null);
      setAuthReady(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const uid = session?.user?.id ?? null;
      setAuthUserId(uid);
      if (!uid) {
        await AsyncStorage.multiRemove([
          "auth_user_id",
          "studentId",
          "hasOnboarded",
          "internaura-filters",
          "internaura-sort",
        ]);
        queryClient.clear();
      }
    });

    return () => {
      mounted = false;
      listener?.subscription.unsubscribe();
    };
  }, [queryClient]);

  const enabled = authReady && Boolean(authUserId);

  const studentQuery = useQuery({
    queryKey: ["/api/students/me", authUserId],
    queryFn: () => getJson<any>("/api/students/me"),
    enabled,
    staleTime: 60_000,
  });

  const recommendationsQuery = useQuery({
    queryKey: ["/api/recommendations", authUserId],
    queryFn: () => getJson<any[]>("/api/recommendations"),
    // No student_id param — the server reads the JWT.
    enabled: enabled && Boolean(studentQuery.data?.id),
    staleTime: 30_000,
  });

  const internshipsQuery = useQuery({
    queryKey: ["/api/internships"],
    queryFn: () => getJson<any[]>("/api/internships"),
    enabled,
    staleTime: 5 * 60_000,
  });

  const interactionsQuery = useQuery({
    queryKey: ["/api/interactions", authUserId],
    queryFn: () => getJson<any[]>("/api/interactions"),
    enabled: enabled && Boolean(studentQuery.data?.id),
    staleTime: 15_000,
  });

  // --- Derived ids, DE-DUPLICATED (fix #3b) ---
  const interactions = useMemo(
    () => (Array.isArray(interactionsQuery.data) ? interactionsQuery.data : []),
    [interactionsQuery.data],
  );

  const idsFor = useCallback(
    (...actions: string[]) => [
      ...new Set(
        interactions.filter((i: any) => actions.includes(i.action)).map((i: any) => i.internshipId),
      ),
    ],
    [interactions],
  );

  const savedIds = useMemo(() => idsFor("save", "like"), [idsFor]);
  const appliedIds = useMemo(() => idsFor("apply"), [idsFor]);
  const skippedIds = useMemo(() => idsFor("skip"), [idsFor]);

  // --- Mutations ---
  const invalidateInteractions = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/interactions"] });
    queryClient.invalidateQueries({ queryKey: ["/api/recommendations"] });
  }, [queryClient]);

  const addInteraction = useMutation({
    mutationFn: async (v: { internshipId: string; action: string; reason?: string }) => {
      const res = await authedFetch("/api/interactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(v),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        // Surfaces the real reason Adzuna saves failed (fix #4) instead of a
        // silent 500 the user never sees.
        throw new Error(body.error ?? `Failed to record ${v.action}`);
      }
      return res.json();
    },
    onSettled: invalidateInteractions,
  });

  const removeInteraction = useMutation({
    mutationFn: async (v: { internshipId: string; action: string }) => {
      // The endpoint that never existed — see patches/api-server/routes/interactions.ts
      const res = await authedFetch("/api/interactions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(v),
      });
      if (!res.ok) throw new Error(`Failed to remove ${v.action}`);
      return res.json();
    },
    onSettled: invalidateInteractions,
  });

  /** Optimistically patch the interactions cache so the UI responds instantly. */
  const patchCache = useCallback(
    (fn: (rows: any[]) => any[]) => {
      queryClient.setQueryData(["/api/interactions", authUserId], (old: any) =>
        fn(Array.isArray(old) ? old : []),
      );
    },
    [queryClient, authUserId],
  );

  const toggleSave = useCallback(
    (internshipId: string) => {
      const isSaved = savedIds.includes(internshipId);

      if (isSaved) {
        patchCache((rows) =>
          rows.filter(
            (r) => !(r.internshipId === internshipId && (r.action === "save" || r.action === "like")),
          ),
        );
        // THE ACTUAL FIX: delete the row instead of appending a "view".
        removeInteraction.mutate({ internshipId, action: "save" });
        removeInteraction.mutate({ internshipId, action: "like" });
      } else {
        patchCache((rows) => [
          ...rows,
          { id: `optimistic-${internshipId}`, internshipId, action: "save" },
        ]);
        addInteraction.mutate({ internshipId, action: "save" });
      }
    },
    [savedIds, patchCache, addInteraction, removeInteraction],
  );

  const applyToInternship = useCallback(
    (internshipId: string) => {
      if (appliedIds.includes(internshipId)) return; // idempotent
      patchCache((rows) => [
        ...rows,
        { id: `optimistic-apply-${internshipId}`, internshipId, action: "apply" },
      ]);
      addInteraction.mutate({ internshipId, action: "apply" });
    },
    [appliedIds, patchCache, addInteraction],
  );

  const skipInternship = useCallback(
    (internshipId: string, reason?: string) => {
      patchCache((rows) => [
        ...rows,
        { id: `optimistic-skip-${internshipId}`, internshipId, action: "skip", reason },
      ]);
      addInteraction.mutate({ internshipId, action: "skip", reason });
    },
    [patchCache, addInteraction],
  );

  const unskipInternship = useCallback(
    (internshipId: string) => {
      patchCache((rows) => rows.filter((r) => !(r.internshipId === internshipId && r.action === "skip")));
      removeInteraction.mutate({ internshipId, action: "skip" });
    },
    [patchCache, removeInteraction],
  );

  /**
   * Views are logged at most once per session per internship. The old code fired
   * on every detail-screen mount, growing the table without bound.
   */
  const [viewed] = useState(() => new Set<string>());
  const logView = useCallback(
    (internshipId: string) => {
      if (!internshipId || viewed.has(internshipId)) return;
      viewed.add(internshipId);
      addInteraction.mutate({ internshipId, action: "view" });
    },
    [viewed, addInteraction],
  );

  // --- Shaped output ---
  const raw = studentQuery.data;
  const profile: StudentProfile | null = raw
    ? {
        id: raw.id,
        name: raw.name,
        degree: raw.degree,
        year: raw.year,
        goal: raw.careerGoal,
        location: raw.location,
        workMode: raw.workMode,
        stipendPreference: raw.stipendPreference,
        interests: raw.interests ?? [],
        skills: (raw.skills as string[]) ?? [],
      }
    : null;

  const recommendations = useMemo(
    () => (Array.isArray(recommendationsQuery.data) ? recommendationsQuery.data.map(toView) : []),
    [recommendationsQuery.data],
  );

  const internships = useMemo(
    () => (Array.isArray(internshipsQuery.data) ? internshipsQuery.data.map(toView) : []),
    [internshipsQuery.data],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setAuthUserId(null);
    await AsyncStorage.multiRemove([
      "auth_user_id",
      "studentId",
      "hasOnboarded",
      "internaura-filters",
      "internaura-sort",
    ]);
    queryClient.clear();
  }, [queryClient]);

  const value: AppContextType = {
    authUserId,
    profile,
    hasProfile: Boolean(profile),
    internships,
    recommendations,
    savedIds,
    appliedIds,
    skippedIds,
    toggleSave,
    applyToInternship,
    skipInternship,
    unskipInternship,
    logView,
    isLoading: !authReady || studentQuery.isLoading || recommendationsQuery.isLoading,
    error: (studentQuery.error ?? recommendationsQuery.error ?? null) as Error | null,
    refetchAll: () => {
      studentQuery.refetch();
      recommendationsQuery.refetch();
      internshipsQuery.refetch();
      interactionsQuery.refetch();
    },
    signOut,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextType {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within an AppProvider");
  return ctx;
}
