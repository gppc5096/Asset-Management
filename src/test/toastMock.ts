import { vi } from "vitest";

/** sonner 알림 대체물. 화면이 어떤 성공/오류 알림을 띄우는지 검증하는 데 쓴다. */
export const toastMock = { success: vi.fn(), error: vi.fn() };
