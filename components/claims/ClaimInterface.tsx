"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  Shield, Clock, AlertTriangle, XCircle, FileText,
  CheckCircle, DollarSign, Timer, MessageSquare
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Booking {
  id: string;
  status: string;
  totalCredits: number;
  isGuaranteed: boolean;
  guaranteedAt?: string;
  provider: {
    id: string;
    name: string;
  };
  booker: {
    id: string;
    name: string;
  };
  slot: {
    title: string;
    start: string;
  };
}

interface Claim {
  id: string;
  claimType: string;
  status: string;
  description: string;
  amount: number;
  bonusAmount: number;
  totalPayout: number;
  claimDeadline: string;
  helperResponse?: string;
  helperRespondedAt?: string;
  autoResolved: boolean;
  resolvedAt?: string;
  claimant: {
    id: string;
    name: string;
  };
  respondent: {
    id: string;
    name: string;
  };
}

interface ClaimInterfaceProps {
  booking: Booking;
  currentUserId: string;
  onClaimUpdate?: (claim: Claim) => void;
}

const CLAIM_TYPES = [
  {
    value: "NO_SHOW",
    label: "No-Show",
    description: "Provider didn't show up for the appointment",
    icon: XCircle,
    color: "text-red-600"
  },
  {
    value: "UNSAFE_CONDITIONS",
    label: "Unsafe Conditions",
    description: "Safety concerns prevented completion",
    icon: AlertTriangle,
    color: "text-orange-600"
  },
  {
    value: "TASK_IMPOSSIBLE",
    label: "Task Impossible",
    description: "Task couldn't be completed as described",
    icon: FileText,
    color: "text-yellow-600"
  },
  {
    value: "OTHER",
    label: "Other Issue",
    description: "Other legitimate reason for non-completion",
    icon: MessageSquare,
    color: "text-gray-600"
  }
];

export function ClaimInterface({ booking, currentUserId, onClaimUpdate }: ClaimInterfaceProps) {
  const [showClaimDialog, setShowClaimDialog] = useState(false);
  const [selectedClaimType, setSelectedClaimType] = useState<string>("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingClaim, setExistingClaim] = useState<Claim | null>(null);

  const isBooker = currentUserId === booking.bookerId;
  const isProvider = currentUserId === booking.provider.id;

  // Check if booking is eligible for claims
  const canClaim = booking.isGuaranteed && 
                   isBooker && 
                   ["CONFIRMED", "IN_PROGRESS"].includes(booking.status);

  const handleSubmitClaim = async () => {
    if (!selectedClaimType) {
      toast.error("Please select a claim type");
      return;
    }

    if (description.trim().length < 10) {
      toast.error("Please provide a detailed description (at least 10 characters)");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/bookings/${booking.id}/claim`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          claimType: selectedClaimType,
          description: description.trim()
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to submit claim");
      }

      const result = await response.json();
      toast.success(result.message);
      setShowClaimDialog(false);
      setSelectedClaimType("");
      setDescription("");
      setExistingClaim(result.claim);
      
      if (onClaimUpdate) {
        onClaimUpdate(result.claim);
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to submit claim");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getClaimStatusColor = (status: string) => {
    switch (status) {
      case "APPROVED": return "bg-green-100 text-green-800";
      case "REJECTED": return "bg-red-100 text-red-800";
      case "HELPER_RESPONDED": return "bg-blue-100 text-blue-800";
      case "MODERATOR_REVIEW": return "bg-purple-100 text-purple-800";
      default: return "bg-yellow-100 text-yellow-800";
    }
  };

  const formatClaimType = (type: string) => {
    return CLAIM_TYPES.find(t => t.value === type)?.label || type;
  };

  const timeUntilDeadline = existingClaim ? 
    new Date(existingClaim.claimDeadline).getTime() - Date.now() : 0;
  const hoursLeft = Math.max(0, Math.floor(timeUntilDeadline / (1000 * 60 * 60)));

  // Show existing claim if it exists
  if (existingClaim) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-600" />
            Insurance Claim Filed
          </CardTitle>
          <CardDescription>
            Claim for guaranteed credit refund and bonus
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Claim Status */}
          <div className="flex items-center justify-between">
            <span className="font-medium">Status:</span>
            <Badge className={getClaimStatusColor(existingClaim.status)}>
              {existingClaim.status.replace('_', ' ')}
            </Badge>
          </div>

          {/* Claim Details */}
          <div className="space-y-2 text-sm">
            <div><strong>Type:</strong> {formatClaimType(existingClaim.claimType)}</div>
            <div><strong>Description:</strong> {existingClaim.description}</div>
            <div><strong>Refund Amount:</strong> {existingClaim.amount} credits</div>
            <div><strong>Bonus:</strong> +{existingClaim.bonusAmount} credits (20%)</div>
            <div className="font-medium text-green-700">
              <strong>Total Payout:</strong> {existingClaim.totalPayout} credits
            </div>
          </div>

          {/* Auto-resolution timer */}
          {existingClaim.status === "PENDING" && hoursLeft > 0 && (
            <Alert>
              <Timer className="h-4 w-4" />
              <AlertDescription>
                <strong>Auto-resolution in {hoursLeft} hours</strong><br />
                {existingClaim.respondent.name} has until {format(new Date(existingClaim.claimDeadline), "MMM d, h:mm a")} to respond. 
                If no response, you'll automatically receive the full refund plus bonus.
              </AlertDescription>
            </Alert>
          )}

          {/* Helper Response */}
          {existingClaim.helperResponse && (
            <div className="bg-blue-50 p-3 rounded-lg">
              <div className="text-sm font-medium text-blue-800 mb-1">
                Response from {existingClaim.respondent.name}:
              </div>
              <div className="text-sm text-blue-700">
                {existingClaim.helperResponse}
              </div>
              <div className="text-xs text-blue-600 mt-1">
                {existingClaim.helperRespondedAt && 
                  format(new Date(existingClaim.helperRespondedAt), "MMM d, h:mm a")
                }
              </div>
            </div>
          )}

          {/* Resolution info */}
          {existingClaim.resolvedAt && (
            <div className="bg-green-50 p-3 rounded-lg">
              <div className="text-sm font-medium text-green-800 mb-1">
                <CheckCircle className="h-4 w-4 inline mr-1" />
                Claim Resolved
              </div>
              <div className="text-sm text-green-700">
                {existingClaim.autoResolved ? "Auto-resolved" : "Manually resolved"} on{" "}
                {format(new Date(existingClaim.resolvedAt), "MMM d, h:mm a")}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Show claim button for eligible bookings
  if (canClaim) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-green-600" />
            Guaranteed Credits Protection
          </CardTitle>
          <CardDescription>
            This booking is protected by insurance. If something goes wrong, you can file a claim.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="text-sm font-medium">Protected Amount: {booking.totalCredits} credits</div>
              <div className="text-sm text-gray-600">
                Guaranteed refund + 20% bonus if issues occur
              </div>
            </div>
            
            <Dialog open={showClaimDialog} onOpenChange={setShowClaimDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" className="border-red-200 text-red-700 hover:bg-red-50">
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  File Claim
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>File Insurance Claim</DialogTitle>
                  <DialogDescription>
                    Report an issue with your guaranteed credit booking to receive a full refund plus 20% bonus
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-6">
                  {/* Claim Type Selection */}
                  <div className="space-y-3">
                    <Label>What went wrong?</Label>
                    <div className="grid gap-3">
                      {CLAIM_TYPES.map((type) => {
                        const Icon = type.icon;
                        const isSelected = selectedClaimType === type.value;
                        
                        return (
                          <button
                            key={type.value}
                            onClick={() => setSelectedClaimType(type.value)}
                            className={`
                              p-3 rounded-lg border-2 text-left transition-all
                              ${isSelected 
                                ? 'border-red-300 bg-red-50' 
                                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                              }
                            `}
                          >
                            <div className="flex items-center gap-3">
                              <Icon className={`h-5 w-5 ${type.color}`} />
                              <div>
                                <div className="font-medium text-sm">{type.label}</div>
                                <div className="text-xs text-gray-600">{type.description}</div>
                              </div>
                              {isSelected && (
                                <CheckCircle className="h-4 w-4 text-red-600 ml-auto" />
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Description */}
                  <div className="space-y-2">
                    <Label htmlFor="description">Description *</Label>
                    <Textarea
                      id="description"
                      placeholder="Please describe what happened in detail..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      maxLength={500}
                      rows={4}
                    />
                    <div className="text-xs text-gray-500 text-right">
                      {description.length}/500 (minimum 10 characters)
                    </div>
                  </div>

                  {/* Payout Preview */}
                  {selectedClaimType && (
                    <Alert>
                      <DollarSign className="h-4 w-4" />
                      <AlertDescription>
                        <div className="space-y-1">
                          <div className="font-medium">If approved, you'll receive:</div>
                          <div>• Refund: {booking.totalCredits} credits</div>
                          <div>• Bonus: +{Math.round(booking.totalCredits * 0.2)} credits (20%)</div>
                          <div className="font-medium text-green-700">
                            Total: {booking.totalCredits + Math.round(booking.totalCredits * 0.2)} credits
                          </div>
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Actions */}
                  <div className="flex gap-3 pt-4 border-t">
                    <Button 
                      variant="outline" 
                      onClick={() => setShowClaimDialog(false)}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleSubmitClaim}
                      disabled={!selectedClaimType || description.trim().length < 10 || isSubmitting}
                      className="flex-1 bg-red-600 hover:bg-red-700"
                    >
                      {isSubmitting ? "Filing claim..." : "File Claim"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>
    );
  }

  // No claim interface needed
  return null;
}