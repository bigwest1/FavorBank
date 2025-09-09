"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Camera, Clock, MapPin, ArrowLeft, ArrowRight, 
  Upload, Star, Shield, Zap, AlertCircle 
} from "lucide-react";
import { toast } from "sonner";
import { calculateCreditsOffered, getTierBenefits } from "@/lib/credits/calculator";

const RequestSchema = z.object({
  title: z.string().min(5).max(100),
  description: z.string().min(10).max(2000),
  category: z.string(),
  photoBase64: z.string().optional(),
  effortLevel: z.number().min(1).max(5),
  tier: z.enum(["BASIC", "PRIORITY", "GUARANTEED"]),
  timeWindowStart: z.string().optional(),
  timeWindowEnd: z.string().optional(),
  expiresAt: z.string().optional(),
  locationRadius: z.number().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  equipmentNeeded: z.array(z.string()).optional(),
  specialRequirements: z.string().optional()
});

type RequestFormData = z.infer<typeof RequestSchema>;

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

const EFFORT_LABELS = {
  1: "Very Light (< 15 min)",
  2: "Light (15-30 min)",
  3: "Medium (30-60 min)", 
  4: "Heavy (1-2 hours)",
  5: "Very Heavy (2+ hours)"
};

const EQUIPMENT_OPTIONS = [
  "Tools", "Vehicle", "Ladder", "Cleaning Supplies", "Garden Equipment", 
  "Computer/Laptop", "Kitchen Equipment", "Moving Supplies", "Other"
];

interface RequestCreationFormProps {
  circleId: string;
  onSuccess?: (requestId: string) => void;
}

export function RequestCreationForm({ circleId, onSuccess }: RequestCreationFormProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);
  const router = useRouter();

  const form = useForm<RequestFormData>({
    resolver: zodResolver(RequestSchema),
    defaultValues: {
      title: "",
      description: "",
      category: "",
      effortLevel: 3,
      tier: "BASIC",
      equipmentNeeded: [],
      locationRadius: 5
    }
  });

  const watchedValues = form.watch();
  const creditsOffered = calculateCreditsOffered({
    effortLevel: watchedValues.effortLevel,
    category: watchedValues.category,
    hasEquipment: selectedEquipment.length > 0,
    locationRadius: watchedValues.locationRadius
  });

  const handlePhotoUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        setPhotoPreview(base64);
        form.setValue("photoBase64", base64);
      };
      reader.readAsDataURL(file);
    }
  }, [form]);

  const toggleEquipment = (equipment: string) => {
    const updated = selectedEquipment.includes(equipment)
      ? selectedEquipment.filter(e => e !== equipment)
      : [...selectedEquipment, equipment];
    setSelectedEquipment(updated);
    form.setValue("equipmentNeeded", updated);
  };

  const handleSubmit = async (data: RequestFormData) => {
    setIsSubmitting(true);
    try {
      // Set expiration to 7 days from now if not specified
      const expiresAt = data.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const response = await fetch(`/api/circles/${circleId}/requests`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ...data,
          expiresAt,
          equipmentNeeded: selectedEquipment
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create request");
      }

      const request = await response.json();
      toast.success("Request created successfully!");
      
      if (onSuccess) {
        onSuccess(request.id);
      } else {
        router.push(`/app/circles/${circleId}/requests/${request.id}`);
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to create request");
    } finally {
      setIsSubmitting(false);
    }
  };

  const nextStep = async () => {
    const stepFields = {
      1: ["title", "description", "category"],
      2: ["effortLevel"],
      3: []
    };

    const fieldsToValidate = stepFields[currentStep as keyof typeof stepFields];
    const isStepValid = await form.trigger(fieldsToValidate as any);
    
    if (isStepValid && currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case "PRIORITY": return <Zap className="h-4 w-4" />;
      case "GUARANTEED": return <Shield className="h-4 w-4" />;
      default: return <Star className="h-4 w-4" />;
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case "PRIORITY": return "border-blue-200 bg-blue-50";
      case "GUARANTEED": return "border-green-200 bg-green-50";
      default: return "border-gray-200 bg-gray-50";
    }
  };

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>Step {currentStep} of 3</span>
          <span>{Math.round((currentStep / 3) * 100)}% complete</span>
        </div>
        <Progress value={(currentStep / 3) * 100} className="h-2" />
      </div>

      {/* Step 1: Basic Details */}
      {currentStep === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Request Details
            </CardTitle>
            <CardDescription>
              Describe what you need help with and add a photo to help others understand
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="photo">Photo (Optional)</Label>
              <div className="flex items-center gap-4">
                <Input
                  id="photo"
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="flex-1"
                />
                <Button type="button" variant="outline" size="sm">
                  <Camera className="h-4 w-4 mr-2" />
                  Upload
                </Button>
              </div>
              {photoPreview && (
                <div className="mt-2">
                  <img 
                    src={photoPreview} 
                    alt="Preview" 
                    className="h-32 w-32 object-cover rounded border"
                  />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                {...form.register("title")}
                placeholder="Need help moving furniture"
                maxLength={100}
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>{form.formState.errors.title?.message}</span>
                <span>{watchedValues.title?.length || 0}/100</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                {...form.register("description")}
                placeholder="I need help moving a couch from the 2nd floor to the ground floor. It's about 7 feet long and quite heavy..."
                rows={4}
                maxLength={2000}
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>{form.formState.errors.description?.message}</span>
                <span>{watchedValues.description?.length || 0}/2000</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              <Select onValueChange={(value) => form.setValue("category", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((category) => (
                    <SelectItem key={category.value} value={category.value}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.category && (
                <p className="text-xs text-red-500">{form.formState.errors.category.message}</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Effort & Details */}
      {currentStep === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Effort & Requirements
            </CardTitle>
            <CardDescription>
              Help us calculate fair credit compensation
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Effort Level *</Label>
                <Badge variant="outline" className="text-sm">
                  {creditsOffered} credits
                </Badge>
              </div>
              <div className="space-y-3">
                <Slider
                  value={[watchedValues.effortLevel]}
                  onValueChange={([value]) => form.setValue("effortLevel", value)}
                  min={1}
                  max={5}
                  step={1}
                  className="py-4"
                />
                <div className="text-center">
                  <span className="text-sm font-medium">
                    {EFFORT_LABELS[watchedValues.effortLevel as keyof typeof EFFORT_LABELS]}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Label>Equipment Needed</Label>
              <div className="flex flex-wrap gap-2">
                {EQUIPMENT_OPTIONS.map((equipment) => (
                  <Badge
                    key={equipment}
                    variant={selectedEquipment.includes(equipment) ? "default" : "outline"}
                    className="cursor-pointer hover:bg-opacity-80"
                    onClick={() => toggleEquipment(equipment)}
                  >
                    {equipment}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="timeStart">Time Window Start</Label>
                <Input
                  id="timeStart"
                  type="datetime-local"
                  {...form.register("timeWindowStart")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="timeEnd">Time Window End</Label>
                <Input
                  id="timeEnd"
                  type="datetime-local"
                  {...form.register("timeWindowEnd")}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="locationRadius">Location Radius (km)</Label>
              <Slider
                value={[watchedValues.locationRadius || 5]}
                onValueChange={([value]) => form.setValue("locationRadius", value)}
                min={1}
                max={50}
                step={1}
                className="py-4"
              />
              <div className="text-center text-sm text-gray-600">
                {watchedValues.locationRadius || 5} km radius
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="specialRequirements">Special Requirements</Label>
              <Textarea
                id="specialRequirements"
                {...form.register("specialRequirements")}
                placeholder="Any special requirements, skills needed, or other details..."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Tier Selection & Review */}
      {currentStep === 3 && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Choose Your Tier</CardTitle>
              <CardDescription>
                Higher tiers get more visibility and better guarantees
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {(["BASIC", "PRIORITY", "GUARANTEED"] as const).map((tier) => {
                const benefits = getTierBenefits(tier);
                const isSelected = watchedValues.tier === tier;
                
                return (
                  <div
                    key={tier}
                    className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                      isSelected ? getTierColor(tier) : "border-gray-200"
                    }`}
                    onClick={() => form.setValue("tier", tier)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getTierIcon(tier)}
                        <h3 className="font-semibold">{benefits.name}</h3>
                      </div>
                      <Badge variant={isSelected ? "default" : "outline"}>
                        {isSelected ? "Selected" : "Select"}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">{benefits.description}</p>
                    <ul className="text-sm space-y-1">
                      {benefits.features.map((feature, index) => (
                        <li key={index} className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 bg-current rounded-full opacity-60" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Review & Submit</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border rounded-lg p-4 bg-gray-50">
                <h4 className="font-semibold mb-2">{watchedValues.title}</h4>
                <p className="text-sm text-gray-600 mb-3">{watchedValues.description}</p>
                <div className="flex items-center gap-4 text-sm">
                  <Badge variant="outline">{watchedValues.category?.replace('_', ' ')}</Badge>
                  <Badge variant="outline">{getTierBenefits(watchedValues.tier).name}</Badge>
                  <Badge variant="outline">{creditsOffered} credits</Badge>
                </div>
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>{creditsOffered} credits</strong> will be escrowed from your balance when you post this request.
                  They&apos;ll be released to the helper when the favor is completed.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        {currentStep > 1 && (
          <Button type="button" variant="outline" onClick={prevStep}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        )}
        
        {currentStep < 3 ? (
          <Button type="button" onClick={nextStep} className="ml-auto">
            Next
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button type="submit" disabled={isSubmitting} className="ml-auto">
            {isSubmitting ? "Creating..." : "Post Request"}
          </Button>
        )}
      </div>
    </form>
  );
}