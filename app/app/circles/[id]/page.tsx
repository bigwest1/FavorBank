import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Settings, UserPlus, Shield, Crown, Calendar, MapPin } from "lucide-react";
import Link from "next/link";

async function getCircle(circleId: string, userId: string) {
  return await prisma.circle.findFirst({
    where: {
      id: circleId,
      memberships: {
        some: {
          userId
        }
      }
    },
    include: {
      owner: {
        select: {
          id: true,
          name: true,
          email: true
        }
      },
      memberships: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        },
        orderBy: [
          { role: "desc" },
          { createdAt: "asc" }
        ]
      },
      requests: {
        where: {
          status: "OPEN"
        },
        include: {
          user: {
            select: {
              name: true
            }
          }
        },
        take: 5,
        orderBy: {
          createdAt: "desc"
        }
      },
      _count: {
        select: {
          requests: {
            where: {
              status: "OPEN"
            }
          }
        }
      }
    }
  });
}

function getRoleColor(role: string) {
  switch (role) {
    case "OWNER":
      return "bg-yellow-100 text-yellow-800";
    case "ADMIN":
      return "bg-purple-100 text-purple-800";
    case "MODERATOR":
      return "bg-blue-100 text-blue-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

function getRoleIcon(role: string) {
  switch (role) {
    case "OWNER":
      return <Crown className="h-4 w-4" />;
    case "ADMIN":
    case "MODERATOR":
      return <Shield className="h-4 w-4" />;
    default:
      return null;
  }
}

export default async function CirclePage({ params }: { params: { id: string } }) {
  const session = await auth();
  
  if (!session?.user?.id) {
    redirect("/login");
  }

  const circle = await getCircle(params.id, session.user.id);
  
  if (!circle) {
    notFound();
  }

  const userMembership = circle.memberships.find(m => m.userId === session.user.id);
  const canManage = userMembership && ["OWNER", "ADMIN", "MODERATOR"].includes(userMembership.role);

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-start mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-h2 font-bold">{circle.name}</h1>
            {circle.isPrivate && (
              <Badge variant="outline" className="flex items-center gap-1">
                <Shield className="h-3 w-3" />
                Private
              </Badge>
            )}
          </div>
          {circle.description && (
            <p className="text-gray-600 mb-2">{circle.description}</p>
          )}
          <div className="flex items-center gap-4 text-sm text-gray-500">
            {circle.city && (
              <span className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {circle.city}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              {circle.memberships.length} members
            </span>
          </div>
        </div>
        
        <div className="flex gap-2">
          {canManage && (
            <>
              <Link href={`/app/circles/${circle.id}/settings`}>
                <Button variant="outline">
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </Button>
              </Link>
              <Link href={`/app/circles/${circle.id}/invite`}>
                <Button>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Invite
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="requests">
            Requests ({circle._count.requests})
          </TabsTrigger>
          <TabsTrigger value="members">
            Members ({circle.memberships.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Recent Requests
              </CardTitle>
            </CardHeader>
            <CardContent>
              {circle.requests.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  No open requests yet
                </p>
              ) : (
                <div className="space-y-3">
                  {circle.requests.map((request) => (
                    <div key={request.id} className="border rounded-lg p-3">
                      <h4 className="font-medium mb-1">{request.title}</h4>
                      <p className="text-sm text-gray-600">
                        by {request.user.name} • {new Date(request.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                  {circle._count.requests > 5 && (
                    <p className="text-sm text-gray-500 text-center">
                      +{circle._count.requests - 5} more requests
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Your Balance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-4">
                <div className="text-3xl font-bold text-green-600 mb-2">
                  {userMembership?.balanceCredits || 0}
                </div>
                <p className="text-gray-600">Credits Available</p>
                <div className="mt-4 space-y-2">
                  <Link href={`/app/circles/${circle.id}/requests/new`}>
                    <Button className="w-full">
                      Post a Request
                    </Button>
                  </Link>
                  <Button variant="outline" className="w-full">
                    Browse Requests
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="requests">
          <Card>
            <CardHeader>
              <CardTitle>Open Requests</CardTitle>
              <CardDescription>
                Help your circle members by browsing and responding to their requests
              </CardDescription>
            </CardHeader>
            <CardContent>
              {circle.requests.length === 0 ? (
                <div className="text-center py-12">
                  <Calendar className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Open Requests</h3>
                  <p className="text-gray-600 mb-6">
                    Be the first to post a request in this circle!
                  </p>
                  <Link href={`/app/circles/${circle.id}/requests/new`}>
                    <Button>Post a Request</Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {circle.requests.map((request) => (
                    <div key={request.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-semibold mb-2">{request.title}</h4>
                          <p className="text-gray-600 text-sm mb-2">
                            by {request.user.name}
                          </p>
                          <p className="text-sm text-gray-500">
                            Posted {new Date(request.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <Button variant="outline" size="sm">
                          View Details
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="members">
          <Card>
            <CardHeader>
              <CardTitle>Circle Members</CardTitle>
              <CardDescription>
                Everyone who&apos;s part of this favor exchange circle
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {circle.memberships.map((membership) => (
                  <div key={membership.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div>
                        <h4 className="font-medium">{membership.user.name}</h4>
                        <p className="text-sm text-gray-600">{membership.user.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {membership.balanceCredits} credits
                      </Badge>
                      <Badge 
                        className={`${getRoleColor(membership.role)} flex items-center gap-1`}
                      >
                        {getRoleIcon(membership.role)}
                        {membership.role}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}