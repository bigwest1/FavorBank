"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  DollarSign, Star, TrendingUp, Clock, CheckCircle, 
  AlertCircle, Calendar, CreditCard, Award
} from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";

interface ProDashboardData {
  proProfile: any;
  stats: {
    totalEarnings: number;
    pendingEarnings: number;
    completedBookings: number;
    averageBonus: number;
  };
  recentBonuses: any[];
  payoutHistory: any[];
  skillVerifications: any[];
}

export default function ProDashboardPage() {
  const [data, setData] = useState<ProDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await fetch("/api/pro/dashboard");
      if (!response.ok) {
        throw new Error("Failed to load dashboard data");
      }
      const dashboardData = await response.json();
      setData(dashboardData);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container max-w-6xl mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center space-y-4">
            <Clock className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
            <p>Loading your Pro dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container max-w-6xl mx-auto p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error || "No Pro profile found. "}
            <Link href="/pro/signup" className="underline font-medium">
              Apply for Pro membership
            </Link>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "APPROVED": return "bg-green-100 text-green-800";
      case "PENDING": return "bg-yellow-100 text-yellow-800";
      case "REJECTED": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getPayoutStatusColor = (status: string) => {
    switch (status) {
      case "COMPLETED": return "text-green-600";
      case "PROCESSING": return "text-blue-600";
      case "FAILED": return "text-red-600";
      default: return "text-yellow-600";
    }
  };

  return (
    <div className="container max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Star className="h-6 w-6 text-yellow-500" />
            Pro Dashboard
          </h1>
          <p className="text-gray-600">Track your earnings and Pro status</p>
        </div>
        
        <Badge className={`${getStatusColor(data.proProfile.status)} text-sm px-3 py-1`}>
          {data.proProfile.status}
        </Badge>
      </div>

      {/* Status Alert */}
      {data.proProfile.status !== "APPROVED" && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {data.proProfile.status === "PENDING" && (
              <>Your Pro application is under review. You'll be notified when approved.</>
            )}
            {data.proProfile.status === "REJECTED" && (
              <>Your Pro application was not approved. Contact support for more information.</>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Earnings Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Earnings</p>
                <p className="text-2xl font-bold text-green-600">
                  ${(data.stats.totalEarnings / 100).toFixed(2)}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pending Earnings</p>
                <p className="text-2xl font-bold text-yellow-600">
                  ${(data.stats.pendingEarnings / 100).toFixed(2)}
                </p>
              </div>
              <Clock className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Completed Bookings</p>
                <p className="text-2xl font-bold">{data.stats.completedBookings}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Bonus</p>
                <p className="text-2xl font-bold">
                  ${(data.stats.averageBonus / 100).toFixed(2)}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="bonuses" className="space-y-6">
        <TabsList>
          <TabsTrigger value="bonuses">Recent Bonuses</TabsTrigger>
          <TabsTrigger value="payouts">Payout History</TabsTrigger>
          <TabsTrigger value="skills">Skills</TabsTrigger>
        </TabsList>

        <TabsContent value="bonuses" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent Cash Bonuses</CardTitle>
              <CardDescription>
                15% cash bonuses earned from completed bookings
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.recentBonuses.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  No bonuses earned yet. Complete some bookings to start earning!
                </p>
              ) : (
                <div className="space-y-4">
                  {data.recentBonuses.map((bonus: any) => (
                    <div key={bonus.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-1">
                        <p className="font-medium">Booking #{bonus.booking.id.slice(-8)}</p>
                        <p className="text-sm text-gray-600">
                          {format(new Date(bonus.accrualDate), "MMM d, yyyy 'at' h:mm a")}
                        </p>
                        <p className="text-xs text-gray-500">
                          Base: {bonus.baseAmount} credits • Bonus Rate: {(bonus.bonusRate * 100)}%
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-green-600">
                          +${(bonus.bonusAmount / 100).toFixed(2)}
                        </p>
                        {bonus.payoutId ? (
                          <Badge variant="outline" className="text-xs mt-1">
                            Paid Out
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs mt-1">
                            Pending
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payouts" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Payout History</CardTitle>
              <CardDescription>
                Weekly payouts via Stripe Connect
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.payoutHistory.length === 0 ? (
                <div className="text-center py-8 space-y-4">
                  <CreditCard className="h-12 w-12 text-gray-400 mx-auto" />
                  <p className="text-gray-500">
                    No payouts yet. Payouts are processed weekly for bonuses over $10.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {data.payoutHistory.map((payout: any) => (
                    <div key={payout.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-1">
                        <p className="font-medium flex items-center gap-2">
                          Week of {format(new Date(payout.weekStartDate), "MMM d")}
                          <Badge variant="outline" className="text-xs">
                            {payout.bonusCount} bonuses
                          </Badge>
                        </p>
                        <p className="text-sm text-gray-600">
                          {payout.processedAt && format(new Date(payout.processedAt), "MMM d, yyyy")}
                        </p>
                        {payout.stripeTransferId && (
                          <p className="text-xs text-gray-500 font-mono">
                            {payout.stripeTransferId}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-lg">
                          ${(payout.totalAmount / 100).toFixed(2)}
                        </p>
                        <p className={`text-sm font-medium ${getPayoutStatusColor(payout.status)}`}>
                          {payout.status}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="skills" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Skill Verifications</CardTitle>
              <CardDescription>
                Your verified professional skills
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.skillVerifications.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  No skills verified yet.
                </p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {data.skillVerifications.map((skill: any) => (
                    <div key={skill.id} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-medium text-sm">{skill.skill}</p>
                        <Badge 
                          variant={skill.status === "VERIFIED" ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {skill.status}
                        </Badge>
                      </div>
                      {skill.verifiedAt && (
                        <p className="text-xs text-gray-500">
                          Verified {format(new Date(skill.verifiedAt), "MMM d, yyyy")}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Quick Actions */}
      {data.proProfile.status === "APPROVED" && (
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <Button asChild>
                <Link href="/dashboard">
                  Create New Slot
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/circles">
                  Browse Circles
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}