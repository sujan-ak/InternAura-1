import React, { useState, useCallback } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import { Feather } from "@expo/vector-icons";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useApp } from "@/context/AppContext";
import colors from "@/constants/colors";
import { authedFetch } from "@/lib/api";

const c = colors.light;

export interface SkillItem {
  name: string;
  category: string;
  confidence: number;
  original_name?: string;
}

type AnalyzerState = "upload" | "loading" | "edit" | "assessment-offer" | "confirmed";

export default function ResumeAnalyzerScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { profile, authUserId } = useApp();

  const [state, setState] = useState<AnalyzerState>("upload");
  const [file, setFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Fetch completed assessments for student verification badges
  const { data: userAssessments = [], refetch: refetchAssessments } = useQuery({
    queryKey: ["/api/assessments", profile?.id, authUserId],
    queryFn: async () => {
      try {
        const res = await authedFetch("/api/assessments");
        if (res.ok) return (await res.json()) as any[];
      } catch {}
      return [];
    },
  });

  useFocusEffect(
    React.useCallback(() => {
      setNavigating(false);
      refetchAssessments();
    }, [refetchAssessments])
  );

  // Adzuna Job Search results state
  const [adzunaLoading, setAdzunaLoading] = useState(false);
  const [adzunaResults, setAdzunaResults] = useState<any[]>([]);
  const [isAdzunaFallback, setIsAdzunaFallback] = useState(false);
  const [fallbackNotice, setFallbackNotice] = useState<string | null>(null);

  // Manual skill addition
  const [newSkillName, setNewSkillName] = useState("");
  const [newSkillCategory, setNewSkillCategory] = useState("");

  // Inline editing state
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState("");

  // Assessment-offer: track which category's picker is open and what skill was chosen per category
  const [pickerCategory, setPickerCategory] = useState<string | null>(null);
  const [chosenSkills, setChosenSkills] = useState<Record<string, string>>({});  // { categoryName: chosenSkillName }
  const [navigating, setNavigating] = useState(false);

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const picked = result.assets[0];
        setFile(picked);
        setError(null);
      }
    } catch (err: any) {
      console.error("Document picking error:", err);
      setError("Failed to pick document.");
    }
  };

  const handleAnalyze = async () => {
    if (!file) return;

    const tStart = Date.now();
    console.log(`[CLIENT TIMING 1/5] "Analyze Resume" tap at +0ms`);

    setState("loading");
    setError(null);

    const apiUrl = process.env.EXPO_PUBLIC_API_URL || "http://localhost:5000";

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.warn(`[CLIENT TIMING TIMEOUT] Analysis request timed out after 35000ms. Aborting...`);
      controller.abort();
    }, 35000);

    try {
      const tFormDataStart = Date.now();
      const formData = new FormData();
      formData.append("file", {
        uri: file.uri,
        name: file.name || "resume.pdf",
        type: file.mimeType || "application/pdf",
      } as any);
      const tFormDataEnd = Date.now();
      console.log(`[CLIENT TIMING 2/5] FormData constructed in ${tFormDataEnd - tFormDataStart}ms (total +${tFormDataEnd - tStart}ms)`);

      console.log(`[CLIENT TIMING 3/5] fetch() called to ${apiUrl}/api/resume/analyze at +${Date.now() - tStart}ms`);

      const tFetchStart = Date.now();
      const response = await fetch(`${apiUrl}/api/resume/analyze`, {
        method: "POST",
        body: formData,
        headers: {
          Accept: "application/json",
        },
        signal: controller.signal,
      });

      const tFetchEnd = Date.now();
      console.log(`[CLIENT TIMING 4/5] fetch() response received in ${tFetchEnd - tFetchStart}ms (total +${tFetchEnd - tStart}ms), status: ${response.status}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Analysis failed with status ${response.status}`);
      }

      const data = await response.json();
      const tUiStart = Date.now();
      console.log("[ResumeAnalyzer] Received skills:", data.skills);
      setSkills(data.skills || []);
      setState("edit");
      const tUiEnd = Date.now();
      console.log(`[CLIENT TIMING 5/5] UI updated in ${tUiEnd - tUiStart}ms (total +${tUiEnd - tStart}ms)`);
    } catch (err: any) {
      const tErr = Date.now();
      console.warn(`[CLIENT TIMING ERROR] Failed after ${tErr - tStart}ms:`, err);
      if (err.name === "AbortError" || err?.message?.includes("aborted")) {
        setError("Analysis is taking longer than expected. Please try again or upload a smaller file.");
      } else {
        setError(err.message || "An error occurred during resume analysis. Please try again.");
      }
      setState("upload");
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const handleConfirmSkills = async () => {
    setState("loading");
    setError(null);

    try {
      const newSkillsList = skills.map((s) => s.name);

      const res = await authedFetch("/api/students/me/skills", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skills: newSkillsList, mode: "merge" }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Failed to update skills (HTTP ${res.status})`);
      }

      queryClient.invalidateQueries({ queryKey: ["/api/students/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/recommendations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/assessments"] });
      refetchAssessments();

      // Transition to assessment offer step BEFORE fetching Adzuna results
      setState("assessment-offer");
    } catch (err: any) {
      console.error("Failed to save skills:", err);
      setError(err.message || "Failed to save skills to profile.");
      setState("edit");
    }
  };

  // assessedSkillNames: the specific skills the user chose per category (used for Adzuna query ONLY)
  const handleFetchAdzunaResults = async (assessedSkillNames: string[]) => {
    setState("confirmed");
    setAdzunaLoading(true);

    try {
      // Adzuna search uses assessed skills with safe fallback to profile skills
      const validSkills = (assessedSkillNames || []).filter(Boolean);
      const fallbackSkills = skills.map((s) => s.name).filter(Boolean);
      const profileSkills = Array.isArray(profile?.skills) ? (profile.skills as string[]) : [];
      const finalSkills =
        validSkills.length > 0 ? validSkills : fallbackSkills.length > 0 ? fallbackSkills : profileSkills;

      const skillsQuery = finalSkills.length > 0 ? finalSkills.join(",") : "Software Developer";
      const locQuery = profile?.location || "India";

      console.log(`[Adzuna] Searching with skills: ${skillsQuery} (location: ${locQuery})`);
      const res = await authedFetch(
        `/api/internships/search-adzuna?skills=${encodeURIComponent(skillsQuery)}&location=${encodeURIComponent(locQuery)}`
      );
      if (res.ok) {
        const payload = await res.json();
        setAdzunaResults(payload.recommendations || []);
        setIsAdzunaFallback(!!payload.isFallback);
        setFallbackNotice(payload.fallbackReason || null);
      }
    } catch (adzunaErr) {
      console.error("Adzuna search fetch error:", adzunaErr);
    } finally {
      setAdzunaLoading(false);
    }
  };

  const handleAddSkill = () => {
    if (!newSkillName.trim()) return;
    const newSkill: SkillItem = {
      name: newSkillName.trim(),
      category: newSkillCategory.trim() || "Other",
      confidence: 1.0,
    };
    setSkills([...skills, newSkill]);
    setNewSkillName("");
    setNewSkillCategory("");
  };

  const handleDeleteSkill = (idx: number) => {
    setSkills((prev) => prev.filter((_, index) => index !== idx));
  };

  const startEdit = (idx: number, skill: SkillItem) => {
    setEditingIndex(idx);
    setEditName(skill.name);
    setEditCategory(skill.category);
  };

  const saveEdit = (idx: number) => {
    if (!editName.trim()) return;
    const updated = [...skills];
    updated[idx] = {
      ...updated[idx],
      name: editName.trim(),
      category: editCategory.trim() || "Other",
    };
    setSkills(updated);
    setEditingIndex(null);
  };

  // Group by category
  const groupedSkills = skills.reduce<Record<string, { idx: number; skill: SkillItem }[]>>((groups, skill, idx) => {
    const category = skill.category || "Other";
    if (!groups[category]) groups[category] = [];
    groups[category].push({ idx, skill });
    return groups;
  }, {});

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      {/* Header Bar */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Feather name="arrow-left" size={20} color={c.foreground} />
        </Pressable>
        <Text style={s.headerTitle}>Resume AI Analyzer</Text>
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {state === "upload" && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Upload your Resume PDF</Text>
            <Text style={s.cardSub}>
              InternAura will parse your resume and extract verified skills using AI.
            </Text>

            <Pressable onPress={handlePickDocument} style={s.dropZone}>
              <View style={s.iconCircle}>
                <Feather name={file ? "file-text" : "upload-cloud"} size={32} color={c.primary} />
              </View>
              <Text style={s.dropText}>
                {file ? file.name : "Tap to browse local PDF resume"}
              </Text>
              {file && file.size && (
                <Text style={s.fileSize}>
                  {(file.size / (1024 * 1024)).toFixed(2)} MB
                </Text>
              )}
            </Pressable>

            {error && (
              <View style={s.errorBox}>
                <Feather name="alert-circle" size={16} color={c.destructive} />
                <Text style={s.errorText}>{error}</Text>
              </View>
            )}

            {file && (
              <View style={s.actionsRow}>
                <Pressable onPress={() => setFile(null)} style={s.clearBtn}>
                  <Text style={s.clearText}>Clear</Text>
                </Pressable>
                <Pressable onPress={handleAnalyze} style={s.primaryBtn}>
                  <Text style={s.primaryBtnText}>Analyze Resume</Text>
                  <Feather name="arrow-right" size={16} color="#FFF" style={{ marginLeft: 6 }} />
                </Pressable>
              </View>
            )}
          </View>
        )}

        {state === "loading" && (
          <View style={[s.card, { alignItems: "center", paddingVertical: 40 }]}>
            <ActivityIndicator size="large" color={c.primary} style={{ marginBottom: 16 }} />
            <Text style={s.loadingTitle}>Analyzing your resume...</Text>
            <Text style={s.loadingSub}>
              Parsing content, identifying skills section, and normalizing skill entities.
            </Text>
          </View>
        )}

        {state === "edit" && (
          <View style={s.editContainer}>
            <View style={s.card}>
              <View style={s.cardHead}>
                <View>
                  <Text style={s.cardTitle}>Extracted Skills</Text>
                  <Text style={s.cardSub}>Review and refine detected skills</Text>
                </View>
                <View style={s.countBadge}>
                  <Text style={s.countBadgeText}>{skills.length} skills</Text>
                </View>
              </View>

              {skills.length === 0 ? (
                <Text style={s.emptyText}>No skills identified. Add skills manually below.</Text>
              ) : (
                Object.entries(groupedSkills).map(([category, items]) => (
                  <View key={category} style={s.categoryGroup}>
                    <Text style={s.categoryTitle}>{category}</Text>
                    {items.map(({ idx, skill }) => (
                      <View key={idx} style={s.skillRow}>
                        {editingIndex === idx ? (
                          <View style={s.editForm}>
                            <TextInput
                              value={editName}
                              onChangeText={setEditName}
                              placeholder="Skill name"
                              style={s.editInput}
                            />
                            <TextInput
                              value={editCategory}
                              onChangeText={setEditCategory}
                              placeholder="Category"
                              style={s.editInput}
                            />
                            <View style={s.editBtnRow}>
                              <Pressable onPress={() => setEditingIndex(null)} style={s.cancelSmBtn}>
                                <Text style={s.cancelSmText}>Cancel</Text>
                              </Pressable>
                              <Pressable onPress={() => saveEdit(idx)} style={s.saveSmBtn}>
                                <Text style={s.saveSmText}>Save</Text>
                              </Pressable>
                            </View>
                          </View>
                        ) : (
                          <>
                            <View>
                              <Text style={s.skillName}>{skill.name}</Text>
                              <Text style={s.skillConf}>
                                Confidence: {(skill.confidence * 100).toFixed(0)}%
                              </Text>
                            </View>
                            <View style={s.rowIcons}>
                              <Pressable onPress={() => startEdit(idx, skill)} style={s.iconBtn}>
                                <Feather name="edit-2" size={14} color={c.primary} />
                              </Pressable>
                              <Pressable onPress={() => handleDeleteSkill(idx)} style={s.iconBtn}>
                                <Feather name="trash-2" size={14} color={c.destructive} />
                              </Pressable>
                            </View>
                          </>
                        )}
                      </View>
                    ))}
                  </View>
                ))
              )}
            </View>

            {/* Manual Add Box */}
            <View style={s.card}>
              <Text style={s.cardTitle}>Add Manual Skill</Text>
              <TextInput
                value={newSkillName}
                onChangeText={setNewSkillName}
                placeholder="Skill name (e.g. Docker, Figma)"
                placeholderTextColor={c.mutedForeground}
                style={s.input}
              />
              <TextInput
                value={newSkillCategory}
                onChangeText={setNewSkillCategory}
                placeholder="Category (e.g. Tools, Design)"
                placeholderTextColor={c.mutedForeground}
                style={s.input}
              />
              <Pressable onPress={handleAddSkill} style={s.addBtn}>
                <Feather name="plus" size={16} color={c.primary} style={{ marginRight: 6 }} />
                <Text style={s.addBtnText}>Add Skill</Text>
              </Pressable>
            </View>

            {/* Confirm Box */}
            <View style={s.confirmBox}>
              <Text style={s.confirmTitle}>Ready to update your profile?</Text>
              <Text style={s.confirmSub}>
                Confirming will merge these skills into your student profile for personalized matching.
              </Text>
              <Pressable onPress={handleConfirmSkills} style={s.confirmBtn}>
                <Text style={s.confirmBtnText}>Confirm & Save to Profile</Text>
              </Pressable>
            </View>
          </View>
        )}

        {state === "assessment-offer" && (() => {
          // --- Build category groups from all extracted skills ---
          const categoryGroups: Record<string, SkillItem[]> = {};
          for (const skillItem of skills) {
            const cat = (skillItem.category || "Other").trim();
            if (!categoryGroups[cat]) categoryGroups[cat] = [];
            categoryGroups[cat].push(skillItem);
          }

          // Cap to 3 categories (alphabetical-ish, preserving insertion order)
          const allCategories = Object.keys(categoryGroups);
          const mandatoryCategories = allCategories.slice(0, 3);

          // For each mandatory category, check if a chosen or category skill has been verified
          const totalRequired = mandatoryCategories.length;
          const completedCount = mandatoryCategories.filter((cat) => {
            const chosen = chosenSkills[cat];
            const catSkills = categoryGroups[cat] || [];
            return userAssessments.some((a: any) => {
              const score = Number(a.weightedScore ?? a.weighted_score ?? a.score ?? 0);
              if (score < 60) return false;
              if (chosen && a.skill?.toLowerCase() === chosen.toLowerCase()) return true;
              return catSkills.some((sk) => sk.name.toLowerCase() === a.skill?.toLowerCase());
            });
          }).length;
          const allDone = totalRequired > 0 && completedCount >= totalRequired;

          // Collect the assessed skill names (for Adzuna query) — verified ones
          const assessedSkillNames = mandatoryCategories
            .map((cat) => {
              const chosen = chosenSkills[cat];
              const catSkills = categoryGroups[cat] || [];
              if (chosen) {
                const found = userAssessments.find(
                  (a: any) =>
                    a.skill?.toLowerCase() === chosen.toLowerCase() &&
                    Number(a.weightedScore ?? a.weighted_score ?? a.score ?? 0) >= 60
                );
                if (found) return chosen;
              }
              const verifiedInCat = catSkills.find((sk) =>
                userAssessments.some(
                  (a: any) =>
                    a.skill?.toLowerCase() === sk.name.toLowerCase() &&
                    Number(a.weightedScore ?? a.weighted_score ?? a.score ?? 0) >= 60
                )
              );
              return verifiedInCat?.name;
            })
            .filter((sk): sk is string => !!sk);

          return (
            <View style={{ gap: 20 }}>
              {/* Header Card */}
              <View style={[s.card, { alignItems: "center", paddingVertical: 24 }]}>
                <View style={s.successCircle}>
                  <Feather name="award" size={28} color="#059669" />
                </View>
                <Text style={s.successTitle}>Profile Skills Saved!</Text>
                <Text style={s.successSub}>
                  Choose a skill from each category and complete a quick assessment to unlock your personalised internship matches.
                </Text>

                {/* Progress indicator */}
                <View style={s.progressRow}>
                  <View style={s.progressBar}>
                    <View
                      style={[
                        s.progressFill,
                        { width: `${totalRequired > 0 ? (completedCount / totalRequired) * 100 : 0}%` as any },
                      ]}
                    />
                  </View>
                  <Text style={s.progressLabel}>
                    {completedCount}/{totalRequired} complete
                  </Text>
                </View>
              </View>

              {/* Category Cards — one per mandatory category */}
              <View style={s.card}>
                <Text style={s.cardTitle}>Verify Your Skills</Text>
                <Text style={s.cardSubText}>
                  Complete all {totalRequired} assessment{totalRequired !== 1 ? "s" : ""} to unlock your live internship matches. Each takes ~3–5 min.
                </Text>

                <View style={{ gap: 14, marginTop: 14 }}>
                  {mandatoryCategories.map((cat) => {
                    const catSkills = categoryGroups[cat] || [];
                    const autoVerifiedSkill = catSkills.find((sk) =>
                      userAssessments.some(
                        (a: any) =>
                          a.skill?.toLowerCase() === sk.name.toLowerCase() &&
                          Number(a.weightedScore ?? a.weighted_score ?? a.score ?? 0) >= 60
                      )
                    );
                    const chosenSkill = chosenSkills[cat] || autoVerifiedSkill?.name;
                    const isPickerOpen = pickerCategory === cat;

                    const verifiedRecord = chosenSkill
                      ? userAssessments.find(
                          (a: any) =>
                            a.skill?.toLowerCase() === chosenSkill.toLowerCase() &&
                            Number(a.weightedScore ?? a.weighted_score ?? a.score ?? 0) >= 60
                        )
                      : null;
                    const isVerified = !!verifiedRecord;

                    return (
                      <View key={cat} style={s.categoryCard}>
                        {/* Category header row */}
                        <View style={s.categoryCardHeader}>
                          <View style={[s.categoryDot, isVerified && s.categoryDotDone]} />
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                              <Text style={s.assessmentSkillName}>{cat}</Text>
                              {isVerified && (
                                <View style={s.verifiedBadge}>
                                  <Feather name="check-circle" size={12} color="#059669" />
                                  <Text style={s.verifiedBadgeText}>{verifiedRecord!.weightedScore}%</Text>
                                </View>
                              )}
                            </View>
                            <Text style={s.categoryTagText}>
                              {catSkills.length} skill{catSkills.length !== 1 ? "s" : ""} detected
                              {chosenSkill ? ` · Chosen: ${chosenSkill}` : " · Tap to pick one"}
                            </Text>
                          </View>

                          {/* Action button */}
                          {isVerified ? (
                            <Pressable
                              style={[s.retakeOfferBtn, navigating && s.confirmBtnDisabled]}
                              disabled={navigating}
                              onPress={() => {
                                setNavigating(true);
                                router.push(`/assessment/${encodeURIComponent(chosenSkill!)}`);
                              }}
                            >
                              <Text style={[s.takeAssessmentOfferText, s.retakeOfferText]}>Retake</Text>
                              <Feather name="rotate-cw" size={13} color={c.primary} />
                            </Pressable>
                          ) : chosenSkill ? (
                            // Skill chosen, not yet verified — show Start button
                            <Pressable
                              style={[s.takeAssessmentOfferBtn, navigating && s.confirmBtnDisabled]}
                              disabled={navigating}
                              onPress={() => {
                                setNavigating(true);
                                router.push(`/assessment/${encodeURIComponent(chosenSkill)}`);
                              }}
                            >
                              <Text style={s.takeAssessmentOfferText}>Start</Text>
                              <Feather name="chevron-right" size={14} color="#FFF" />
                            </Pressable>
                          ) : (
                            // No skill chosen yet — show picker toggle
                            <Pressable
                              style={[s.takeAssessmentOfferBtn, isPickerOpen && { backgroundColor: c.foreground }]}
                              onPress={() => setPickerCategory(isPickerOpen ? null : cat)}
                            >
                              <Text style={s.takeAssessmentOfferText}>
                                {isPickerOpen ? "Close" : "Choose"}
                              </Text>
                              <Feather name={isPickerOpen ? "chevron-up" : "chevron-down"} size={14} color="#FFF" />
                            </Pressable>
                          )}
                        </View>

                        {/* Inline skill picker — expands below header when open */}
                        {isPickerOpen && (
                          <View style={s.skillPickerContainer}>
                            <Text style={s.skillPickerTitle}>Select a skill to be assessed on:</Text>
                            {catSkills.map((sk, skIdx) => (
                              <Pressable
                                key={skIdx}
                                style={s.skillPickerItem}
                                onPress={() => {
                                  // Only record the chosen skill — navigation happens via the Start button.
                                  // Combining setState + router.push in one handler caused the Start button
                                  // to become non-responsive on return (navigation fired before state flush).
                                  setChosenSkills((prev) => ({ ...prev, [cat]: sk.name }));
                                  setPickerCategory(null);
                                }}
                              >
                                <Feather name="zap" size={13} color={c.primary} style={{ marginTop: 1 }} />
                                <Text style={s.skillPickerItemText}>{sk.name}</Text>
                                <Feather name="arrow-right" size={13} color={c.mutedForeground} />
                              </Pressable>
                            ))}
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              </View>

              {/* Unlock button — only active once ALL categories have verified assessments */}
              <Pressable
                onPress={allDone ? () => handleFetchAdzunaResults(assessedSkillNames) : undefined}
                style={[s.confirmBtn, !allDone && s.confirmBtnDisabled]}
              >
                <Feather
                  name={allDone ? "unlock" : "lock"}
                  size={16}
                  color="#FFF"
                  style={{ marginRight: 8 }}
                />
                <Text style={s.confirmBtnText}>
                  {allDone
                    ? "View My Matches →"
                    : `Complete ${totalRequired - completedCount} more to unlock matches`}
                </Text>
              </Pressable>
            </View>
          );
        })()}

        {state === "confirmed" && (
          <View style={{ gap: 20 }}>
            {/* Profile Updated Header */}
            <View style={[s.card, { alignItems: "center", paddingVertical: 24 }]}>
              <View style={s.successCircle}>
                <Feather name="check" size={28} color="#059669" />
              </View>
              <Text style={s.successTitle}>Profile Skills Updated!</Text>
              <Text style={s.successSub}>
                Your resume skills have been saved to your student profile.
              </Text>

              <View style={s.tagsContainer}>
                {skills.map((skill, idx) => (
                  <View key={idx} style={s.tagChip}>
                    <Text style={s.tagChipText}>{skill.name}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Adzuna Live Internships Section */}
            <View style={s.card}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Feather name="briefcase" size={20} color={c.primary} />
                  <Text style={s.cardTitle}>Live Matched Internships</Text>
                </View>

                {!adzunaLoading && (
                  <View style={[s.networkBadge, isAdzunaFallback ? s.networkBadgeFallback : s.networkBadgeLive]}>
                    <Text style={[s.networkBadgeText, isAdzunaFallback ? s.networkBadgeTextFallback : s.networkBadgeTextLive]}>
                      {isAdzunaFallback ? "DB Matches" : "Adzuna Live"}
                    </Text>
                  </View>
                )}
              </View>

              {isAdzunaFallback && fallbackNotice && (
                <View style={s.noticeBanner}>
                  <Feather name="info" size={14} color="#B45309" />
                  <Text style={s.noticeText}>
                    Showing curated internships from InternAura database. ({fallbackNotice})
                  </Text>
                </View>
              )}

              {adzunaLoading ? (
                <View style={{ paddingVertical: 32, alignItems: "center", gap: 12 }}>
                  <ActivityIndicator size="large" color={c.primary} />
                  <Text style={s.loadingSub}>Querying Adzuna Job Network for live roles matching your skills...</Text>
                </View>
              ) : adzunaResults.length === 0 ? (
                <Text style={s.emptyText}>No matching internships found for your skill set.</Text>
              ) : (
                <View style={{ gap: 14, marginTop: 4 }}>
                  {adzunaResults.map((item: any, idx: number) => {
                    const job = item.internship || item;
                    const applyUrl = job.redirectUrl || item.redirectUrl;

                    return (
                      <View key={idx} style={s.jobCard}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                          <View style={{ flex: 1, paddingRight: 10 }}>
                            <Text style={s.jobTitle}>{job.title}</Text>
                            <Text style={s.jobCompany}>{job.company}</Text>
                          </View>

                          <View style={s.matchBadge}>
                            <Text style={s.matchBadgeText}>{item.score || 85}% Match</Text>
                          </View>
                        </View>

                        <Text style={s.jobMeta}>
                          📍 {job.location} · {job.workMode || "On-site"}
                        </Text>
                        <Text style={s.jobStipend}>💰 {job.stipend || "Stipend Provided"}</Text>

                        {item.reasons && item.reasons[0] && (
                          <View style={s.reasonBox}>
                            <Text style={s.reasonText}>✨ {item.reasons[0]}</Text>
                          </View>
                        )}

                        <View style={{ marginTop: 12 }}>
                          {applyUrl ? (
                            <Pressable
                              onPress={() => {
                                if (applyUrl) Linking.openURL(applyUrl).catch((e) => Alert.alert("Error", "Could not open link"));
                              }}
                              style={s.applyAdzunaBtn}
                            >
                              <Feather name="external-link" size={14} color="#FFF" style={{ marginRight: 6 }} />
                              <Text style={s.applyAdzunaBtnText}>Apply on Adzuna</Text>
                            </Pressable>
                          ) : (
                            <Pressable
                              onPress={() => router.push(`/internship/${job.id}` as any)}
                              style={s.viewDetailsBtn}
                            >
                              <Text style={s.viewDetailsBtnText}>View Details</Text>
                            </Pressable>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>

            <Pressable onPress={() => router.replace("/(tabs)")} style={[s.primaryBtn, { alignSelf: "center" }]}>
              <Feather name="grid" size={16} color="#FFF" style={{ marginRight: 6 }} />
              <Text style={s.primaryBtnText}>Return to Discover Feed</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#EEE8DF",
  },
  backBtn: { padding: 4, marginRight: 12 },
  headerTitle: { fontFamily: "Inter_700Bold", fontSize: 18, color: c.foreground },
  content: { padding: 20, paddingBottom: 60 },
  card: {
    backgroundColor: c.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#EEE8DF",
    padding: 20,
    marginBottom: 20,
  },
  cardTitle: { fontFamily: "Inter_700Bold", fontSize: 18, color: c.foreground, marginBottom: 4 },
  cardSub: { fontFamily: "Inter_400Regular", fontSize: 13, color: c.mutedForeground, marginBottom: 16 },
  dropZone: {
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: c.primary,
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F4F0E8",
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: c.background,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  dropText: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: c.foreground, textAlign: "center" },
  fileSize: { fontFamily: "Inter_400Regular", fontSize: 11, color: c.mutedForeground, marginTop: 4 },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEE2E2",
    padding: 12,
    borderRadius: 12,
    marginTop: 14,
    gap: 8,
  },
  errorText: { fontFamily: "Inter_500Medium", fontSize: 13, color: c.destructive },
  actionsRow: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 18 },
  clearBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: "#EEE8DF" },
  clearText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: c.mutedForeground },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: c.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  primaryBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: "#FFF" },
  loadingTitle: { fontFamily: "Inter_700Bold", fontSize: 18, color: c.foreground, marginBottom: 6 },
  loadingSub: { fontFamily: "Inter_400Regular", fontSize: 13, color: c.mutedForeground, textAlign: "center", paddingHorizontal: 20 },
  editContainer: {},
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  countBadge: { backgroundColor: c.secondary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  countBadgeText: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: c.primary },
  emptyText: { fontFamily: "Inter_400Regular", fontSize: 13, color: c.mutedForeground, textAlign: "center", paddingVertical: 16 },
  categoryGroup: { marginBottom: 16 },
  categoryTitle: { fontFamily: "Inter_600SemiBold", fontSize: 11, letterSpacing: 1.2, color: c.mutedForeground, marginBottom: 8, textTransform: "uppercase" },
  skillRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    backgroundColor: c.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#EEE8DF",
    marginBottom: 8,
  },
  skillName: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: c.foreground },
  skillConf: { fontFamily: "Inter_400Regular", fontSize: 11, color: c.mutedForeground, marginTop: 2 },
  rowIcons: { flexDirection: "row", gap: 10 },
  iconBtn: { padding: 4 },
  editForm: { flex: 1, gap: 8 },
  editInput: {
    borderWidth: 1,
    borderColor: "#EEE8DF",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    backgroundColor: "#FFF",
  },
  editBtnRow: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  cancelSmBtn: { paddingHorizontal: 10, paddingVertical: 6 },
  cancelSmText: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: c.mutedForeground },
  saveSmBtn: { backgroundColor: c.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  saveSmText: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: "#FFF" },
  input: {
    borderWidth: 1,
    borderColor: "#EEE8DF",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    backgroundColor: c.background,
    marginBottom: 12,
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.secondary,
    paddingVertical: 10,
    borderRadius: 12,
  },
  addBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: c.primary },
  confirmBox: {
    backgroundColor: c.foreground,
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
  },
  confirmTitle: { fontFamily: "Inter_700Bold", fontSize: 18, color: "#FFF" },
  confirmSub: { fontFamily: "Inter_400Regular", fontSize: 12, color: "#B7C6D3", marginTop: 4, marginBottom: 16 },
  confirmBtn: {
    flexDirection: "row",
    backgroundColor: c.primary,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmBtnDisabled: {
    backgroundColor: "#9CA3AF",
    opacity: 0.85,
  },
  confirmBtnText: { fontFamily: "Inter_700Bold", fontSize: 14, color: "#FFF" },
  successCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#D1FAE5", alignItems: "center", justifyContent: "center", marginBottom: 16 },
  successTitle: { fontFamily: "Inter_700Bold", fontSize: 20, color: c.foreground, marginBottom: 4 },
  successSub: { fontFamily: "Inter_400Regular", fontSize: 13, color: c.mutedForeground, textAlign: "center", marginBottom: 16 },
  tagsContainer: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center", marginBottom: 20 },
  tagChip: { backgroundColor: c.secondary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  tagChipText: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: c.primary },

  networkBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  networkBadgeLive: { backgroundColor: "#D1FAE5" },
  networkBadgeFallback: { backgroundColor: "#FEF3C7" },
  networkBadgeText: { fontFamily: "Inter_600SemiBold", fontSize: 11 },
  networkBadgeTextLive: { color: "#065F46" },
  networkBadgeTextFallback: { color: "#92400E" },

  noticeBanner: { flexDirection: "row", alignItems: "center", backgroundColor: "#FEF3C7", padding: 10, borderRadius: 10, gap: 8, marginBottom: 12 },
  noticeText: { fontFamily: "Inter_400Regular", fontSize: 12, color: "#92400E", flex: 1 },

  jobCard: { backgroundColor: c.background, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: "#EEE8DF" },
  jobTitle: { fontFamily: "Inter_700Bold", fontSize: 15, color: c.foreground },
  jobCompany: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: c.mutedForeground, marginTop: 2 },
  jobMeta: { fontFamily: "Inter_400Regular", fontSize: 12, color: c.foreground, marginTop: 6 },
  jobStipend: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: "#059669", marginTop: 2 },

  matchBadge: { backgroundColor: c.secondary, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  matchBadgeText: { fontFamily: "Inter_700Bold", fontSize: 11, color: c.primary },

  reasonBox: { backgroundColor: "#F3F4F6", padding: 8, borderRadius: 8, marginTop: 8 },
  reasonText: { fontFamily: "Inter_400Regular", fontSize: 11, color: c.mutedForeground },

  applyAdzunaBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#0284C7", paddingVertical: 10, borderRadius: 10 },
  applyAdzunaBtnText: { fontFamily: "Inter_700Bold", fontSize: 13, color: "#FFF" },

  viewDetailsBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: c.primary, paddingVertical: 10, borderRadius: 10 },
  viewDetailsBtnText: { fontFamily: "Inter_700Bold", fontSize: 13, color: "#FFF" },

  cardSubText: { fontFamily: "Inter_400Regular", fontSize: 12, color: c.mutedForeground, marginTop: 2, marginBottom: 8 },
  assessmentSkillCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: c.background,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#EEE8DF",
    gap: 12,
  },
  assessmentSkillName: { fontFamily: "Inter_700Bold", fontSize: 14, color: c.foreground },
  assessmentSkillSub: { fontFamily: "Inter_400Regular", fontSize: 11, color: c.mutedForeground, marginTop: 2 },
  verifiedBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#D1FAE5", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  verifiedBadgeText: { fontFamily: "Inter_600SemiBold", fontSize: 10, color: "#065F46" },
  takeAssessmentOfferBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: c.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  retakeOfferBtn: { backgroundColor: c.secondary, borderWidth: 1, borderColor: "#EEE8DF" },
  takeAssessmentOfferText: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: "#FFF" },
  retakeOfferText: { color: c.primary },

  // Progress bar
  progressRow: { flexDirection: "row", alignItems: "center", gap: 10, width: "100%", paddingHorizontal: 4 },
  progressBar: { flex: 1, height: 6, backgroundColor: "#E5E7EB", borderRadius: 3, overflow: "hidden" },
  progressFill: { height: 6, backgroundColor: "#059669", borderRadius: 3 },
  progressLabel: { fontFamily: "Inter_600SemiBold", fontSize: 11, color: c.mutedForeground, minWidth: 70, textAlign: "right" },

  // Category dot indicator on each skill card
  categoryDotWrap: { width: 20, alignItems: "center", justifyContent: "flex-start", paddingTop: 3 },
  categoryDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#D1D5DB" },
  categoryDotDone: { backgroundColor: "#059669" },
  categoryTagText: { fontFamily: "Inter_400Regular", fontSize: 10, color: c.mutedForeground, marginTop: 1, letterSpacing: 0.3 },

  // Category card — wraps header + optional picker expansion
  categoryCard: {
    backgroundColor: c.background,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#EEE8DF",
    overflow: "hidden",
  },
  categoryCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
  },

  // Inline skill picker that expands below the category header
  skillPickerContainer: {
    borderTopWidth: 1,
    borderTopColor: "#EEE8DF",
    backgroundColor: "#FAFAF8",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  skillPickerTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    color: c.mutedForeground,
    marginBottom: 6,
    letterSpacing: 0.2,
    textTransform: "uppercase",
  },
  skillPickerItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 10,
    backgroundColor: "#FFF",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#EEE8DF",
    marginBottom: 4,
  },
  skillPickerItemText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: c.foreground,
    flex: 1,
  },
});

