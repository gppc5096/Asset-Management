import { vi } from "vitest";

/**
 * 테스트 전용 Firebase 대체물. 실제 네트워크/인증 없이 화면과 훅의 동작을 검증한다.
 * - firestore: onSnapshot이 즉시 현재 스냅샷을 전달, setDoc/getDocs는 vi.fn
 * - auth: authState.user로 로그인 상태 제어
 */

type SnapshotLike = { exists: () => boolean; data: () => unknown };

export const firestoreState = {
  /** 경로("users/u1/backups/general") → 문서 데이터. undefined면 문서 없음 */
  docs: new Map<string, unknown>(),
  /** true면 onSnapshot의 오류 콜백을 호출(권한/서비스 오류 재현) */
  listenError: false,
};

export const authState: { user: { uid: string; email: string } | null } = {
  user: { uid: "u1", email: "tester@example.com" },
};

export function resetFirebaseMock() {
  firestoreState.docs.clear();
  firestoreState.listenError = false;
  authState.user = { uid: "u1", email: "tester@example.com" };
  firestoreModule.setDoc.mockReset();
  firestoreModule.setDoc.mockResolvedValue(undefined);
  firestoreModule.getDocs.mockReset();
  firestoreModule.onSnapshot.mockClear();
}

const pathOf = (...segments: unknown[]) =>
  segments.filter((s) => typeof s === "string").join("/");

export const firestoreModule = {
  doc: vi.fn((_db: unknown, ...segments: string[]) => ({ path: pathOf(...segments) })),
  collection: vi.fn((_db: unknown, ...segments: string[]) => ({ path: pathOf(...segments) })),
  getDocs: vi.fn(),
  setDoc: vi.fn<(ref: { path: string }, data: unknown) => Promise<void>>(async () => {}),
  onSnapshot: vi.fn(
    (
      ref: { path: string },
      next: (snap: SnapshotLike) => void,
      error?: (e: Error) => void
    ) => {
      if (firestoreState.listenError) {
        error?.(new Error("permission-denied"));
      } else {
        const has = firestoreState.docs.has(ref.path);
        next({ exists: () => has, data: () => firestoreState.docs.get(ref.path) });
      }
      return () => {};
    }
  ),
};

export const authModule = {
  useAuth: () => ({
    user: authState.user,
    loading: false,
    signInWithGoogle: async () => {},
    signOut: async () => {},
  }),
};
