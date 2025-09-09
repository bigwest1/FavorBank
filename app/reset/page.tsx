"use client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export default function DevResetPage() {
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/auth/dev-reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, newPassword }),
    });
    const data = await res.json();
    setMsg(res.ok ? "Password updated." : data.error ?? "Failed");
  };
  return (
    <div className="py-12 flex justify-center">
      <Card className="w-full max-w-md p-6">
        <h1 className="text-h2 mb-2">Dev Password Reset</h1>
        <p className="text-muted-foreground mb-6">Available only in development.</p>
        <form onSubmit={onSubmit} className="space-y-3">
          <Input placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input type="password" placeholder="New password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          <Button type="submit" variant="brand" className="w-full">Update</Button>
        </form>
        {msg && <p className="text-sm mt-3">{msg}</p>}
      </Card>
    </div>
  );
}

