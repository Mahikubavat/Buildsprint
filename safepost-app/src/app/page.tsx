"use client";

import { FormEvent, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Post = {
  id: number | string;
  title: string;
  body: string;
  platform: string;
  status: "Needs review" | "Ready to publish";
  score?: number;
};

type Profile = {
  name: string;
  email: string;
  phone?: string;
  role: string;
  region: string;
  apiKey: string;
  audience?: string;
  isComplete?: boolean;
  avatarUrl?: string;
};

const regions = ["India", "United States", "United Kingdom", "Global"];
const platforms = ["Instagram", "YouTube", "Facebook", "X", "LinkedIn"];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label>
      {label}
      {children}
    </label>
  );
}

export default function Home() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [authError, setAuthError] = useState("");
  const [role, setRole] = useState("");
  const [region, setRegion] = useState("India");
  const [audience, setAudience] = useState("");
  const [posts, setPosts] = useState<Post[]>([]);
  const [selectedId, setSelectedId] = useState<number | string>(2);
  const [view, setView] = useState("Review desk");
  const [draft, setDraft] = useState("");
  const [title, setTitle] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["Instagram"]);
  const [rewrite, setRewrite] = useState("");
  const [flaggedPhrases, setFlaggedPhrases] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [rewriteNote, setRewriteNote] = useState("");
  const [showOverwriteModal, setShowOverwriteModal] = useState(false);
  const [showHighRiskWarningModal, setShowHighRiskWarningModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [postToDelete, setPostToDelete] = useState<number | string | null>(null);
  const [currentScore, setCurrentScore] = useState<number | null>(null);
  const [currentDateTime, setCurrentDateTime] = useState<{ dateStr: string; greeting: string }>({
    dateStr: "",
    greeting: "Good morning",
  });
  const [workspaceId, setWorkspaceId] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [apiKeyAlert, setApiKeyAlert] = useState("");

  useEffect(() => {
    const updateTimeAndGreeting = () => {
      const now = new Date();
      const hour = now.getHours();
      let greetingStr = "Good morning";
      if (hour >= 12 && hour < 17) {
        greetingStr = "Good afternoon";
      } else if (hour >= 17) {
        greetingStr = "Good evening";
      }

      const options: Intl.DateTimeFormatOptions = {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      };
      const formattedDate = now.toLocaleDateString("en-US", options).toUpperCase();
      setCurrentDateTime({ dateStr: formattedDate, greeting: greetingStr });
    };

    updateTimeAndGreeting();
    const interval = setInterval(updateTimeAndGreeting, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    async function loadWorkspace() {
      if (!profile?.email) return;
      const userWsId = `user:${profile.email.toLowerCase().trim()}`;
      setWorkspaceId(userWsId);
      const savedApiKey = localStorage.getItem("gemini_api_key") || profile.apiKey || "";

      if (supabase && userId) {
        const [{ data: savedProfile }, { data: savedPosts }] = await Promise.all([
          supabase
            .from("profiles")
            .select("name,email,phone,role,region,api_key,audience,is_complete,avatar_url")
            .eq("id", userId)
            .maybeSingle(),
          supabase
            .from("posts")
            .select("id,title,body,platform,status,score")
            .eq("user_id", userId)
            .order("created_at", { ascending: false }),
        ]);
        if (savedProfile) {
          const profileData = savedProfile as {
            name: string;
            email: string;
            phone?: string | null;
            role?: string | null;
            region?: string | null;
            api_key?: string | null;
            audience?: string | null;
            avatar_url?: string | null;
            is_complete?: boolean | null;
          };
          const currentKey = savedApiKey || profileData.api_key || "";
          setProfile({
            name: profileData.name,
            email: profileData.email,
            phone: profileData.phone ?? "",
            role: profileData.role ?? "",
            region: profileData.region ?? "India",
            apiKey: currentKey,
            audience: profileData.audience ?? "",
            avatarUrl: profileData.avatar_url ?? "",
            isComplete: profileData.is_complete ?? Boolean(profileData.role && profileData.phone),
          });
          setApiKeyInput(currentKey);
          setRole(profileData.role ?? "");
          setRegion(profileData.region ?? "India");
          setAudience(profileData.audience ?? "");
        }
        setPosts((savedPosts as Post[] | null) ?? []);
        if (savedPosts && savedPosts.length > 0) {
          setSelectedId(savedPosts[0].id);
        }
      } else {
        const rawProfile = localStorage.getItem(`safepost-profile-${profile.email.toLowerCase().trim()}`);
        if (rawProfile) {
          try {
            const parsed = JSON.parse(rawProfile) as Profile;
            if (parsed.email === profile.email.toLowerCase().trim()) {
              const currentKey = savedApiKey || parsed.apiKey || "";
              parsed.apiKey = currentKey;
              setProfile(parsed);
              setApiKeyInput(currentKey);
              setRole(parsed.role ?? "");
              setRegion(parsed.region ?? "India");
              setAudience(parsed.audience ?? "");
            }
          } catch {
            // keep current profile
          }
        }

        const response = await fetch(`/api/workspace?workspaceId=${encodeURIComponent(userWsId)}`);
        if (response.ok) {
          const data = await response.json();
          if (data.posts && Array.isArray(data.posts)) {
            setPosts(data.posts);
            if (data.posts.length > 0) {
              setSelectedId(data.posts[0].id);
            }
          }
          if (data.profile) {
            const loadedProfile = data.profile as Profile;
            const currentKey = savedApiKey || loadedProfile.apiKey || "";
            loadedProfile.apiKey = currentKey;
            setProfile(loadedProfile);
            setApiKeyInput(currentKey);
            setRole(loadedProfile.role ?? "");
            setRegion(loadedProfile.region ?? "India");
            setAudience(loadedProfile.audience ?? "");
          }
        }
      }
    }

    void loadWorkspace();
  }, [profile?.email, userId]);

  // Hydrate auth state on startup
  useEffect(() => {
    const savedApiKey = localStorage.getItem("gemini_api_key") || "";
    setApiKeyInput(savedApiKey);

    if (supabase) {
      void supabase.auth.getSession().then(({ data }) => {
        const session = data.session;
        if (!session?.user) return;

        localStorage.setItem("safepost_auth_token", session.access_token);
        setUserId(session.user.id);

        const emailVal = session.user.email ?? "";
        const userMeta = session.user.user_metadata ?? {};

        const next: Profile = {
          name: (userMeta.name as string) || emailVal.split("@")[0] || "Creator",
          email: emailVal,
          phone: (userMeta.phone as string) || "",
          role: (userMeta.role as string) || "",
          region: (userMeta.region as string) || "India",
          apiKey: savedApiKey || (userMeta.apiKey as string) || "",
          audience: (userMeta.audience as string) || "",
          isComplete: Boolean(userMeta.role && userMeta.phone),
        };

        setRole(next.role);
        setRegion(next.region);
        if (next.audience !== undefined) setAudience(next.audience);

        const client = supabase;
        if (!client) return;
        void (async () => {
          const [{ data: savedProfile }, { data: savedPosts }] = await Promise.all([
            client
              .from("profiles")
              .select("name,email,phone,role,region,api_key,audience,is_complete,avatar_url")
              .eq("id", session.user.id)
              .maybeSingle(),
            client
              .from("posts")
              .select("id,title,body,platform,status,score")
              .eq("user_id", session.user.id)
              .order("created_at", { ascending: false }),
          ]);

          if (savedProfile) {
            const profileData = savedProfile as {
              name: string;
              email: string;
              phone?: string | null;
              role?: string | null;
              region?: string | null;
              api_key?: string | null;
              audience?: string | null;
              avatar_url?: string | null;
              is_complete?: boolean | null;
            };
            const currentKey = savedApiKey || profileData.api_key || "";
            setProfile({
              name: profileData.name,
              email: profileData.email,
              phone: profileData.phone ?? "",
              role: profileData.role ?? "",
              region: profileData.region ?? "India",
              apiKey: currentKey,
              audience: profileData.audience ?? "",
              avatarUrl: profileData.avatar_url ?? "",
              isComplete: profileData.is_complete ?? Boolean(profileData.role && profileData.phone),
            });
            setApiKeyInput(currentKey);
            setRole(profileData.role ?? "");
            setRegion(profileData.region ?? "India");
            setAudience(profileData.audience ?? "");
          } else {
            setProfile(next);
          }

          const formattedPosts = (savedPosts as Post[] | null) ?? [];
          setPosts(formattedPosts);
          if (formattedPosts.length > 0) {
            setSelectedId(formattedPosts[0].id);
          }
        })();
      });
    } else {
      const currentUserEmail = localStorage.getItem("safepost-current-user");
      if (currentUserEmail) {
        const userWsId = `user:${currentUserEmail.toLowerCase().trim()}`;
        setWorkspaceId(userWsId);
        const rawProfile = localStorage.getItem(`safepost-profile-${currentUserEmail.toLowerCase().trim()}`);
        if (rawProfile) {
          try {
            const parsed = JSON.parse(rawProfile) as Profile;
            const currentKey = savedApiKey || parsed.apiKey || "";
            parsed.apiKey = currentKey;
            setProfile(parsed);
            setApiKeyInput(currentKey);
            setRole(parsed.role ?? "");
            setRegion(parsed.region ?? "India");
            setAudience(parsed.audience ?? "");
          } catch {
            // handle parse error
          }
        }
      }
    }
  }, []);

  const selected = posts.find((item) => item.id === selectedId) ??
    posts[0] ?? {
      id: 0,
      title: "No draft selected",
      body: "",
      platform: "",
      status: "Needs review" as const,
    };

  const risky = /sensitive|ridiculous|hate|stupid|outdated|terrible|awful|dumb|furious|horrible/i.test(selected?.body ?? "");
  const defaultCalculatedScore = selected.id === 0 ? 0 : selected.score ?? (risky ? 68 : 18);
  const score = currentScore !== null ? currentScore : defaultCalculatedScore;

  useEffect(() => {
    // Reset AI rewrite state whenever selected draft changes
    setRewrite("");
    setFlaggedPhrases([]);
    setRewriteNote("");

    if (!selected || selected.id === 0 || !selected.body) {
      setCurrentScore(0);
      return;
    }

    if (selected.score !== undefined && selected.score !== null) {
      setCurrentScore(selected.score);
      return;
    }

    let isMounted = true;
    const fetchRiskScore = async () => {
      try {
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        const savedApiKey = localStorage.getItem("gemini_api_key") || profile?.apiKey;
        if (savedApiKey) {
          headers["x-gemini-api-key"] = savedApiKey;
        }
        const response = await fetch("/api/rewrite", {
          method: "POST",
          headers,
          body: JSON.stringify({
            body: selected.body,
            region,
            platform: selected.platform,
            role,
            audience,
          }),
        });
        if (response.ok) {
          const data = await response.json();
          if (isMounted && typeof data.riskScore === "number") {
            setCurrentScore(data.riskScore);
            if (data.flaggedPhrases) setFlaggedPhrases(data.flaggedPhrases);
          }
        }
      } catch {
        // Fallback silently if auto-fetch fails
      }
    };

    fetchRiskScore();
    return () => {
      isMounted = false;
    };
  }, [selectedId, selected, region, role, audience]);

  const save = (next: Profile) => {
    if (next.apiKey) {
      localStorage.setItem("gemini_api_key", next.apiKey);
    } else {
      localStorage.removeItem("gemini_api_key");
    }
    if (next.email) {
      const normalizedEmail = next.email.toLowerCase().trim();
      localStorage.setItem(`safepost-profile-${normalizedEmail}`, JSON.stringify(next));
      localStorage.setItem("safepost-profile", JSON.stringify(next));
    }
    setProfile(next);
    setName(next.name);
    setEmail(next.email);
    if (next.phone !== undefined) setPhone(next.phone);
    setRole(next.role);
    setRegion(next.region);
    if (next.audience !== undefined) setAudience(next.audience);

    if (supabase && userId) {
      void supabase
        .from("profiles")
        .upsert({
          id: userId,
          name: next.name,
          email: next.email,
          phone: next.phone || null,
          role: next.role || null,
          region: next.region,
          api_key: next.apiKey || null,
          audience: next.audience || null,
          avatar_url: next.avatarUrl || null,
          is_complete: next.isComplete ?? false,
        });
    } else if (workspaceId) {
      void fetch("/api/workspace", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, userEmail: next.email, profile: next }),
      });
    }
  };

  const update = (key: keyof Profile, value: string) => {
    if (!profile) return;
    const next = { ...profile, [key]: value };
    setProfile(next);
    save(next);
  };

  const signIn = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError("");

    const normalizedEmail = email.toLowerCase().trim();
    if (!normalizedEmail) return;

    if (!supabase) {
      const userWsId = `user:${normalizedEmail}`;
      setWorkspaceId(userWsId);
      localStorage.setItem("safepost-current-user", normalizedEmail);

      const savedLocal = localStorage.getItem(`safepost-profile-${normalizedEmail}`);
      let next: Profile;

      if (savedLocal) {
        try {
          next = JSON.parse(savedLocal) as Profile;
        } catch {
          next = {
            name: mode === "signup" ? name || "New creator" : normalizedEmail.split("@")[0] || "Creator",
            email: normalizedEmail,
            phone: mode === "signup" ? phone : "",
            role: "",
            region: "India",
            apiKey: "",
            audience: "",
            isComplete: false,
          };
        }
      } else {
        next = {
          name: mode === "signup" ? name || "New creator" : normalizedEmail.split("@")[0] || "Creator",
          email: normalizedEmail,
          phone: mode === "signup" ? phone : "",
          role: "",
          region: "India",
          apiKey: "",
          audience: "",
          isComplete: false,
        };
      }

      if (mode === "signup") {
        setProfile(next);
        setPosts([]);
        setView("Profile & context");
        void fetch("/api/workspace", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspaceId: userWsId, userEmail: normalizedEmail, profile: next }),
        });
      } else {
        const response = await fetch(`/api/workspace?workspaceId=${encodeURIComponent(userWsId)}`);
        if (response.ok) {
          const data = await response.json();
          if (data.profile) {
            const loadedProfile = data.profile as Profile;
            setProfile(loadedProfile);
            setRole(loadedProfile.role ?? "");
            setRegion(loadedProfile.region ?? "India");
            setAudience(loadedProfile.audience ?? "");
            if (!loadedProfile.isComplete && (!loadedProfile.role || !loadedProfile.phone)) {
              setView("Profile & context");
            }
          } else {
            setProfile(next);
            setView("Profile & context");
            void fetch("/api/workspace", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ workspaceId: userWsId, userEmail: normalizedEmail, profile: next }),
            });
          }
          if (data.posts && Array.isArray(data.posts)) {
            setPosts(data.posts);
            if (data.posts.length > 0) {
              setSelectedId(data.posts[0].id);
            }
          }
        } else {
          setProfile(next);
          setView("Profile & context");
        }
      }
      return;
    }

    if (mode === "signup") {
      if (password.length < 12) {
        setAuthError("Password must be at least 12 characters.");
        return;
      }
      if (password !== confirmPassword) {
        setAuthError("Passwords do not match.");
        return;
      }

      const result = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: {
            name: name || normalizedEmail.split("@")[0],
            phone,
            role,
            region,
            apiKey: "",
            audience,
          },
        },
      });

      if (result.error) {
        setAuthError(result.error.message);
        return;
      }

      if (!result.data.user) {
        setAuthError("Sign up failed. Please try again.");
        return;
      }

      if (result.data.session) {
        localStorage.setItem("safepost_auth_token", result.data.session.access_token);
      }
      setUserId(result.data.user.id);
      const next: Profile = {
        name: name || normalizedEmail.split("@")[0],
        email: normalizedEmail,
        phone,
        role: "",
        region: "India",
        apiKey: "",
        audience: "",
        isComplete: false,
      };

      await supabase.from("profiles").upsert({
        id: result.data.user.id,
        name: next.name,
        email: next.email,
        phone: next.phone || null,
        role: null,
        region: "India",
        api_key: null,
        audience: null,
        is_complete: false,
      });

      setProfile(next);
      setPosts([]);
      setView("Profile & context");
      return;
    }

    const result = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (result.error) {
      setAuthError(result.error.message);
      return;
    }

    if (!result.data.user) {
      setAuthError("Sign in failed. Please try again.");
      return;
    }

    setUserId(result.data.user.id);

    const userMeta = result.data.user.user_metadata ?? {};
    const next: Profile = {
      name: (userMeta.name as string) || normalizedEmail.split("@")[0] || "Creator",
      email: normalizedEmail,
      phone: (userMeta.phone as string) || "",
      role: (userMeta.role as string) || "",
      region: (userMeta.region as string) || "India",
      apiKey: (userMeta.apiKey as string) || "",
      audience: (userMeta.audience as string) || "",
      isComplete: Boolean(userMeta.role && userMeta.phone),
    };

    const [{ data: savedProfile }, { data: savedPosts }] = await Promise.all([
      supabase
        .from("profiles")
        .select("name,email,phone,role,region,api_key,audience,is_complete,avatar_url")
        .eq("id", result.data.user.id)
        .maybeSingle(),
      supabase
        .from("posts")
        .select("id,title,body,platform,status,score")
        .eq("user_id", result.data.user.id)
        .order("created_at", { ascending: false }),
    ]);

    if (savedProfile) {
      const profileData = savedProfile as {
        name: string;
        email: string;
        phone?: string | null;
        role?: string | null;
        region?: string | null;
        api_key?: string | null;
        audience?: string | null;
        avatar_url?: string | null;
        is_complete?: boolean | null;
      };
      const loaded: Profile = {
        name: profileData.name,
        email: profileData.email,
        phone: profileData.phone ?? "",
        role: profileData.role ?? "",
        region: profileData.region ?? "India",
        apiKey: profileData.api_key ?? "",
        audience: profileData.audience ?? "",
        avatarUrl: profileData.avatar_url ?? "",
        isComplete: profileData.is_complete ?? Boolean(profileData.role && profileData.phone),
      };
      setProfile(loaded);
      if (!loaded.isComplete && (!loaded.role || !loaded.phone)) {
        setView("Profile & context");
      }
    } else {
      setProfile(next);
      if (!next.isComplete && (!next.role || !next.phone)) {
        setView("Profile & context");
      }
    }

    setPosts((savedPosts as Post[] | null) ?? []);
    if (savedPosts && savedPosts.length > 0) {
      setSelectedId(savedPosts[0].id);
    }
  };

  const togglePlatform = (p: string) => {
    setSelectedPlatforms((prev) => {
      if (prev.includes(p)) {
        if (prev.length === 1) return prev;
        return prev.filter((item) => item !== p);
      } else {
        return [...prev, p];
      }
    });
  };

  const addPost = async () => {
    if (!draft.trim()) return;
    const targetPlatform = selectedPlatforms.length > 0 ? selectedPlatforms.join(", ") : "Instagram";
    const next: Post = { id: Date.now(), title: title || "Untitled draft", body: draft, platform: targetPlatform, status: "Needs review" };
    const activeWsId = workspaceId || (profile?.email ? `user:${profile.email.toLowerCase().trim()}` : "");

    if (supabase && userId) {
      const { data } = await supabase
        .from("posts")
        .insert({ title: next.title, body: next.body, platform: next.platform, status: next.status, user_id: userId })
        .select("id")
        .single();
      if (data) next.id = data.id;
    } else if (activeWsId) {
      const response = await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: activeWsId, userEmail: profile?.email, post: next }),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.post?.id) {
          next.id = data.post.id;
        }
      }
    }
    setPosts((items) => [next, ...items]);
    setSelectedId(next.id);
    setDraft("");
    setTitle("");
    setView("Review desk");
  };

  const handleApproveClick = () => {
    if (!selected) return;
    if (score > 25) {
      setShowHighRiskWarningModal(true);
    } else {
      void executeApprove();
    }
  };

  const executeApprove = async () => {
    if (!selected) return;
    const activeWsId = workspaceId || (profile?.email ? `user:${profile.email.toLowerCase().trim()}` : "");

    if (supabase && userId) {
      await supabase.from("posts").update({ status: "Ready to publish", score }).eq("id", selected.id).eq("user_id", userId);
    } else if (activeWsId) {
      await fetch("/api/workspace", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: activeWsId, postId: String(selected.id), score }),
      });
    }
    setPosts((items) => items.map((post) => (post.id === selected.id ? { ...post, status: "Ready to publish", score } : post)));
    setShowHighRiskWarningModal(false);
  };

  const makeRewrite = async () => {
    if (!selected) return;
    const savedApiKey = localStorage.getItem("gemini_api_key") || profile?.apiKey;
    if (!savedApiKey) {
      setApiKeyAlert("Gemini API key missing! Please configure your Gemini API Key in Profile Settings first.");
      setView("Profile & context");
      return;
    }
    setLoading(true);
    setRewriteNote("");
    try {
      const response = await fetch("/api/rewrite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-gemini-api-key": savedApiKey,
        },
        body: JSON.stringify({
          body: selected.body,
          region,
          platform: selected.platform,
          role,
          audience,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data?.error || "Failed to generate AI rewrite.";
        alert(`Error generating rewrite: ${errorMsg}`);
        setRewrite("");
        setFlaggedPhrases([]);
        setRewriteNote(`Error: ${errorMsg}`);
        return;
      }

      setRewrite(data.suggestedRewrite || "");
      setFlaggedPhrases(data.flaggedPhrases || []);
      const newRiskScore = typeof data.riskScore === "number" ? data.riskScore : 15;
      setCurrentScore(newRiskScore);
      setRewriteNote(`Gemini Risk Score: ${newRiskScore}/100`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network error connecting to AI rewrite service.";
      alert(`Error: ${msg}`);
      setRewrite("");
      setFlaggedPhrases([]);
      setRewriteNote(`Error: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const getRiskInfo = (s: number) => {
    if (s <= 25) {
      return {
        levelClass: "low",
        label: "● Post looks safe",
        description: "Low risk detected. Content aligns with platform guidelines and regional tone.",
        color: "#10b981",
      };
    } else if (s <= 55) {
      return {
        levelClass: "moderate",
        label: "● Moderate Risk",
        description: "Profanity or aggressive tone detected. Consider reviewing.",
        color: "#f59e0b",
      };
    } else {
      return {
        levelClass: "high",
        label: "● High Risk Content",
        description: "High risk detected. Violates tone or safety guidelines.",
        color: "#ef4444",
      };
    }
  };

  const riskInfo = getRiskInfo(score);

  const applyRewrite = async () => {
    if (!selected || !rewrite) return;
    const newScore = 12;
    setCurrentScore(newScore);
    const activeWsId = workspaceId || (profile?.email ? `user:${profile.email.toLowerCase().trim()}` : "");

    if (supabase && userId) {
      await supabase.from("posts").update({ body: rewrite, score: newScore }).eq("id", selected.id).eq("user_id", userId);
    } else if (activeWsId) {
      await fetch("/api/workspace", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: activeWsId, postId: String(selected.id), post: { body: rewrite }, score: newScore }),
      });
    }
    setPosts((items) => items.map((post) => (post.id === selected.id ? { ...post, body: rewrite, score: newScore } : post)));
    setShowOverwriteModal(false);
  };

  const openEditModal = () => {
    if (!selected) return;
    setEditTitle(selected.title);
    setEditBody(selected.body);
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!selected) return;
    const activeWsId = workspaceId || (profile?.email ? `user:${profile.email.toLowerCase().trim()}` : "");

    if (supabase && userId) {
      await supabase.from("posts").update({ title: editTitle, body: editBody }).eq("id", selected.id).eq("user_id", userId);
    } else if (activeWsId) {
      await fetch("/api/workspace", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: activeWsId, postId: String(selected.id), post: { title: editTitle, body: editBody } }),
      });
    }

    setPosts((items) => items.map((p) => (p.id === selected.id ? { ...p, title: editTitle, body: editBody } : p)));
    setShowEditModal(false);
  };

  const openDeleteModal = (id: number | string) => {
    setPostToDelete(id);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!postToDelete) return;
    const activeWsId = workspaceId || (profile?.email ? `user:${profile.email.toLowerCase().trim()}` : "");

    if (supabase && userId) {
      await supabase.from("posts").delete().eq("id", postToDelete).eq("user_id", userId);
    } else if (activeWsId) {
      await fetch(`/api/workspace?workspaceId=${encodeURIComponent(activeWsId)}&postId=${encodeURIComponent(String(postToDelete))}`, {
        method: "DELETE",
      });
    }

    setPosts((items) => {
      const remaining = items.filter((p) => p.id !== postToDelete);
      if (selectedId === postToDelete) {
        if (remaining.length > 0) setSelectedId(remaining[0].id);
      }
      return remaining;
    });

    setShowDeleteModal(false);
    setPostToDelete(null);
  };

  const renderHighlightedDraft = (text: string, flagged: string[]) => {
    if (!text) return "No content in this draft.";
    if (!flagged || flagged.length === 0) return text;

    const escapeRegex = (s: string) => s.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
    const sorted = [...flagged].filter(Boolean).sort((a, b) => b.length - a.length);
    if (sorted.length === 0) return text;

    const pattern = new RegExp(`(${sorted.map(escapeRegex).join("|")})`, "gi");
    const parts = text.split(pattern);

    return parts.map((part, i) => {
      const isRisky = sorted.some((r) => r.toLowerCase() === part.toLowerCase());
      if (isRisky) {
        return (
          <mark
            key={i}
            className="highlighted-risky-segment"
            style={{
              backgroundColor: "#fee2e2",
              color: "#991b1b",
              padding: "2px 5px",
              borderRadius: "4px",
              borderBottom: "2px solid #f87171",
              fontWeight: 600,
            }}
          >
            {part}
          </mark>
        );
      }
      return part;
    });
  };

  const ready = posts.filter((post) => post.status === "Ready to publish").length;

  if (!profile) {
    return (
      <main className="auth-shell">
        <div className="auth-art">
          <div className="auth-brand-logo">
            <span className="brand-text">SafePost</span>
          </div>
          <p className="eyebrow">PRE-PUBLISH INTELLIGENCE</p>
          <h1>
            Say what you mean.<br />
            <em>Land how you intend.</em>
          </h1>
          <p>Review the nuance behind every post before it reaches your audience.</p>
        </div>
        <form className="auth-card" onSubmit={signIn}>
          <span className="eyebrow">{mode === "signin" ? "WELCOME BACK" : "CREATE YOUR WORKSPACE"}</span>
          <h2>{mode === "signin" ? "Sign in to SafePost" : "Build your safety profile"}</h2>
          <p>{mode === "signin" ? "Pick up your review desk where you left it." : "Your profile helps every rewrite sound like you."}</p>
          {authError && (
            <div
              className="auth-error"
              style={{
                color: "#e53e3e",
                fontSize: "0.875rem",
                marginBottom: "1rem",
                padding: "0.5rem 0.75rem",
                backgroundColor: "#fff5f5",
                borderRadius: "6px",
                border: "1px solid #feb2b2",
              }}
            >
              {authError}
            </div>
          )}
          {mode === "signup" && (
            <Field label="Your name">
              <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Aarav Mehta" />
            </Field>
          )}
          <Field label="Email address">
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
          </Field>
          {mode === "signup" && (
            <Field label="Phone number (10 digits)">
              <input
                required
                type="tel"
                pattern="[0-9]{10}"
                maxLength={10}
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                placeholder="9876543210"
              />
            </Field>
          )}
          <Field label="Password">
            <div className="input-with-icon">
              <input
                required
                type={showPassword ? "text" : "password"}
                minLength={12}
                onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity("Password must be at least 12 characters.")}
                onInput={(e) => (e.target as HTMLInputElement).setCustomValidity("")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="12+ characters"
              />
              <button
                type="button"
                className="eye-button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </Field>
          {mode === "signup" && (
            <>
              <small className="password-hint">Use uppercase, lowercase, a number, and a special character.</small>
              <Field label="Confirm password">
                <div className="input-with-icon">
                  <input
                    required
                    type={showConfirmPassword ? "text" : "password"}
                    minLength={12}
                    onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity("Password must be at least 12 characters.")}
                    onInput={(e) => (e.target as HTMLInputElement).setCustomValidity("")}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                  />
                  <button
                    type="button"
                    className="eye-button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                    title={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmPassword ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </Field>
            </>
          )}
          <div className="auth-action-row">
            <button type="submit" className="primary-button">
              {mode === "signin" ? "Sign in" : "Create workspace"}
            </button>
          </div>
          <button
            type="button"
            className="text-button"
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setAuthError("");
            }}
          >
            {mode === "signin" ? "Need a workspace? Sign up" : "Already have a workspace? Sign in"}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">S</span>
          <span>SafePost</span>
          <span className="brand-beta">beta</span>
        </div>
        <div className="workspace-label">YOUR WORKSPACE</div>
        <nav>
          {["Review desk", "All drafts", "Profile & context"].map((item) => (
            <button className={`nav-item ${view === item ? "active" : ""}`} key={item} onClick={() => setView(item)}>
              <span className="nav-icon">{item === "Review desk" ? "◈" : item === "All drafts" ? "▤" : "◎"}</span>
              {item}
              {item === "All drafts" && <span className="nav-count">{posts.length}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="context-mini">
            <span className="status-dot" /> Context engine active
            <div className="mini-code">gemini-3.6-flash / active</div>
          </div>
            <button className="profile-chip" onClick={() => setView("Profile & context")}>
              <span className="avatar">
                {profile.avatarUrl ? (
                  <img src={profile.avatarUrl} alt={profile.name} className="avatar-img" />
                ) : (
                  (profile.name || "U").slice(0, 2).toUpperCase()
                )}
              </span>
              <span>
                <strong>{profile.name || "User"}</strong>
                <small>{profile.role || "Complete profile"}</small>
              </span>
            </button>
        </div>
      </aside>

      <section className="main-content">
        <header className="topbar">
          <div>
            <span className="eyebrow">
              {view === "Profile & context"
                ? "WORKSPACE SETTINGS"
                : currentDateTime.dateStr || "MONDAY, 28 AUGUST 2026"}
            </span>
            <h1>
              {view === "Profile & context"
                ? "Your profile & context"
                : `${currentDateTime.greeting}, ${(profile.name || "Creator").split(" ")[0]}`}
            </h1>
          </div>
        </header>

        {view === "Profile & context" && (
          <div className="profile-page">
            <div className="section-heading">
              <div>
                <span className="eyebrow">PERSONAL SIGNALS</span>
                <h2>{profile.isComplete ? "Make every review more relevant." : "Complete your creator profile."}</h2>
                <p>SafePost uses your audience, region, and voice to catch nuance before it becomes a problem.</p>
              </div>
              <div className="large-avatar-container">
                <div className="large-avatar">
                  {profile.avatarUrl ? (
                    <img src={profile.avatarUrl} alt={profile.name} className="large-avatar-img" />
                  ) : (
                    (profile.name || "U").slice(0, 2).toUpperCase()
                  )}
                </div>
                <label className="change-avatar-btn">
                  Upload Photo
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          if (reader.result) {
                            update("avatarUrl", reader.result as string);
                          }
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </label>
                {profile.avatarUrl && (
                  <button
                    type="button"
                    className="remove-avatar-btn"
                    onClick={() => update("avatarUrl", "")}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
            <div className="form-grid">
              <Field label="Display name">
                <input value={profile.name} onChange={(e) => update("name", e.target.value)} placeholder="Your display name" />
              </Field>
              <Field label="Phone number">
                <input type="tel" maxLength={10} value={profile.phone || ""} onChange={(e) => update("phone", e.target.value.replace(/\D/g, ""))} placeholder="10-digit phone number" />
              </Field>
              <Field label="Role or team">
                <input value={profile.role || ""} onChange={(e) => update("role", e.target.value)} placeholder="e.g. Brand & community lead" />
              </Field>
              <Field label="Primary region">
                <select value={profile.region || "India"} onChange={(e) => update("region", e.target.value)}>
                  {regions.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </Field>
              <Field label="Audience focus">
                <input value={profile.audience || ""} onChange={(e) => update("audience", e.target.value)} placeholder="Customers, creators & local communities" />
              </Field>
            </div>

            <div className="gemini-api-key-section" style={{ margin: "1.5rem 0", padding: "1.25rem", backgroundColor: "#ffffff", borderRadius: "8px", border: "1px solid #cbd5e1" }}>
              <div style={{ marginBottom: "0.75rem" }}>
                <span className="eyebrow" style={{ color: "#4f46e5" }}>API CONFIGURATION</span>
                <h3 style={{ margin: "0.25rem 0 0.5rem", fontSize: "1rem", fontWeight: 700 }}>Gemini API Key <span style={{ color: "#ef4444" }}>*</span></h3>
                <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b" }}>Required to power SafePost AI content rewriting &amp; risk scoring.</p>
              </div>

              {apiKeyAlert && (
                <div style={{ margin: "0.5rem 0 1rem", padding: "0.5rem 0.75rem", backgroundColor: "#fef2f2", border: "1px solid #fca5a5", borderRadius: "6px", color: "#991b1b", fontSize: "0.85rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>{apiKeyAlert}</span>
                  <button type="button" onClick={() => setApiKeyAlert("")} style={{ border: "none", background: "none", color: "#991b1b", fontWeight: "bold", cursor: "pointer" }}>✕</button>
                </div>
              )}

              <Field label="Gemini API Key">
                <div className="input-with-icon" style={{ marginTop: "0.25rem" }}>
                  <input
                    required
                    type={showApiKey ? "text" : "password"}
                    value={apiKeyInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      setApiKeyInput(val);
                      update("apiKey", val);
                      if (val) setApiKeyAlert("");
                    }}
                    placeholder="AIzaSy..."
                  />
                  <button
                    type="button"
                    className="eye-button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    aria-label={showApiKey ? "Hide API key" : "Show API key"}
                    title={showApiKey ? "Hide API key" : "Show API key"}
                  >
                    {showApiKey ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </Field>

              <div style={{ marginTop: "0.75rem" }}>
                <button
                  type="button"
                  onClick={() => setShowGuide(!showGuide)}
                  style={{ border: "none", background: "none", padding: 0, color: "#4f46e5", fontSize: "0.85rem", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "0.25rem" }}
                >
                  <span>{showGuide ? "▼ Hide helper guide" : "► How to get a Gemini API Key"}</span>
                </button>

                {showGuide && (
                  <div style={{ marginTop: "0.5rem", padding: "0.75rem", backgroundColor: "#f8fafc", borderRadius: "6px", border: "1px solid #e2e8f0", fontSize: "0.85rem", color: "#334155" }}>
                    <p style={{ margin: "0 0 0.5rem", fontWeight: 600 }}>Steps to generate your key:</p>
                    <ul style={{ margin: 0, paddingLeft: "1.25rem", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                      <li><strong>Step 1:</strong> Go to <a href="https://aistudio.google.com" target="_blank" rel="noopener noreferrer" style={{ color: "#2563eb", textDecoration: "underline" }}>aistudio.google.com</a></li>
                      <li><strong>Step 2:</strong> Sign in and click <strong>&quot;Create API Key&quot;</strong></li>
                      <li><strong>Step 3:</strong> Copy your key and paste it here</li>
                    </ul>
                  </div>
                )}
              </div>
            </div>
            {!profile.isComplete && (
              <div style={{ margin: "1rem 0" }}>
                <button
                  className="primary-button"
                  onClick={() => save({ ...profile, isComplete: true })}
                >
                  Save and complete profile
                </button>
              </div>
            )}
            <div className="insights-block">
              <span className="eyebrow">PROFILE INSIGHTS</span>
              <h2>Your saved-post signals</h2>
              <div className="insight-grid">
                <div>
                  <strong>{posts.length}</strong>
                  <span>saved posts</span>
                </div>
                <div>
                  <strong>{posts.length ? Math.round((ready / posts.length) * 100) : 0}%</strong>
                  <span>ready to publish</span>
                </div>
                <div>
                  <strong>{score}</strong>
                  <span>current risk</span>
                </div>
              </div>
            </div>
            <button
              className="signout-button"
              onClick={() => {
                localStorage.removeItem("safepost_auth_token");
                localStorage.removeItem("gemini_api_key");
                localStorage.removeItem("safepost-current-user");
                localStorage.removeItem("safepost-profile");
                setApiKeyInput("");
                setProfile(null);
                setPosts([]);
                setUserId(null);
                setWorkspaceId("");
                setSelectedId(0);
                setDraft("");
                setTitle("");
                setEmail("");
                setName("");
                setPassword("");
                setConfirmPassword("");
                setPhone("");
                setAuthError("");
                if (supabase) void supabase.auth.signOut();
              }}
            >
              Sign out
            </button>
          </div>
        )}

        {view === "Review desk" && (
          <>
            <div className="stats-row">
              <div className="stat-card">
                <span className="stat-label">DRAFTS IN REVIEW</span>
                <strong>{posts.length - ready}</strong>
                <span className="stat-note warning">● Needs your attention</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">PUBLISHED SAFELY</span>
                <strong>{ready}<small> posts</small></strong>
                <span className="stat-note positive">↑ Your last 30 days</span>
              </div>
            </div>

            <div className="content-grid">
              <div className="drafts-panel">
                <div className="panel-heading">
                  <div>
                    <span className="eyebrow">YOUR CONTENT</span>
                    <h2>
                      Drafts to review <span>{posts.length}</span>
                    </h2>
                  </div>
                  <button className="new-button" onClick={() => setView("All drafts")}>
                    + New draft
                  </button>
                </div>
                <div className="draft-list">
                  {posts.length === 0 ? (
                    <div style={{ padding: "1.5rem", textAlign: "center", color: "#64748b", fontSize: "0.9rem" }}>
                      No drafts yet. Click &quot;+ New draft&quot; to create your first post!
                    </div>
                  ) : (
                    posts.map((post) => (
                      <button
                        className={`draft-item ${selected.id === post.id ? "selected" : ""}`}
                        key={post.id}
                        onClick={() => {
                          setSelectedId(post.id);
                          setRewriteNote("");
                        }}
                      >
                        <span className="platform-icon">{post.platform === "X" ? "𝕏" : "▧"}</span>
                        <span className="draft-copy">
                          <strong>{post.title}</strong>
                          <small>{post.body}</small>
                          <em>{post.platform} · just now</em>
                        </span>
                        <span className={`status ${post.status === "Needs review" ? "needs" : "ready"}`}>
                          {post.status === "Needs review" ? "Review" : "Safe"}
                        </span>
                      </button>
                    ))
                  )}
                </div>
                <div className="queue-footer">Showing all drafts <span>↗</span></div>
              </div>

              <div className="review-panel">
                <div className="review-heading">
                  <div>
                    <span className="eyebrow">PRE-PUBLISH CHECK</span>
                    <h2>
                      Reviewing <span>“{selected.title}”</span>
                    </h2>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    {selected.id !== 0 && (
                      <>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={openEditModal}
                          style={{ padding: "4px 10px", fontSize: "12px" }}
                        >
                          ✎ Edit
                        </button>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => openDeleteModal(selected.id)}
                          style={{ padding: "4px 10px", fontSize: "12px", color: "#ef4444", borderColor: "#fca5a5" }}
                        >
                          🗑 Delete
                        </button>
                      </>
                    )}
                    <span className="review-region">◉ {profile.region}</span>
                  </div>
                </div>

                <div className="score-block">
                  <div className={`score-ring ${riskInfo.levelClass}`} style={{ borderColor: riskInfo.color }}>
                    <strong style={{ color: riskInfo.color }}>{score}</strong>
                    <span>risk</span>
                  </div>
                  <div>
                    <span className={`risk-label ${riskInfo.levelClass}`} style={{ color: riskInfo.color }}>
                      {riskInfo.label}
                    </span>
                    <p>{riskInfo.description}</p>
                  </div>
                </div>

                <div className="post-preview-box">
                  <span className="eyebrow">ORIGINAL DRAFT</span>
                  <div className="preview-body">{renderHighlightedDraft(selected.body, flaggedPhrases)}</div>
                </div>

                <div className="ai-rewrite-section" style={{ marginTop: "1rem", padding: "1rem", backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                    <span className="eyebrow" style={{ color: "#4f46e5", fontWeight: 600 }}>✨ AI RISK-FREE REWRITE</span>
                    <button className="secondary-button" onClick={makeRewrite} disabled={loading} style={{ padding: "0.4rem 0.8rem", fontSize: "0.85rem" }}>
                      {loading ? "Analyzing & Rewriting..." : "Generate AI Rewrite"}
                    </button>
                  </div>

                  {rewriteNote && <div style={{ fontSize: "0.8rem", color: "#64748b", marginBottom: "0.5rem" }}>{rewriteNote}</div>}

                  <div style={{ padding: "0.75rem", backgroundColor: "#ffffff", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "0.95rem", lineHeight: "1.5", minHeight: "60px" }}>
                    {rewrite ? rewrite : <span style={{ color: "#94a3b8", fontStyle: "italic" }}>Click &quot;Generate AI Rewrite&quot; above to see AI suggestions...</span>}
                  </div>

                  <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem" }}>
                    <button className="primary-button" onClick={() => setShowOverwriteModal(true)} style={{ backgroundColor: "#10b981", borderColor: "#059669" }}>
                      Apply AI Rewrite (Make Risk Free)
                    </button>
                    <button className="primary-button" onClick={handleApproveClick} style={{ backgroundColor: "#10b981", borderColor: "#059669" }}>
                      Approve & Mark Safe
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {view === "All drafts" && (
          <div className="new-draft-form">
            <div className="section-heading">
              <div>
                <span className="eyebrow">ADD TO YOUR QUEUE</span>
                <h2>Bring a draft into the light.</h2>
                <p>Write it as you would publish it. SafePost will review it against your context.</p>
              </div>
            </div>
            <div className="form-grid">
              <Field label="Draft title">
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Weekend announcement" />
              </Field>
              <div className="platform-selection-field">
                <label className="field-label">Target Social Media Platforms (Select one or multiple)</label>
                <div className="platform-checkboxes">
                  {platforms.map((item) => {
                    const isChecked = selectedPlatforms.includes(item);
                    return (
                      <label key={item} className={`checkbox-chip ${isChecked ? "checked" : ""}`}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => togglePlatform(item)}
                        />
                        <span>{item}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="your-post-container">
              <label className="field-label">Your post</label>
              <textarea
                className="your-post-textarea"
                rows={6}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Start writing your post draft here..."
              />
            </div>
            <div className="form-action-row">
              <button className="primary-button" onClick={addPost}>
                Add draft for review <span>→</span>
              </button>
            </div>
          </div>
        )}
        {showOverwriteModal && (
          <div className="modal-backdrop">
            <div className="modal-content">
              <h3>Confirm Draft Overwrite</h3>
              <p>Are you sure you want to overwrite your original draft with this rewrite?</p>
              <div className="modal-actions">
                <button className="secondary-button" onClick={() => setShowOverwriteModal(false)}>
                  Cancel
                </button>
                <button className="primary-button" onClick={applyRewrite} style={{ backgroundColor: "#10b981", borderColor: "#059669" }}>
                  Yes, Overwrite Draft
                </button>
              </div>
            </div>
          </div>
        )}

        {showHighRiskWarningModal && (
          <div className="modal-backdrop">
            <div className="modal-content" style={{ borderColor: "#f87171" }}>
              <h3 style={{ color: "#991b1b" }}>High Risk Warning</h3>
              <p style={{ fontWeight: 600, color: "#7f1d1d" }}>
                Warning: This post contains flagged high-risk content.
              </p>
              <p>
                The risk engine detected sensitive, aggressive, or non-compliant phrasing in this draft.
              </p>
              <div className="modal-actions" style={{ flexDirection: "column", gap: "8px" }}>
                <button
                  className="primary-button"
                  onClick={() => {
                    setShowHighRiskWarningModal(false);
                    void makeRewrite();
                  }}
                  style={{ backgroundColor: "#4f46e5", borderColor: "#4338ca", width: "100%" }}
                >
                  Generate Alternative (AI Rewrite)
                </button>
                <button
                  className="secondary-button"
                  onClick={() => void executeApprove()}
                  style={{ width: "100%", color: "#991b1b", borderColor: "#fca5a5" }}
                >
                  Skip & Approve
                </button>
                <button
                  className="text-button"
                  onClick={() => setShowHighRiskWarningModal(false)}
                  style={{ alignSelf: "center", marginTop: "4px" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {showEditModal && (
          <div className="modal-backdrop">
            <div className="modal-content" style={{ width: "min(520px, calc(100% - 32px))" }}>
              <h3>Edit Draft</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", margin: "16px 0" }}>
                <label style={{ fontSize: "12px", fontWeight: 700, color: "#475569" }}>
                  Title
                  <input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", marginTop: "4px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                  />
                </label>
                <label style={{ fontSize: "12px", fontWeight: 700, color: "#475569" }}>
                  Content
                  <textarea
                    rows={5}
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", marginTop: "4px", borderRadius: "6px", border: "1px solid #cbd5e1", resize: "vertical" }}
                  />
                </label>
              </div>
              <div className="modal-actions">
                <button className="secondary-button" onClick={() => setShowEditModal(false)}>
                  Cancel
                </button>
                <button className="primary-button" onClick={handleSaveEdit}>
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}

        {showDeleteModal && (
          <div className="modal-backdrop">
            <div className="modal-content">
              <h3>Delete this draft?</h3>
              <p>This action cannot be undone. Are you sure you want to delete this post draft?</p>
              <div className="modal-actions">
                <button className="secondary-button" onClick={() => setShowDeleteModal(false)}>
                  Cancel
                </button>
                <button className="primary-button" onClick={handleConfirmDelete} style={{ backgroundColor: "#ef4444", borderColor: "#dc2626" }}>
                  Yes, Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}