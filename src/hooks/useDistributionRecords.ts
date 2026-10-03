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
  // 읽기 구독이 오류로 끝났는지. true면 data는 실제 문서가 아닌 빈 값이므로 쓰기를 막는다.
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!user) {
      // Firebase Auth(외부 시스템) 로그아웃에 맞춰 구독 상태를 정리 — 의도된 동기 setState
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setData(EMPTY_DOC);
      setLoadError(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(false);
    const ref = doc(db, "users", user.uid, "backups", category);
    const unsubscribe = onSnapshot(
      ref,
      (snap) => {
        setLoadError(false);
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
        setLoadError(true);
        toast.error("분배금 데이터를 불러오지 못했습니다");
      }
    );
    return unsubscribe;
  }, [user, category]);

  const save = async (next: DistributionDoc) => {
    // 조용히 성공한 것처럼 보이면 안 된다: 호출자가 실패를 알리도록 거부한다.
    if (!user) throw new Error("로그인이 필요합니다");
    if (loadError) throw new Error("데이터를 불러오지 못한 상태에서는 저장할 수 없습니다");
    const ref = doc(db, "users", user.uid, "backups", category);
    await setDoc(ref, next);
  };

  return { data, loading, loadError, save };
}
