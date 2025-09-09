"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Users, Shield, Clock, Tag } from "lucide-react";
import { toast } from "sonner";

const CircleSettingsSchema = z.object({
  name: z.string().min(2).max(50),
  description: z.string().optional(),
  city: z.string().max(100).optional(),
  isPrivate: z.boolean(),
  quietHours: z.object({
    start: z.string().regex(/^\d{2}:\d{2}$/),
    end: z.string().regex(/^\d{2}:\d{2}$/)
  }).optional(),
  allowsMinors: z.boolean(),
  demurrageRate: z.number().min(0).max(1),
  categories: z.array(z.string()).optional()
});

type CircleSettingsData = z.infer<typeof CircleSettingsSchema>;

const AVAILABLE_CATEGORIES = [
  "Household Tasks", "Yard Work", "Pet Care", "Child Care", "Elder Care",
  "Transportation", "Tech Support", "Home Repair", "Moving Help", "Errands",
  "Cooking", "Tutoring", "Creative Projects", "Event Help", "Other"
];

interface CircleSettingsFormProps {
  circle: any;
  onSave: (data: CircleSettingsData) => Promise<void>;
  canEdit: boolean;
}

export function CircleSettingsForm({ circle, onSave, canEdit }: CircleSettingsFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    circle?.categories || []
  );

  const form = useForm<CircleSettingsData>({
    resolver: zodResolver(CircleSettingsSchema),
    defaultValues: {
      name: circle?.name || "",
      description: circle?.description || "",
      city: circle?.city || "",
      isPrivate: circle?.isPrivate || false,
      quietHours: circle?.quietHours || undefined,
      allowsMinors: circle?.allowsMinors ?? true,
      demurrageRate: circle?.demurrageRate || 0,
      categories: circle?.categories || []
    }
  });

  const handleSave = async (data: CircleSettingsData) => {
    if (!canEdit) return;
    
    setIsSaving(true);
    try {
      await onSave({
        ...data,
        categories: selectedCategories
      });
      toast.success("Circle settings updated successfully");
    } catch (error) {
      toast.error("Failed to update circle settings");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleCategory = (category: string) => {
    if (!canEdit) return;
    
    setSelectedCategories(prev => 
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  return (
    <form onSubmit={form.handleSubmit(handleSave)} className="space-y-6">
      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="basic">
            <Settings className="h-4 w-4 mr-2" />
            Basic
          </TabsTrigger>
          <TabsTrigger value="privacy">
            <Shield className="h-4 w-4 mr-2" />
            Privacy
          </TabsTrigger>
          <TabsTrigger value="rules">
            <Clock className="h-4 w-4 mr-2" />
            Rules
          </TabsTrigger>
          <TabsTrigger value="categories">
            <Tag className="h-4 w-4 mr-2" />
            Categories
          </TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>
                Update your circle's basic details and description
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Circle Name</Label>
                <Input
                  id="name"
                  {...form.register("name")}
                  disabled={!canEdit}
                  placeholder="My Awesome Circle"
                />
                {form.formState.errors.name && (
                  <p className="text-sm text-red-500">{form.formState.errors.name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  {...form.register("description")}
                  disabled={!canEdit}
                  placeholder="Describe what your circle is about..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  {...form.register("city")}
                  disabled={!canEdit}
                  placeholder="San Francisco, CA"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="privacy" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Privacy Settings</CardTitle>
              <CardDescription>
                Control who can join your circle and how
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="isPrivate"
                  checked={form.watch("isPrivate")}
                  onCheckedChange={(checked) => form.setValue("isPrivate", checked)}
                  disabled={!canEdit}
                />
                <Label htmlFor="isPrivate">Private Circle</Label>
              </div>
              {form.watch("isPrivate") && (
                <Alert>
                  <Shield className="h-4 w-4" />
                  <AlertDescription>
                    Private circles require approval for new members. They can join via invitation links or by submitting join requests.
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex items-center space-x-2">
                <Switch
                  id="allowsMinors"
                  checked={form.watch("allowsMinors")}
                  onCheckedChange={(checked) => form.setValue("allowsMinors", checked)}
                  disabled={!canEdit}
                />
                <Label htmlFor="allowsMinors">Allow Minors</Label>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rules" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Circle Rules</CardTitle>
              <CardDescription>
                Set quiet hours and credit rules for your circle
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Quiet Hours</Label>
                  <div className="flex space-x-2">
                    <div className="flex-1 space-y-1">
                      <Label htmlFor="quietStart" className="text-sm text-gray-600">Start</Label>
                      <Input
                        id="quietStart"
                        type="time"
                        {...form.register("quietHours.start")}
                        disabled={!canEdit}
                      />
                    </div>
                    <div className="flex-1 space-y-1">
                      <Label htmlFor="quietEnd" className="text-sm text-gray-600">End</Label>
                      <Input
                        id="quietEnd"
                        type="time"
                        {...form.register("quietHours.end")}
                        disabled={!canEdit}
                      />
                    </div>
                  </div>
                  <p className="text-sm text-gray-600">
                    Optional: Set hours when requests should not send notifications
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="demurrageRate">Monthly Demurrage Rate</Label>
                  <div className="flex space-x-2 items-center">
                    <Input
                      id="demurrageRate"
                      type="number"
                      step="0.01"
                      min="0"
                      max="1"
                      {...form.register("demurrageRate", { valueAsNumber: true })}
                      disabled={!canEdit}
                      className="w-24"
                    />
                    <span className="text-sm text-gray-600">
                      (0 = no decay, 0.05 = 5% monthly)
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">
                    Credits automatically decay over time to encourage circulation
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Enabled Categories</CardTitle>
              <CardDescription>
                Choose which types of requests are allowed in your circle
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {AVAILABLE_CATEGORIES.map((category) => (
                  <Badge
                    key={category}
                    variant={selectedCategories.includes(category) ? "default" : "outline"}
                    className={`cursor-pointer transition-colors ${canEdit ? 'hover:bg-opacity-80' : 'cursor-not-allowed'}`}
                    onClick={() => toggleCategory(category)}
                  >
                    {category}
                  </Badge>
                ))}
              </div>
              <p className="text-sm text-gray-600 mt-4">
                Click categories to enable/disable them. If none are selected, all categories are allowed.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {canEdit && (
        <div className="flex justify-end">
          <Button type="submit" disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      )}

      {!canEdit && (
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            You need Owner or Admin permissions to edit circle settings.
          </AlertDescription>
        </Alert>
      )}
    </form>
  );
}