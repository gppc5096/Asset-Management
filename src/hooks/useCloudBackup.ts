"use client";

import { useState } from "react";
import { collection, doc, getDocs, setDoc } from "firebase/firestore";
import { toast } from "sonner";
import { db } from "@/lib/firebaseConfig";
import { useAuth } from "@/components/providers/AuthProvider";

/** Firestore `users/{uid}/backups` 컬렉션에 대한 백업/복원 흐름을 캡슐화. */
export function useCloudBackup<T extends object>(
  collectionPrefix: string,
  isValid: (v: unknown) => v is T,
  save: (next: T) => Promise<void>
) {
  const { user } = useAuth();
  const [pendingRestore, setPendingRestore] = useState<{ id: string; data: T } | null>(null);

  async function backup(data: T) {
    if (!user) return;
    const backupId = `${collectionPrefix}-backup-${new Date().toISOString()}`;
    await setDoc(doc(db, "users", user.uid, "backups", backupId), data);
    toast.success("클라우드에 백업되었습니다", { style: { background: "#1c2536" } });
  }

  async function requestRestore() {
    if (!user) return;
    const snap = await getDocs(collection(db, "users", user.uid, "backups"));
    const backups = snap.docs
      .filter((d) => d.id.startsWith(`${collectionPrefix}-backup-`))
      .sort((a, b) => (a.id < b.id ? 1 : -1));
    if (backups.length === 0) {
      toast.error("복원할 백업이 없습니다");
      return;
    }
    const latest = backups[0];
    const latestData = latest.data();
    if (!isValid(latestData)) {
      toast.error("백업 데이터 형식이 올바르지 않습니다");
      return;
    }
    setPendingRestore({ id: latest.id, data: latestData });
  }

  async function confirmRestore() {
    if (!pendingRestore) return;
    await save(pendingRestore.data);
    setPendingRestore(null);
    toast.success("복원되었습니다", { style: { background: "#1c2536" } });
  }

  function cancelRestore() {
    setPendingRestore(null);
  }

  return { pendingRestore, backup, requestRestore, confirmRestore, cancelRestore };
}
