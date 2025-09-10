"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  DollarSign, Users, TrendingUp, Settings, Clock, 
  AlertCircle, CheckCircle, CreditCard, ArrowUp
} from "lucide-react";
import { format } from "date-fns";
import { loadStripe } from "@stripe/stripe-js";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface TreasuryData {
  circle: {
    id: string;
    name: string;
    ownerId: string;
  };
  treasury: {
    id: string;
    currentBalance: number;
    totalFunded: number;
    totalDistributed: number;
    totalMatched: number;
    monthlyAllowanceTotal: number;
    allowancePerMember: number;
    isAllowanceActive: boolean;
    isMatchingActive: boolean;
    matchRatio: number;
    maxMatchPerBooking?: number;
    lastDistribution?: string;
    fundingTransactions: any[];
    allowanceDistributions: any[];
  } | null;
  memberCount: number;
  canManage: boolean;
  userRole: string;
}

export default function TreasuryPage() {
  const params = useParams();
  const circleId = params.id as string;
  
  const [data, setData] = useState<TreasuryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Form states
  const [fundingAmount, setFundingAmount] = useState("");
  const [fundingNotes, setFundingNotes] = useState("");
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  
  // Settings
  const [settings, setSettings] = useState({
    monthlyAllowanceTotal: 0,
    allowancePerMember: 0,
    isAllowanceActive: false,
    isMatchingActive: false,
    matchRatio: 1.0,
    maxMatchPerBooking: ""
  });

  useEffect(() => {
    fetchTreasuryData();
  }, [circleId]);

  useEffect(() => {
    if (data?.treasury) {
      setSettings({
        monthlyAllowanceTotal: data.treasury.monthlyAllowanceTotal,
        allowancePerMember: data.treasury.allowancePerMember,
        isAllowanceActive: data.treasury.isAllowanceActive,
        isMatchingActive: data.treasury.isMatchingActive,
        matchRatio: data.treasury.matchRatio,
        maxMatchPerBooking: data.treasury.maxMatchPerBooking?.toString() || ""
      });
    }
  }, [data]);

  const fetchTreasuryData = async () => {
    try {
      const response = await fetch(`/api/circles/${circleId}/treasury`);
      if (!response.ok) {
        throw new Error("Failed to load treasury data");
      }
      const treasuryData = await response.json();
      setData(treasuryData);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFunding = async () => {
    if (!fundingAmount || parseFloat(fundingAmount) < 0.50) {
      alert("Minimum funding amount is $0.50");
      return;
    }

    setIsProcessingPayment(true);
    try {
      const amountCents = Math.round(parseFloat(fundingAmount) * 100);
      
      const response = await fetch(`/api/circles/${circleId}/treasury/fund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountCents,
          notes: fundingNotes || null
        })
      });

      if (!response.ok) {
        throw new Error("Failed to create funding request");
      }

      const { paymentIntent, creditAmount } = await response.json();
      
      const stripe = await stripePromise;
      const { error: stripeError } = await stripe!.confirmPayment({
        clientSecret: paymentIntent.clientSecret,
        elements: null,
        confirmParams: {
          return_url: `${window.location.origin}/circles/${circleId}/treasury?funded=true`,
        },
        redirect: "if_required"
      });

      if (stripeError) {
        throw new Error(stripeError.message);
      }

      // Payment succeeded
      setFundingAmount("");
      setFundingNotes("");
      await fetchTreasuryData(); // Refresh data
      alert(`Successfully added ${creditAmount} credits to treasury!`);

    } catch (error: any) {
      alert(`Funding failed: ${error.message}`);
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleSettingsUpdate = async () => {
    try {
      const response = await fetch(`/api/circles/${circleId}/treasury`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...settings,
          maxMatchPerBooking: settings.maxMatchPerBooking ? parseInt(settings.maxMatchPerBooking) : null
        })
      });

      if (!response.ok) {
        throw new Error("Failed to update settings");
      }

      await fetchTreasuryData();
      alert("Settings updated successfully!");

    } catch (error: any) {
      alert(`Update failed: ${error.message}`);
    }
  };

  if (loading) {
    return (
      <div className="container max-w-6xl mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center space-y-4">
            <Clock className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
            <p>Loading treasury...</p>
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
            {error || "Failed to load treasury data"}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "COMPLETED": return "bg-green-100 text-green-800";
      case "PENDING": case "PROCESSING": return "bg-yellow-100 text-yellow-800";
      case "FAILED": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="container max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-green-600" />
            Treasury - {data.circle.name}
          </h1>
          <p className="text-gray-600">Manage circle funding, allowances, and credit matching</p>
        </div>

        {!data.canManage && (
          <Badge variant="outline">View Only</Badge>
        )}
      </div>

      {!data.treasury && data.canManage && (
        <Alert>
          <Settings className="h-4 w-4" />
          <AlertDescription>
            No treasury configured yet. Update settings below to create one.
          </AlertDescription>
        </Alert>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Current Balance</p>
                <p className="text-2xl font-bold text-green-600">
                  {data.treasury?.currentBalance || 0}
                </p>
                <p className="text-xs text-gray-500">credits available</p>
              </div>
              <CreditCard className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Funded</p>
                <p className="text-2xl font-bold">
                  {data.treasury?.totalFunded || 0}
                </p>
                <p className="text-xs text-gray-500">credits purchased</p>
              </div>
              <ArrowUp className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Members</p>
                <p className="text-2xl font-bold">{data.memberCount}</p>
                <p className="text-xs text-gray-500">active members</p>
              </div>
              <Users className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Match Ratio</p>
                <p className="text-2xl font-bold">
                  {data.treasury?.matchRatio ? `${data.treasury.matchRatio}:1` : "0:1"}
                </p>
                <p className="text-xs text-gray-500">
                  {data.treasury?.isMatchingActive ? "Active" : "Inactive"}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="funding" className="space-y-6">
        <TabsList>
          <TabsTrigger value="funding">Funding</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="funding" className="space-y-6">
          {data.canManage ? (
            <Card>
              <CardHeader>
                <CardTitle>Add Funds via Stripe</CardTitle>
                <CardDescription>
                  Add credits to the treasury. $1.00 = 100 credits
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="amount">Amount (USD)</Label>
                    <Input
                      id="amount"
                      type="number"
                      min="0.50"
                      step="0.01"
                      placeholder="25.00"
                      value={fundingAmount}
                      onChange={(e) => setFundingAmount(e.target.value)}
                    />
                    {fundingAmount && (
                      <p className="text-sm text-gray-500 mt-1">
                        = {Math.round(parseFloat(fundingAmount || "0") * 100)} credits
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="notes">Notes (optional)</Label>
                    <Input
                      id="notes"
                      placeholder="Purpose of funding..."
                      value={fundingNotes}
                      onChange={(e) => setFundingNotes(e.target.value)}
                    />
                  </div>
                </div>

                <Button 
                  onClick={handleFunding}
                  disabled={!fundingAmount || isProcessingPayment}
                  className="w-full"
                >
                  {isProcessingPayment ? "Processing..." : "Add Funds"}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Only treasury administrators can add funds.
              </AlertDescription>
            </Alert>
          )}

          {/* Recent Funding Transactions */}
          {data.treasury?.fundingTransactions && data.treasury.fundingTransactions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recent Funding</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data.treasury.fundingTransactions.map((transaction: any) => (
                    <div key={transaction.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-1">
                        <p className="font-medium">
                          ${(transaction.amountCents / 100).toFixed(2)} → {transaction.creditAmount} credits
                        </p>
                        <p className="text-sm text-gray-600">
                          {format(new Date(transaction.createdAt), "MMM d, yyyy 'at' h:mm a")}
                        </p>
                        {transaction.notes && (
                          <p className="text-xs text-gray-500">{transaction.notes}</p>
                        )}
                      </div>
                      <Badge className={getStatusColor(transaction.status)}>
                        {transaction.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          {data.canManage ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Monthly Allowances</CardTitle>
                  <CardDescription>
                    Automatically distribute credits to members each month
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={settings.isAllowanceActive}
                      onCheckedChange={(checked) => 
                        setSettings(prev => ({ ...prev, isAllowanceActive: checked }))
                      }
                    />
                    <Label>Enable monthly allowances</Label>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="allowancePerMember">Credits per member</Label>
                      <Input
                        id="allowancePerMember"
                        type="number"
                        min="0"
                        value={settings.allowancePerMember}
                        onChange={(e) => setSettings(prev => ({ 
                          ...prev, 
                          allowancePerMember: parseInt(e.target.value) || 0 
                        }))}
                      />
                    </div>

                    <div>
                      <Label>Monthly total</Label>
                      <div className="p-2 bg-gray-50 rounded">
                        {settings.allowancePerMember * data.memberCount} credits
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Credit Matching</CardTitle>
                  <CardDescription>
                    Match credits earned from completed favors to encourage participation
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={settings.isMatchingActive}
                      onCheckedChange={(checked) => 
                        setSettings(prev => ({ ...prev, isMatchingActive: checked }))
                      }
                    />
                    <Label>Enable credit matching</Label>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="matchRatio">Match ratio</Label>
                      <Input
                        id="matchRatio"
                        type="number"
                        min="0"
                        step="0.1"
                        value={settings.matchRatio}
                        onChange={(e) => setSettings(prev => ({ 
                          ...prev, 
                          matchRatio: parseFloat(e.target.value) || 0 
                        }))}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        {settings.matchRatio}:1 (treasury pays {settings.matchRatio} credits for every 1 earned)
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="maxMatch">Max match per booking (optional)</Label>
                      <Input
                        id="maxMatch"
                        type="number"
                        min="0"
                        placeholder="No limit"
                        value={settings.maxMatchPerBooking}
                        onChange={(e) => setSettings(prev => ({ 
                          ...prev, 
                          maxMatchPerBooking: e.target.value 
                        }))}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Button onClick={handleSettingsUpdate} className="w-full">
                Update Settings
              </Button>
            </>
          ) : (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Only treasury administrators can modify settings.
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Transaction History</CardTitle>
              <CardDescription>
                Recent treasury activity and distributions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-500 text-center py-8">
                Transaction history will be displayed here
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Button 
              variant={data.treasury && data.canManage ? "default" : "outline"}
              onClick={() => data.canManage && window.alert("Distribution functionality will be added")}
            >
              Distribute This Month's Allowances
            </Button>
            <Button 
              variant="outline"
              onClick={() => window.alert("Reports functionality will be expanded")}
            >
              Export Reports
            </Button>
            <Button 
              variant="outline"
              onClick={() => window.alert("Advanced analytics coming soon")}
            >
              View Analytics
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">
                    {data.treasury?.totalMatched || 0}
                  </p>
                  <p className="text-sm text-gray-600">Credits Matched</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">
                    {data.treasury?.totalDistributed || 0}
                  </p>
                  <p className="text-sm text-gray-600">Allowances Distributed</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-orange-600">
                    {data.treasury?.totalFunded ? 
                      Math.round((data.treasury.totalDistributed + data.treasury.totalMatched) / 
                      data.treasury.totalFunded * 100) : 0}%
                  </p>
                  <p className="text-sm text-gray-600">Treasury Utilization</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-purple-600">
                    {data.memberCount}
                  </p>
                  <p className="text-sm text-gray-600">Active Members</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Treasury Health</CardTitle>
              <CardDescription>
                Budget status and financial health indicators
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span>Current Balance</span>
                  <span className="font-bold">{data.treasury?.currentBalance || 0} credits</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span>Monthly Allowance Budget</span>
                  <span className="font-bold">
                    {(data.treasury?.allowancePerMember || 0) * data.memberCount} credits
                  </span>
                </div>

                {data.treasury?.isMatchingActive && (
                  <div className="flex justify-between items-center">
                    <span>Match Ratio</span>
                    <span className="font-bold">{data.treasury.matchRatio}:1</span>
                  </div>
                )}

                <div className="pt-4 border-t">
                  <div className="flex justify-between items-center text-sm text-gray-600">
                    <span>Status</span>
                    <Badge variant={
                      (data.treasury?.currentBalance || 0) > 0 ? "default" : "destructive"
                    }>
                      {(data.treasury?.currentBalance || 0) > 0 ? "Funded" : "Needs Funding"}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}