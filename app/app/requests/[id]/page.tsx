import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  User, Calendar, MapPin, Clock, Star, Zap, Shield, 
  Image as ImageIcon, AlertCircle, CheckCircle, XCircle,
  MessageSquare
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";

async function getRequestDetails(requestId: string, userId: string) {
  return await prisma.request.findFirst({
    where: {
      id: requestId,
      circle: {
        memberships: {
          some: {
            userId
          }
        }
      }
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true
        }
      },
      circle: {
        select: {
          id: true,
          name: true
        }
      },
      bookings: {
        include: {
          provider: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        },
        orderBy: {
          createdAt: "desc"
        }
      }
    }
  });
}

const EFFORT_LABELS = {
  1: "Very Light (< 15 min)",
  2: "Light (15-30 min)",
  3: "Medium (30-60 min)", 
  4: "Heavy (1-2 hours)",
  5: "Very Heavy (2+ hours)"
};

function getTierIcon(tier: string) {
  switch (tier) {
    case "PRIORITY": return <Zap className="h-4 w-4" />;
    case "GUARANTEED": return <Shield className="h-4 w-4" />;
    default: return <Star className="h-4 w-4" />;
  }
}

function getTierColor(tier: string) {
  switch (tier) {
    case "PRIORITY": return "bg-blue-100 text-blue-800";
    case "GUARANTEED": return "bg-green-100 text-green-800";
    default: return "bg-gray-100 text-gray-800";
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case "COMPLETED": return <CheckCircle className="h-4 w-4 text-green-600" />;
    case "CANCELLED": return <XCircle className="h-4 w-4 text-red-600" />;
    case "BOOKED": return <Clock className="h-4 w-4 text-blue-600" />;
    default: return <AlertCircle className="h-4 w-4 text-orange-600" />;
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case "COMPLETED": return "bg-green-100 text-green-800";
    case "CANCELLED": return "bg-red-100 text-red-800";
    case "BOOKED": return "bg-blue-100 text-blue-800";
    default: return "bg-orange-100 text-orange-800";
  }
}

export default async function RequestDetailsPage({ params }: { params: { id: string } }) {
  const session = await auth();
  
  if (!session?.user?.id) {
    redirect("/login");
  }

  const request = await getRequestDetails(params.id, session.user.id);
  
  if (!request) {
    notFound();
  }

  const isOwner = request.userId === session.user.id;
  const canRespond = !isOwner && request.status === "OPEN";

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-8">
        <Link 
          href={`/app/circles/${request.circle.id}`}
          className="text-sm text-gray-600 hover:text-gray-800 mb-4 inline-block"
        >
          ← Back to {request.circle.name}
        </Link>
        
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-h2 font-bold">{request.title}</h1>
              <Badge 
                variant="secondary" 
                className={`${getTierColor(request.tier)} flex items-center gap-1`}
              >
                {getTierIcon(request.tier)}
                {request.tier}
              </Badge>
              <Badge 
                variant="secondary"
                className={`${getStatusColor(request.status)} flex items-center gap-1`}
              >
                {getStatusIcon(request.status)}
                {request.status}
              </Badge>
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
              <div className="flex items-center gap-1">
                <User className="h-4 w-4" />
                <span>{request.user.name}</span>
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>{formatDistanceToNow(new Date(request.createdAt), { addSuffix: true })}</span>
              </div>
            </div>
          </div>
          
          {canRespond && (
            <div className="ml-4">
              <Button size="lg">
                <MessageSquare className="h-4 w-4 mr-2" />
                Respond to Request
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Photo */}
          {request.photoBase64 && (
            <Card>
              <CardContent className="p-4">
                <img 
                  src={request.photoBase64} 
                  alt={request.title}
                  className="w-full h-64 object-cover rounded"
                />
              </CardContent>
            </Card>
          )}

          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700 whitespace-pre-wrap">
                {request.description}
              </p>
            </CardContent>
          </Card>

          {/* Special Requirements */}
          {request.specialRequirements && (
            <Card>
              <CardHeader>
                <CardTitle>Special Requirements</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700">
                  {request.specialRequirements}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Equipment Needed */}
          {request.equipmentNeeded && request.equipmentNeeded.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Equipment Needed</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {request.equipmentNeeded.map((equipment: string, index: number) => (
                    <Badge key={index} variant="outline">
                      {equipment}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Responses/Bookings */}
          {request.bookings.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Responses ({request.bookings.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {request.bookings.map((booking: any) => (
                    <div key={booking.id} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">{booking.provider.name}</h4>
                          <p className="text-sm text-gray-600">
                            Responded {formatDistanceToNow(new Date(booking.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                        <Badge variant="outline" className={getStatusColor(booking.status)}>
                          {booking.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Key Details */}
          <Card>
            <CardHeader>
              <CardTitle>Request Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Credits Offered</span>
                <Badge variant="default" className="bg-green-100 text-green-800">
                  {request.creditsOffered}
                </Badge>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Category</span>
                <Badge variant="outline">
                  {request.category.replace('_', ' ')}
                </Badge>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Effort Level</span>
                <Badge variant="outline">
                  {EFFORT_LABELS[request.effortLevel as keyof typeof EFFORT_LABELS]}
                </Badge>
              </div>

              {request.city && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Location</span>
                  <div className="text-right text-sm">
                    <div>{request.city}</div>
                    {request.locationRadius && (
                      <div className="text-gray-500">
                        {request.locationRadius}km radius
                      </div>
                    )}
                  </div>
                </div>
              )}

              {request.timeWindowStart && (
                <div>
                  <span className="text-sm text-gray-600 block mb-1">Time Window</span>
                  <div className="text-sm">
                    <div>
                      Start: {new Date(request.timeWindowStart).toLocaleString()}
                    </div>
                    {request.timeWindowEnd && (
                      <div>
                        End: {new Date(request.timeWindowEnd).toLocaleString()}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {request.expiresAt && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Expires</span>
                  <div className="text-sm text-orange-600">
                    {formatDistanceToNow(new Date(request.expiresAt), { addSuffix: true })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isOwner && request.status === "OPEN" && (
                <>
                  <Button variant="outline" className="w-full">
                    Edit Request
                  </Button>
                  <Button variant="outline" className="w-full text-red-600 hover:text-red-700">
                    Cancel Request
                  </Button>
                </>
              )}
              
              {canRespond && (
                <Button className="w-full" size="lg">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  I Can Help
                </Button>
              )}

              <Button variant="ghost" className="w-full">
                Share Request
              </Button>
              
              <Button variant="ghost" className="w-full">
                Report Issue
              </Button>
            </CardContent>
          </Card>

          {/* Tier Benefits */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {getTierIcon(request.tier)}
                {request.tier} Tier Benefits
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm space-y-1">
                {request.tier === "GUARANTEED" && (
                  <>
                    <div>• Top priority in feed</div>
                    <div>• Instant push notifications</div>
                    <div>• Guarantee fund coverage</div>
                    <div>• Maximum search radius</div>
                  </>
                )}
                {request.tier === "PRIORITY" && (
                  <>
                    <div>• Highlighted in feed</div>
                    <div>• Push notifications to members</div>
                    <div>• Higher queue position</div>
                  </>
                )}
                {request.tier === "BASIC" && (
                  <>
                    <div>• Standard visibility</div>
                    <div>• Normal response time</div>
                    <div>• Basic support</div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}