"use client";

import { useEffect, useRef, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { MdPerson } from "react-icons/md";
import { Modal } from "@/components/ui/Modal";
import {
  USERNAME_MAX,
  USERNAME_RULES,
  normalizeUsername,
  validateUsernameFormat,
} from "@/lib/username";

interface AccountSettingsProps {
  open: boolean;
  onBack: () => void;
  onClose: () => void;
}

interface Profile {
  username: string | null;
  name: string | null;
  email: string | null;
  createdAt: string;
}

type Check = { state: "idle" } | { state: "checking" } | { state: "ok" } | { state: "error"; message: string };

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

export function AccountSettings({ open, onBack, onClose }: AccountSettingsProps) {
  const { user } = useUser();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadError, setLoadError] = useState("");
  const [username, setUsername] = useState("");
  const [check, setCheck] = useState<Check>({ state: "idle" });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const current = profile?.username ?? "";
  const trimmed = normalizeUsername(username);
  const changed = trimmed !== current;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setProfile(null);
    setLoadError("");
    setSaved(false);
    setSaveError("");
    setPhotoError("");
    fetch("/api/users/profile")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: Profile) => {
        if (cancelled) return;
        setProfile(data);
        setUsername(data.username ?? "");
        setCheck({ state: "idle" });
      })
      .catch(() => !cancelled && setLoadError("Could not load your account."));
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Debounced format + global availability check.
  useEffect(() => {
    if (!profile) return;
    setSaved(false);
    setSaveError("");
    if (!changed) {
      setCheck({ state: "idle" });
      return;
    }
    const formatError = validateUsernameFormat(trimmed);
    if (formatError) {
      setCheck({ state: "error", message: formatError });
      return;
    }
    let cancelled = false;
    setCheck({ state: "checking" });
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/users/username?name=${encodeURIComponent(trimmed)}`);
        const data = await res.json();
        if (cancelled) return;
        setCheck(data.available ? { state: "ok" } : { state: "error", message: data.error || "Not available" });
      } catch {
        if (!cancelled) setCheck({ state: "error", message: "Could not check availability" });
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmed, changed, profile]);

  const canSave = !!profile && changed && check.state === "ok" && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch("/api/users/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSaveError(data.error || "Failed to save");
        return;
      }
      setProfile((p) => (p ? { ...p, username: data.username, name: data.username } : p));
      setUsername(data.username);
      await user?.reload();
      setSaved(true);
    } catch {
      setSaveError("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setPhotoError("");
    if (!file.type.startsWith("image/")) {
      setPhotoError("Choose an image file");
    } else if (file.size > MAX_PHOTO_BYTES) {
      setPhotoError("Image must be under 5 MB");
    } else {
      setPhotoBusy(true);
      try {
        await user.setProfileImage({ file });
        await user.reload();
        // Server re-reads the new Clerk image URL and mirrors it to our DB.
        await fetch("/api/users/avatar", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ avatar: null }),
        });
      } catch {
        setPhotoError("Could not update your photo");
      } finally {
        setPhotoBusy(false);
      }
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const displayName = profile?.username || profile?.name || user?.fullName || "Your account";
  const memberSince = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
    : "";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Account settings"
      size="md"
      footer={
        <>
          <button onClick={onBack} className="btn btn-ghost btn-sm">Back</button>
          <button onClick={handleSave} disabled={!canSave} className="btn btn-primary btn-sm">
            {saving ? "Saving..." : "Save"}
          </button>
        </>
      }
    >
      {loadError && <p className="alert-danger">{loadError}</p>}
      {!loadError && !profile && (
        <div className="flex justify-center py-8">
          <span className="spinner" aria-label="Loading" />
        </div>
      )}
      {profile && (
        <div className="space-y-5">
          <div className="flex items-center gap-4">
            {user?.imageUrl ? (
              <img src={user.imageUrl} alt="" className="w-14 h-14 rounded-full shrink-0 object-cover" />
            ) : (
              <span className="w-14 h-14 rounded-full bg-surface border border-line flex items-center justify-center text-fg-muted shrink-0">
                <MdPerson className="w-5 h-5" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-body font-medium text-fg truncate">{displayName}</p>
              <p className="text-small text-fg-muted truncate">{profile.email}</p>
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={photoBusy}
              className="btn btn-secondary btn-sm"
            >
              {photoBusy ? "Uploading..." : "Change photo"}
            </button>
          </div>
          {photoError && <p className="alert-danger">{photoError}</p>}

          <div>
            <label className="field-label" htmlFor="account-username">Username</label>
            <input
              id="account-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
              }}
              maxLength={USERNAME_MAX}
              autoComplete="off"
              spellCheck={false}
              className="input-base w-full"
              placeholder="Choose a username"
            />
            {check.state === "error" ? (
              <p className="text-small text-danger mt-1.5">{check.message}</p>
            ) : check.state === "checking" ? (
              <p className="field-hint mt-1.5">Checking...</p>
            ) : check.state === "ok" ? (
              <p className="field-hint mt-1.5">Available</p>
            ) : saved ? (
              <p className="field-hint mt-1.5">Saved</p>
            ) : (
              <p className="field-hint mt-1.5">{USERNAME_RULES}</p>
            )}
            {saveError && <p className="alert-danger mt-2">{saveError}</p>}
          </div>

          <div>
            <label className="field-label" htmlFor="account-email">Email</label>
            <input id="account-email" value={profile.email ?? ""} disabled readOnly className="input-base w-full" />
            {memberSince && <p className="field-hint mt-1.5">Member since {memberSince}</p>}
          </div>
        </div>
      )}
    </Modal>
  );
}
