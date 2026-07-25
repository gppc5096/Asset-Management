import { DistributionAccountView } from "@/components/distribution/DistributionAccountView";

export default function SpecialAccountPage() {
  return (
    <DistributionAccountView
      category="special"
      title="특별계좌 분배금 현황"
      subtitle="특별계좌로 운영하는 분배금 내역을 요약하고 데이터를 관리합니다."
    />
  );
}
