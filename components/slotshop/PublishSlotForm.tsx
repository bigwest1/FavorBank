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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Plus, Clock, DollarSign, Calendar, User, 
  AlertCircle, Info, CheckCircle 
} from "lucide-react";
import { toast } from "sonner";

const PublishSlotSchema = z.object({
  title: z.string().min(5).max(100),
  description: z.string().max(500).optional(),
  category: z.string(),
  startDateTime: z.string(),
  windowMinutes: z.number().min(5).max(480), // 5 min to 8 hours
  pricePerMinute: z.number().min(1).max(50),
  minDuration: z.number().min(5).max(240),
  maxDuration: z.number().min(15).max(480).optional(),
  location: z.string().max(200).optional()
});

type PublishSlotData = z.infer<typeof PublishSlotSchema>;

const CATEGORIES = [
  { value: "HOUSEHOLD_TASKS", label: "Household Tasks" },
  { value: "YARD_WORK", label: "Yard Work" },
  { value: "PET_CARE", label: "Pet Care" },
  { value: "CHILD_CARE", label: "Child Care" },
  { value: "ELDER_CARE", label: "Elder Care" },
  { value: "TRANSPORTATION", label: "Transportation" },
  { value: "TECH_SUPPORT", label: "Tech Support" },
  { value: "HOME_REPAIR", label: "Home Repair" },
  { value: "MOVING_HELP", label: "Moving Help" },
  { value: "ERRANDS", label: "Errands" },
  { value: "COOKING", label: "Cooking" },
  { value: "TUTORING", label: "Tutoring" },
  { value: "CREATIVE_PROJECTS", label: "Creative Projects" },
  { value: "EVENT_HELP", label: "Event Help" },
  { value: "OTHER", label: "Other" }
];

const QUICK_WINDOWS = [
  { label: "5 min", value: 5 },
  { label: "10 min", value: 10 },
  { label: "15 min", value: 15 },
  { label: "20 min", value: 20 },
  { label: "30 min", value: 30 },
  { label: "1 hour", value: 60 },
  { label: "2 hours", value: 120 }
];

interface PublishSlotFormProps {
  circleId: string;
  onSlotPublished?: (slotId: string) => void;
}

export function PublishSlotForm({ circleId, onSlotPublished }: PublishSlotFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<PublishSlotData>({
    resolver: zodResolver(PublishSlotSchema),
    defaultValues: {
      title: "",
      description: "",
      category: "",
      windowMinutes: 30,
      pricePerMinute: 2,
      minDuration: 5,
      maxDuration: 60,
      location: ""
    }
  });

  const watchedValues = form.watch();

  const calculateExampleEarnings = () => {
    const { windowMinutes, pricePerMinute, minDuration } = watchedValues;
    const minEarning = minDuration * pricePerMinute;
    const maxEarning = windowMinutes * pricePerMinute;
    return { minEarning, maxEarning };
  };

  const handleSubmit = async (data: PublishSlotData) => {
    setIsSubmitting(true);
    try {
      const startDateTime = new Date(data.startDateTime);
      const endDateTime = new Date(startDateTime.getTime() + data.windowMinutes * 60000);

      const response = await fetch(`/api/circles/${circleId}/slots`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ...data,
          start: startDateTime.toISOString(),
          end: endDateTime.toISOString()
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to publish slot");
      }

      const slot = await response.json();
      toast.success("Slot published successfully!");
      setIsOpen(false);
      form.reset();
      
      if (onSlotPublished) {
        onSlotPublished(slot.id);
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to publish slot");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getMinDateTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 60); // At least 1 hour from now
    return now.toISOString().slice(0, 16);
  };

  const { minEarning, maxEarning } = calculateExampleEarnings();

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Publish Availability
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Publish Your Availability</DialogTitle>
          <DialogDescription>
            Create a bookable time slot where others can request your help
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">What can you help with? *</Label>
              <Input
                id="title"
                {...form.register("title")}
                placeholder="Available for household tasks, errands, etc."
                maxLength={100}
              />
              <div className="text-xs text-gray-500 text-right">
                {watchedValues.title?.length || 0}/100
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                {...form.register("description")}
                placeholder="Any specific details about what you can help with..."
                rows={2}
                maxLength={500}
              />
              <div className="text-xs text-gray-500 text-right">
                {watchedValues.description?.length || 0}/500
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              <Select onValueChange={(value) => form.setValue("category", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((category) => (
                    <SelectItem key={category.value} value={category.value}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Timing */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Availability Window
              </CardTitle>
              <CardDescription>
                Set when you&apos;re available and for how long
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="startDateTime">Start Time *</Label>
                <Input
                  id="startDateTime"
                  type="datetime-local"
                  {...form.register("startDateTime")}
                  min={getMinDateTime()}
                />
              </div>

              <div className="space-y-2">
                <Label>Window Duration *</Label>
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {QUICK_WINDOWS.map((window) => (
                    <Button
                      key={window.value}
                      type="button"
                      variant={watchedValues.windowMinutes === window.value ? "default" : "outline"}
                      size="sm"
                      onClick={() => form.setValue("windowMinutes", window.value)}
                    >
                      {window.label}
                    </Button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="5"
                    max="480"
                    {...form.register("windowMinutes", { valueAsNumber: true })}
                    className="w-24"
                  />
                  <span className="text-sm text-gray-600">minutes</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pricing */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Pricing & Duration
              </CardTitle>
              <CardDescription>
                Set your rates and minimum/maximum booking lengths
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pricePerMinute">Price per minute *</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="pricePerMinute"
                    type="number"
                    min="1"
                    max="50"
                    {...form.register("pricePerMinute", { valueAsNumber: true })}
                    className="w-24"
                  />
                  <span className="text-sm text-gray-600">credits/min</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="minDuration">Minimum Duration *</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="minDuration"
                      type="number"
                      min="5"
                      max="240"
                      {...form.register("minDuration", { valueAsNumber: true })}
                      className="w-20"
                    />
                    <span className="text-sm text-gray-600">min</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxDuration">Maximum Duration</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="maxDuration"
                      type="number"
                      min="15"
                      max="480"
                      {...form.register("maxDuration", { valueAsNumber: true })}
                      className="w-20"
                    />
                    <span className="text-sm text-gray-600">min</span>
                  </div>
                </div>
              </div>

              {/* Earnings Preview */}
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-1">
                    <div className="font-medium">Potential Earnings:</div>
                    <div className="text-sm">
                      Minimum: {minEarning} credits ({watchedValues.minDuration} min × {watchedValues.pricePerMinute} credits)
                    </div>
                    <div className="text-sm">
                      Maximum: {maxEarning} credits (full {watchedValues.windowMinutes} min × {watchedValues.pricePerMinute} credits)
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          {/* Location */}
          <div className="space-y-2">
            <Label htmlFor="location">Location (Optional)</Label>
            <Input
              id="location"
              {...form.register("location")}
              placeholder="Your address or general area..."
              maxLength={200}
            />
            <p className="text-xs text-gray-600">
              This will only be shared with confirmed bookers
            </p>
          </div>

          {/* Terms */}
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <div className="font-medium">How SlotShop Works:</div>
                <ul className="text-sm space-y-1 list-disc list-inside">
                  <li>Others can book portions of your availability window</li>
                  <li>Credits are escrowed when someone books your time</li>
                  <li>You&apos;ll be notified of bookings and can coordinate with bookers</li>
                  <li>Credits are released to you when the booking is completed</li>
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
              {isSubmitting ? "Publishing..." : "Publish Slot"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}