import { afterEach, beforeEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import { resetFirebaseMock } from "@/test/firebaseMock";
import { toastMock } from "@/test/toastMock";

// 모든 테스트에서 실제 Firebase/인증/차트를 쓰지 않는다.
vi.mock("firebase/firestore", async () => (await import("@/test/firebaseMock")).firestoreModule);
vi.mock("@/lib/firebaseConfig", () => ({ db: {}, auth: {}, googleProvider: {}, firebaseApp: {} }));
vi.mock("@/components/providers/AuthProvider", async () => {
  const { authModule } = await import("@/test/firebaseMock");
  return { ...authModule, AuthProvider: ({ children }: { children: unknown }) => children };
});
vi.mock("sonner", async () => ({
  toast: (await import("@/test/toastMock")).toastMock,
  Toaster: () => null,
}));
// recharts는 jsdom에서 크기를 못 재므로, 계산된 차트 데이터를 DOM에 그대로 노출하는 대체물로 교체
vi.mock("recharts", async () => await import("@/test/rechartsStub"));

// jsdom에는 ResizeObserver가 없어 base-ui 등이 참조할 때 필요
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

beforeEach(() => {
  resetFirebaseMock();
  toastMock.success.mockClear();
  toastMock.error.mockClear();
});
afterEach(() => cleanup());
