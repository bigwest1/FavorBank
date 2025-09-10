"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { PlusBadge, PlusStatus } from "@/components/plus/PlusBadge";
import { 
  User, Crown, CreditCard, Calendar, Shield,
  Settings, Bell, Lock, Palette, Briefcase, Download, FileText
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface PlusDetails {
  isActive: boolean;
  subscription?: {
    status: string;
    currentPeriodEnd: string;
    subscribedAt: string;
  } | null;
}

interface PlusStats {
  subscription: any;
  totalCreditGrants: number;
  totalAutoWinDisputes: number;
  thisMonthCreditsGranted: boolean;
  thisMonthDisputeUsed: boolean;
  canUseAutoWinThisMonth: boolean;
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const user = session?.user;
  
  const [plusDetails, setPlusDetails] = useState<PlusDetails | null>(null);
  const [plusStats, setPlusStats] = useState<PlusStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      Promise.all([
        fetch(`/api/users/${user.id}/plus-status`).then(res => res.ok ? res.json() : null),
        fetch(`/api/users/${user.id}/plus-stats`).then(res => res.ok ? res.json() : null)
      ])
      .then(([details, stats]) => {
        setPlusDetails(details);
        setPlusStats(stats);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
    }
  }, [user?.id]);

  if (!user) {
    return <div>Please log in to view settings.</div>;
  }

  const subscription = plusDetails?.subscription ? {
    ...plusDetails.subscription,
    currentPeriodEnd: new Date(plusDetails.subscription.currentPeriodEnd)
  } : null;

  return (
    <div className="container max-w-4xl mx-auto py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="h-8 w-8" />
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-gray-600">Manage your account and preferences</p>
        </div>
      </div>

      <Tabs defaultValue="account" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="plus">Plus</TabsTrigger>
          <TabsTrigger value="business">Business</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="privacy">Privacy</TabsTrigger>
        </TabsList>

        {/* Account Tab */}
        <TabsContent value="account" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Profile Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center text-xl font-bold">
                    {(user.name ?? user.email ?? "?").slice(0, 2).toUpperCase()}
                  </div>
                  {plusDetails?.isActive && <PlusBadge variant="crown" size="sm" />}
                </div>
                <div>
                  <h3 className="text-lg font-semibold">{user.name || "No name set"}</h3>
                  <p className="text-gray-600">{user.email}</p>
                  {plusDetails?.isActive && <PlusBadge size="sm" className="mt-1" />}
                </div>
              </div>
              
              <Separator />
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Account Status:</span>
                  <Badge variant="outline" className="ml-2 bg-green-50 text-green-700">Active</Badge>
                </div>
                <div>
                  <span className="font-medium">Member Since:</span>
                  <span className="ml-2 text-gray-600">
                    {new Date(user.joinedAt || Date.now()).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Plus Tab */}
        <TabsContent value="plus" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-yellow-500" />
                FavorBank Plus
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <div className="text-center py-8">Loading Plus status...</div>
              ) : plusDetails?.isActive && subscription ? (
                <div className="space-y-4">
                  <PlusStatus 
                    isActive={true} 
                    subscription={subscription} 
                  />
                  
                  <Separator />
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <h4 className="font-medium flex items-center gap-2">
                        <CreditCard className="h-4 w-4" />
                        Active Benefits
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <span>💰</span>
                          <span>100 monthly credits</span>
                          {plusStats?.thisMonthCreditsGranted && (
                            <Badge variant="outline" className="bg-green-50 text-green-700">✓</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span>💳</span>
                          <span>No platform fees on purchases</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span>📅</span>
                          <span>2-week scheduling horizon</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span>⚡</span>
                          <span>Auto-win small disputes</span>
                          {plusStats?.canUseAutoWinThisMonth ? (
                            <Badge variant="outline" className="bg-blue-50 text-blue-700">Available</Badge>
                          ) : (
                            <Badge variant="outline" className="bg-gray-50 text-gray-600">Used</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <h4 className="font-medium flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        Usage Statistics
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Total Credit Grants:</span>
                          <span>{plusStats?.totalCreditGrants || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Auto-Win Disputes:</span>
                          <span>{plusStats?.totalAutoWinDisputes || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Subscription Status:</span>
                          <Badge variant="outline" className="bg-green-50 text-green-700">
                            {subscription.status}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <Separator />
                  
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      Manage Subscription
                    </Button>
                    <Button variant="outline" size="sm">
                      View Billing
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 space-y-4">
                  <div className="text-6xl">👑</div>
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Upgrade to FavorBank Plus</h3>
                    <p className="text-gray-600 mb-4">
                      Get premium benefits and enhance your FavorBank experience
                    </p>
                    <div className="space-y-2 text-sm text-left max-w-md mx-auto">
                      <div className="flex items-center gap-2">
                        <span>💰</span>
                        <span>100 monthly credits automatically added</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span>💳</span>
                        <span>No platform fees on credit purchases</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span>📅</span>
                        <span>Extended 2-week scheduling horizon</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span>⚡</span>
                        <span>Auto-win small disputes once per month</span>
                      </div>
                    </div>
                    <Button className="mt-4">
                      <Crown className="h-4 w-4 mr-2" />
                      Upgrade to Plus
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Business Tab */}
        <TabsContent value="business" className="space-y-6">
          <BusinessSettings />
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-6">
          <NotificationSettings />
        </TabsContent>

        {/* Privacy Tab */}
        <TabsContent value="privacy" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Privacy & Security
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">
                <Lock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Privacy settings coming soon</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function NotificationSettings() {
  const { data: session } = useSession();
  const user = session?.user;

  const [circles, setCircles] = useState<any[]>([]);
  const [prefs, setPrefs] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/circles');
        if (res.ok) {
          const data = await res.json();
          setCircles(data);
          // fetch prefs per circle
          const entries: Record<string, any> = {};
          await Promise.all(data.map(async (c: any) => {
            const r = await fetch(`/api/circles/${c.id}/notification-preferences`);
            const p = r.ok ? (await r.json()).preferences : null;
            entries[c.id] = p || { newOffers: true, bookingReminders: true, startFinishNudges: true, dailyEmail: true };
          }));
          setPrefs(entries);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.id]);

  const updatePref = async (circleId: string, key: string, value: boolean) => {
    setSaving(circleId + key);
    try {
      const res = await fetch(`/api/circles/${circleId}/notification-preferences`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [key]: value })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }
      setPrefs((prev) => ({ ...prev, [circleId]: { ...prev[circleId], [key]: value } }));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(null);
    }
  };

  const triggerTestToasts = async () => {
    const res = await fetch('/api/notifications/test', { method: 'POST' });
    if (res.ok) toast.success('Created test in-app notifications');
    else toast.error('Failed to create test notifications');
  };
  const triggerTestDigest = async () => {
    const res = await fetch('/api/notifications/digest/test', { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      toast.success('Test daily email generated');
      console.log('Digest preview:', data.preview);
    } else toast.error('Failed to trigger digest');
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification Preferences by Circle
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-gray-500">Loading…</div>
          ) : circles.length === 0 ? (
            <div className="text-gray-500">Join a circle to configure notifications.</div>
          ) : (
            <div className="space-y-4">
              {circles.map((c) => (
                <div key={c.id} className="border rounded-md p-3">
                  <div className="font-medium mb-2">{c.name}</div>
                  <div className="grid md:grid-cols-2 gap-3 text-sm">
                    <label className="flex items-center justify-between gap-3">
                      <span>New offers</span>
                      <Switch checked={!!prefs[c.id]?.newOffers} onCheckedChange={(v) => updatePref(c.id, 'newOffers', !!v)} disabled={saving !== null} />
                    </label>
                    <label className="flex items-center justify-between gap-3">
                      <span>Booking reminders</span>
                      <Switch checked={!!prefs[c.id]?.bookingReminders} onCheckedChange={(v) => updatePref(c.id, 'bookingReminders', !!v)} disabled={saving !== null} />
                    </label>
                    <label className="flex items-center justify-between gap-3">
                      <span>Start/finish nudges</span>
                      <Switch checked={!!prefs[c.id]?.startFinishNudges} onCheckedChange={(v) => updatePref(c.id, 'startFinishNudges', !!v)} disabled={saving !== null} />
                    </label>
                    <label className="flex items-center justify-between gap-3">
                      <span>Daily email digest</span>
                      <Switch checked={!!prefs[c.id]?.dailyEmail} onCheckedChange={(v) => updatePref(c.id, 'dailyEmail', !!v)} disabled={saving !== null} />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Test Notifications</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button variant="outline" onClick={triggerTestToasts}>Create Test Toasts</Button>
          <Button onClick={triggerTestDigest}>Send Test Daily Email</Button>
        </CardContent>
      </Card>
    </div>
  );
}

function BusinessSettings() {
  const { data: session } = useSession();
  const user = session?.user;

  const [loading, setLoading] = useState(true);
  const [sub, setSub] = useState<any | null>(null);
  const [businessCategories, setBusinessCategories] = useState<string[]>([]);
  const [companyName, setCompanyName] = useState("");
  const [defaultMemo, setDefaultMemo] = useState("");
  const [enabledCategories, setEnabledCategories] = useState<string[]>([]);

  const [exportMonth, setExportMonth] = useState<string>(() => new Date().toISOString().slice(0, 7));
  const [exportFormat, setExportFormat] = useState<"csv" | "pdf" | "concur" | "expensify">("csv");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);
    fetch('/api/business/subscription')
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to load subscription');
        return res.json();
      })
      .then((data) => {
        setSub(data.subscription);
        setBusinessCategories(data.businessCategories || []);
        if (data.subscription) {
          setCompanyName(data.subscription.companyName || "");
          setDefaultMemo(data.subscription.defaultMemo || "");
          setEnabledCategories(data.subscription.enabledCategories || []);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user?.id]);

  const toggleCategory = (cat: string) => {
    setEnabledCategories((prev) => 
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const createSubscription = async () => {
    if (!companyName || enabledCategories.length === 0) return;
    setLoading(true);
    try {
      const res = await fetch('/api/business/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName, enabledCategories, defaultMemo })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to enable business kit');
      setSub(data.subscription);
    } catch (e) {
      console.error(e);
      alert((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const updateSubscription = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/business/subscription', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName, enabledCategories, defaultMemo })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update subscription');
      setSub({ ...sub, ...data.subscription });
    } catch (e) {
      console.error(e);
      alert((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      if (exportFormat === 'csv') {
        const res = await fetch('/api/business/export', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ format: 'csv', month: exportMonth, includeDetails: true })
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Export failed');
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `business-expenses-${exportMonth}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } else {
        const res = await fetch('/api/business/export', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ format: exportFormat, month: exportMonth, includeDetails: true })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Export failed');
        // Download JSON stub
        const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `business-expenses-${exportMonth}-${exportFormat}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      console.error(e);
      alert((e as Error).message);
    } finally {
      setExporting(false);
    }
  };

  if (!user) return <div>Please log in to view settings.</div>;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            Business Expense Kit
            <Badge variant="secondary" className="ml-2">$199/year</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading ? (
            <div className="text-gray-500">Loading...</div>
          ) : sub?.status === 'ACTIVE' ? (
            <div className="space-y-5">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="companyName">Company name</Label>
                  <Input id="companyName" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="defaultMemo">Default memo</Label>
                  <Input id="defaultMemo" value={defaultMemo} onChange={(e) => setDefaultMemo(e.target.value)} placeholder="e.g., Client support services" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Allowed categories</Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {businessCategories.map((cat) => (
                    <label key={cat} className="flex items-center gap-2 border rounded-md px-3 py-2 bg-white">
                      <Checkbox checked={enabledCategories.includes(cat)} onCheckedChange={() => toggleCategory(cat)} />
                      <span className="text-sm">{cat.replace(/_/g, ' ')}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-gray-500">Only bookings in these categories can be tagged during checkout.</p>
              </div>
              <div className="flex gap-3">
                <Button onClick={updateSubscription} disabled={loading}>Save Changes</Button>
                <Badge variant="outline" className="self-center">Active · {sub.daysRemaining ?? ''} days left</Badge>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <p className="text-gray-700">Enable exports and expense tagging for business use. Tag eligible favors and export monthly reports as CSV/PDF or Concur/Expensify JSON.</p>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="companyName-new">Company name</Label>
                  <Input id="companyName-new" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Your company Inc." />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="defaultMemo-new">Default memo (optional)</Label>
                  <Input id="defaultMemo-new" value={defaultMemo} onChange={(e) => setDefaultMemo(e.target.value)} placeholder="e.g., Field operations support" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Select allowed categories</Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {businessCategories.map((cat) => (
                    <label key={cat} className="flex items-center gap-2 border rounded-md px-3 py-2 bg-white">
                      <Checkbox checked={enabledCategories.includes(cat)} onCheckedChange={() => toggleCategory(cat)} />
                      <span className="text-sm">{cat.replace(/_/g, ' ')}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <Button onClick={createSubscription} disabled={loading || !companyName || enabledCategories.length === 0}>
                  <CreditCard className="h-4 w-4 mr-2" />
                  Enable Business Expense Kit ($199/year)
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {sub?.status === 'ACTIVE' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Monthly Export
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-3 gap-4 items-end">
              <div className="space-y-2">
                <Label htmlFor="month">Month</Label>
                <Input id="month" type="month" value={exportMonth} onChange={(e) => setExportMonth(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Format</Label>
                <Select value={exportFormat} onValueChange={(v) => setExportFormat(v as any)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="csv">CSV</SelectItem>
                    <SelectItem value="pdf">PDF (stub JSON)</SelectItem>
                    <SelectItem value="concur">Concur JSON</SelectItem>
                    <SelectItem value="expensify">Expensify JSON</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="invisible">Export</Label>
                <Button onClick={handleExport} disabled={exporting} className="w-full">
                  <Download className="h-4 w-4 mr-2" />
                  {exporting ? 'Exporting…' : 'Export'}
                </Button>
              </div>
            </div>
            <p className="text-xs text-gray-500">CSV downloads directly. Other formats provide JSON stubs for integration.</p>
          </CardContent>
        </Card>
      )}
    </>
  );
}
