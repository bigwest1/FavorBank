"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  Play, Square, Clock, MapPin, User, Camera,
  CheckCircle, Heart, Sparkles, AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import confetti from "canvas-confetti";

interface Booking {
  id: string;
  status: string;
  duration: number;
  totalCredits: number;
  actualStart?: string;
  actualEnd?: string;
  completedAt?: string;
  completionNotes?: string;
  completionPhotoBase64?: string;
  bookerThanks?: string;
  providerThanks?: string;
  checkinLatitude?: number;
  checkinLongitude?: number;
  slot: {
    id: string;
    title: string;
    description?: string;
    start: string;
    end: string;
    location?: string;
    provider: {
      id: string;
      name: string;
    };
  };
  provider: {
    id: string;
    name: string;
  };
  booker: {
    id: string;
    name: string;
  };
}

interface BookingCheckInOutProps {
  booking: Booking;
  currentUserId: string;
  onBookingUpdate?: (booking: Booking) => void;
}

export function BookingCheckInOut({ booking, currentUserId, onBookingUpdate }: BookingCheckInOutProps) {
  const [isCheckingin, setIsCheckingIn] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isLeavingThanks, setIsLeavingThanks] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [completionNotes, setCompletionNotes] = useState("");
  const [completionPhoto, setCompletionPhoto] = useState<string>("");
  const [thanksMessage, setThanksMessage] = useState("");
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  const [showThanksDialog, setShowThanksDialog] = useState(false);

  const isProvider = currentUserId === booking.providerId;
  const isBooker = currentUserId === booking.bookerId;
  const canStart = booking.status === "CONFIRMED";
  const inProgress = booking.status === "IN_PROGRESS";
  const isCompleted = booking.status === "COMPLETED";
  
  const slotStart = new Date(booking.slot.start);
  const now = new Date();
  const fifteenMinutesEarly = new Date(slotStart.getTime() - 15 * 60 * 1000);
  const canCheckIn = now >= fifteenMinutesEarly;

  // Timer for in-progress bookings
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (inProgress && booking.actualStart) {
      interval = setInterval(() => {
        const startTime = new Date(booking.actualStart!).getTime();
        const currentTime = Date.now();
        setElapsedTime(Math.floor((currentTime - startTime) / 1000));
      }, 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [inProgress, booking.actualStart]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const requestGeolocation = (): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported"));
        return;
      }
      
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      });
    });
  };

  const handleCheckIn = async () => {
    setIsCheckingIn(true);
    try {
      // Request geolocation
      const position = await requestGeolocation();
      const { latitude, longitude } = position.coords;

      const response = await fetch(`/api/bookings/${booking.id}/checkin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ latitude, longitude })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to check in");
      }

      const updatedBooking = await response.json();
      toast.success("Checked in successfully! Timer started.");
      
      if (onBookingUpdate) {
        onBookingUpdate(updatedBooking);
      }
    } catch (error: any) {
      if (error.message.includes("geolocation") || error.message.includes("location")) {
        toast.error("Location access is required to check in. Please enable location services and try again.");
      } else {
        toast.error(error.message || "Failed to check in");
      }
    } finally {
      setIsCheckingIn(false);
    }
  };

  const convertImageToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove the data URL prefix to get just the base64 data
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      toast.error("Photo must be smaller than 5MB");
      return;
    }

    try {
      const base64 = await convertImageToBase64(file);
      setCompletionPhoto(base64);
      toast.success("Photo uploaded successfully");
    } catch (error) {
      toast.error("Failed to upload photo");
    }
  };

  const handleComplete = async () => {
    setIsCompleting(true);
    try {
      const response = await fetch(`/api/bookings/${booking.id}/complete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          completionNotes,
          photoBase64: completionPhoto || undefined,
          thanks: thanksMessage || undefined
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to complete booking");
      }

      const result = await response.json();
      
      // Trigger confetti animation
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });

      toast.success("🎉 Booking completed! Credits released.");
      setShowCompletionDialog(false);
      
      if (onBookingUpdate) {
        onBookingUpdate(result.booking);
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to complete booking");
    } finally {
      setIsCompleting(false);
    }
  };

  const handleLeaveThanks = async () => {
    if (!thanksMessage.trim()) {
      toast.error("Please enter a thank you message");
      return;
    }

    setIsLeavingThanks(true);
    try {
      const response = await fetch(`/api/bookings/${booking.id}/thanks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: thanksMessage.trim()
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to send thank you");
      }

      const result = await response.json();
      toast.success(result.message);
      setShowThanksDialog(false);
      setThanksMessage("");
      
      if (onBookingUpdate) {
        onBookingUpdate(result.booking);
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to send thank you");
    } finally {
      setIsLeavingThanks(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Main Booking Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="flex items-center gap-2">
                {booking.slot.title}
                <Badge 
                  variant={
                    booking.status === "COMPLETED" ? "default" : 
                    booking.status === "IN_PROGRESS" ? "secondary" : 
                    "outline"
                  }
                  className={
                    booking.status === "COMPLETED" ? "bg-green-100 text-green-800" :
                    booking.status === "IN_PROGRESS" ? "bg-blue-100 text-blue-800" :
                    "bg-gray-100 text-gray-800"
                  }
                >
                  {booking.status === "IN_PROGRESS" ? "In Progress" : 
                   booking.status === "COMPLETED" ? "Completed" :
                   booking.status}
                </Badge>
              </CardTitle>
              <CardDescription>
                {format(new Date(booking.slot.start), "MMM d, h:mm a")} • {booking.duration} minutes
              </CardDescription>
            </div>
            <div className="text-right">
              <div className="text-lg font-semibold text-green-700">
                {booking.totalCredits} credits
              </div>
              <div className="text-sm text-gray-600">
                {isProvider ? "You earn" : "You pay"}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Participants */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-gray-400" />
                <div>
                  <div className="font-medium">Provider</div>
                  <div className="text-gray-600">{booking.provider.name}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-gray-400" />
                <div>
                  <div className="font-medium">Booker</div>
                  <div className="text-gray-600">{booking.booker.name}</div>
                </div>
              </div>
            </div>

            {/* Location */}
            {booking.slot.location && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-gray-400" />
                <span>{booking.slot.location}</span>
              </div>
            )}

            {/* Timer for in-progress bookings */}
            {inProgress && (
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex items-center justify-center gap-3">
                  <Clock className="h-6 w-6 text-blue-600" />
                  <div className="text-center">
                    <div className="text-2xl font-mono font-bold text-blue-800">
                      {formatTime(elapsedTime)}
                    </div>
                    <div className="text-sm text-blue-600">Session in progress</div>
                  </div>
                </div>
              </div>
            )}

            {/* Check-in Alert */}
            {canStart && !canCheckIn && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  You can check in up to 15 minutes before the scheduled start time.
                  Available at {format(fifteenMinutesEarly, "h:mm a")}.
                </AlertDescription>
              </Alert>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t">
              {/* Check In Button */}
              {canStart && canCheckIn && (
                <Button 
                  onClick={handleCheckIn}
                  disabled={isCheckingin}
                  className="flex-1"
                >
                  <Play className="h-4 w-4 mr-2" />
                  {isCheckingin ? "Checking In..." : "Start Session"}
                </Button>
              )}

              {/* Complete Button */}
              {inProgress && (
                <Dialog open={showCompletionDialog} onOpenChange={setShowCompletionDialog}>
                  <DialogTrigger asChild>
                    <Button variant="secondary" className="flex-1">
                      <Square className="h-4 w-4 mr-2" />
                      Finish Session
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Complete Session</DialogTitle>
                      <DialogDescription>
                        Mark this session as complete and release the escrowed credits
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="notes">Completion Notes (Optional)</Label>
                        <Textarea
                          id="notes"
                          placeholder="How did the session go? Any notes for the other party..."
                          value={completionNotes}
                          onChange={(e) => setCompletionNotes(e.target.value)}
                          maxLength={500}
                        />
                        <div className="text-xs text-gray-500 text-right mt-1">
                          {completionNotes.length}/500
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="photo">Optional Photo</Label>
                        <div className="mt-1">
                          <input
                            id="photo"
                            type="file"
                            accept="image/*"
                            onChange={handlePhotoUpload}
                            className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                          />
                          {completionPhoto && (
                            <div className="mt-2">
                              <img
                                src={`data:image/jpeg;base64,${completionPhoto}`}
                                alt="Completion photo"
                                className="max-w-full h-32 object-cover rounded"
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="thanks">Thank You Message (Optional)</Label>
                        <Textarea
                          id="thanks"
                          placeholder={`Thank ${isProvider ? booking.booker.name : booking.provider.name} for the session...`}
                          value={thanksMessage}
                          onChange={(e) => setThanksMessage(e.target.value)}
                          maxLength={200}
                        />
                        <div className="text-xs text-gray-500 text-right mt-1">
                          {thanksMessage.length}/200
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <Button 
                          variant="outline" 
                          onClick={() => setShowCompletionDialog(false)}
                          className="flex-1"
                        >
                          Cancel
                        </Button>
                        <Button 
                          onClick={handleComplete}
                          disabled={isCompleting}
                          className="flex-1"
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          {isCompleting ? "Completing..." : "Release Credits"}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>

            {/* Completion Info */}
            {isCompleted && (
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="font-medium text-green-800">Session Completed</span>
                  <Sparkles className="h-4 w-4 text-green-600" />
                </div>
                {booking.completedAt && (
                  <div className="text-sm text-green-700">
                    Completed on {format(new Date(booking.completedAt), "MMM d, h:mm a")}
                  </div>
                )}
                {booking.completionNotes && (
                  <div className="mt-2 text-sm text-green-800">
                    <strong>Notes:</strong> {booking.completionNotes}
                  </div>
                )}
                {booking.completionPhotoBase64 && (
                  <div className="mt-2">
                    <img
                      src={`data:image/jpeg;base64,${booking.completionPhotoBase64}`}
                      alt="Completion photo"
                      className="max-w-full h-32 object-cover rounded"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Thank You Messages */}
            {isCompleted && (
              <div className="space-y-3">
                {/* Show existing thanks */}
                {(booking.bookerThanks || booking.providerThanks) && (
                  <div className="bg-pink-50 p-3 rounded-lg">
                    <div className="text-sm font-medium text-pink-800 mb-2">
                      <Heart className="h-4 w-4 inline mr-1" />
                      Thank You Messages
                    </div>
                    {booking.bookerThanks && (
                      <div className="text-sm text-pink-700">
                        <strong>{booking.booker.name}:</strong> {booking.bookerThanks}
                      </div>
                    )}
                    {booking.providerThanks && (
                      <div className="text-sm text-pink-700 mt-1">
                        <strong>{booking.provider.name}:</strong> {booking.providerThanks}
                      </div>
                    )}
                  </div>
                )}

                {/* Leave thanks button */}
                {((isProvider && !booking.providerThanks) || (isBooker && !booking.bookerThanks)) && (
                  <Dialog open={showThanksDialog} onOpenChange={setShowThanksDialog}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Heart className="h-4 w-4 mr-2" />
                        Leave Thank You
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Leave a Thank You</DialogTitle>
                        <DialogDescription>
                          Share your appreciation with {isProvider ? booking.booker.name : booking.provider.name}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <Textarea
                          placeholder={`Thank ${isProvider ? booking.booker.name : booking.provider.name} for the session...`}
                          value={thanksMessage}
                          onChange={(e) => setThanksMessage(e.target.value)}
                          maxLength={200}
                        />
                        <div className="text-xs text-gray-500 text-right">
                          {thanksMessage.length}/200
                        </div>
                        <div className="flex gap-3">
                          <Button 
                            variant="outline" 
                            onClick={() => {
                              setShowThanksDialog(false);
                              setThanksMessage("");
                            }}
                            className="flex-1"
                          >
                            Cancel
                          </Button>
                          <Button 
                            onClick={handleLeaveThanks}
                            disabled={isLeavingThanks || !thanksMessage.trim()}
                            className="flex-1"
                          >
                            <Heart className="h-4 w-4 mr-2" />
                            {isLeavingThanks ? "Sending..." : "Send Thanks"}
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}