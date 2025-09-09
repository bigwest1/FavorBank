import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { RequestCreationForm } from "@/components/requests/RequestCreationForm";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

async function getCircleForRequest(circleId: string, userId: string) {
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
      memberships: {
        where: {
          userId
        },
        select: {
          balanceCredits: true
        }
      }
    }
  });
}

export default async function NewRequestPage({ params }: { params: { id: string } }) {
  const session = await auth();
  
  if (!session?.user?.id) {
    redirect("/login");
  }

  const circle = await getCircleForRequest(params.id, session.user.id);
  
  if (!circle) {
    notFound();
  }

  const membership = circle.memberships[0];

  return (
    <div className="container mx-auto py-8 px-4 max-w-3xl">
      <div className="mb-8">
        <Link 
          href={`/app/circles/${params.id}`}
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-800 mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to {circle.name}
        </Link>
        
        <div className="text-center">
          <div className="text-4xl mb-4">🤝</div>
          <h1 className="text-h2 font-bold">Post a Request</h1>
          <p className="text-gray-600 mt-2">
            Ask your circle for help with a favor or task
          </p>
          <div className="text-sm text-gray-500 mt-2">
            Your current balance: <span className="font-medium">{membership.balanceCredits} credits</span>
          </div>
        </div>
      </div>

      <RequestCreationForm 
        circleId={params.id}
        onSuccess={(requestId) => {
          window.location.href = `/app/requests/${requestId}`;
        }}
      />
    </div>
  );
}