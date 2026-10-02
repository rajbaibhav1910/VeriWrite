import { Hero } from "@/components/landing/Hero";
import { TrustedBy } from "@/components/landing/TrustedBy";
import { FeatureOverview } from "@/components/landing/FeatureOverview";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { DetectorPreview } from "@/components/landing/DetectorPreview";
import { WritingTools } from "@/components/landing/WritingTools";
import { AudienceStudents } from "@/components/landing/AudienceStudents";
import { AudienceProfessionals } from "@/components/landing/AudienceProfessionals";
import { SecurityPrivacy } from "@/components/landing/SecurityPrivacy";
import { Faq } from "@/components/landing/Faq";
import { PricingCta } from "@/components/landing/PricingCta";

export function LandingPage() {
  return (
    <>
      <Hero />
      <TrustedBy />
      <FeatureOverview />
      <HowItWorks />
      <DetectorPreview />
      <div id="tools">
        <WritingTools />
      </div>
      <AudienceStudents />
      <AudienceProfessionals />
      <SecurityPrivacy />
      <Faq />
      <PricingCta />
    </>
  );
}
