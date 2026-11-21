"use client";

import { useEffect, useRef, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { MdPerson } from "react-icons/md";
import {
  USERNAME_MAX,
  USERNAME_RULES,
  normalizeUsername,
  validateUsernameFormat,
} from "@/lib/username";

interface AccountSettingsProps {
  open: boolean;
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

export function AccountSettings({ open, onClose }: AccountSettingsProps) {
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
    setSaveError("");
    if (!changed) {
      setCheck({ state: "idle" });
      return;
    }
    setSaved(false);
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
    <form className="settings-account" onSubmit={(event) => { event.preventDefault(); void handleSave(); }}>
      <header className="settings-section-header">
        <h2 id="account-settings-title" className="text-h2 text-fg">Account</h2>
        <p className="text-small text-fg-muted mt-1.5">Manage your account details and photo.</p>
      </header>

      <div className="settings-fields">
        {loadError && <p className="alert-danger" role="alert">{loadError}</p>}
        {!loadError && !profile && (
          <div className="flex justify-center py-8"><span className="spinner" aria-label="Loading account" /></div>
        )}
        {profile && (
          <>
            <div className="settings-field">
              <p className="field-label">Photo</p>
              <div className="settings-photo-row">
                {user?.imageUrl ? (
                  <img src={user.imageUrl} alt={`${displayName} profile photo`} className="settings-avatar" />
                ) : (
                  <span className="settings-avatar settings-avatar-empty" aria-hidden="true"><MdPerson className="w-5 h-5" /></span>
                )}
                <div>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} aria-label="Upload profile photo" />
                  <button type="button" onClick={() => fileRef.current?.click()} disabled={photoBusy} className="btn btn-secondary btn-sm">
                    {photoBusy ? "Uploading..." : "Change photo"}
                  </button>
                  <p className="field-hint mt-2">Image files up to 5 MB.</p>
                </div>
              </div>
              {photoError && <p className="alert-danger mt-3" role="alert">{photoError}</p>}
            </div>

            <div className="settings-field">
              <label className="field-label" htmlFor="account-username">Username</label>
              <input
                id="account-username"
                value={username}
                onChange={(event) => { setSaved(false); setUsername(event.target.value); }}
                maxLength={USERNAME_MAX}
                autoComplete="off"
                spellCheck={false}
                className="input-base w-full"
                placeholder="Choose a username"
                aria-invalid={check.state === "error"}
                aria-describedby="account-username-hint"
              />
              <p id="account-username-hint" className={`text-small mt-2 ${check.state === "error" ? "text-danger" : "text-fg-muted"}`} aria-live="polite">
                {check.state === "error" ? check.message : check.state === "checking" ? "Checking availability..." : check.state === "ok" ? "This username is available." : USERNAME_RULES}
              </p>
              {saveError && <p className="alert-danger mt-3" role="alert">{saveError}</p>}
            </div>

            <div className="settings-field">
              <label className="field-label" htmlFor="account-email">Email</label>
              <input id="account-email" value={profile.email ?? ""} readOnly className="input-base w-full" aria-describedby="account-email-hint" />
              <p id="account-email-hint" className="field-hint mt-2">Your sign-in email is managed by your account provider.</p>
            </div>

            {memberSince && (
              <div className="settings-member-since">
                <span className="text-small text-fg-muted">Member since</span>
                <span className="text-small text-fg">{memberSince}</span>
              </div>
            )}
          </>
        )}
      </div>

      <footer className="settings-actions">
        <span className="settings-save-status" role="status">{saved ? "Changes saved" : ""}</span>
        <button type="button" onClick={onClose} className="btn btn-ghost btn-sm">Cancel</button>
        <button type="submit" disabled={!canSave} className="btn btn-primary btn-sm">{saving ? "Saving..." : "Save changes"}</button>
      </footer>
    </form>
  );
}
