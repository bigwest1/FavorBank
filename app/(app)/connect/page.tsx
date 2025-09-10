"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { AlertCircle, HandHeart, MapPin, Calendar, Users, Star, Building2, CheckCircle2 } from "lucide-react";
import { BookingForm } from "@/components/slotshop/BookingForm";

type SlotItem = {
  id: string;
  title: string | null;
  description: string | null;
  category: string;
  start: string;
  end: string;
  location: string | null;
  pricePerMinute: number;
  minDuration: number;
  maxDuration: number | null;
  circleId: string;
  provider: { id: string; name: string | null };
  sponsored?: boolean;
  sponsorName?: string | null;
  circleName?: string;
};

const APPROVED_PUBLIC_CATEGORIES = [
  "ELDERCARE",
  "CHILDCARE",
  "TUTORING",
  "GARDENING",
  "CLEANING",
  "MAINTENANCE",
  "TRANSPORT",
  "CREATIVE",
];

export default function PublicGoodPage() {
  const [loading, setLoading] = useState(true);
  const [slots, setSlots] = useState<SlotItem[]>([]);
  const [category, setCategory] = useState<string>("");
  const [sponsor, setSponsor] = useState<{ message: string; sponsorName?: string; circleName?: string } | null>(null);
  const [selected, setSelected] = useState<SlotItem | null>(null);

  useEffect(() => {
    fetchSponsor();
  }, []);

  useEffect(() => {
    fetchSlots();
  }, [category]);

  async function fetchSlots() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (category) params.set("category", category);
      const res = await fetch(`/api/connect/public-good?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load public good feed");
      const data = await res.json();
      setSlots(data.slots || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function fetchSponsor() {
    try {
      const res = await fetch(`/api/connect/sponsor`);
      if (res.ok) {
        const data = await res.json();
        setSponsor(data.sponsor || null);
      }
    } catch (e) {
      console.error(e);
    }
  }

  const categories = useMemo(() => ["", ...APPROVED_PUBLIC_CATEGORIES], []);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <HandHeart className="h-7 w-7 text-[var(--leaf-42a)]" />
        <div>
          <h1 className="text-2xl font-semibold">Public Good</h1>
          <p className="text-gray-600 text-sm">City-wide favors in approved categories. 15% community fee applies.</p>
        </div>
      </div>

      {sponsor && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-green-700" />
              <div>
                <div className="text-sm text-green-900 font-medium">Sponsored by {sponsor.sponsorName || sponsor.circleName || "Community Partner"}</div>
                <div className="text-xs text-green-800">Local partners fund credit pools to power public good</div>
              </div>
            </div>
            <Badge variant="outline" className="border-green-300 text-green-800">Active Sponsorship</Badge>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            Explore Favors
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-sm text-gray-600">Filter:</div>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="All approved categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All approved</SelectItem>
                {APPROVED_PUBLIC_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{c.replace(/_/g, " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="text-sm text-gray-600">Loading feed…</div>
          ) : slots.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <AlertCircle className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <div>No public good favors right now. Check back soon!</div>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {slots.map((slot) => (
                <Card key={slot.id} className="hover:shadow-sm transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-base line-clamp-1">{slot.title || `${slot.category.replace(/_/g, " ")} session`}</CardTitle>
                        <div className="text-xs text-gray-600 mt-1 flex items-center gap-2">
                          <MapPin className="h-3.5 w-3.5" /> {slot.location || "City"}
                          <span className="mx-1">•</span>
                          <Calendar className="h-3.5 w-3.5" /> {new Date(slot.start).toLocaleString()}
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline" className="text-xs">{slot.category.replace(/_/g, " ")}</Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <p className="text-sm text-gray-700 line-clamp-2 min-h-[40px]">{slot.description || "Community service favor"}</p>
                    <div className="flex items-center justify-between text-sm">
                      <div className="text-gray-700">
                        {slot.pricePerMinute} credits/min · min {slot.minDuration}m
                      </div>
                      <Button size="sm" onClick={() => setSelected(slot)}>Book</Button>
                    </div>
                    {slot.sponsored && (
                      <div className="flex items-center gap-2 text-xs text-green-700">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Sponsored by {slot.sponsorName || "Community Partner"}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selected && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="border-b px-4 py-3 flex items-center justify-between">
              <div className="font-medium">Book: {selected.title || selected.category}</div>
              <button className="text-sm text-gray-500" onClick={() => setSelected(null)}>Close</button>
            </div>
            <div className="p-4">
              {/* BookingForm posts to the booking API. Public Good fee handled server-side via isPublicGood flag. */}
              <BookingForm slot={selected as any} onSuccess={() => setSelected(null)} isPublicGood={true} />
              <div className="mt-2 text-xs text-gray-600">Public Good bookings include a 15% community fee.</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
