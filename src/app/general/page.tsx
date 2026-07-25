import { DistributionAccountView } from "@/components/distribution/DistributionAccountView";

export default function GeneralAccountPage() {
  return (
    <DistributionAccountView
      category="general"
      title="일반계좌 분배금 현황"
      subtitle="일반계좌로 운영하는 분배금 내역을 요약하고 데이터를 관리합니다."
    />
  );
}
