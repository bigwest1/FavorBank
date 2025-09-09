import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BrandBadge } from "@/components/brand/BrandBadge";
import { ProBadge } from "@/components/brand/ProBadge";
import { InsuranceBadge } from "@/components/brand/InsuranceBadge";
import { CreditChip } from "@/components/brand/CreditChip";
import Logo from "@/components/brand/Logo";

const swatch = (name: string) => (
  <div key={name} className="flex items-center gap-3">
    <div
      className="h-10 w-10 rounded-md border"
      style={{ background: `var(--${name})` }}
    />
    <div className="text-sm">
      <div className="font-medium">--{name}</div>
      <div className="text-muted-foreground">var(--{name})</div>
    </div>
  </div>
);

export default function Brand() {
  return (
    <div className="py-10 space-y-8">
      <div className="flex items-center justify-between">
        <Logo />
        <BrandBadge />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-6 space-y-4">
          <h2 className="text-h2">Palette</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[
              "ink",
              "leaf-42a",
              "citrus",
              "cloud",
              "clay",
            ].map((n) => swatch(n))}
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-h2">Type Scale</h2>
          <div className="space-y-2">
            <div className="text-display">Display 56/64</div>
            <div className="text-h1">H1 40/48</div>
            <div className="text-h2">H2 32/40</div>
            <div className="text-h3">H3 24/32</div>
            <div className="text-body">Body 16/24</div>
            <div className="text-small">Small 14/20</div>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-6 space-y-4">
          <h2 className="text-h2">Badges & Chips</h2>
          <div className="flex flex-wrap gap-3 items-center">
            <ProBadge />
            <InsuranceBadge />
            <BrandBadge />
            <CreditChip amount={"120 credits"} />
            <CreditChip amount={"+10"} />
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-h2">Buttons (AAA primary)</h2>
          <div className="flex flex-wrap gap-3">
            <Button variant="brand">Primary CTA</Button>
            <Button>Default</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="secondary">Secondary</Button>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-6 space-y-4">
          <h2 className="text-h2">Motion: Springy Chip</h2>
          <p className="text-muted-foreground">
            Hover/press demonstrates a spring-like scale pop using CSS keyframes.
          </p>
          <div className="flex gap-4">
            <CreditChip amount="Tap me" />
            <CreditChip amount="I bounce" />
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-h2">Motion: Breathing Marker</h2>
          <p className="text-muted-foreground">
            Used to indicate nearby time slots or active locations.
          </p>
          <div className="flex items-center gap-4">
            <div className="breathing-marker" />
            <div className="breathing-marker" style={{ width: 16, height: 16 }} />
            <div className="breathing-marker" style={{ width: 20, height: 20 }} />
          </div>
        </Card>
      </div>
    </div>
  );
}

