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

export function BookingForm({ slot, onSuccess, onCancel }: BookingFormProps) {
  const [duration, setDuration] = useState(slot.minDuration);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  
  // Fee-related state
  const [isUrgent, setIsUrgent] = useState(false);
  const [needsEquipment, setNeedsEquipment] = useState(false);
  const [isGuaranteed, setIsGuaranteed] = useState(false);
  const [crossCircle, setCrossCircle] = useState(false);
  
  const [feeCalculation, setFeeCalculation] = useState<any>(null);

  // Calculate slot duration and cost
  const slotDuration = Math.round(
    (new Date(slot.end).getTime() - new Date(slot.start).getTime()) / (1000 * 60)
  );
  const maxBookingDuration = slot.maxDuration ? Math.min(slot.maxDuration, slotDuration) : slotDuration;
  const baseAmount = duration * slot.pricePerMinute;

  // Calculate fees whenever options change
  useEffect(() => {
    calculateFees();
  }, [duration, isUrgent, needsEquipment, isGuaranteed, crossCircle]);

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
    const breakdown = FeesContext.getFeeBreakdown(calculation);
    setFeeCalculation(breakdown);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
          }
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

      {/* Actions */}
      <div className="flex gap-3">
        <Button 
          type="submit" 
          disabled={loading}
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