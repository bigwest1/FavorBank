"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, Trophy, Leaf, Clock, Users } from "lucide-react";

type Impact = {
  month: string;
  totalHours: number;
  totalMinutes: number;
  carbonSavedKg: number;
  helpers: Array<{ id: string; name: string; hours: number; minutes: number }>;
  reciprocity: number;
  categories: Array<{ category: string; hours: number; minutes: number }>;
};

export default function CircleImpact({ circleId, circleName }: { circleId: string; circleName: string }) {
  const [month, setMonth] = useState<string>(() => new Date().toISOString().slice(0,7));
  const [impact, setImpact] = useState<Impact | null>(null);
  const [loading, setLoading] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => { fetchImpact(); }, [circleId, month]);

  async function fetchImpact() {
    setLoading(true);
    try {
      const res = await fetch(`/api/circles/${circleId}/impact?month=${month}`);
      if (res.ok) setImpact(await res.json());
    } finally { setLoading(false); }
  }

  function Bar({ label, value, max, color = '#46C079' }: { label: string; value: number; max: number; color?: string }) {
    const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
    return (
      <div className="space-y-1">
        <div className="flex justify-between text-xs"><span>{label}</span><span>{value}</span></div>
        <div className="h-2 bg-gray-100 rounded">
          <div className="h-2 rounded" style={{ width: pct + '%', backgroundColor: color }} />
        </div>
      </div>
    );
  }

  function drawPoster() {
    if (!impact) return;
    const canvas = canvasRef.current!;
    const W = 1080, H = 1350;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d')!;
    // Background
    ctx.fillStyle = '#F7F9FC';
    ctx.fillRect(0,0,W,H);
    // Header
    ctx.fillStyle = '#1F2430';
    ctx.fillRect(0,0,W,160);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 42px Inter, system-ui';
    ctx.fillText('FavorBank Impact', 48, 70);
    ctx.font = '28px Inter, system-ui';
    ctx.fillText(`${circleName} • ${impact.month}`, 48, 120);
    // Summary cards
    const cardY = 200; const cardH = 160; const pad = 32; const cardW = (W - pad*2 - 2*24) / 3;
    const cards = [
      { title: 'Hours Traded', value: `${impact.totalHours}` },
      { title: 'Carbon Saved', value: `${impact.carbonSavedKg} kg` },
      { title: 'Reciprocity', value: `${impact.reciprocity}` },
    ];
    cards.forEach((c, i) => {
      const x = pad + i*(cardW+24);
      ctx.fillStyle = '#FFFFFF'; ctx.strokeStyle = '#E7E3DC'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(x, cardY, cardW, cardH, 12); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#6B7280'; ctx.font = '20px Inter, system-ui'; ctx.fillText(c.title, x+20, cardY+46);
      ctx.fillStyle = '#1F2430'; ctx.font = 'bold 44px Inter, system-ui'; ctx.fillText(c.value, x+20, cardY+110);
    });
    // Top helpers
    const leftX = pad; const leftY = cardY + cardH + 60; const leftW = (W - pad*3)/2; const leftH = 400;
    ctx.fillStyle = '#1F2430'; ctx.font = 'bold 28px Inter, system-ui'; ctx.fillText('Top Helpers', leftX, leftY - 12);
    ctx.fillStyle = '#FFFFFF'; ctx.strokeStyle = '#E7E3DC'; ctx.beginPath(); ctx.roundRect(leftX, leftY, leftW, leftH, 12); ctx.fill(); ctx.stroke();
    const maxHrs = Math.max(1, ...impact.helpers.map(h => h.hours));
    impact.helpers.slice(0,5).forEach((h, idx) => {
      const bx = leftX + 20, by = leftY + 30 + idx*70, bw = leftW - 40, bh = 18;
      const pct = Math.min(1, h.hours / maxHrs);
      ctx.fillStyle = '#1F2430'; ctx.font = '20px Inter, system-ui'; ctx.fillText(h.name || 'Member', bx, by-6);
      ctx.fillStyle = '#F3F4F6'; ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = '#46C079'; ctx.fillRect(bx, by, Math.round(bw*pct), bh);
      ctx.fillStyle = '#1F2430'; ctx.font = '16px Inter, system-ui'; ctx.fillText(`${h.hours} h`, bx + bw - 70, by + bh - 2);
    });
    // Category mix
    const rightX = leftX + leftW + pad; const rightY = leftY; const rightW = leftW; const rightH = leftH;
    ctx.fillStyle = '#1F2430'; ctx.font = 'bold 28px Inter, system-ui'; ctx.fillText('Category Mix', rightX, rightY - 12);
    ctx.fillStyle = '#FFFFFF'; ctx.strokeStyle = '#E7E3DC'; ctx.beginPath(); ctx.roundRect(rightX, rightY, rightW, rightH, 12); ctx.fill(); ctx.stroke();
    const maxCat = Math.max(1, ...impact.categories.map(c => c.hours));
    impact.categories.slice(0,6).forEach((c, idx) => {
      const bx = rightX + 20, by = rightY + 30 + idx*60, bw = rightW - 40, bh = 18;
      const pct = Math.min(1, c.hours / maxCat);
      ctx.fillStyle = '#1F2430'; ctx.font = '20px Inter, system-ui'; ctx.fillText(c.category.replace(/_/g,' '), bx, by-6);
      ctx.fillStyle = '#F3F4F6'; ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = '#F7C948'; ctx.fillRect(bx, by, Math.round(bw*pct), bh);
      ctx.fillStyle = '#1F2430'; ctx.font = '16px Inter, system-ui'; ctx.fillText(`${c.hours} h`, bx + bw - 70, by + bh - 2);
    });
    // Footer brand
    ctx.fillStyle = '#6B7280'; ctx.font = '18px Inter, system-ui'; ctx.fillText('favorbank.app • Celebrate time well spent', pad, H - 36);
  }

  function downloadPoster() {
    drawPoster();
    const canvas = canvasRef.current!;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url; a.download = `favorbank-impact-${impact?.month || month}.png`; a.click();
  }

  const maxHelperHours = useMemo(() => Math.max(1, ...(impact?.helpers?.map(h => h.hours) || [1])), [impact]);
  const maxCatHours = useMemo(() => Math.max(1, ...(impact?.categories?.map(c => c.hours) || [1])), [impact]);

  return (
    <div className="space-y-6">
      <div className="flex items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="month">Month</Label>
          <Input id="month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-48" />
        </div>
        <div className="flex-1" />
        <Button onClick={downloadPoster} disabled={!impact}><Download className="h-4 w-4 mr-2"/>Download Poster</Button>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5"/>Hours Traded</CardTitle></CardHeader>
          <CardContent>
            {loading || !impact ? (
              <div className="text-sm text-gray-600">Loading…</div>
            ) : (
              <div className="text-3xl font-bold">{impact.totalHours} <span className="text-base font-medium text-gray-500">hrs</span></div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2"><Leaf className="h-5 w-5"/>Carbon Saved</CardTitle></CardHeader>
          <CardContent>
            {loading || !impact ? (
              <div className="text-sm text-gray-600">Loading…</div>
            ) : (
              <div className="text-3xl font-bold">{impact.carbonSavedKg} <span className="text-base font-medium text-gray-500">kg CO₂</span></div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5"/>Reciprocity</CardTitle></CardHeader>
          <CardContent>
            {loading || !impact ? (
              <div className="text-sm text-gray-600">Loading…</div>
            ) : (
              <div className="text-3xl font-bold">{impact.reciprocity}</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5"/>Top Helpers</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {loading || !impact ? (
              <div className="text-sm text-gray-600">Loading…</div>
            ) : impact.helpers.length === 0 ? (
              <div className="text-sm text-gray-600">No helpers yet this month</div>
            ) : (
              impact.helpers.map((h) => (
                <Bar key={h.id} label={h.name || 'Member'} value={h.hours} max={maxHelperHours} color="#46C079" />
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle>Category Mix (hours)</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {loading || !impact ? (
              <div className="text-sm text-gray-600">Loading…</div>
            ) : impact.categories.length === 0 ? (
              <div className="text-sm text-gray-600">No activity yet</div>
            ) : (
              impact.categories.map((c) => (
                <Bar key={c.category} label={c.category.replace(/_/g,' ')} value={c.hours} max={maxCatHours} color="#F7C948" />
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

