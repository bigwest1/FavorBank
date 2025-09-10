import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const CreateSubscriptionSchema = z.object({
  companyName: z.string().min(1).max(100),
  enabledCategories: z.array(z.string()).min(1),
  defaultMemo: z.string().optional()
});

const UpdateSubscriptionSchema = z.object({
  companyName: z.string().min(1).max(100).optional(),
  enabledCategories: z.array(z.string()).optional(),
  defaultMemo: z.string().optional(),
  status: z.enum(["ACTIVE", "CANCELLED"]).optional()
});

// Business categories that can be expense-tracked
const BUSINESS_CATEGORIES = [
  "ADMINISTRATIVE",
  "TECH_SUPPORT", 
  "CREATIVE",
  "MAINTENANCE",
  "TRANSPORT",
  "MOVING",
  "CLEANING",
  "TUTORING"
];

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const data = CreateSubscriptionSchema.parse(body);

    // Validate categories are business-eligible
    const invalidCategories = data.enabledCategories.filter(
      cat => !BUSINESS_CATEGORIES.includes(cat)
    );
    if (invalidCategories.length > 0) {
      return NextResponse.json({ 
        error: `Invalid categories: ${invalidCategories.join(", ")}`,
        validCategories: BUSINESS_CATEGORIES
      }, { status: 400 });
    }

    // Check if user already has a subscription
    const existingSubscription = await prisma.businessSubscription.findUnique({
      where: { userId: session.user.id }
    });

    if (existingSubscription && existingSubscription.status === "ACTIVE") {
      return NextResponse.json({ 
        error: "User already has an active business subscription" 
      }, { status: 400 });
    }

    // Calculate subscription end date (1 year from now)
    const endDate = new Date();
    endDate.setFullYear(endDate.getFullYear() + 1);

    // Create or update subscription
    const subscription = await prisma.businessSubscription.upsert({
      where: { userId: session.user.id },
      update: {
        status: "ACTIVE",
        startDate: new Date(),
        endDate,
        companyName: data.companyName,
        enabledCategories: data.enabledCategories,
        defaultMemo: data.defaultMemo
      },
      create: {
        userId: session.user.id,
        status: "ACTIVE",
        endDate,
        companyName: data.companyName,
        enabledCategories: data.enabledCategories,
        defaultMemo: data.defaultMemo
      }
    });

    return NextResponse.json({
      success: true,
      subscription: {
        id: subscription.id,
        status: subscription.status,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        companyName: subscription.companyName,
        enabledCategories: subscription.enabledCategories,
        yearlyFee: subscription.yearlyFee
      }
    });

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: "Invalid input", 
        details: error.errors 
      }, { status: 400 });
    }
    console.error("Error creating business subscription:", error);
    return NextResponse.json({ 
      error: "Internal server error" 
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const subscription = await prisma.businessSubscription.findUnique({
      where: { userId: session.user.id },
      include: {
        businessExpenses: {
          take: 10,
          orderBy: { createdAt: "desc" },
          include: {
            booking: {
              select: {
                id: true,
                totalCredits: true,
                createdAt: true,
                slot: {
                  select: {
                    title: true,
                    category: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!subscription) {
      return NextResponse.json({ 
        subscription: null,
        businessCategories: BUSINESS_CATEGORIES
      });
    }

    // Check if subscription is expired
    const isExpired = new Date() > subscription.endDate;
    if (isExpired && subscription.status === "ACTIVE") {
      await prisma.businessSubscription.update({
        where: { id: subscription.id },
        data: { status: "EXPIRED" }
      });
      subscription.status = "EXPIRED";
    }

    return NextResponse.json({
      subscription: {
        id: subscription.id,
        status: subscription.status,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        companyName: subscription.companyName,
        enabledCategories: subscription.enabledCategories,
        defaultMemo: subscription.defaultMemo,
        yearlyFee: subscription.yearlyFee,
        isExpired,
        daysRemaining: Math.max(0, Math.ceil((subscription.endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))),
        recentExpenses: subscription.businessExpenses
      },
      businessCategories: BUSINESS_CATEGORIES
    });

  } catch (error) {
    console.error("Error fetching business subscription:", error);
    return NextResponse.json({ 
      error: "Internal server error" 
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const data = UpdateSubscriptionSchema.parse(body);

    const subscription = await prisma.businessSubscription.findUnique({
      where: { userId: session.user.id }
    });

    if (!subscription) {
      return NextResponse.json({ 
        error: "No business subscription found" 
      }, { status: 404 });
    }

    // Validate categories if provided
    if (data.enabledCategories) {
      const invalidCategories = data.enabledCategories.filter(
        cat => !BUSINESS_CATEGORIES.includes(cat)
      );
      if (invalidCategories.length > 0) {
        return NextResponse.json({ 
          error: `Invalid categories: ${invalidCategories.join(", ")}`,
          validCategories: BUSINESS_CATEGORIES
        }, { status: 400 });
      }
    }

    const updatedSubscription = await prisma.businessSubscription.update({
      where: { userId: session.user.id },
      data: {
        ...data,
        updatedAt: new Date()
      }
    });

    return NextResponse.json({
      success: true,
      subscription: {
        id: updatedSubscription.id,
        status: updatedSubscription.status,
        companyName: updatedSubscription.companyName,
        enabledCategories: updatedSubscription.enabledCategories,
        defaultMemo: updatedSubscription.defaultMemo
      }
    });

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: "Invalid input", 
        details: error.errors 
      }, { status: 400 });
    }
    console.error("Error updating business subscription:", error);
    return NextResponse.json({ 
      error: "Internal server error" 
    }, { status: 500 });
  }
}