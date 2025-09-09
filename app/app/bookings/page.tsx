import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  User, Calendar, MapPin, Clock, Star, CheckCircle, XCircle,
  Phone, Mail, MessageSquare
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";

async function getUserBookings(userId: string) {
  // Get bookings where user is the provider (helping others)
  const asProvider = await prisma.booking.findMany({
    where: {
      providerId: userId
    },
    include: {
      request: {
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
              name: true
            }
          }
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  // Get bookings where user is the requester (getting help)
  const asRequester = await prisma.booking.findMany({
    where: {
      request: {
        userId
      }
    },
    include: {
      provider: {
        select: {
          id: true,
          name: true,
          email: true
        }
      },
      request: {
        include: {
          circle: {
            select: {
              name: true
            }
          }
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  return { asProvider, asRequester };
}

function getStatusColor(status: string) {
  switch (status) {
    case "COMPLETED": return "bg-green-100 text-green-800";
    case "CANCELLED": return "bg-red-100 text-red-800";
    case "CONFIRMED": return "bg-blue-100 text-blue-800";
    default: return "bg-orange-100 text-orange-800";
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case "COMPLETED": return <CheckCircle className="h-4 w-4" />;
    case "CANCELLED": return <XCircle className="h-4 w-4" />;
    default: return <Clock className="h-4 w-4" />;
  }
}

export default async function BookingsPage() {
  const session = await auth();
  
  if (!session?.user?.id) {
    redirect("/login");
  }

  const { asProvider, asRequester } = await getUserBookings(session.user.id);

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-h2 font-bold">My Bookings</h1>
        <p className="text-gray-600 mt-2">
          Manage your active and past favor exchanges
        </p>
      </div>

      <Tabs defaultValue="helping" className="space-y-6">
        <TabsList>
          <TabsTrigger value="helping">
            Helping Others ({asProvider.length})
          </TabsTrigger>
          <TabsTrigger value="getting-help">
            Getting Help ({asRequester.length})
          </TabsTrigger>
        </TabsList>

        {/* Bookings where user is helping others */}
        <TabsContent value="helping">
          {asProvider.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <div className="space-y-4">
                  <div className="text-6xl">🤝</div>
                  <div>
                    <h3 className="text-lg font-semibold mb-2">No Active Help Sessions</h3>
                    <p className="text-gray-600 mb-4">
                      You haven&apos;t offered to help anyone yet. Browse requests in your circles to get started!
                    </p>
                    <Link href="/app/circles">
                      <Button>Browse Circles</Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {asProvider.map((booking: any) => (
                <Card key={booking.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">
                          <Link 
                            href={`/app/requests/${booking.request.id}`}
                            className="hover:underline"
                          >
                            {booking.request.title}
                          </Link>
                        </CardTitle>
                        <CardDescription className="mt-1">
                          Helping {booking.request.user.name} in {booking.request.circle.name}
                        </CardDescription>
                      </div>
                      <Badge 
                        variant="secondary" 
                        className={`${getStatusColor(booking.status)} flex items-center gap-1`}
                      >
                        {getStatusIcon(booking.status)}
                        {booking.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <p className="text-gray-700 text-sm line-clamp-2">
                        {booking.request.description}
                      </p>
                      
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          <span>{formatDistanceToNow(new Date(booking.createdAt), { addSuffix: true })}</span>
                        </div>
                        <Badge variant="outline" className="bg-green-100 text-green-800">
                          {booking.request.creditsOffered} credits
                        </Badge>
                      </div>

                      {/* Contact info for requester */}
                      {booking.status === "CONFIRMED" && (
                        <div className="bg-blue-50 border border-blue-200 p-3 rounded mt-3">
                          <div className="text-sm font-medium text-blue-800 mb-2">Contact Information:</div>
                          <div className="space-y-1 text-sm text-blue-700">
                            <div className="flex items-center gap-2">
                              <Mail className="h-3 w-3" />
                              <a href={`mailto:${booking.request.user.email}`} className="hover:underline">
                                {booking.request.user.email}
                              </a>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2 pt-2">
                        <Link href={`/app/requests/${booking.request.id}`}>
                          <Button variant="outline" size="sm">
                            View Request
                          </Button>
                        </Link>
                        {booking.status === "CONFIRMED" && (
                          <Button variant="outline" size="sm">
                            <MessageSquare className="h-4 w-4 mr-1" />
                            Contact
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Bookings where user is getting help */}
        <TabsContent value="getting-help">
          {asRequester.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <div className="space-y-4">
                  <div className="text-6xl">📝</div>
                  <div>
                    <h3 className="text-lg font-semibold mb-2">No Requests with Bookings</h3>
                    <p className="text-gray-600 mb-4">
                      You haven&apos;t had any requests accepted yet. Post a request to get started!
                    </p>
                    <Link href="/app/circles">
                      <Button>Post a Request</Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {asRequester.map((booking: any) => (
                <Card key={booking.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">
                          <Link 
                            href={`/app/requests/${booking.request.id}`}
                            className="hover:underline"
                          >
                            {booking.request.title}
                          </Link>
                        </CardTitle>
                        <CardDescription className="mt-1">
                          {booking.provider.name} is helping you in {booking.request.circle.name}
                        </CardDescription>
                      </div>
                      <Badge 
                        variant="secondary" 
                        className={`${getStatusColor(booking.status)} flex items-center gap-1`}
                      >
                        {getStatusIcon(booking.status)}
                        {booking.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <p className="text-gray-700 text-sm line-clamp-2">
                        {booking.request.description}
                      </p>
                      
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          <span>{formatDistanceToNow(new Date(booking.createdAt), { addSuffix: true })}</span>
                        </div>
                        <Badge variant="outline" className="bg-green-100 text-green-800">
                          {booking.request.creditsOffered} credits
                        </Badge>
                      </div>

                      {/* Helper contact info */}
                      {booking.status === "CONFIRMED" && (
                        <div className="bg-green-50 border border-green-200 p-3 rounded mt-3">
                          <div className="text-sm font-medium text-green-800 mb-2">
                            Helper Contact Information:
                          </div>
                          <div className="space-y-1 text-sm text-green-700">
                            <div className="flex items-center gap-2">
                              <Mail className="h-3 w-3" />
                              <a href={`mailto:${booking.provider.email}`} className="hover:underline">
                                {booking.provider.email}
                              </a>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2 pt-2">
                        <Link href={`/app/requests/${booking.request.id}`}>
                          <Button variant="outline" size="sm">
                            View Request
                          </Button>
                        </Link>
                        {booking.status === "CONFIRMED" && (
                          <Button variant="outline" size="sm">
                            <MessageSquare className="h-4 w-4 mr-1" />
                            Contact Helper
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}