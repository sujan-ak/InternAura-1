import React, { createContext, useContext } from "react";
import {
  useGetCurrentStudent,
  getGetCurrentStudentQueryKey,
  useListInternships,
  getListInternshipsQueryKey,
  useGetRecommendations,
  getGetRecommendationsQueryKey,
  useListInteractions,
  getListInteractionsQueryKey,
  useCreateInteraction,
  setBaseUrl,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Platform } from "react-native";

const resolvedApiUrl = process.env.EXPO_PUBLIC_API_URL || "http://localhost:5000";
console.log("[AppContext Init] EXPO_PUBLIC_API_URL resolved to:", resolvedApiUrl);

if (Platform.OS !== "web") {
  setBaseUrl(resolvedApiUrl);
}

export interface AppContextType {
  profile: {
    id?: string;
    name: string;
    degree: string;
    year: string;
    goal: string;
    location: string;
    workMode: string;
    mode: string;
    stipendPreference: string;
    interests: string[];
    skills: string[];
  };
  internships: any[];
  recommendations: any[];
  savedIds: string[];
  appliedIds: string[];
  skippedIds: string[];
  saved: string[];
  applied: string[];
  toggleSave: (id: string) => void;
  toggleSaved: (id: string) => void;
  applyToInternship: (id: string) => void;
  apply: (id: string) => void;
  skipInternship: (id: string, reason?: string) => void;
  logView: (id: string) => void;
  logSkip: (id: string, reason: string) => void;
  logInteraction: (id: string, action: string, reason?: string) => void;
  isLoading: boolean;
  refetchData: () => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();

  const studentQuery = useGetCurrentStudent({
    query: {
      queryKey: getGetCurrentStudentQueryKey(),
      retry: 1,
    },
  });

  const internshipsQuery = useListInternships({
    query: {
      queryKey: getListInternshipsQueryKey(),
      retry: 1,
    },
  });

  const recParams = { student_id: studentQuery.data?.id || "00000000-0000-0000-0000-000000000001" };
  const recommendationsQuery = useGetRecommendations(
    recParams,
    {
      query: {
        queryKey: getGetRecommendationsQueryKey(recParams),
        retry: 1,
      },
    }
  );

  const interParams = { student_id: studentQuery.data?.id || "00000000-0000-0000-0000-000000000001" };
  const interactionsQuery = useListInteractions(
    interParams,
    {
      query: {
        queryKey: getListInteractionsQueryKey(interParams),
        retry: 1,
      },
    }
  );

  const createInteractionMutation = useCreateInteraction();

  const rawProfile = studentQuery.data;
  const profile = {
    id: rawProfile?.id,
    name: rawProfile?.name || "Aarav Mehta",
    degree: rawProfile?.degree || "B.Des · Interaction Design",
    year: rawProfile?.year || "3rd year",
    goal: rawProfile?.careerGoal || "Product Designer",
    location: rawProfile?.location || "Bengaluru",
    workMode: rawProfile?.workMode || "Hybrid",
    mode: rawProfile?.workMode || "Hybrid",
    stipendPreference: rawProfile?.stipendPreference || "₹30k+/month",
    interests: rawProfile?.interests || ["Design Systems", "User Research", "AI Interfaces"],
    skills: rawProfile?.skills || ["Figma", "User Research", "Visual Design", "React"],
  };

  const interactions = (interactionsQuery.data as any[]) || [];
  const savedIds = interactions
    .filter((i) => i.action === "save" || i.action === "like")
    .map((i) => i.internshipId);
  const appliedIds = interactions
    .filter((i) => i.action === "apply")
    .map((i) => i.internshipId);
  const skippedIds = interactions
    .filter((i) => i.action === "skip")
    .map((i) => i.internshipId);

  const internships = (internshipsQuery.data as any[]) || [];
  const rawRecs = (recommendationsQuery.data as any[]) || [];

  const recommendations = rawRecs.map((rec: any) => ({
    id: rec.internship?.id || rec.internshipId,
    title: rec.internship?.title || "Internship",
    company: rec.internship?.company || "Company",
    domain: rec.internship?.domain || "General",
    location: rec.internship?.location || "Remote",
    workMode: rec.internship?.workMode || "Remote",
    duration: rec.internship?.duration || "3 months",
    stipend: rec.internship?.stipend || "Stipend Provided",
    matchScore: typeof rec.score === "number" ? rec.score : parseInt(rec.score, 10) || 85,
    reasons: Array.isArray(rec.reasons) ? rec.reasons : [],
    skillGaps: Array.isArray(rec.skillGap)
      ? rec.skillGap.map(([skill, level]: [string, string]) => ({
          skill,
          status: level === "Strong" || level === "Partial" ? level : "Missing",
        }))
      : [],
    description: rec.internship?.description || "",
    requiredSkills: rec.internship?.requiredSkills || [],
    preferredSkills: rec.internship?.preferredSkills || [],
    experienceLevel: rec.internship?.experienceLevel || "Beginner",
  }));

  const logInteraction = (internshipId: string, action: string, reason?: string) => {
    createInteractionMutation.mutate(
      {
        data: {
          studentId: profile.id || "00000000-0000-0000-0000-000000000001",
          internshipId,
          action: action as any,
          reason,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["/api/interactions"] });
        },
      }
    );
  };

  const toggleSave = (id: string) => {
    const isSaved = savedIds.includes(id);
    logInteraction(id, isSaved ? "view" : "save");
  };

  const applyToInternship = (id: string) => {
    logInteraction(id, "apply");
  };

  const skipInternship = (id: string, reason?: string) => {
    logInteraction(id, "skip", reason);
  };

  const logView = (id: string) => {
    logInteraction(id, "view");
  };

  const logSkip = (id: string, reason: string) => {
    logInteraction(id, "skip", reason);
  };

  const refetchData = () => {
    studentQuery.refetch();
    internshipsQuery.refetch();
    recommendationsQuery.refetch();
    interactionsQuery.refetch();
  };

  const isLoading =
    studentQuery.isLoading ||
    internshipsQuery.isLoading ||
    recommendationsQuery.isLoading;

  return (
    <AppContext.Provider
      value={{
        profile,
        internships,
        recommendations,
        savedIds,
        appliedIds,
        skippedIds,
        saved: savedIds,
        applied: appliedIds,
        toggleSave,
        toggleSaved: toggleSave,
        applyToInternship,
        apply: applyToInternship,
        skipInternship,
        logView,
        logSkip,
        logInteraction,
        isLoading,
        refetchData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return ctx;
}