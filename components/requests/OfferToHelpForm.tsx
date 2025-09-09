"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MessageSquare, Clock, Phone, Mail, AlertCircle } from "lucide-react";
import { toast } from "sonner";

const OfferSchema = z.object({
  message: z.string().max(1000).optional(),
  proposedStartAt: z.string().optional(),
  estimatedHours: z.number().min(0.25).max(24).optional(),
  helperPhone: z.string().max(50).optional(),
  helperEmail: z.string().email().optional()
});

type OfferFormData = z.infer<typeof OfferSchema>;

interface OfferToHelpFormProps {
  requestId: string;
  requestTitle: string;
  timeWindowStart?: string;
  timeWindowEnd?: string;
  onOfferSubmitted?: () => void;
}

export function OfferToHelpForm({ 
  requestId, 
  requestTitle, 
  timeWindowStart, 
  timeWindowEnd, 
  onOfferSubmitted 
}: OfferToHelpFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<OfferFormData>({
    resolver: zodResolver(OfferSchema),
    defaultValues: {
      message: "",
      estimatedHours: 1,
      helperPhone: "",
      helperEmail: ""
    }
  });

  const handleSubmit = async (data: OfferFormData) => {
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/requests/${requestId}/offers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to submit offer");
      }

      toast.success("Your offer has been sent! The requester will be notified.");
      setIsOpen(false);
      form.reset();
      
      if (onOfferSubmitted) {
        onOfferSubmitted();
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to submit offer");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getMinDateTime = () => {
    if (timeWindowStart) {
      return new Date(timeWindowStart).toISOString().slice(0, 16);
    }
    return new Date().toISOString().slice(0, 16);
  };

  const getMaxDateTime = () => {
    if (timeWindowEnd) {
      return new Date(timeWindowEnd).toISOString().slice(0, 16);
    }
    // Default to 30 days from now
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 30);
    return maxDate.toISOString().slice(0, 16);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="w-full">
          <MessageSquare className="h-4 w-4 mr-2" />
          I Can Help
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Offer to Help</DialogTitle>
          <DialogDescription>
            Send your offer to help with: <strong>{requestTitle}</strong>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          {/* Time Window Info */}
          {(timeWindowStart || timeWindowEnd) && (
            <Alert>
              <Clock className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  <div className="font-medium">Time Window for this Request:</div>
                  {timeWindowStart && (
                    <div>Start: {formatDateTime(timeWindowStart)}</div>
                  )}
                  {timeWindowEnd && (
                    <div>End: {formatDateTime(timeWindowEnd)}</div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Message */}
          <div className="space-y-2">
            <Label htmlFor="message">Your Message (Optional)</Label>
            <Textarea
              id="message"
              {...form.register("message")}
              placeholder="Hi! I'd be happy to help with this. I have experience with..."
              rows={4}
              maxLength={1000}
            />
            <div className="text-xs text-gray-500 text-right">
              {form.watch("message")?.length || 0}/1000
            </div>
          </div>

          {/* Proposed Start Time */}
          <div className="space-y-2">
            <Label htmlFor="proposedStartAt">When can you start? (Optional)</Label>
            <Input
              id="proposedStartAt"
              type="datetime-local"
              {...form.register("proposedStartAt")}
              min={getMinDateTime()}
              max={getMaxDateTime()}
            />
            <p className="text-xs text-gray-600">
              Propose a time within the request window when you can start helping
            </p>
          </div>

          {/* Estimated Hours */}
          <div className="space-y-2">
            <Label htmlFor="estimatedHours">Estimated time needed (hours)</Label>
            <Input
              id="estimatedHours"
              type="number"
              step="0.25"
              min="0.25"
              max="24"
              {...form.register("estimatedHours", { valueAsNumber: true })}
            />
            <p className="text-xs text-gray-600">
              How long do you think this task will take?
            </p>
          </div>

          {/* Contact Information */}
          <div className="space-y-4">
            <div className="border-t pt-4">
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Contact Information
              </h4>
              <p className="text-xs text-gray-600 mb-4">
                This information will only be shared if your offer is accepted
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="helperPhone">Phone Number (Optional)</Label>
                <Input
                  id="helperPhone"
                  type="tel"
                  {...form.register("helperPhone")}
                  placeholder="+1 (555) 123-4567"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="helperEmail">Email (Optional)</Label>
                <Input
                  id="helperEmail"
                  type="email"
                  {...form.register("helperEmail")}
                  placeholder="your@email.com"
                />
                {form.formState.errors.helperEmail && (
                  <p className="text-xs text-red-500">
                    {form.formState.errors.helperEmail.message}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Privacy Notice */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <div className="font-medium">Privacy & Next Steps:</div>
                <ul className="text-sm space-y-1 list-disc list-inside">
                  <li>Your contact info will only be shared if your offer is accepted</li>
                  <li>The requester will see your message and availability</li>
                  <li>You&apos;ll be notified if your offer is accepted or declined</li>
                  <li>You can withdraw your offer anytime before it&apos;s accepted</li>
                </ul>
              </div>
            </AlertDescription>
          </Alert>

          {/* Actions */}
          <div className="flex justify-end space-x-4 pt-4 border-t">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setIsOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Sending Offer..." : "Send Offer"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}