"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  User, Clock, Phone, Mail, MessageSquare, 
  CheckCircle, XCircle, AlertCircle 
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

interface Offer {
  id: string;
  status: string;
  message: string | null;
  proposedStartAt: string | null;
  estimatedHours: number | null;
  helperPhone: string | null;
  helperEmail: string | null;
  helper: {
    id: string;
    name: string;
    email?: string;
    city: string | null;
  };
  createdAt: string;
}

interface OffersListProps {
  requestId: string;
  isOwner: boolean;
  requestStatus: string;
  onOfferAccepted?: () => void;
}

export function OffersList({ requestId, isOwner, requestStatus, onOfferAccepted }: OffersListProps) {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchOffers();
  }, [requestId]);

  const fetchOffers = async () => {
    try {
      const response = await fetch(`/api/requests/${requestId}/offers`);
      if (response.ok) {
        const data = await response.json();
        setOffers(data);
      }
    } catch (error) {
      console.error("Error fetching offers:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleOfferAction = async (offerId: string, action: "accept" | "reject") => {
    setActionLoading(offerId);
    try {
      const response = await fetch(`/api/offers/${offerId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ action })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Failed to ${action} offer`);
      }

      const actionText = action === "accept" ? "accepted" : "rejected";
      toast.success(`Offer ${actionText} successfully!`);
      
      // Refresh offers list
      fetchOffers();
      
      if (action === "accept" && onOfferAccepted) {
        onOfferAccepted();
      }
    } catch (error: any) {
      toast.error(error.message || `Failed to ${action} offer`);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="text-center text-gray-500">Loading offers...</div>
        </CardContent>
      </Card>
    );
  }

  if (offers.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Offers</CardTitle>
          <CardDescription>
            {isOwner 
              ? "People who want to help with your request will appear here" 
              : "No one has offered to help yet"
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No offers yet</p>
            {!isOwner && (
              <p className="text-sm mt-2">Be the first to offer help!</p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Offers ({offers.length})</CardTitle>
        <CardDescription>
          {isOwner 
            ? "People who want to help with your request" 
            : "Others who have offered to help"
          }
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {offers.map((offer) => (
            <div key={offer.id} className="border rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div>
                    <h4 className="font-medium flex items-center gap-2">
                      {offer.helper.name}
                      <Badge variant="outline" className="text-xs">
                        {offer.status}
                      </Badge>
                    </h4>
                    <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {offer.helper.city || "Location not specified"}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(offer.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action buttons for request owner */}
                {isOwner && offer.status === "PENDING" && requestStatus === "OPEN" && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleOfferAction(offer.id, "accept")}
                      disabled={actionLoading === offer.id}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOfferAction(offer.id, "reject")}
                      disabled={actionLoading === offer.id}
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Decline
                    </Button>
                  </div>
                )}
              </div>

              {/* Helper's message */}
              {offer.message && (
                <div className="mb-3">
                  <p className="text-gray-700 text-sm bg-gray-50 p-3 rounded italic">
                    &quot;{offer.message}&quot;
                  </p>
                </div>
              )}

              {/* Proposed details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                {offer.proposedStartAt && (
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-gray-400" />
                    <span>Can start: {new Date(offer.proposedStartAt).toLocaleString()}</span>
                  </div>
                )}
                
                {offer.estimatedHours && (
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-gray-400" />
                    <span>Estimated: {offer.estimatedHours} hours</span>
                  </div>
                )}
              </div>

              {/* Contact info (only show if accepted or if current user is the helper) */}
              {(offer.status === "ACCEPTED" || !isOwner) && (offer.helperPhone || offer.helperEmail) && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded">
                  <div className="text-sm font-medium text-blue-800 mb-2">
                    {offer.status === "ACCEPTED" ? "Contact Information:" : "Your Contact Info:"}
                  </div>
                  <div className="space-y-1 text-sm text-blue-700">
                    {offer.helperPhone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-3 w-3" />
                        <a href={`tel:${offer.helperPhone}`} className="hover:underline">
                          {offer.helperPhone}
                        </a>
                      </div>
                    )}
                    {offer.helperEmail && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-3 w-3" />
                        <a href={`mailto:${offer.helperEmail}`} className="hover:underline">
                          {offer.helperEmail}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Status-specific alerts */}
              {offer.status === "ACCEPTED" && (
                <Alert className="mt-3 border-green-200 bg-green-50">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-700">
                    <strong>Offer Accepted!</strong> You can now coordinate directly with {offer.helper.name}.
                  </AlertDescription>
                </Alert>
              )}

              {offer.status === "REJECTED" && (
                <Alert className="mt-3 border-red-200 bg-red-50">
                  <XCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-700">
                    This offer was declined.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          ))}
        </div>

        {isOwner && requestStatus === "OPEN" && offers.some(o => o.status === "PENDING") && (
          <Alert className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Choose carefully!</strong> Accepting an offer will automatically reject all other offers 
              and create a booking with the selected helper.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}