"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FeeChips } from "@/components/fees/FeeChips";
import { FeesContext } from "@/lib/fees/context";
import { format } from "date-fns";
import { 
  Calculator, TestTube, Clock, DollarSign, 
  AlertCircle, Info, Zap, Calendar
} from "lucide-react";
import { toast } from "sonner";

interface LedgerEntry {
  id: string;
  timestamp: string;
  amount: number;
  meta: any;
}

export default function FeesTestPage() {
  const [baseAmount, setBaseAmount] = useState(100);
  const [startTime, setStartTime] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(18, 0, 0, 0); // 6 PM tomorrow
    return format(tomorrow, "yyyy-MM-dd'T'HH:mm");
  });
  
  const [duration, setDuration] = useState(60);
  const [category, setCategory] = useState("HOUSEHOLD_TASKS");
  const [isUrgent, setIsUrgent] = useState(false);
  const [needsEquipment, setNeedsEquipment] = useState(false);
  const [isGuaranteed, setIsGuaranteed] = useState(false);
  const [crossCircle, setCrossCircle] = useState(false);
  
  const [feeCalculation, setFeeCalculation] = useState<any>(null);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const calculateFees = () => {
    const startDate = new Date(startTime);
    const endDate = new Date(startDate.getTime() + duration * 60 * 1000);
    
    const bookingContext = {
      startTime: startDate,
      endTime: endDate,
      duration,
      category,
      location: "Test Location",
      requirements: "Test requirements",
      isUrgent,
      needsEquipment,
      isGuaranteed,
      crossCircle,
      providerId: "test-provider",
      bookerId: "test-booker",
      circleId: "test-circle"
    };

    const calculation = FeesContext.calculateFees(baseAmount, bookingContext);
    const breakdown = FeesContext.getFeeBreakdown(calculation);
    setFeeCalculation(breakdown);
  };

  const testLedgerEntry = async () => {
    if (!feeCalculation) {
      toast.error("Calculate fees first!");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/test/fees-ledger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseAmount,
          feeBreakdown: feeCalculation,
          testBookingId: `test-booking-${Date.now()}`
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to test ledger entry");
      }

      const result = await response.json();
      toast.success("Ledger entry created successfully!");
      
      // Fetch updated ledger entries
      fetchLedgerEntries();
    } catch (error: any) {
      toast.error(error.message || "Failed to test ledger entry");
    } finally {
      setLoading(false);
    }
  };

  const fetchLedgerEntries = async () => {
    try {
      const response = await fetch("/api/test/fees-ledger");
      if (response.ok) {
        const entries = await response.json();
        setLedgerEntries(entries);
      }
    } catch (error) {
      console.error("Error fetching ledger entries:", error);
    }
  };

  // Auto-calculate fees when options change
  useEffect(() => {
    calculateFees();
  }, [baseAmount, startTime, duration, category, isUrgent, needsEquipment, isGuaranteed, crossCircle]);

  const isWeekend = () => {
    const day = new Date(startTime).getDay();
    return day === 0 || day === 6;
  };

  const isPeakHours = () => {
    const hour = new Date(startTime).getHours();
    const day = new Date(startTime).getDay();
    const weekend = day === 0 || day === 6;
    
    if (weekend) {
      return hour >= 9 && hour < 18; // 9 AM - 6 PM weekends
    } else {
      return hour >= 17 && hour < 20; // 5 PM - 8 PM weekdays
    }
  };

  const isSpecialized = () => {
    return ["TECH_SUPPORT", "TUTORING", "ELDERCARE", "CHILDCARE"].includes(category);
  };

  const isWithin24Hours = () => {
    const now = new Date();
    const start = new Date(startTime);
    const hoursUntil = (start.getTime() - now.getTime()) / (1000 * 60 * 60);
    return hoursUntil < 24;
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center gap-3">
        <TestTube className="h-8 w-8 text-blue-600" />
        <div>
          <h1 className="text-3xl font-bold">Dynamic Fees Test</h1>
          <p className="text-gray-600">Test the dynamic fees engine and ledger integration</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Test Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Test Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="baseAmount">Base Amount (credits)</Label>
                <Input
                  id="baseAmount"
                  type="number"
                  value={baseAmount}
                  onChange={(e) => setBaseAmount(parseInt(e.target.value) || 0)}
                  min={1}
                />
              </div>
              
              <div>
                <Label htmlFor="duration">Duration (minutes)</Label>
                <Input
                  id="duration"
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(parseInt(e.target.value) || 0)}
                  min={5}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="startTime">Start Time</Label>
              <Input
                id="startTime"
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="category">Category</Label>
              <select 
                id="category"
                className="w-full p-2 border rounded-md"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="HOUSEHOLD_TASKS">Household Tasks</option>
                <option value="TECH_SUPPORT">Tech Support</option>
                <option value="TUTORING">Tutoring</option>
                <option value="ELDERCARE">Elder Care</option>
                <option value="CHILDCARE">Child Care</option>
                <option value="YARD_WORK">Yard Work</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <Separator />

            <div className="space-y-3">
              <h4 className="font-medium">Service Options</h4>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="urgent"
                    checked={isUrgent}
                    onCheckedChange={(checked) => setIsUrgent(checked as boolean)}
                  />
                  <Label htmlFor="urgent" className="text-sm">Urgent (+15%)</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="equipment"
                    checked={needsEquipment}
                    onCheckedChange={(checked) => setNeedsEquipment(checked as boolean)}
                  />
                  <Label htmlFor="equipment" className="text-sm">Equipment (+8%)</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="guaranteed"
                    checked={isGuaranteed}
                    onCheckedChange={(checked) => setIsGuaranteed(checked as boolean)}
                  />
                  <Label htmlFor="guaranteed" className="text-sm">Guaranteed (+12%)</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="crossCircle"
                    checked={crossCircle}
                    onCheckedChange={(checked) => setCrossCircle(checked as boolean)}
                  />
                  <Label htmlFor="crossCircle" className="text-sm">Cross-Circle (+5%)</Label>
                </div>
              </div>
            </div>

            {/* Automatic Conditions */}
            <div className="space-y-2 p-3 bg-gray-50 rounded-lg">
              <h5 className="font-medium text-sm">Automatic Conditions:</h5>
              <div className="space-y-1 text-xs">
                {isWeekend() && <Badge variant="outline">Weekend (+6%)</Badge>}
                {isPeakHours() && <Badge variant="outline">Peak Hours (+10%)</Badge>}
                {isSpecialized() && <Badge variant="outline">Specialized (+7%)</Badge>}
                {isWithin24Hours() && <Badge variant="outline">Auto-Urgent (&lt; 24h)</Badge>}
              </div>
            </div>

            <Button onClick={calculateFees} className="w-full">
              <Calculator className="h-4 w-4 mr-2" />
              Calculate Fees
            </Button>
          </CardContent>
        </Card>

        {/* Fee Results */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Fee Calculation Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            {feeCalculation ? (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-700">{baseAmount}</div>
                    <div className="text-xs text-blue-600">Base</div>
                  </div>
                  <div className="p-3 bg-orange-50 rounded-lg">
                    <div className="text-2xl font-bold text-orange-700">+{feeCalculation.totalSurcharge}</div>
                    <div className="text-xs text-orange-600">Fees</div>
                  </div>
                  <div className="p-3 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-700">{feeCalculation.finalAmount}</div>
                    <div className="text-xs text-green-600">Total</div>
                  </div>
                </div>

                {feeCalculation.fees.length > 0 && (
                  <FeeChips 
                    feeBreakdown={feeCalculation}
                    showDetails={true}
                  />
                )}

                <Button 
                  onClick={testLedgerEntry}
                  disabled={loading}
                  className="w-full"
                  variant="outline"
                >
                  {loading ? (
                    <>
                      <Clock className="h-4 w-4 mr-2 animate-spin" />
                      Testing Ledger...
                    </>
                  ) : (
                    <>
                      <TestTube className="h-4 w-4 mr-2" />
                      Test Ledger Entry
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div className="text-center text-gray-500 py-8">
                <Calculator className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Click "Calculate Fees" to see results</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Ledger Entries */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            Recent Ledger Entries
            <Button 
              onClick={fetchLedgerEntries}
              size="sm"
              variant="outline"
            >
              Refresh
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {ledgerEntries.length > 0 ? (
            <div className="space-y-2">
              {ledgerEntries.map((entry) => (
                <div key={entry.id} className="p-3 border rounded-lg text-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium">Fee Surcharge: {entry.amount} credits</div>
                      <div className="text-gray-600 text-xs">
                        {format(new Date(entry.timestamp), "MMM d, yyyy 'at' h:mm a")}
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline">
                        {entry.meta?.transactionType || "booking"}
                      </Badge>
                    </div>
                  </div>
                  {entry.meta?.feesApplied && (
                    <div className="mt-2 text-xs text-gray-500">
                      Fees: {entry.meta.feesApplied.map((fee: any) => `${fee.name} +${fee.percentage}%`).join(", ")}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-500 py-8">
              <Info className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No ledger entries yet. Test the fee calculation to create entries.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}