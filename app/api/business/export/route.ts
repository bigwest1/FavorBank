import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const ExportSchema = z.object({
  format: z.enum(["csv", "pdf", "concur", "expensify"]),
  month: z.string().regex(/^\d{4}-\d{2}$/), // YYYY-MM format
  includeDetails: z.boolean().optional().default(true)
});

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const data = ExportSchema.parse(body);

    // Check for active business subscription
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

    // Parse month
    const [year, month] = data.month.split("-").map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    // Get business expenses for the month
    const expenses = await prisma.businessExpense.findMany({
      where: {
        userId: session.user.id,
        isBusinessExpense: true,
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      },
      include: {
        booking: {
          select: {
            id: true,
            createdAt: true,
            totalCredits: true,
            duration: true,
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
            }
          }
        }
      },
      orderBy: { createdAt: "asc" }
    });

    if (expenses.length === 0) {
      return NextResponse.json({ 
        error: `No business expenses found for ${data.month}` 
      }, { status: 404 });
    }

    // Generate export based on format
    switch (data.format) {
      case "csv":
        const csvData = generateCSV(expenses, subscription, data.month);
        return new NextResponse(csvData, {
          headers: {
            "Content-Type": "text/csv",
            "Content-Disposition": `attachment; filename="business-expenses-${data.month}.csv"`
          }
        });

      case "pdf":
        const pdfData = generatePDFData(expenses, subscription, data.month);
        return NextResponse.json({
          success: true,
          format: "pdf",
          data: pdfData,
          message: "PDF data generated (would be rendered by client)"
        });

      case "concur":
        const concurData = generateConcurJSON(expenses, subscription, data.month);
        return NextResponse.json({
          success: true,
          format: "concur",
          data: concurData,
          message: "Concur-compatible JSON export"
        });

      case "expensify":
        const expensifyData = generateExpensifyJSON(expenses, subscription, data.month);
        return NextResponse.json({
          success: true,
          format: "expensify",
          data: expensifyData,
          message: "Expensify-compatible JSON export"
        });

      default:
        return NextResponse.json({ 
          error: "Unsupported export format" 
        }, { status: 400 });
    }

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: "Invalid input", 
        details: error.errors 
      }, { status: 400 });
    }
    console.error("Error exporting business expenses:", error);
    return NextResponse.json({ 
      error: "Internal server error" 
    }, { status: 500 });
  }
}

function generateCSV(expenses: any[], subscription: any, month: string): string {
  const headers = [
    "Date",
    "Category", 
    "Description",
    "Memo",
    "Duration (min)",
    "Credits",
    "Dollar Value",
    "Tax Deductible",
    "Provider",
    "Location",
    "Booking ID"
  ];

  const rows = expenses.map(expense => [
    expense.booking.createdAt.toISOString().split('T')[0],
    expense.category,
    expense.booking.slot.title || "",
    expense.memo || "",
    expense.booking.duration,
    expense.creditValue,
    `$${expense.dollarValue.toFixed(2)}`,
    expense.taxDeductible ? "Yes" : "No",
    expense.booking.slot.provider.name,
    expense.booking.slot.location || "",
    expense.bookingId
  ]);

  const csvContent = [
    `# Business Expense Report - ${month}`,
    `# Company: ${subscription.companyName}`,
    `# Generated: ${new Date().toISOString()}`,
    `# Total Expenses: ${expenses.length}`,
    `# Total Credits: ${expenses.reduce((sum, e) => sum + e.creditValue, 0)}`,
    `# Total Value: $${expenses.reduce((sum, e) => sum + e.dollarValue, 0).toFixed(2)}`,
    "",
    headers.join(","),
    ...rows.map(row => row.map(cell => 
      typeof cell === "string" && cell.includes(",") ? `"${cell}"` : cell
    ).join(","))
  ].join("\n");

  return csvContent;
}

function generatePDFData(expenses: any[], subscription: any, month: string) {
  return {
    title: `Business Expense Report - ${month}`,
    company: subscription.companyName,
    generatedAt: new Date().toISOString(),
    summary: {
      totalExpenses: expenses.length,
      totalCredits: expenses.reduce((sum, e) => sum + e.creditValue, 0),
      totalValue: expenses.reduce((sum, e) => sum + e.dollarValue, 0),
      categories: Object.entries(
        expenses.reduce((acc, e) => {
          acc[e.category] = (acc[e.category] || 0) + e.dollarValue;
          return acc;
        }, {} as Record<string, number>)
      ).map(([category, value]) => ({ category, value }))
    },
    expenses: expenses.map(expense => ({
      date: expense.booking.createdAt.toISOString().split('T')[0],
      category: expense.category,
      description: expense.booking.slot.title,
      memo: expense.memo,
      duration: expense.booking.duration,
      credits: expense.creditValue,
      dollarValue: expense.dollarValue,
      provider: expense.booking.slot.provider.name,
      location: expense.booking.slot.location
    }))
  };
}

function generateConcurJSON(expenses: any[], subscription: any, month: string) {
  // Stub for Concur API format
  return {
    reportName: `FavorBank Expenses - ${month}`,
    reportPeriod: month,
    businessPurpose: "Business services and support",
    expenses: expenses.map((expense, index) => ({
      expenseTypeCode: getConcurExpenseType(expense.category),
      transactionDate: expense.booking.createdAt.toISOString().split('T')[0],
      transactionAmount: expense.dollarValue,
      transactionCurrencyCode: "USD",
      vendorDescription: "FavorBank Community Services",
      businessPurpose: expense.memo,
      receiptRequired: false,
      customField1: expense.category,
      customField2: `${expense.creditValue} credits`,
      customField3: expense.booking.slot.provider.name,
      externalId: `favorbank-${expense.bookingId}`
    }))
  };
}

function generateExpensifyJSON(expenses: any[], subscription: any, month: string) {
  // Stub for Expensify API format
  return {
    type: "expenses",
    expenses: expenses.map(expense => ({
      merchant: "FavorBank",
      amount: Math.round(expense.dollarValue * 100), // Cents
      currency: "USD",
      category: getExpensifyCategory(expense.category),
      tag: expense.category,
      comment: expense.memo,
      created: expense.booking.createdAt.toISOString(),
      externalID: `favorbank-${expense.bookingId}`,
      receiptRequired: false,
      reimbursable: true,
      customField1: `${expense.creditValue} credits`,
      customField2: expense.booking.slot.provider.name
    }))
  };
}

function getConcurExpenseType(category: string): string {
  const mapping: Record<string, string> = {
    "ADMINISTRATIVE": "GENRL",
    "TECH_SUPPORT": "TECHN", 
    "CREATIVE": "ADVRT",
    "MAINTENANCE": "MAINT",
    "TRANSPORT": "TRANS",
    "MOVING": "TRANS",
    "CLEANING": "MAINT",
    "TUTORING": "TRAIN"
  };
  return mapping[category] || "GENRL";
}

function getExpensifyCategory(category: string): string {
  const mapping: Record<string, string> = {
    "ADMINISTRATIVE": "Office Supplies",
    "TECH_SUPPORT": "Computer - Software", 
    "CREATIVE": "Advertising",
    "MAINTENANCE": "Repairs & Maintenance",
    "TRANSPORT": "Automobile",
    "MOVING": "Automobile", 
    "CLEANING": "Cleaning",
    "TUTORING": "Training"
  };
  return mapping[category] || "Professional Services";
}
