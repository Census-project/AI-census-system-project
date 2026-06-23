import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarChart3, ShieldCheck, MapPin, Bot } from "lucide-react";

const features = [
  {
    icon: BarChart3,
    title: "Fast data capture",
    description: "Collect census records quickly in the field with a responsive digital form.",
  },
  {
    icon: ShieldCheck,
    title: "Supervisor oversight",
    description: "Supervisors can review all enumerator submissions and validate coverage in real time.",
  },
  {
    icon: Bot,
    title: "Smart validation",
    description: "Built-in verification and anomaly checks keep your census data consistent and accurate.",
  },
  {
    icon: MapPin,
    title: "Location-aware reporting",
    description: "Capture GPS-enabled household locations for stronger spatial planning and analysis.",
  },
];

const illustrations = [
  {
    label: "Field data collection",
    caption: "AI-generated illustration showing the mobile field workflow.",
    src: "/images/ChatGPT Image Jun 10, 2026, 03_30_20 PM.png",
  },
  {
    label: "Supervisor review dashboard",
    caption: "AI-generated illustration showing a review dashboard and oversight panel.",
    src: "/images/ChatGPT Image Jun 10, 2026, 02_58_50 PM.png",
  },
  {
    label: "Smart validation and mapping",
    caption: "AI-generated illustration showing validation checks and map insights.",
    src: "/images/ChatGPT Image Jun 10, 2026, 03_27_05 PM.png",
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img
            src="/images/banner image.png"
            alt="Census platform banner"
            className="h-[520px] w-full object-cover"
          />
          <div className="absolute inset-0 bg-slate-950/40" />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="max-w-3xl text-center text-white">
            <span className="inline-flex rounded-full bg-primary/20 px-4 py-1 text-sm font-semibold text-primary-100">
              Digital census platform
            </span>
            <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl">
              Modern census collection, supervision, and verification in one web app.
            </h1>
            <p className="mt-6 text-base text-slate-200 sm:text-lg">
              Empower enumerators with faster field reporting, give supervisors full visibility into collected data, and keep your census workflow secure with role-based access.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button className="bg-white text-slate-950 shadow-xl shadow-slate-950/15 hover:bg-slate-100" asChild>
                <Link to="/app">Launch the app</Link>
              </Button>
              <Button
                variant="outline"
                className="border-white/40 bg-white/90 text-slate-950 shadow-lg shadow-slate-950/10 hover:bg-white"
                asChild
              >
                <Link to="/app">Sign in or register</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <nav className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/95 px-4 py-3 shadow-xl shadow-slate-950/20 backdrop-blur-md sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6">
          <div className="text-sm font-semibold text-white">Census Dashboard</div>
          <div className="hidden items-center gap-4 text-sm text-slate-200 sm:flex">
            <a href="#features" className="transition-colors hover:text-white">Features</a>
            <a href="#illustrations" className="transition-colors hover:text-white">Illustrations</a>
            <a href="#overview" className="transition-colors hover:text-white">Overview</a>
            <a
              href="/app"
              className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm text-white transition-colors hover:bg-white/20"
            >
              Go to App
            </a>
          </div>
          <div className="flex items-center gap-3 sm:hidden">
            <a
              href="/app"
              className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm text-white transition-colors hover:bg-white/20"
            >
              App
            </a>
          </div>
        </div>
      </nav>

      <div className="relative overflow-hidden px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div id="features" className="grid gap-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <motion.div
              initial={{ opacity: 0, x: -24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
              className="max-w-2xl"
            >
              <span className="inline-flex rounded-full bg-primary/10 px-4 py-1 text-sm font-semibold text-primary">
                Digital census platform
              </span>
              <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl">
                Modern census collection, supervision, and verification in one web app.
              </h1>
              <p className="mt-6 max-w-xl text-base text-muted-foreground sm:text-lg">
                Empower enumerators with faster field reporting, give supervisors full visibility into collected data, and keep your census workflow secure with role-based access.
              </p>
              <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                <Button asChild>
                  <Link to="/app">Launch the app</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link to="/app">Sign in or register</Link>
                </Button>
              </div>
              <div className="mt-10 grid gap-4 sm:grid-cols-2">
                {features.slice(0, 2).map((feature) => (
                  <div key={feature.title} className="rounded-3xl border border-border/70 bg-card/80 p-6">
                    <feature.icon className="h-6 w-6 text-primary" />
                    <h2 className="mt-4 text-lg font-semibold text-foreground">{feature.title}</h2>
                    <p className="mt-2 text-sm text-muted-foreground">{feature.description}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
              className="space-y-6"
            >
              {features.slice(2).map((feature) => (
                <Card key={feature.title} className="rounded-3xl border border-border/70 bg-card/90 p-6 shadow-lg">
                  <CardHeader className="p-0">
                    <CardTitle className="flex items-center gap-3 text-xl font-semibold text-foreground">
                      <feature.icon className="h-5 w-5 text-primary" />
                      {feature.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0 pt-4">
                    <CardDescription className="text-sm text-muted-foreground">{feature.description}</CardDescription>
                  </CardContent>
                </Card>
              ))}
            </motion.div>
          </div>

          <div id="overview" className="mt-16">
            <div className="mb-8 text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">AI illustrations</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground">Visualizing the census workflow with AI-generated art</h2>
              <p className="mx-auto mt-4 max-w-2xl text-sm text-muted-foreground sm:text-base">
                These illustrations are generated by AI to show how the app brings together data capture, field teams, supervision, and analytics.
              </p>
            </div>
            <div id="illustrations" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {illustrations.map((item) => (
                <div key={item.label} className="overflow-hidden rounded-3xl border border-border/70 bg-card/80 shadow-sm">
                  <div className="aspect-[4/3] w-full overflow-hidden bg-slate-100">
                    {item.src ? (
                      <img src={item.src} alt={item.label} className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      item.illustration
                    )}
                  </div>
                  <div className="p-4">
                    <p className="text-sm font-semibold text-foreground">{item.label}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{item.caption}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
