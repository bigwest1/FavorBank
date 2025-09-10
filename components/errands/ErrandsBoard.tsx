"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar, ShoppingCart, RefreshCw, CheckCircle2 } from "lucide-react";

type Bundle = {
  id: string;
  title: string;
  departAt: string;
  location?: string | null;
  creator: { id: string; name: string | null };
  items: Array<{ id: string; description: string; tipCredits: number; requester: { name: string | null } }>
};

export function ErrandsBoard({ circleId }: { circleId: string }) {
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("Costco run");
  const [departAt, setDepartAt] = useState<string>(() => new Date(Date.now() + 2*60*60*1000).toISOString().slice(0,16));
  const [location, setLocation] = useState("Costco - Main St");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { fetchBundles(); }, [circleId]);

  async function fetchBundles() {
    setLoading(true);
    try {
      const res = await fetch(`/api/circles/${circleId}/errands`);
      if (res.ok) {
        const data = await res.json();
        setBundles(data.bundles || []);
      }
    } finally { setLoading(false); }
  }

  async function createBundle() {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/circles/${circleId}/errands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, departAt: new Date(departAt).toISOString(), location, notes })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create bundle');
      await fetchBundles();
    } catch (e: any) { alert(e.message); }
    finally { setSubmitting(false); }
  }

  async function addItem(bundleId: string, description: string, tipCredits: number) {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/errands/${bundleId}/items`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description, tipCredits })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add item');
      await fetchBundles();
    } catch (e: any) { alert(e.message); }
    finally { setSubmitting(false); }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" /> Bundled Errands
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="text-sm text-gray-600">Loading…</div>
          ) : bundles.length === 0 ? (
            <div className="text-sm text-gray-600">No open bundles yet. Create the first one below!</div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {bundles.map((b) => (
                <Card key={b.id} className="border">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{b.title}</CardTitle>
                      <Badge variant="outline">Departs {new Date(b.departAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Badge>
                    </div>
                    <div className="text-xs text-gray-600">By {b.creator.name || 'Member'}{b.location ? ` • ${b.location}` : ''}</div>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <div className="space-y-1">
                      {b.items.length === 0 ? (
                        <div className="text-xs text-gray-600">No add-ons yet</div>
                      ) : (
                        b.items.map((it) => (
                          <div key={it.id} className="flex items-center justify-between text-sm">
                            <span>{it.description} <span className="text-xs text-gray-500">by {it.requester.name || 'Member'}</span></span>
                            <Badge variant="outline" className="text-xs">{it.tipCredits} credit{it.tipCredits === 1 ? '' : 's'}</Badge>
                          </div>
                        ))
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Input placeholder="Add milk, paper towels…" id={`desc-${b.id}`} />
                      <Button size="sm" onClick={() => {
                        const input = document.getElementById(`desc-${b.id}`) as HTMLInputElement | null;
                        const val = input?.value?.trim();
                        if (!val) return;
                        addItem(b.id, val, 1);
                        if (input) input.value = '';
                      }}>Add (1 credit)</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Create a Bundle</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Costco run" />
            </div>
            <div className="space-y-1">
              <Label>Depart at</Label>
              <Input type="datetime-local" value={departAt} onChange={(e) => setDepartAt(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Location</Label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Costco - Main St" />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Notes</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Leave cooler by 3pm, text when done…" />
          </div>
          <div className="flex gap-2">
            <Button onClick={createBundle} disabled={submitting}>
              {submitting ? (<><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Creating</>) : (<><CheckCircle2 className="h-4 w-4 mr-2"/> Create</>)}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default ErrandsBoard;

