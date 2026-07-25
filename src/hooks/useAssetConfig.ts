"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { toast } from "sonner";
import { db } from "@/lib/firebaseConfig";
import { useAuth } from "@/components/providers/AuthProvider";
import { normalizeTimestamp } from "@/lib/firestore-utils";
import { isAssetConfig } from "@/lib/validate";
import type { AssetConfig } from "@/lib/types";

const EMPTY_CONFIG: AssetConfig = {
  holdings: [],
  cash: { krw: 0, usd: 0, updatedAt: new Date(0).toISOString() },
  exchangeRate: { rate: 0, source: "auto", fetchedAt: new Date(0).toISOString() },
  updatedAt: new Date(0).toISOString(),
};

export function useAssetConfig() {
  const { user } = useAuth();
  const [data, setData] = useState<AssetConfig>(EMPTY_CONFIG);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      // Firebase Auth(외부 시스템) 로그아웃에 맞춰 구독 상태를 정리 — 의도된 동기 setState
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setData(EMPTY_CONFIG);
      setLoading(false);
      return;
    }
    setLoading(true);
    const ref = doc(db, "users", user.uid, "backups", "asset-config");
    const unsubscribe = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setData(EMPTY_CONFIG);
          setLoading(false);
          return;
        }
        const raw = snap.data();
        if (!isAssetConfig(raw)) {
          // 손상되거나 형식이 맞지 않는 문서 — 빈 값으로 안전하게 대체(크래시 방지)
          setData(EMPTY_CONFIG);
          setLoading(false);
          return;
        }
        setData({ ...raw, updatedAt: normalizeTimestamp(raw.updatedAt) });
        setLoading(false);
      },
      () => {
        setLoading(false);
        toast.error("자산 데이터를 불러오지 못했습니다");
      }
    );
    return unsubscribe;
  }, [user]);

  const save = async (next: AssetConfig) => {
    if (!user) return;
    const ref = doc(db, "users", user.uid, "backups", "asset-config");
    await setDoc(ref, next);
  };

  return { data, loading, save };
}
