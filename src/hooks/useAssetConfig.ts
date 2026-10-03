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
  // 읽기 구독이 오류로 끝났는지. true면 data는 실제 문서가 아닌 빈 값이므로 쓰기를 막는다.
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!user) {
      // Firebase Auth(외부 시스템) 로그아웃에 맞춰 구독 상태를 정리 — 의도된 동기 setState
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setData(EMPTY_CONFIG);
      setLoadError(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(false);
    const ref = doc(db, "users", user.uid, "backups", "asset-config");
    const unsubscribe = onSnapshot(
      ref,
      (snap) => {
        setLoadError(false);
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
        setLoadError(true);
        toast.error("자산 데이터를 불러오지 못했습니다");
      }
    );
    return unsubscribe;
  }, [user]);

  const save = async (next: AssetConfig) => {
    // 조용히 성공한 것처럼 보이면 안 된다: 호출자가 실패를 알리도록 거부한다.
    if (!user) throw new Error("로그인이 필요합니다");
    if (loadError) throw new Error("데이터를 불러오지 못한 상태에서는 저장할 수 없습니다");
    const ref = doc(db, "users", user.uid, "backups", "asset-config");
    await setDoc(ref, next);
  };

  return { data, loading, loadError, save };
}
