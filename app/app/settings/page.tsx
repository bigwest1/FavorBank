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
  Settings, Bell, Lock, Palette
} from "lucide-react";

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
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="plus">Plus</TabsTrigger>
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

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notification Preferences
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">
                <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Notification settings coming soon</p>
              </div>
            </CardContent>
          </Card>
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