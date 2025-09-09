import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Plus, Settings, Crown, Shield, UserCheck } from "lucide-react";
import Link from "next/link";

async function getCircles(userId: string) {
  return await prisma.circle.findMany({
    where: {
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
        where: {
          userId
        },
        select: {
          role: true,
          balanceCredits: true
        }
      },
      _count: {
        select: {
          memberships: true,
          requests: {
            where: {
              status: "OPEN"
            }
          }
        }
      }
    },
    orderBy: {
      updatedAt: "desc"
    }
  });
}

function getRoleIcon(role: string) {
  switch (role) {
    case "OWNER":
      return <Crown className="h-4 w-4" />;
    case "ADMIN":
    case "MODERATOR":
      return <Shield className="h-4 w-4" />;
    default:
      return <UserCheck className="h-4 w-4" />;
  }
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

export default async function CirclesPage() {
  const session = await auth();
  
  if (!session?.user?.id) {
    redirect("/login");
  }

  const circles = await getCircles(session.user.id);

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-h2 font-bold">My Circles</h1>
          <p className="text-gray-600 mt-2">
            Manage your favor exchange circles and communities
          </p>
        </div>
        <Link href="/app/circles/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Create Circle
          </Button>
        </Link>
      </div>

      {circles.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Users className="h-16 w-16 mx-auto text-gray-400 mb-4" />
            <CardTitle className="mb-2">No Circles Yet</CardTitle>
            <CardDescription className="mb-6 max-w-md mx-auto">
              Create your first circle to start exchanging favors with your community. 
              Circles are private groups where you can request and offer help to people you trust.
            </CardDescription>
            <Link href="/app/circles/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Circle
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {circles.map((circle) => {
            const membership = circle.memberships[0];
            const canManage = ["OWNER", "ADMIN", "MODERATOR"].includes(membership.role);
            
            return (
              <Card key={circle.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Link 
                          href={`/app/circles/${circle.id}`}
                          className="hover:underline"
                        >
                          {circle.name}
                        </Link>
                        {circle.isPrivate && (
                          <Shield className="h-4 w-4 text-gray-500" />
                        )}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {circle.description || "No description"}
                      </CardDescription>
                    </div>
                    {canManage && (
                      <Link href={`/app/circles/${circle.id}/settings`}>
                        <Button variant="ghost" size="sm">
                          <Settings className="h-4 w-4" />
                        </Button>
                      </Link>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Your Role</span>
                      <Badge 
                        variant="secondary" 
                        className={`${getRoleColor(membership.role)} flex items-center gap-1`}
                      >
                        {getRoleIcon(membership.role)}
                        {membership.role}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Credits</span>
                      <Badge variant="outline">
                        {membership.balanceCredits}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Members</span>
                      <span className="text-sm font-medium">
                        {circle._count.memberships}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Open Requests</span>
                      <span className="text-sm font-medium">
                        {circle._count.requests}
                      </span>
                    </div>

                    {circle.city && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">City</span>
                        <span className="text-sm text-gray-800">
                          {circle.city}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-4 border-t">
                    <Link href={`/app/circles/${circle.id}`}>
                      <Button variant="outline" className="w-full">
                        View Circle
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}