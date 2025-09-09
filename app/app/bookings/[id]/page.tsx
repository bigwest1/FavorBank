import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { BookingCheckInOut } from "@/components/bookings/BookingCheckInOut";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default async function BookingDetailPage({
  params
}: {
  params: { id: string };
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  // Get the booking with all necessary relations
  const booking = await prisma.booking.findUnique({
    where: { id: params.id },
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
      booker: {
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
    }
  });

  if (!booking) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/app/bookings">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Bookings
            </Button>
          </Link>
        </div>
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold text-gray-900">Booking Not Found</h1>
          <p className="text-gray-600 mt-2">The booking you&apos;re looking for doesn&apos;t exist or you don&apos;t have access to it.</p>
        </div>
      </div>
    );
  }

  // Check if user has access to this booking
  if (booking.providerId !== session.user.id && booking.bookerId !== session.user.id) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/app/bookings">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Bookings
            </Button>
          </Link>
        </div>
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold text-gray-900">Access Denied</h1>
          <p className="text-gray-600 mt-2">You don&apos;t have permission to view this booking.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/app/bookings">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Bookings
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Booking Details</h1>
          <p className="text-gray-600">
            {booking.request ? "Request-based booking" : "SlotShop booking"} in {booking.slot.circle.name}
          </p>
        </div>
      </div>

      {/* Check-in/Check-out Component */}
      <BookingCheckInOut 
        booking={booking as any}
        currentUserId={session.user.id}
      />

      {/* Additional Details */}
      {booking.slot.description && (
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="font-medium text-gray-900 mb-2">Service Description</h3>
          <p className="text-gray-700">{booking.slot.description}</p>
        </div>
      )}

      {booking.bookerNotes && (
        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="font-medium text-blue-900 mb-2">Booker Notes</h3>
          <p className="text-blue-800">{booking.bookerNotes}</p>
        </div>
      )}

      {booking.providerNotes && (
        <div className="bg-green-50 p-4 rounded-lg">
          <h3 className="font-medium text-green-900 mb-2">Provider Notes</h3>
          <p className="text-green-800">{booking.providerNotes}</p>
        </div>
      )}
    </div>
  );
}