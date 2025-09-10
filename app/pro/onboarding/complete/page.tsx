"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, Clock, Star, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function OnboardingCompletePage() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [profileData, setProfileData] = useState<any>(null);

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      try {
        const response = await fetch("/api/pro/onboarding/status");
        if (!response.ok) {
          throw new Error("Failed to check onboarding status");
        }
        
        const data = await response.json();
        setProfileData(data);
        setStatus('success');
      } catch (error) {
        console.error("Error checking onboarding status:", error);
        setStatus('error');
      }
    };

    checkOnboardingStatus();
  }, []);

  if (status === 'loading') {
    return (
      <div className="container max-w-2xl mx-auto p-6">
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center space-y-4">
              <Clock className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
              <p>Checking your onboarding status...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="container max-w-2xl mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-red-600">Onboarding Error</CardTitle>
            <CardDescription>
              There was an issue checking your Pro onboarding status.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/pro/dashboard">Go to Pro Dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isFullyApproved = profileData?.proProfile?.status === 'APPROVED' && 
                         profileData?.proProfile?.stripePayoutsEnabled;

  return (
    <div className="container max-w-2xl mx-auto p-6 space-y-6">
      {/* Success Header */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center">
          <CheckCircle className="h-12 w-12 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold">Onboarding Progress</h1>
        <p className="text-gray-600">
          Your Pro application is being processed
        </p>
      </div>

      {/* Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-500" />
            Pro Application Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Stripe Setup Status */}
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <h3 className="font-medium">Stripe Payment Setup</h3>
              <p className="text-sm text-gray-600">Required for cash bonus payouts</p>
            </div>
            <div className="text-right">
              {profileData?.proProfile?.stripePayoutsEnabled ? (
                <div className="flex items-center gap-1 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">Complete</span>
                </div>
              ) : profileData?.proProfile?.stripeDetailsSubmitted ? (
                <div className="flex items-center gap-1 text-yellow-600">
                  <Clock className="h-4 w-4" />
                  <span className="text-sm font-medium">Under Review</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-gray-500">
                  <Clock className="h-4 w-4" />
                  <span className="text-sm font-medium">Pending</span>
                </div>
              )}
            </div>
          </div>

          {/* Background Check Status */}
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <h3 className="font-medium">Background Check</h3>
              <p className="text-sm text-gray-600">Identity and safety verification</p>
            </div>
            <div className="text-right">
              {profileData?.proProfile?.backgroundCheckPassed ? (
                <div className="flex items-center gap-1 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">Passed</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-yellow-600">
                  <Clock className="h-4 w-4" />
                  <span className="text-sm font-medium">In Progress</span>
                </div>
              )}
            </div>
          </div>

          {/* Skill Verifications */}
          <div className="p-3 border rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-medium">Skill Verifications</h3>
                <p className="text-sm text-gray-600">
                  {profileData?.skillVerifications?.length || 0} skills submitted
                </p>
              </div>
            </div>
            
            {profileData?.skillVerifications?.length > 0 && (
              <div className="space-y-2">
                {profileData.skillVerifications.map((skill: any) => (
                  <div key={skill.id} className="flex items-center justify-between text-sm">
                    <span>{skill.skill}</span>
                    <span className={`
                      px-2 py-1 rounded text-xs font-medium
                      ${skill.status === 'VERIFIED' 
                        ? 'bg-green-100 text-green-700' 
                        : skill.status === 'REJECTED'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-yellow-100 text-yellow-700'
                      }
                    `}>
                      {skill.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Next Steps */}
      <Card>
        <CardHeader>
          <CardTitle>What Happens Next?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isFullyApproved ? (
            <Alert>
              <Clock className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-medium">Your application is under review</p>
                  <ul className="text-sm space-y-1 list-disc list-inside ml-4">
                    <li>Background check typically takes 1-2 business days</li>
                    <li>Skill verifications are reviewed by community moderators</li>
                    <li>Stripe payout setup may require additional documentation</li>
                    <li>You'll receive email notifications for status updates</li>
                  </ul>
                </div>
              </AlertDescription>
            </Alert>
          ) : (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                <p className="font-medium text-green-700">
                  Congratulations! Your Pro application has been approved. 
                  You can now start earning 15% cash bonuses on completed bookings.
                </p>
              </AlertDescription>
            </Alert>
          )}

          <div className="flex gap-3">
            <Button asChild variant="outline" className="flex-1">
              <Link href="/dashboard">
                Continue to Dashboard
              </Link>
            </Button>
            <Button asChild className="flex-1">
              <Link href="/pro/dashboard">
                View Pro Dashboard
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}