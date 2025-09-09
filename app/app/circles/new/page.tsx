"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Users } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

const CreateCircleSchema = z.object({
  name: z.string().min(2).max(50),
  description: z.string().optional(),
  city: z.string().max(100).optional(),
  isPrivate: z.boolean().default(false)
});

type CreateCircleData = z.infer<typeof CreateCircleSchema>;

export default function NewCirclePage() {
  const [isCreating, setIsCreating] = useState(false);
  const router = useRouter();

  const form = useForm<CreateCircleData>({
    resolver: zodResolver(CreateCircleSchema),
    defaultValues: {
      name: "",
      description: "",
      city: "",
      isPrivate: false
    }
  });

  const handleCreate = async (data: CreateCircleData) => {
    setIsCreating(true);
    try {
      const response = await fetch("/api/circles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        throw new Error("Failed to create circle");
      }

      const circle = await response.json();
      toast.success("Circle created successfully!");
      router.push(`/app/circles/${circle.id}`);
    } catch (error) {
      toast.error("Failed to create circle");
      console.error("Error creating circle:", error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-2xl">
      <div className="mb-8">
        <Link 
          href="/app/circles"
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-800 mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Circles
        </Link>
        
        <div className="text-center">
          <Users className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h1 className="text-h2 font-bold">Create a New Circle</h1>
          <p className="text-gray-600 mt-2">
            Start a private community for exchanging favors with people you trust
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Circle Details</CardTitle>
          <CardDescription>
            Set up your circle with a name and description that helps members understand its purpose
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(handleCreate)} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Circle Name *</Label>
              <Input
                id="name"
                {...form.register("name")}
                placeholder="My Neighborhood Circle"
              />
              {form.formState.errors.name && (
                <p className="text-sm text-red-500">{form.formState.errors.name.message}</p>
              )}
              <p className="text-sm text-gray-600">
                Choose a clear, friendly name that describes your community
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                {...form.register("description")}
                placeholder="A circle for neighbors to help each other with daily tasks..."
                rows={3}
              />
              <p className="text-sm text-gray-600">
                Explain what your circle is about and what kinds of favors you'll exchange
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                {...form.register("city")}
                placeholder="San Francisco, CA"
              />
              <p className="text-sm text-gray-600">
                Help members find local circles and in-person favors
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="isPrivate"
                  checked={form.watch("isPrivate")}
                  onCheckedChange={(checked) => form.setValue("isPrivate", checked)}
                />
                <Label htmlFor="isPrivate">Make this a private circle</Label>
              </div>
              
              {form.watch("isPrivate") ? (
                <Alert>
                  <AlertDescription>
                    <strong>Private circles</strong> require approval for new members. People can join via invitation links or by submitting join requests that you can approve or reject.
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert>
                  <AlertDescription>
                    <strong>Public circles</strong> allow anyone to join immediately. This is great for open communities but gives you less control over membership.
                  </AlertDescription>
                </Alert>
              )}
            </div>

            <div className="flex justify-end space-x-4 pt-6 border-t">
              <Link href="/app/circles">
                <Button variant="outline" type="button">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" disabled={isCreating}>
                {isCreating ? "Creating..." : "Create Circle"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}