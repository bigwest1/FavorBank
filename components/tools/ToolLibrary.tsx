"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Wrench, Download, QrCode, CheckCircle2, RefreshCw } from "lucide-react";

type Tool = {
  id: string;
  name: string;
  description?: string | null;
  status: "AVAILABLE" | "BORROWED" | "MAINTENANCE" | "RETIRED";
  feePerBorrow: number;
  loans: Array<{
    id: string;
    borrower: { id: string; name: string | null };
  }>;
};

export function ToolLibrary({ circleId }: { circleId: string }) {
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [fee, setFee] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchTools();
  }, [circleId]);

  async function fetchTools() {
    setLoading(true);
    try {
      const res = await fetch(`/api/circles/${circleId}/tools`);
      if (res.ok) {
        const data = await res.json();
        setTools(data.tools || []);
      }
    } finally {
      setLoading(false);
    }
  }

  async function addTool() {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/circles/${circleId}/tools`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, feePerBorrow: fee })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add tool");
      setName("");
      setDescription("");
      setFee(1);
      await fetchTools();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function borrow(toolId: string) {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/tools/${toolId}/checkout`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to borrow tool");
      await fetchTools();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function returnTool(toolId: string) {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/tools/${toolId}/checkin`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to return tool");
      await fetchTools();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Tool Library
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="text-gray-600 text-sm">Loading…</div>
          ) : tools.length === 0 ? (
            <Alert>
              <AlertDescription>
                No tools listed yet. Add the first ladder, dolly, or kit below.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tools.map((tool) => (
                <Card key={tool.id} className="border">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{tool.name}</CardTitle>
                      <Badge variant="outline" className={
                        tool.status === 'AVAILABLE' ? 'text-green-700 border-green-300' :
                        tool.status === 'BORROWED' ? 'text-amber-700 border-amber-300' : 'text-gray-700 border-gray-300'
                      }>
                        {tool.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    {tool.description && (
                      <p className="text-sm text-gray-700 line-clamp-2">{tool.description}</p>
                    )}
                    <div className="flex items-center justify-between text-sm">
                      <div>
                        Fee: <span className="font-medium">{tool.feePerBorrow} credits</span>
                      </div>
                      {tool.status === 'AVAILABLE' ? (
                        <Button size="sm" onClick={() => borrow(tool.id)} disabled={submitting}>Borrow</Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => returnTool(tool.id)} disabled={submitting}>
                          Return
                        </Button>
                      )}
                    </div>
                    {tool.status === 'BORROWED' && tool.loans[0] && (
                      <div className="text-xs text-gray-600">Borrowed by {tool.loans[0].borrower?.name || 'Someone'}</div>
                    )}
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <QrCode className="h-4 w-4" />
                      Checkout URL: <code className="truncate">/api/tools/{tool.id}/checkout</code>
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
          <CardTitle>List a Tool</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ladder, dolly, toolkit" />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="description">Description</Label>
              <Input id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Size, any notes or limitations" />
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label htmlFor="fee">Borrow fee (credits)</Label>
              <Input id="fee" type="number" min={0} max={50} value={fee} onChange={(e) => setFee(parseInt(e.target.value || '0', 10))} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={addTool} disabled={submitting || !name.trim()}>
              {submitting ? (<><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Saving</>) : (<> <CheckCircle2 className="h-4 w-4 mr-2"/> Add Tool</>)}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default ToolLibrary;

