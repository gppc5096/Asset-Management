import { toast } from "sonner";

export const MSG_SAVE_FAILED = "저장하지 못했습니다. 네트워크 상태를 확인한 뒤 다시 시도해주세요";
export const MSG_BACKUP_FAILED = "클라우드 백업에 실패했습니다. 잠시 후 다시 시도해주세요";
export const MSG_RESTORE_LOOKUP_FAILED = "백업 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요";
export const MSG_RESTORE_FAILED = "클라우드 복원에 실패했습니다. 잠시 후 다시 시도해주세요";

/**
 * 비동기 작업을 실행하되 실패하면 처리되지 않은 Promise 거부로 새어 나가지 않게 하고,
 * 사용자에게 오류 알림을 띄운다. 성공/실패 여부를 반환한다.
 * (성공 알림과 다이얼로그 닫기는 task 안에서 await 이후에 수행하므로 실패 시 실행되지 않는다.)
 */
export async function runSafely(task: () => Promise<void>, failureMessage: string): Promise<boolean> {
  try {
    await task();
    return true;
  } catch (error) {
    console.error(failureMessage, error);
    toast.error(failureMessage);
    return false;
  }
}
