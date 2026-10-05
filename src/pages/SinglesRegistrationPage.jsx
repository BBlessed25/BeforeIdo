import { SinglesWizard } from "../components/SinglesWizard";
import { SEO } from "../components/SEO";

export function SinglesRegistrationPage() {
  return (
    <div className="min-h-screen relative">
      <SEO
        title="Before I do – The Singles Experience Registration"
        description="Connect, build meaningful friendships, have fun, and grow together in faith. Register for the Singles Experience."
        image="/logo2.jpeg"
      />
      <div
        aria-hidden="true"
        className="singles-background fixed inset-0 -z-10 bg-cover bg-no-repeat"
        style={{ backgroundImage: "url(/background.jpeg)" }}
      />
      <div className="relative z-0 mx-auto max-w-2xl px-4 py-8 pb-16 sm:py-12">
        <section id="hero" className="mb-6 text-center animate-slide-up">
          <div className="singles-card rounded-2xl p-6 text-left sm:p-8 sm:text-center">
            <h1 className="singles-title mb-4 text-burgundy-950">
              Before I do – The Singles Experience Registration
            </h1>
            <div className="space-y-4 text-left text-sm leading-relaxed text-text sm:text-base">
              <p>
                Welcome! 💕 We’re excited to have you join us for our upcoming Singles Event. This
                will be a wonderful opportunity to connect, build meaningful friendships, have fun,
                and grow together in faith.
              </p>
              <p>
                Please complete the form below so we can prepare for you. We look forward to seeing
                you! ❤️
              </p>
              <p className="font-semibold text-burgundy-800">
                <time dateTime="2026-10-16">Friday 16th October 2026</time>
                <br />
                <time dateTime="19:00">7:00pm</time>
              </p>
            </div>
          </div>
        </section>
        <div className="my-8 flex items-center gap-3" aria-hidden="true">
          <div className="h-px flex-1 bg-rose-400/65" />
          <span className="text-lg text-rose-400/90">⸻</span>
          <div className="h-px flex-1 bg-rose-400/65" />
        </div>
        <section
          id="registration"
          aria-label="Singles event registration"
          className="animate-slide-up"
        >
          <SinglesWizard />
        </section>
        <footer className="no-print pt-10 text-center text-xs text-blush-50/80 sm:text-sm">
          © Gospel Pillars Toronto 2026
        </footer>
      </div>
    </div>
  );
}
