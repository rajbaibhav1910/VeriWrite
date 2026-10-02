import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "@/layouts/AppLayout";
import { BareMarketingLayout, MarketingLayout } from "@/layouts/MarketingLayout";
import { AuthLayout } from "@/layouts/AuthLayout";
import { CommandPalette } from "@/components/navigation/CommandPalette";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useUiStore } from "@/store/uiStore";
import { SectionStubPage } from "@/pages/SectionStubPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { LegalPage } from "@/pages/LegalPage";
import { PricingPage } from "@/pages/PricingPage";
import { AuthFormPage } from "@/pages/AuthFormPage";
import { ForgotPasswordPage } from "@/pages/ForgotPasswordPage";
import { RequireSession } from "@/components/auth/RequireSession";
import { Gauge, LayoutDashboard, UserSquare2 } from "lucide-react";

const LandingPage = lazy(() => import("@/pages/LandingPage").then((m) => ({ default: m.LandingPage })));

/**
 * Every screen a visitor may never open is its own chunk, loaded when the route is
 * reached. The shell — layouts, nav, the pages linked from the landing page — stays in
 * the first load, because that is what a reader sees before any tool runs.
 */
const DetectorPage = lazy(() => import("@/pages/DetectorPage").then((m) => ({ default: m.DetectorPage })));
const ParaphrasePage = lazy(() => import("@/pages/ParaphrasePage").then((m) => ({ default: m.ParaphrasePage })));
const HumanizerPage = lazy(() => import("@/pages/HumanizerPage").then((m) => ({ default: m.HumanizerPage })));
const GrammarPage = lazy(() => import("@/pages/GrammarPage").then((m) => ({ default: m.GrammarPage })));
const PlagiarismPage = lazy(() => import("@/pages/PlagiarismPage").then((m) => ({ default: m.PlagiarismPage })));
const SummarizerPage = lazy(() => import("@/pages/SummarizerPage").then((m) => ({ default: m.SummarizerPage })));
const TranslatorPage = lazy(() => import("@/pages/TranslatorPage").then((m) => ({ default: m.TranslatorPage })));
const CitationPage = lazy(() => import("@/pages/CitationPage").then((m) => ({ default: m.CitationPage })));
const WriterPage = lazy(() => import("@/pages/WriterPage").then((m) => ({ default: m.WriterPage })));
const DashboardPage = lazy(() => import("@/pages/DashboardPage").then((m) => ({ default: m.DashboardPage })));
const UsagePage = lazy(() => import("@/pages/UsagePage").then((m) => ({ default: m.UsagePage })));
const SettingsPage = lazy(() => import("@/pages/SettingsPage").then((m) => ({ default: m.SettingsPage })));
const AccountPage = lazy(() => import("@/pages/AccountPage").then((m) => ({ default: m.AccountPage })));
const DocumentsPage = lazy(() => import("@/pages/DocumentsPage").then((m) => ({ default: m.DocumentsPage })));
const HistoryPage = lazy(() => import("@/pages/HistoryPage").then((m) => ({ default: m.HistoryPage })));
const ReportsPage = lazy(() => import("@/pages/ReportsPage").then((m) => ({ default: m.ReportsPage })));
const ReportPage = lazy(() => import("@/pages/ReportPage").then((m) => ({ default: m.ReportPage })));

export function App() {
  const setCommandPaletteOpen = useUiStore((state) => state.setCommandPaletteOpen);

  useKeyboardShortcuts({
    onSearch: () => setCommandPaletteOpen(true),
    onEscape: () => setCommandPaletteOpen(false),
  });

  return (
    <>
      <Suspense fallback={<LandingFallback />}>
        <Routes>
          {/* Marketing */}
          <Route element={<BareMarketingLayout />}>
            <Route index element={<LandingPage />} />
            <Route path="/landing" element={<LandingPage />} />
          </Route>

          <Route element={<MarketingLayout />}>
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/careers" element={<CareersPage />} />
            <Route path="/help" element={<HelpPage />} />
            <Route path="/help/:section" element={<HelpPage />} />
            <Route path="/legal/:slug" element={<LegalPage />} />
          </Route>

          {/* Authentication */}
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<AuthFormPage mode="login" />} />
            <Route path="/signup" element={<AuthFormPage mode="signup" />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          </Route>

          {/* Authenticated application shell */}
          <Route element={<AppLayout />}>
            {/* Account data needs a session; the tools themselves stay open to visitors. */}
            <Route element={<RequireSession />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              {/* One library, two names: marketing links call it the workspace. */}
              <Route path="/workspace" element={<DocumentsPage />} />
              <Route path="/documents" element={<DocumentsPage />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/usage" element={<UsagePage />} />
              <Route path="/account" element={<AccountPage />} />
            </Route>
            {/* Preferences describe this device, and the privacy switches are how a visitor
                refuses storage, so settings are deliberately not behind a session. */}
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/detector" element={<DetectorPage />} />
            {/* A share link has to open for whoever received it, session or not. */}
            <Route path="/report" element={<ReportPage />} />
            <Route path="/paraphraser" element={<ParaphrasePage />} />
            <Route path="/humanizer" element={<HumanizerPage />} />
            <Route path="/grammar" element={<GrammarPage />} />
            <Route path="/plagiarism" element={<PlagiarismPage />} />
            <Route path="/summarizer" element={<SummarizerPage />} />
            <Route path="/translator" element={<TranslatorPage />} />
            <Route path="/citations" element={<CitationPage />} />
            <Route path="/writer" element={<WriterPage />} />
            <Route path="/billing" element={<Navigate to="/pricing" replace />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
      <CommandPalette />
    </>
  );
}

function AboutPage() {
  return (
    <SectionStubPage
      title="About VeriWrite"
      description="Why this product exists and how it thinks about detection."
      icon={LayoutDashboard}
      emptyTitle="Building in the open"
      emptyBody="VeriWrite treats authorship signals as estimates to be explained, not verdicts to be handed down."
    />
  );
}

function ContactPage() {
  return (
    <SectionStubPage
      title="Contact"
      description="Reach the team about research partnerships or enterprise questions."
      icon={UserSquare2}
      emptyTitle="Support inbox"
      emptyBody="Contact routing is wired to the support service in a later phase."
    />
  );
}

function CareersPage() {
  return (
    <SectionStubPage
      title="Careers"
      description="Open roles across applied NLP, product design and platform engineering."
      icon={UserSquare2}
      emptyTitle="No roles listed yet"
      emptyBody="Position listings are published when a hiring loop is open."
    />
  );
}

function HelpPage() {
  return (
    <SectionStubPage
      title="Help Center"
      description="Guides on detection signals, report interpretation and plan limits."
      icon={Gauge}
      emptyTitle="Guides are on the way"
      emptyBody="The knowledge base links from every tool once the article set is imported."
    />
  );
}

function LandingFallback() {
  return (
    <div className="mx-auto max-w-[86rem] px-4 py-20 sm:px-6 lg:px-8" role="status">
      <span className="sr-only">Loading VeriWrite</span>
      <div className="grid gap-10 lg:grid-cols-[minmax(0,42%)_minmax(0,1fr)]">
        <div className="space-y-4">
          <div className="skeleton h-3 w-40 rounded-sm" />
          <div className="skeleton h-12 w-full rounded-md" />
          <div className="skeleton h-12 w-3/4 rounded-md" />
          <div className="skeleton h-4 w-2/3 rounded-sm" />
        </div>
        <div className="skeleton h-[24rem] w-full rounded-xl" />
      </div>
    </div>
  );
}
