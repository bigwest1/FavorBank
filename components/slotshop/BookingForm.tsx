"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Clock, DollarSign, AlertCircle, Info, CheckCircle,
  Zap, Wrench, RefreshCw, Shield, Calendar
} from "lucide-react";
import { FeeChips, FeeSummary } from "@/components/fees/FeeChips";
import { FeesContext } from "@/lib/fees/context";
import { toast } from "sonner";

interface Slot {
  id: string;
  title: string;
  description: string | null;
  category: string;
  start: string;
  end: string;
  location: string | null;
  pricePerMinute: number;
  minDuration: number;
  maxDuration: number | null;
  provider: {
    id: string;
    name: string;
  };
  circleId: string;
}

interface BookingFormProps {
  slot: Slot;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function BookingForm({ slot, onSuccess, onCancel, isPublicGood = false }: BookingFormProps & { isPublicGood?: boolean }) {
  const [duration, setDuration] = useState(slot.minDuration);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  
  // Fee-related state
  const [isUrgent, setIsUrgent] = useState(false);
  const [needsEquipment, setNeedsEquipment] = useState(false);
  const [isGuaranteed, setIsGuaranteed] = useState(false);
  const [crossCircle, setCrossCircle] = useState(false);
  const [wantInsurance, setWantInsurance] = useState(false);
  
  // Business expense state
  const [isBusinessExpense, setIsBusinessExpense] = useState(false);
  const [businessMemo, setBusinessMemo] = useState("");
  const [businessSubscription, setBusinessSubscription] = useState<any>(null);
  
  const [feeCalculation, setFeeCalculation] = useState<any>(null);
  
  // Safety checklist for heavy categories
  const HEAVY_CATEGORIES = new Set(["MOVING", "FURNITURE", "MAINTENANCE"]);
  const requiresSafety = HEAVY_CATEGORIES.has(slot.category);
  const [safetyChecked, setSafetyChecked] = useState(false);

  // Calculate slot duration and cost
  const slotDuration = Math.round(
    (new Date(slot.end).getTime() - new Date(slot.start).getTime()) / (1000 * 60)
  );
  const maxBookingDuration = slot.maxDuration ? Math.min(slot.maxDuration, slotDuration) : slotDuration;
  const baseAmount = duration * slot.pricePerMinute;

  // Load business subscription on mount
  useEffect(() => {
    fetchBusinessSubscription();
  }, []);
  
  // Calculate fees whenever options change
  useEffect(() => {
    calculateFees();
  }, [duration, isUrgent, needsEquipment, isGuaranteed, crossCircle, wantInsurance]);

  const fetchBusinessSubscription = async () => {
    try {
      const response = await fetch('/api/business/subscription');
      if (response.ok) {
        const data = await response.json();
        if (data.subscription?.status === 'ACTIVE') {
          setBusinessSubscription(data.subscription);
          // Pre-fill memo with default if available
          if (data.subscription.defaultMemo && !businessMemo) {
            setBusinessMemo(data.subscription.defaultMemo);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching business subscription:', error);
    }
  };

  const calculateFees = () => {
    const now = new Date();
    const startTime = new Date(slot.start);
    
    // Check if booking is within 24 hours (auto-urgent)
    const hoursUntilBooking = (startTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    const autoUrgent = hoursUntilBooking < 24;

    const bookingContext = {
      startTime: startTime,
      endTime: new Date(slot.end),
      duration: duration,
      category: slot.category,
      location: slot.location || undefined,
      requirements: notes,
      isUrgent: isUrgent || autoUrgent,
      needsEquipment,
      isGuaranteed,
      crossCircle,
      providerId: slot.provider.id,
      bookerId: "", // Will be set by API
      circleId: slot.circleId
    };

    const calculation = FeesContext.calculateFees(baseAmount, bookingContext);
    const breakdown = FeesContext.getFeeBreakdown(calculation) as any;
    
    // Add Public Good community fee for display
    if (isPublicGood) {
      const pgAmount = Math.floor(baseAmount * 0.15);
      breakdown.fees = [
        ...breakdown.fees,
        {
          id: 'public_good',
          name: 'Public Good',
          icon: '🤝',
          description: 'Community fee for city-wide favors',
          percentage: 15,
          amount: pgAmount,
          displayText: '🤝 Public Good +15%'
        }
      ];
      breakdown.totalSurcharge += pgAmount;
      breakdown.totalPercentage = Math.round((breakdown.totalSurcharge / baseAmount) * 100);
      breakdown.finalAmount += pgAmount;
    }

    // Add insurance cost if selected
    if (wantInsurance && isInsuranceEligible()) {
      breakdown.insuranceCost = 2;
      breakdown.finalAmount += 2;
    }
    
    setFeeCalculation(breakdown);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (requiresSafety && !safetyChecked) {
      toast.error("Please acknowledge the safety checklist first");
      return;
    }
    setLoading(true);

    try {
      const response = await fetch(`/api/slots/${slot.id}/book`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          duration,
          notes,
          // Include fee context for server-side calculation
          feeContext: {
            isUrgent,
            needsEquipment,
            isGuaranteed,
            crossCircle
          },
          wantInsurance,
          // Business expense data
          isBusinessExpense: isBusinessExpense && isBusinessExpenseEligible(),
          businessMemo: isBusinessExpense ? businessMemo : undefined,
          // Mark Public Good bookings
          isPublicGood
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to book slot");
      }

      toast.success("Slot booked successfully!");
      onSuccess?.();
    } catch (error: any) {
      toast.error(error.message || "Failed to book slot");
    } finally {
      setLoading(false);
    }
  };

  const isWeekendBooking = () => {
    const day = new Date(slot.start).getDay();
    return day === 0 || day === 6;
  };

  const isPeakHours = () => {
    const hour = new Date(slot.start).getHours();
    const day = new Date(slot.start).getDay();
    const isWeekend = day === 0 || day === 6;
    
    if (isWeekend) {
      return hour >= 9 && hour < 18; // 9 AM - 6 PM weekends
    } else {
      return hour >= 17 && hour < 20; // 5 PM - 8 PM weekdays
    }
  };

  const isSpecializedCategory = () => {
    const specialized = ["TECH_SUPPORT", "TUTORING", "ELDERCARE", "CHILDCARE"];
    return specialized.includes(slot.category);
  };

  const isInsuranceEligible = () => {
    return slot.category === "MOVING" || slot.category === "FURNITURE";
  };

  const isBusinessExpenseEligible = () => {
    if (!businessSubscription) return false;
    const enabledCategories = businessSubscription.enabledCategories || [];
    return enabledCategories.includes(slot.category);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Book This Slot
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Duration Selection */}
          <div className="space-y-2">
            <Label htmlFor="duration">Duration (minutes)</Label>
            <div className="flex items-center gap-2">
              <Input
                id="duration"
                type="number"
                min={slot.minDuration}
                max={maxBookingDuration}
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value) || slot.minDuration)}
                className="w-24"
              />
              <span className="text-sm text-gray-600">
                ({slot.minDuration} - {maxBookingDuration} min available)
              </span>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              placeholder="Any specific requirements or details..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
              className="h-20"
            />
          </div>
        </CardContent>
      </Card>

      {/* Service Options */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            Service Options
            <Badge variant="outline" className="text-xs">
              Affects pricing
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-start space-x-2">
              <Checkbox
                id="urgent"
                checked={isUrgent}
                onCheckedChange={(checked) => setIsUrgent(checked as boolean)}
              />
              <div className="grid gap-1.5 leading-none">
                <Label htmlFor="urgent" className="flex items-center gap-1">
                  <Zap className="h-3 w-3" />
                  Urgent Service
                </Label>
                <p className="text-xs text-muted-foreground">
                  Priority handling (+15% fee)
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-2">
              <Checkbox
                id="equipment"
                checked={needsEquipment}
                onCheckedChange={(checked) => setNeedsEquipment(checked as boolean)}
              />
              <div className="grid gap-1.5 leading-none">
                <Label htmlFor="equipment" className="flex items-center gap-1">
                  <Wrench className="h-3 w-3" />
                  Equipment Needed
                </Label>
                <p className="text-xs text-muted-foreground">
                  Special tools/supplies (+8% fee)
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-2">
              <Checkbox
                id="guaranteed"
                checked={isGuaranteed}
                onCheckedChange={(checked) => setIsGuaranteed(checked as boolean)}
              />
              <div className="grid gap-1.5 leading-none">
                <Label htmlFor="guaranteed" className="flex items-center gap-1">
                  <Shield className="h-3 w-3" />
                  Service Guarantee
                </Label>
                <p className="text-xs text-muted-foreground">
                  Completion assured (+12% fee)
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-2">
              <Checkbox
                id="crossCircle"
                checked={crossCircle}
                onCheckedChange={(checked) => setCrossCircle(checked as boolean)}
              />
              <div className="grid gap-1.5 leading-none">
                <Label htmlFor="crossCircle" className="flex items-center gap-1">
                  <RefreshCw className="h-3 w-3" />
                  Cross-Circle
                </Label>
                <p className="text-xs text-muted-foreground">
                  Different circle service (+5% fee)
                </p>
              </div>
            </div>
          </div>

          {/* Automatic Fee Notices */}
          <div className="space-y-2">
            {isPeakHours() && (
              <Alert className="bg-orange-50 border-orange-200">
                <AlertCircle className="h-4 w-4 text-orange-600" />
                <AlertDescription className="text-orange-700 text-sm">
                  <strong>Peak Hours:</strong> This booking is during high-demand hours (+10% fee automatically applied)
                </AlertDescription>
              </Alert>
            )}

            {isWeekendBooking() && (
              <Alert className="bg-blue-50 border-blue-200">
                <Info className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-700 text-sm">
                  <strong>Weekend Service:</strong> Weekend premium automatically applied (+6% fee)
                </AlertDescription>
              </Alert>
            )}

            {isSpecializedCategory() && (
              <Alert className="bg-purple-50 border-purple-200">
                <Info className="h-4 w-4 text-purple-600" />
                <AlertDescription className="text-purple-700 text-sm">
                  <strong>Specialized Service:</strong> This category requires special expertise (+7% fee automatically applied)
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Insurance Add-on for eligible categories */}
      {isInsuranceEligible() && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-800">
              <Shield className="h-5 w-5" />
              Damage Protection
              <Badge variant="secondary" className="bg-green-100 text-green-700">
                Optional
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start space-x-3">
              <Checkbox
                id="insurance"
                checked={wantInsurance}
                onCheckedChange={(checked) => setWantInsurance(checked as boolean)}
              />
              <div className="flex-1">
                <Label htmlFor="insurance" className="text-base font-medium text-green-800">
                  Add damage protection up to $500 for $2?
                </Label>
                <p className="text-sm text-green-700 mt-1">
                  Peace of mind for {slot.category.toLowerCase()} services. Covers accidental damage to your belongings up to $500.
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline" className="text-xs border-green-300 text-green-700">
                    +2 credits
                  </Badge>
                  <Badge variant="outline" className="text-xs border-green-300 text-green-700">
                    Up to $500 coverage
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Business Expense Tagging */}
      {isBusinessExpenseEligible() && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-800">
              <DollarSign className="h-5 w-5" />
              Business Expense
              <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                Tax Deductible
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start space-x-3">
              <Checkbox
                id="businessExpense"
                checked={isBusinessExpense}
                onCheckedChange={(checked) => setIsBusinessExpense(checked as boolean)}
              />
              <div className="flex-1">
                <Label htmlFor="businessExpense" className="text-base font-medium text-blue-800">
                  Tag as business expense
                </Label>
                <p className="text-sm text-blue-700 mt-1">
                  This booking will be included in your monthly business expense reports.
                </p>
                {businessSubscription && (
                  <p className="text-xs text-blue-600 mt-1">
                    Company: {businessSubscription.companyName}
                  </p>
                )}
              </div>
            </div>
            
            {isBusinessExpense && (
              <div className="space-y-2">
                <Label htmlFor="businessMemo">Business memo (required for export)</Label>
                <Textarea
                  id="businessMemo"
                  placeholder="e.g., Client meeting setup, office cleaning, equipment transport..."
                  value={businessMemo}
                  onChange={(e) => setBusinessMemo(e.target.value)}
                  maxLength={500}
                  className="h-20"
                  required={isBusinessExpense}
                />
                <p className="text-xs text-blue-600">
                  Estimated value: ${((duration * slot.pricePerMinute) * 0.10).toFixed(2)}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Fee Summary */}
      {feeCalculation && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Pricing Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <FeeSummary
              baseAmount={baseAmount}
              finalAmount={feeCalculation.finalAmount}
              feeBreakdown={feeCalculation}
            />
            
            {feeCalculation.insuranceCost && (
              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-green-700 font-medium">Damage Protection</span>
                  <span className="text-green-800 font-semibold">+{feeCalculation.insuranceCost} credits</span>
                </div>
              </div>
            )}
            
            {feeCalculation.fees.length > 0 && (
              <div className="mt-4">
                <FeeChips
                  feeBreakdown={feeCalculation}
                  showDetails={true}
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Safety Checklist for Heavy Categories */}
      {requiresSafety && (
        <Card className="border-amber-300 bg-amber-50">
          <CardHeader>
            <CardTitle className="text-amber-900">Safety Checklist</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-amber-900">
            <p>Before booking, please confirm:</p>
            <ul className="list-disc ml-5 space-y-1">
              <li>Clear pathways and remove tripping hazards</li>
              <li>Lift with your legs; avoid twisting while carrying</li>
              <li>Use gloves or proper equipment when needed</li>
              <li>Two-person carry for heavy/awkward items</li>
            </ul>
            <div className="flex items-center gap-2 pt-1">
              <Checkbox id="safetyAck" checked={safetyChecked} onCheckedChange={(v) => setSafetyChecked(!!v)} />
              <Label htmlFor="safetyAck">I understand and will follow these safety practices</Label>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <Button 
          type="submit" 
          disabled={loading || (requiresSafety && !safetyChecked)}
          className="flex-1"
        >
          {loading ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Booking...
            </>
          ) : (
            <>
              <CheckCircle className="h-4 w-4 mr-2" />
              Confirm Booking
              {feeCalculation && (
                <span className="ml-2">
                  ({feeCalculation.finalAmount} credits)
                </span>
              )}
            </>
          )}
        </Button>
        {onCancel && (
          <Button 
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
