import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { CircleSettingsForm } from "@/components/circles/CircleSettingsForm";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

async function getCircleForSettings(circleId: string, userId: string) {
  const circle = await prisma.circle.findFirst({
    where: {
      id: circleId,
      memberships: {
        some: {
          userId,
          role: {
            in: ["OWNER", "ADMIN"]
          }
        }
      }
    },
    include: {
      memberships: {
        where: {
          userId
        },
        select: {
          role: true
        }
      }
    }
  });

  return circle;
}

async function updateCircle(circleId: string, data: any) {
  "use server";
  
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  // Verify permissions
  const membership = await prisma.membership.findFirst({
    where: {
      circleId,
      userId: session.user.id,
      role: {
        in: ["OWNER", "ADMIN"]
      }
    }
  });

  if (!membership) {
    throw new Error("Insufficient permissions");
  }

  return await prisma.circle.update({
    where: { id: circleId },
    data: {
      name: data.name,
      description: data.description,
      city: data.city,
      isPrivate: data.isPrivate,
      quietHours: data.quietHours,
      allowsMinors: data.allowsMinors,
      demurrageRate: data.demurrageRate,
      categories: data.categories
    }
  });
}

export default async function CircleSettingsPage({ params }: { params: { id: string } }) {
  const session = await auth();
  
  if (!session?.user?.id) {
    redirect("/login");
  }

  const circle = await getCircleForSettings(params.id, session.user.id);
  
  if (!circle) {
    notFound();
  }

  const userMembership = circle.memberships[0];
  const canEdit = ["OWNER", "ADMIN"].includes(userMembership.role);

  const handleSave = async (data: any) => {
    "use server";
    await updateCircle(params.id, data);
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-8">
        <Link 
          href={`/app/circles/${params.id}`}
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-800 mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to {circle.name}
        </Link>
        
        <h1 className="text-h2 font-bold">Circle Settings</h1>
        <p className="text-gray-600 mt-2">
          Manage your circle's privacy, rules, and member preferences
        </p>
      </div>

      <CircleSettingsForm
        circle={circle}
        onSave={handleSave}
        canEdit={canEdit}
      />
    </div>
  );
}