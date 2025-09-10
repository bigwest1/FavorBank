"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { 
  Star, Shield, DollarSign, Clock, CheckCircle, 
  AlertTriangle, User, FileText, CreditCard
} from "lucide-react";
import { toast } from "sonner";

const SKILL_CATEGORIES = [
  {
    category: "Home & Maintenance",
    skills: ["Cleaning", "Plumbing", "Electrical", "Carpentry", "Painting", "Gardening", "HVAC"]
  },
  {
    category: "Care Services", 
    skills: ["Childcare", "Elder Care", "Pet Care", "Tutoring", "Special Needs Care"]
  },
  {
    category: "Technology",
    skills: ["Computer Repair", "Web Development", "App Development", "IT Support", "Software Training"]
  },
  {
    category: "Creative Services",
    skills: ["Graphic Design", "Photography", "Video Editing", "Writing", "Music Lessons", "Art Instruction"]
  },
  {
    category: "Transport & Delivery",
    skills: ["Delivery", "Moving", "Airport Shuttle", "Grocery Shopping", "Errand Running"]
  },
  {
    category: "Business Services",
    skills: ["Administrative", "Bookkeeping", "Legal Assistance", "Marketing", "Event Planning"]
  }
];

export default function ProSignupPage() {
  const [formData, setFormData] = useState({
    backgroundCheck: false,
    minDurationMinutes: 60,
    applicationNotes: "",
    selectedSkills: [] as string[]
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  const handleSkillToggle = (skill: string) => {
    setFormData(prev => ({
      ...prev,
      selectedSkills: prev.selectedSkills.includes(skill)
        ? prev.selectedSkills.filter(s => s !== skill)
        : [...prev.selectedSkills, skill]
    }));
  };

  const handleSubmit = async () => {
    if (formData.selectedSkills.length === 0) {
      toast.error("Please select at least one skill to verify");
      return;
    }

    if (!formData.backgroundCheck) {
      toast.error("Background check consent is required for Pro membership");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/pro/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to submit Pro application");
      }

      const result = await response.json();
      toast.success("Pro application submitted successfully!");
      
      // Redirect to Stripe Connect onboarding
      if (result.stripeOnboardingUrl) {
        window.location.href = result.stripeOnboardingUrl;
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to submit application");
    } finally {
      setIsSubmitting(false);
    }
  };

  const canProceedToStep2 = formData.selectedSkills.length > 0;
  const canProceedToStep3 = canProceedToStep2 && formData.minDurationMinutes >= 30;

  return (
    <div className="container max-w-4xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-2">
          <Star className="h-8 w-8 text-yellow-500" />
          <h1 className="text-3xl font-bold">Join SlotShop Pro</h1>
          <Star className="h-8 w-8 text-yellow-500" />
        </div>
        <p className="text-lg text-gray-600">
          Earn cash bonuses while helping your community
        </p>
        
        {/* Benefits Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
            <DollarSign className="h-5 w-5 text-green-600" />
            <span className="text-sm font-medium">15% cash bonus on every completed booking</span>
          </div>
          <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
            <Shield className="h-5 w-5 text-blue-600" />
            <span className="text-sm font-medium">Pro badge builds trust and credibility</span>
          </div>
          <div className="flex items-center gap-2 p-3 bg-purple-50 rounded-lg">
            <Clock className="h-5 w-5 text-purple-600" />
            <span className="text-sm font-medium">Weekly payouts via Stripe</span>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-center space-x-4">
        {[1, 2, 3].map((step) => (
          <div key={step} className="flex items-center">
            <div className={`
              w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
              ${currentStep >= step 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-600'}
            `}>
              {step}
            </div>
            {step < 3 && (
              <div className={`
                w-12 h-0.5 mx-2
                ${currentStep > step ? 'bg-blue-600' : 'bg-gray-200'}
              `} />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Skills Selection */}
      {currentStep === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Step 1: Select Your Skills
            </CardTitle>
            <CardDescription>
              Choose the skills you want to offer as a Pro. These will be verified before approval.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {SKILL_CATEGORIES.map((category) => (
              <div key={category.category}>
                <h3 className="font-semibold text-sm text-gray-700 mb-3">
                  {category.category}
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {category.skills.map((skill) => (
                    <button
                      key={skill}
                      onClick={() => handleSkillToggle(skill)}
                      className={`
                        p-2 rounded-lg border text-sm transition-all
                        ${formData.selectedSkills.includes(skill)
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }
                      `}
                    >
                      {skill}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {formData.selectedSkills.length > 0 && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Selected skills ({formData.selectedSkills.length}):</strong>{" "}
                  {formData.selectedSkills.join(", ")}
                </AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end">
              <Button 
                onClick={() => setCurrentStep(2)}
                disabled={!canProceedToStep2}
                className="min-w-32"
              >
                Continue to Settings
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Pro Settings */}
      {currentStep === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Step 2: Pro Settings
            </CardTitle>
            <CardDescription>
              Configure your professional service requirements
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="minDuration">Minimum Booking Duration (minutes)</Label>
              <Input
                id="minDuration"
                type="number"
                min="30"
                max="480"
                step="30"
                value={formData.minDurationMinutes}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  minDurationMinutes: parseInt(e.target.value) || 30 
                }))}
              />
              <p className="text-sm text-gray-500">
                Minimum 30 minutes. This helps ensure quality service delivery.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Why do you want to become a Pro? (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Tell us about your experience and why you'd like to offer professional services..."
                value={formData.applicationNotes}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  applicationNotes: e.target.value 
                }))}
                maxLength={500}
              />
              <p className="text-sm text-gray-500">
                {formData.applicationNotes.length}/500 characters
              </p>
            </div>

            <div className="flex items-center justify-between pt-4">
              <Button 
                variant="outline" 
                onClick={() => setCurrentStep(1)}
              >
                Back to Skills
              </Button>
              <Button 
                onClick={() => setCurrentStep(3)}
                disabled={!canProceedToStep3}
                className="min-w-32"
              >
                Continue to Verification
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Background Check & Stripe Setup */}
      {currentStep === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Step 3: Background Check & Payments
            </CardTitle>
            <CardDescription>
              Final verification steps to complete your Pro application
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Background Check Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-1">
                  <h3 className="font-medium">Background Check</h3>
                  <p className="text-sm text-gray-600">
                    Required for trust and safety in the community
                  </p>
                </div>
                <Switch
                  checked={formData.backgroundCheck}
                  onCheckedChange={(checked) => 
                    setFormData(prev => ({ ...prev, backgroundCheck: checked }))
                  }
                />
              </div>

              {formData.backgroundCheck && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Background Check Process:</strong> We use a third-party service to verify your identity 
                    and conduct a background check. This typically takes 1-2 business days. You'll be notified via 
                    email once complete.
                  </AlertDescription>
                </Alert>
              )}
            </div>

            <Separator />

            {/* Stripe Connect Info */}
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg">
                <CreditCard className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <h3 className="font-medium text-blue-900">Stripe Connect Setup</h3>
                  <p className="text-sm text-blue-700 mt-1">
                    After submitting your application, you'll be redirected to Stripe to set up your 
                    payout account. This is required to receive your 15% cash bonuses.
                  </p>
                </div>
              </div>

              <div className="text-sm text-gray-600 space-y-2">
                <p><strong>What you'll need:</strong></p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Government-issued ID (driver's license or passport)</li>
                  <li>Social Security Number</li>
                  <li>Bank account information for payouts</li>
                  <li>Address verification</li>
                </ul>
              </div>
            </div>

            {/* Application Summary */}
            <div className="border rounded-lg p-4 bg-gray-50">
              <h3 className="font-medium mb-3">Application Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Skills selected:</span>
                  <span className="font-medium">{formData.selectedSkills.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Minimum duration:</span>
                  <span className="font-medium">{formData.minDurationMinutes} minutes</span>
                </div>
                <div className="flex justify-between">
                  <span>Background check:</span>
                  <Badge variant={formData.backgroundCheck ? "default" : "secondary"}>
                    {formData.backgroundCheck ? "Consented" : "Required"}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4">
              <Button 
                variant="outline" 
                onClick={() => setCurrentStep(2)}
              >
                Back to Settings
              </Button>
              <Button 
                onClick={handleSubmit}
                disabled={!formData.backgroundCheck || isSubmitting}
                className="min-w-32"
              >
                {isSubmitting ? "Submitting..." : "Submit Application"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}