import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const CreateExpenseSchema = z.object({
  bookingId: z.string(),
  memo: z.string().min(1).max(500),
  tags: z.array(z.string()).optional(),
  dollarValue: z.number().min(0).optional() // Override estimated value
});

const UpdateExpenseSchema = z.object({
  memo: z.string().min(1).max(500).optional(),
  tags: z.array(z.string()).optional(),
  dollarValue: z.number().min(0).optional(),
  taxDeductible: z.boolean().optional()
});

// Estimate dollar value from credits (rough conversion)
const CREDIT_TO_DOLLAR_RATE = 0.10; // $0.10 per credit

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const data = CreateExpenseSchema.parse(body);

    // Get user's business subscription
    const subscription = await prisma.businessSubscription.findFirst({
      where: { 
        userId: session.user.id,
        status: "ACTIVE"
      }
    });

    if (!subscription) {
      return NextResponse.json({ 
        error: "Active business subscription required" 
      }, { status: 403 });
    }

    // Get the booking
    const booking = await prisma.booking.findFirst({
      where: {
        id: data.bookingId,
        OR: [
          { bookerId: session.user.id },
          { providerId: session.user.id }
        ]
      },
      include: {
        slot: true,
        businessExpense: true
      }
    });

    if (!booking) {
      return NextResponse.json({ 
        error: "Booking not found or not authorized" 
      }, { status: 404 });
    }

    if (booking.businessExpense) {
      return NextResponse.json({ 
        error: "Booking already has a business expense entry" 
      }, { status: 400 });
    }

    // Check if booking category is enabled for business expenses
    const enabledCategories = subscription.enabledCategories as string[];
    if (!enabledCategories.includes(booking.slot.category)) {
      return NextResponse.json({ 
        error: `Category ${booking.slot.category} not enabled for business expenses`,
        enabledCategories
      }, { status: 400 });
    }

    // Estimate dollar value if not provided
    const dollarValue = data.dollarValue || (booking.totalCredits * CREDIT_TO_DOLLAR_RATE);

    // Create business expense
    const expense = await prisma.businessExpense.create({
      data: {
        bookingId: data.bookingId,
        userId: session.user.id,
        subscriptionId: subscription.id,
        isBusinessExpense: true,
        memo: data.memo,
        category: booking.slot.category,
        tags: data.tags || [],
        creditValue: booking.totalCredits,
        dollarValue,
        taxDeductible: true
      },
      include: {
        booking: {
          select: {
            id: true,
            createdAt: true,
            totalCredits: true,
            slot: {
              select: {
                title: true,
                category: true,
                start: true,
                end: true
              }
            }
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      expense: {
        id: expense.id,
        bookingId: expense.bookingId,
        memo: expense.memo,
        category: expense.category,
        tags: expense.tags,
        creditValue: expense.creditValue,
        dollarValue: expense.dollarValue,
        taxDeductible: expense.taxDeductible,
        createdAt: expense.createdAt,
        booking: expense.booking
      }
    });

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: "Invalid input", 
        details: error.errors 
      }, { status: 400 });
    }
    console.error("Error creating business expense:", error);
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
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const month = searchParams.get("month"); // YYYY-MM format
    const year = searchParams.get("year"); // YYYY format
    const category = searchParams.get("category");

    const offset = (page - 1) * limit;

    // Build date filter
    let dateFilter: any = {};
    if (month) {
      const [yearStr, monthStr] = month.split("-");
      const startDate = new Date(parseInt(yearStr), parseInt(monthStr) - 1, 1);
      const endDate = new Date(parseInt(yearStr), parseInt(monthStr), 0, 23, 59, 59);
      dateFilter = {
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      };
    } else if (year) {
      const startDate = new Date(parseInt(year), 0, 1);
      const endDate = new Date(parseInt(year), 11, 31, 23, 59, 59);
      dateFilter = {
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      };
    }

    // Build category filter
    let categoryFilter: any = {};
    if (category) {
      categoryFilter = { category };
    }

    const expenses = await prisma.businessExpense.findMany({
      where: {
        userId: session.user.id,
        isBusinessExpense: true,
        ...dateFilter,
        ...categoryFilter
      },
      include: {
        booking: {
          select: {
            id: true,
            createdAt: true,
            totalCredits: true,
            slot: {
              select: {
                title: true,
                description: true,
                category: true,
                start: true,
                end: true,
                location: true,
                provider: {
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
                name: true
              }
            },
            provider: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset
    });

    const totalCount = await prisma.businessExpense.count({
      where: {
        userId: session.user.id,
        isBusinessExpense: true,
        ...dateFilter,
        ...categoryFilter
      }
    });

    // Calculate totals
    const totals = await prisma.businessExpense.aggregate({
      where: {
        userId: session.user.id,
        isBusinessExpense: true,
        ...dateFilter,
        ...categoryFilter
      },
      _sum: {
        creditValue: true,
        dollarValue: true
      },
      _count: true
    });

    return NextResponse.json({
      expenses,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      },
      totals: {
        totalCredits: totals._sum.creditValue || 0,
        totalDollarValue: totals._sum.dollarValue || 0,
        totalExpenses: totals._count
      }
    });

  } catch (error) {
    console.error("Error fetching business expenses:", error);
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
    const { searchParams } = new URL(request.url);
    const expenseId = searchParams.get("id");

    if (!expenseId) {
      return NextResponse.json({ error: "Expense ID required" }, { status: 400 });
    }

    const body = await request.json();
    const data = UpdateExpenseSchema.parse(body);

    // Verify ownership
    const expense = await prisma.businessExpense.findFirst({
      where: {
        id: expenseId,
        userId: session.user.id
      }
    });

    if (!expense) {
      return NextResponse.json({ 
        error: "Expense not found" 
      }, { status: 404 });
    }

    const updatedExpense = await prisma.businessExpense.update({
      where: { id: expenseId },
      data: {
        ...data,
        updatedAt: new Date()
      },
      include: {
        booking: {
          select: {
            id: true,
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
    });

    return NextResponse.json({
      success: true,
      expense: updatedExpense
    });

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: "Invalid input", 
        details: error.errors 
      }, { status: 400 });
    }
    console.error("Error updating business expense:", error);
    return NextResponse.json({ 
      error: "Internal server error" 
    }, { status: 500 });
  }
}
