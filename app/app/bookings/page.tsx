import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  User, Calendar, MapPin, Clock, CheckCircle, XCircle, Play,
  Mail, MessageSquare, DollarSign
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
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
              id: true,
              name: true
            }
          }
        }
      },
      slot: {
        include: {
          circle: {
            select: {
              id: true,
              name: true
            }
          }
        }
      },
      booker: {
        select: {
          id: true,
          name: true,
          email: true
        }
      }
    },
    orderBy: [
      { status: "asc" }, // Show in-progress and confirmed first
      { createdAt: "desc" }
    ]
  });

  // Get bookings where user is the booker (getting help via SlotShop or requests)
  const asBooker = await prisma.booking.findMany({
    where: {
      bookerId: userId
    },
    include: {
      slot: {
        include: {
          provider: {
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
          }
        }
      },
      provider: {
        select: {
          id: true,
          name: true,
          email: true
        }
      },
      request: {
        select: {
          id: true,
          title: true,
          category: true
        }
      }
    },
    orderBy: [
      { status: "asc" }, // Show in-progress and confirmed first
      { createdAt: "desc" }
    ]
  });

  // Also get traditional request-based bookings where user is requester
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
              id: true,
              name: true
            }
          }
        }
      },
      slot: {
        select: {
          id: true,
          start: true,
          end: true
        }
      }
    },
    orderBy: [
      { status: "asc" },
      { createdAt: "desc" }
    ]
  });

  return { asProvider, asBooker, asRequester };
}

function getStatusColor(status: string) {
  switch (status) {
    case "COMPLETED": return "bg-green-100 text-green-800";
    case "CANCELLED": return "bg-red-100 text-red-800";
    case "CONFIRMED": return "bg-blue-100 text-blue-800";
    case "IN_PROGRESS": return "bg-purple-100 text-purple-800";
    default: return "bg-orange-100 text-orange-800";
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case "COMPLETED": return <CheckCircle className="h-4 w-4" />;
    case "CANCELLED": return <XCircle className="h-4 w-4" />;
    case "IN_PROGRESS": return <Play className="h-4 w-4" />;
    default: return <Clock className="h-4 w-4" />;
  }
}

function getStatusText(status: string) {
  switch (status) {
    case "IN_PROGRESS": return "In Progress";
    default: return status;
  }
}

export default async function BookingsPage() {
  const session = await auth();
  
  if (!session?.user?.id) {
    redirect("/login");
  }

  const { asProvider, asBooker, asRequester } = await getUserBookings(session.user.id);
  
  // Combine asBooker and asRequester for "Getting Help" tab
  const allGettingHelp = [...asBooker, ...asRequester];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">My Bookings</h1>
        <p className="text-gray-600 mt-2">
          Manage your active and completed sessions
        </p>
      </div>

      <Tabs defaultValue="providing" className="space-y-6">
        <TabsList>
          <TabsTrigger value="providing">
            Providing Help ({asProvider.length})
          </TabsTrigger>
          <TabsTrigger value="getting">
            Getting Help ({allGettingHelp.length})
          </TabsTrigger>
        </TabsList>

        {/* Bookings where user is providing help */}
        <TabsContent value="providing">
          {asProvider.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <div className="space-y-4">
                  <div className="text-6xl">🤝</div>
                  <div>
                    <h3 className="text-lg font-semibold mb-2">No Active Help Sessions</h3>
                    <p className="text-gray-600 mb-4">
                      You haven&apos;t offered to help anyone yet. Publish availability or respond to requests!
                    </p>
                    <div className="flex gap-2 justify-center">
                      <Link href="/app/slotshop">
                        <Button>Publish Availability</Button>
                      </Link>
                      <Link href="/app/circles">
                        <Button variant="outline">Browse Requests</Button>
                      </Link>
                    </div>
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
                        <CardTitle className="text-lg flex items-center gap-2">
                          {booking.request ? booking.request.title : booking.slot.title}
                          {booking.status === "IN_PROGRESS" && (
                            <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                              Live Session
                            </Badge>
                          )}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          Helping {booking.booker?.name || booking.request?.user?.name} in{" "}
                          {booking.slot?.circle?.name || booking.request?.circle?.name}
                        </CardDescription>
                      </div>
                      <div className="text-right">
                        <Badge 
                          variant="secondary" 
                          className={`${getStatusColor(booking.status)} flex items-center gap-1 mb-1`}
                        >
                          {getStatusIcon(booking.status)}
                          {getStatusText(booking.status)}
                        </Badge>
                        {booking.totalCredits && (
                          <div className="text-sm text-green-700 font-medium">
                            +{booking.totalCredits} credits
                          </div>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {/* Show slot time for SlotShop bookings */}
                      {booking.slot && (
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            <span>{format(new Date(booking.slot.start), "MMM d, h:mm a")}</span>
                          </div>
                          {booking.duration && (
                            <div className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              <span>{booking.duration} minutes</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Contact info for confirmed bookings */}
                      {booking.status === "CONFIRMED" && (booking.booker || booking.request?.user) && (
                        <div className="bg-blue-50 border border-blue-200 p-3 rounded">
                          <div className="text-sm font-medium text-blue-800 mb-2">Contact Information:</div>
                          <div className="space-y-1 text-sm text-blue-700">
                            <div className="flex items-center gap-2">
                              <Mail className="h-3 w-3" />
                              <a 
                                href={`mailto:${booking.booker?.email || booking.request?.user?.email}`} 
                                className="hover:underline"
                              >
                                {booking.booker?.email || booking.request?.user?.email}
                              </a>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2 pt-2">
                        <Link href={`/app/bookings/${booking.id}`}>
                          <Button variant="outline" size="sm">
                            {booking.status === "IN_PROGRESS" ? "Manage Session" : "View Details"}
                          </Button>
                        </Link>
                        {booking.request && (
                          <Link href={`/app/requests/${booking.request.id}`}>
                            <Button variant="outline" size="sm">
                              View Request
                            </Button>
                          </Link>
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
        <TabsContent value="getting">
          {allGettingHelp.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <div className="space-y-4">
                  <div className="text-6xl">📝</div>
                  <div>
                    <h3 className="text-lg font-semibold mb-2">No Booked Sessions</h3>
                    <p className="text-gray-600 mb-4">
                      You haven&apos;t booked any sessions yet. Browse available slots or post a request!
                    </p>
                    <div className="flex gap-2 justify-center">
                      <Link href="/app/slotshop">
                        <Button>Browse SlotShop</Button>
                      </Link>
                      <Link href="/app/circles">
                        <Button variant="outline">Post Request</Button>
                      </Link>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {allGettingHelp.map((booking: any) => (
                <Card key={booking.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                          {booking.request?.title || booking.slot?.title}
                          {booking.status === "IN_PROGRESS" && (
                            <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                              Live Session
                            </Badge>
                          )}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          {booking.provider.name} is helping you in{" "}
                          {booking.slot?.circle?.name || booking.request?.circle?.name}
                        </CardDescription>
                      </div>
                      <div className="text-right">
                        <Badge 
                          variant="secondary" 
                          className={`${getStatusColor(booking.status)} flex items-center gap-1 mb-1`}
                        >
                          {getStatusIcon(booking.status)}
                          {getStatusText(booking.status)}
                        </Badge>
                        {booking.totalCredits && (
                          <div className="text-sm text-red-700 font-medium">
                            -{booking.totalCredits} credits
                          </div>
                        )}
                        {booking.request?.creditsOffered && (
                          <div className="text-sm text-red-700 font-medium">
                            -{booking.request.creditsOffered} credits
                          </div>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {/* Show slot time for SlotShop bookings */}
                      {booking.slot && (
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            <span>{format(new Date(booking.slot.start), "MMM d, h:mm a")}</span>
                          </div>
                          {booking.duration && (
                            <div className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              <span>{booking.duration} minutes</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Helper contact info */}
                      {booking.status === "CONFIRMED" && (
                        <div className="bg-green-50 border border-green-200 p-3 rounded">
                          <div className="text-sm font-medium text-green-800 mb-2">
                            Provider Contact Information:
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
                        <Link href={`/app/bookings/${booking.id}`}>
                          <Button variant="outline" size="sm">
                            {booking.status === "IN_PROGRESS" ? "Manage Session" : "View Details"}
                          </Button>
                        </Link>
                        {booking.request && (
                          <Link href={`/app/requests/${booking.request.id}`}>
                            <Button variant="outline" size="sm">
                              View Request
                            </Button>
                          </Link>
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