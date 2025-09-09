import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <section className="py-16 sm:py-24">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="font-[family:var(--font-inter-display)] text-4xl sm:text-5xl font-bold tracking-tight">
          Trade favors, not favors owed.
        </h1>
        <p className="mt-4 text-muted-foreground text-base sm:text-lg">
          FavorBank helps communities exchange time and skills fairly. Simple, fast, and built for trust.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Button className="px-5">Get Started</Button>
          <Button variant="outline" className="px-5">Learn More</Button>
        </div>
      </div>
    </section>
  );
}
