"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { toast } from "sonner";
import { db } from "@/lib/firebaseConfig";
import { useAuth } from "@/components/providers/AuthProvider";
import { normalizeTimestamp } from "@/lib/firestore-utils";
import { isDistributionDoc } from "@/lib/validate";
import type { DistributionCategory, DistributionDoc } from "@/lib/types";

const EMPTY_DOC: DistributionDoc = {
  records: [],
  updatedAt: new Date(0).toISOString(),
};

export function useDistributionRecords(category: DistributionCategory) {
  const { user } = useAuth();
  const [data, setData] = useState<DistributionDoc>(EMPTY_DOC);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      // Firebase Auth(외부 시스템) 로그아웃에 맞춰 구독 상태를 정리 — 의도된 동기 setState
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setData(EMPTY_DOC);
      setLoading(false);
      return;
    }
    setLoading(true);
    const ref = doc(db, "users", user.uid, "backups", category);
    const unsubscribe = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setData(EMPTY_DOC);
          setLoading(false);
          return;
        }
        const raw = snap.data();
        if (!isDistributionDoc(raw)) {
          setData(EMPTY_DOC);
          setLoading(false);
          return;
        }
        setData({ ...raw, updatedAt: normalizeTimestamp(raw.updatedAt) });
        setLoading(false);
      },
      () => {
        setLoading(false);
        toast.error("분배금 데이터를 불러오지 못했습니다");
      }
    );
    return unsubscribe;
  }, [user, category]);

  const save = async (next: DistributionDoc) => {
    if (!user) return;
    const ref = doc(db, "users", user.uid, "backups", category);
    await setDoc(ref, next);
  };

  return { data, loading, save };
}
