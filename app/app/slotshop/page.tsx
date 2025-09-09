import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { SlotDiscovery } from "@/components/slotshop/SlotDiscovery";
import { PublishSlotForm } from "@/components/slotshop/PublishSlotForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Clock, DollarSign, Users, TrendingUp, 
  Store, Calendar
} from "lucide-react";
import { format } from "date-fns";

export default async function SlotShopPage() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return <div>Please sign in to access SlotShop</div>;
  }

  // Get user's circle memberships to find available circles
  const memberships = await prisma.membership.findMany({
    where: { userId },
    include: {
      circle: {
        select: {
          id: true,
          name: true,
          _count: {
            select: {
              memberships: true,
              slots: {
                where: {
                  status: "OPEN",
                  start: { gte: new Date() }
                }
              }
            }
          }
        }
      }
    }
  });

  // Get user's published slots
  const mySlots = await prisma.slot.findMany({
    where: {
      providerId: userId,
      status: "OPEN",
      start: { gte: new Date() }
    },
    include: {
      circle: {
        select: { name: true }
      },
      _count: {
        select: {
          bookings: {
            where: {
              status: { in: ["PENDING", "CONFIRMED"] }
            }
          }
        }
      }
    },
    orderBy: { start: "asc" }
  });

  // Get user's upcoming bookings (as booker)
  const myBookings = await prisma.booking.findMany({
    where: {
      bookerId: userId,
      slot: {
        start: { gte: new Date() }
      },
      status: { in: ["PENDING", "CONFIRMED"] }
    },
    include: {
      slot: {
        include: {
          provider: {
            select: { name: true }
          },
          circle: {
            select: { name: true }
          }
        }
      }
    },
    orderBy: {
      slot: { start: "asc" }
    }
  });

  // Calculate stats
  const totalEarningsToday = mySlots.reduce((sum, slot) => {
    const duration = Math.round(
      (new Date(slot.end).getTime() - new Date(slot.start).getTime()) / (1000 * 60)
    );
    return sum + (duration * slot.pricePerMinute);
  }, 0);

  const totalCircles = memberships.length;
  const totalAvailableSlots = memberships.reduce((sum, m) => sum + m.circle._count.slots, 0);

  // Check if user has pro access (simplified check)
  const userHasProAccess = memberships.some(m => m.role === "OWNER");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">SlotShop</h1>
          <p className="text-gray-600 mt-1">Make your availability a product</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-blue-50 text-blue-700">
            <Store className="h-3 w-3 mr-1" />
            Marketplace
          </Badge>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">My Published Slots</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mySlots.length}</div>
            <p className="text-xs text-muted-foreground">
              Active availability
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">My Bookings</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{myBookings.length}</div>
            <p className="text-xs text-muted-foreground">
              Upcoming sessions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Potential Earnings</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalEarningsToday}</div>
            <p className="text-xs text-muted-foreground">
              If all slots booked
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available in Circles</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalAvailableSlots}</div>
            <p className="text-xs text-muted-foreground">
              From {totalCircles} circles
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="discover" className="space-y-4">
        <TabsList>
          <TabsTrigger value="discover">Discover & Book</TabsTrigger>
          <TabsTrigger value="publish">Publish Availability</TabsTrigger>
          <TabsTrigger value="manage">Manage My Slots</TabsTrigger>
        </TabsList>

        <TabsContent value="discover" className="space-y-4">
          {memberships.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Join a Circle First</CardTitle>
                <CardDescription>
                  You need to be part of a circle to access SlotShop
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Alert>
                  <Users className="h-4 w-4" />
                  <AlertDescription>
                    SlotShop lets you book availability from your circle members. 
                    Join or create a circle to get started.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Circle Selector */}
              <div className="flex items-center gap-4 flex-wrap">
                <span className="text-sm font-medium">Browse slots in:</span>
                {memberships.map((membership) => (
                  <Badge 
                    key={membership.circle.id} 
                    variant="outline" 
                    className="cursor-pointer hover:bg-accent"
                  >
                    {membership.circle.name} ({membership.circle._count.slots} slots)
                  </Badge>
                ))}
              </div>

              {/* Use the first circle for now - in a full implementation, this would be selectable */}
              <SlotDiscovery 
                circleId={memberships[0].circle.id}
                userHasProAccess={userHasProAccess}
              />
            </div>
          )}
        </TabsContent>

        <TabsContent value="publish" className="space-y-4">
          {memberships.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Join a Circle First</CardTitle>
                <CardDescription>
                  You need to be part of a circle to publish availability
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Publish Your Availability</CardTitle>
                  <CardDescription>
                    Create bookable time slots and earn credits when others book your time
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Ready to earn credits?</p>
                      <p className="text-sm text-gray-600">
                        Publish availability windows and let others book specific durations
                      </p>
                    </div>
                    {/* Use the first circle for publishing - in full implementation, this would be selectable */}
                    <PublishSlotForm circleId={memberships[0].circle.id} />
                  </div>
                </CardContent>
              </Card>

              {/* Quick Tips */}
              <Alert>
                <TrendingUp className="h-4 w-4" />
                <AlertDescription>
                  <strong>Pro Tip:</strong> Start with short 5-10 minute slots at 2-3 credits/min. 
                  These book quickly and help you build reputation!
                </AlertDescription>
              </Alert>
            </div>
          )}
        </TabsContent>

        <TabsContent value="manage" className="space-y-4">
          <div className="grid gap-6 md:grid-cols-2">
            {/* My Published Slots */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  My Published Slots ({mySlots.length})
                </CardTitle>
                <CardDescription>
                  Your active availability windows
                </CardDescription>
              </CardHeader>
              <CardContent>
                {mySlots.length === 0 ? (
                  <div className="text-center py-6 text-gray-500">
                    <Store className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No published slots yet</p>
                    <p className="text-sm">Create your first availability window!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {mySlots.slice(0, 3).map((slot) => {
                      const duration = Math.round(
                        (new Date(slot.end).getTime() - new Date(slot.start).getTime()) / (1000 * 60)
                      );
                      const maxEarnings = duration * slot.pricePerMinute;
                      
                      return (
                        <div 
                          key={slot.id} 
                          className="p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="font-medium text-sm line-clamp-1">
                                {slot.title}
                              </div>
                              <div className="text-xs text-gray-600 mt-1">
                                {format(new Date(slot.start), "MMM d, h:mm a")} • {duration}min
                              </div>
                              <div className="text-xs text-gray-500">
                                {slot.circle.name}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-medium text-green-700">
                                {maxEarnings} credits max
                              </div>
                              <div className="text-xs text-gray-600">
                                {slot._count.bookings} bookings
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {mySlots.length > 3 && (
                      <div className="text-center pt-2">
                        <span className="text-sm text-gray-500">
                          +{mySlots.length - 3} more slots
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* My Upcoming Bookings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  My Bookings ({myBookings.length})
                </CardTitle>
                <CardDescription>
                  Time you&apos;ve booked with others
                </CardDescription>
              </CardHeader>
              <CardContent>
                {myBookings.length === 0 ? (
                  <div className="text-center py-6 text-gray-500">
                    <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No upcoming bookings</p>
                    <p className="text-sm">Book some availability to get help!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {myBookings.slice(0, 3).map((booking) => (
                      <div 
                        key={booking.id} 
                        className="p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="font-medium text-sm line-clamp-1">
                              {booking.slot.title}
                            </div>
                            <div className="text-xs text-gray-600 mt-1">
                              {format(new Date(booking.slot.start), "MMM d, h:mm a")} • {booking.duration}min
                            </div>
                            <div className="text-xs text-gray-500">
                              with {booking.slot.provider.name}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-medium text-blue-700">
                              {booking.totalCredits} credits
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {booking.status.toLowerCase()}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                    {myBookings.length > 3 && (
                      <div className="text-center pt-2">
                        <span className="text-sm text-gray-500">
                          +{myBookings.length - 3} more bookings
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}