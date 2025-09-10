import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const { action, userId, circleId, companyName, ...options } = await request.json();

    switch (action) {
      case "create_subscription":
        // Create a business subscription for testing
        const categories = options.categories || [
          "ADMINISTRATIVE", 
          "TECH_SUPPORT", 
          "CREATIVE", 
          "MAINTENANCE",
          "TRANSPORT"
        ];

        // Ensure user exists
        await prisma.user.upsert({
          where: { id: userId },
          update: {},
          create: {
            id: userId,
            email: `${userId}@business.com`,
            name: `Business User ${userId}`,
            isActive: true
          }
        });

        // Calculate subscription end date (1 year from now)
        const endDate = new Date();
        endDate.setFullYear(endDate.getFullYear() + 1);

        const subscription = await prisma.businessSubscription.upsert({
          where: { userId },
          update: {
            status: "ACTIVE",
            startDate: new Date(),
            endDate,
            companyName: companyName || "Test Company Inc.",
            enabledCategories: categories,
            defaultMemo: "Business service expense"
          },
          create: {
            userId,
            status: "ACTIVE", 
            endDate,
            companyName: companyName || "Test Company Inc.",
            enabledCategories: categories,
            defaultMemo: "Business service expense"
          }
        });

        return NextResponse.json({
          success: true,
          message: "Business subscription created",
          subscription: {
            id: subscription.id,
            status: subscription.status,
            companyName: subscription.companyName,
            enabledCategories: subscription.enabledCategories,
            yearlyFee: subscription.yearlyFee
          }
        });

      case "create_business_booking":
        // Create a mock booking with business expense tagging
        const category = options.category || "ADMINISTRATIVE";
        const memo = options.memo || "Client consultation and administrative support";

        // Create mock slot
        const slot = await prisma.slot.create({
          data: {
            providerId: "mock-business-provider",
            circleId,
            title: `${category.toLowerCase()} service`,
            description: `Business ${category.toLowerCase()} service for testing`,
            category,
            start: new Date(),
            end: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours
            pricePerMinute: 2,
            minDuration: 60,
            maxDuration: 120,
            status: "OPEN"
          }
        });

        // Create booking
        const bookingCredits = 120; // 60 min * 2 credits/min
        const booking = await prisma.booking.create({
          data: {
            slotId: slot.id,
            providerId: "mock-business-provider",
            bookerId: userId,
            circleId,
            duration: 60,
            totalCredits: bookingCredits,
            status: "COMPLETED"
          }
        });

        // Get business subscription
        const businessSub = await prisma.businessSubscription.findUnique({
          where: { userId }
        });

        if (businessSub) {
          // Create business expense
          const dollarValue = bookingCredits * 0.10; // $0.10 per credit
          
          const expense = await prisma.businessExpense.create({
            data: {
              bookingId: booking.id,
              userId,
              subscriptionId: businessSub.id,
              isBusinessExpense: true,
              memo,
              category,
              tags: [],
              creditValue: bookingCredits,
              dollarValue,
              taxDeductible: true
            }
          });

          return NextResponse.json({
            success: true,
            message: "Business booking and expense created",
            booking: {
              id: booking.id,
              category,
              totalCredits: bookingCredits,
              dollarValue: expense.dollarValue
            },
            expense: {
              id: expense.id,
              memo: expense.memo,
              category: expense.category,
              creditValue: expense.creditValue,
              dollarValue: expense.dollarValue
            }
          });
        } else {
          return NextResponse.json({
            success: false,
            message: "No business subscription found"
          }, { status: 400 });
        }

      case "get_subscription":
        // Get business subscription details
        const sub = await prisma.businessSubscription.findUnique({
          where: { userId },
          include: {
            businessExpenses: {
              take: 5,
              orderBy: { createdAt: "desc" },
              include: {
                booking: {
                  select: {
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

        if (!sub) {
          return NextResponse.json({
            success: false,
            message: "No business subscription found"
          }, { status: 404 });
        }

        return NextResponse.json({
          success: true,
          subscription: {
            id: sub.id,
            status: sub.status,
            companyName: sub.companyName,
            enabledCategories: sub.enabledCategories,
            yearlyFee: sub.yearlyFee,
            daysRemaining: Math.ceil((sub.endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
            recentExpenses: sub.businessExpenses.length
          }
        });

      case "test_export":
        // Test expense export functionality
        const format = options.format || "csv";
        const month = options.month || new Date().toISOString().substring(0, 7); // YYYY-MM

        const exportResponse = await fetch(`${process.env.NEXTAUTH_URL}/api/business/export`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            format,
            month,
            includeDetails: true
          })
        });

        if (!exportResponse.ok) {
          const error = await exportResponse.json();
          return NextResponse.json({
            success: false,
            message: error.error || "Export failed"
          }, { status: exportResponse.status });
        }

        if (format === "csv") {
          const csvData = await exportResponse.text();
          return NextResponse.json({
            success: true,
            format,
            message: "CSV export generated",
            preview: csvData.split('\n').slice(0, 10).join('\n') + "\n... (truncated)"
          });
        } else {
          const jsonData = await exportResponse.json();
          return NextResponse.json({
            success: true,
            format,
            message: `${format.toUpperCase()} export generated`,
            data: jsonData
          });
        }

      case "get_expense_stats":
        // Get business expense statistics
        const stats = await prisma.businessExpense.findMany({
          where: { userId },
          include: {
            booking: {
              select: {
                createdAt: true,
                slot: { select: { category: true } }
              }
            }
          }
        });

        const totalExpenses = stats.length;
        const totalCreditsSum = stats.reduce((sum, e) => sum + e.creditValue, 0);
        const totalValue = stats.reduce((sum, e) => sum + e.dollarValue, 0);

        const categoryBreakdown = stats.reduce((acc, expense) => {
          acc[expense.category] = (acc[expense.category] || 0) + expense.dollarValue;
          return acc;
        }, {} as Record<string, number>);

        const monthlyBreakdown = stats.reduce((acc, expense) => {
          const month = expense.booking.createdAt.toISOString().substring(0, 7);
          acc[month] = (acc[month] || 0) + expense.dollarValue;
          return acc;
        }, {} as Record<string, number>);

        return NextResponse.json({
          success: true,
          stats: {
            userId,
            totalExpenses,
            totalCredits: totalCreditsSum,
            totalValue,
            averageExpense: totalExpenses > 0 ? totalValue / totalExpenses : 0,
            categoryBreakdown,
            monthlyBreakdown
          }
        });

      default:
        return NextResponse.json({
          error: "Invalid action",
          availableActions: [
            "create_subscription",
            "create_business_booking", 
            "get_subscription",
            "test_export",
            "get_expense_stats"
          ]
        }, { status: 400 });
    }

  } catch (error: any) {
    console.error("Error in business simulation:", error);
    return NextResponse.json({
      error: "Internal server error",
      details: error.message
    }, { status: 500 });
  }
}