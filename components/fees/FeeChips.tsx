"use client";

import { Badge } from "@/components/ui/badge";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, AlertTriangle } from "lucide-react";

interface FeeBreakdown {
  baseAmount: number;
  fees: Array<{
    id: string;
    name: string;
    icon: string;
    description: string;
    percentage: number;
    amount: number;
    displayText: string;
  }>;
  totalSurcharge: number;
  totalPercentage: number;
  finalAmount: number;
  capped: boolean;
  capReason?: string;
  summary: string;
}

interface FeeChipsProps {
  feeBreakdown: FeeBreakdown;
  showDetails?: boolean;
  size?: "sm" | "default" | "lg";
  className?: string;
}

export function FeeChips({ 
  feeBreakdown, 
  showDetails = false, 
  size = "default",
  className = "" 
}: FeeChipsProps) {
  if (feeBreakdown.fees.length === 0 && !showDetails) {
    return null;
  }

  const badgeSize = size === "sm" ? "text-xs px-2 py-0.5" : 
                   size === "lg" ? "text-sm px-3 py-1" : "text-xs px-2 py-1";

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Fee Chips */}
      {feeBreakdown.fees.length > 0 && (
        <div className="flex flex-wrap gap-1">
          <TooltipProvider>
            {feeBreakdown.fees.map((fee) => (
              <Tooltip key={fee.id}>
                <TooltipTrigger asChild>
                  <Badge 
                    variant="outline" 
                    className={`${badgeSize} bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100 cursor-help transition-colors`}
                  >
                    <span className="mr-1">{fee.icon}</span>
                    {fee.name} +{fee.percentage}%
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  <div className="space-y-1">
                    <p className="font-medium">{fee.name} Surcharge</p>
                    <p className="text-sm text-gray-600">{fee.description}</p>
                    <div className="flex justify-between items-center pt-1 text-xs">
                      <span>Fee: +{fee.percentage}%</span>
                      <span className="font-medium">+{fee.amount} credits</span>
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            ))}
          </TooltipProvider>

          {/* Total Summary Chip */}
          {feeBreakdown.totalSurcharge > 0 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge 
                    variant={feeBreakdown.capped ? "destructive" : "default"}
                    className={`${badgeSize} bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 cursor-help transition-colors`}
                  >
                    Total +{feeBreakdown.totalPercentage}%
                    {feeBreakdown.capped && (
                      <AlertTriangle className="h-3 w-3 ml-1 text-amber-500" />
                    )}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-sm">
                  <div className="space-y-2">
                    <p className="font-medium">Fee Summary</p>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>Base Amount:</span>
                        <span>{feeBreakdown.baseAmount} credits</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total Surcharges:</span>
                        <span>+{feeBreakdown.totalSurcharge} credits</span>
                      </div>
                      <div className="flex justify-between font-medium pt-1 border-t">
                        <span>Final Amount:</span>
                        <span>{feeBreakdown.finalAmount} credits</span>
                      </div>
                    </div>
                    {feeBreakdown.capped && feeBreakdown.capReason && (
                      <div className="pt-1 border-t">
                        <p className="text-xs text-amber-600 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          {feeBreakdown.capReason}
                        </p>
                      </div>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      )}

      {/* Detailed Breakdown */}
      {showDetails && (
        <div className="space-y-2">
          {feeBreakdown.fees.length > 0 && (
            <Alert className="bg-orange-50 border-orange-200">
              <Info className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-orange-700">
                <div className="space-y-1">
                  <p className="font-medium">Dynamic Fee Breakdown</p>
                  <div className="grid grid-cols-1 gap-1 text-sm">
                    {feeBreakdown.fees.map((fee) => (
                      <div key={fee.id} className="flex justify-between items-center">
                        <span className="flex items-center gap-1">
                          <span>{fee.icon}</span>
                          <span>{fee.name}:</span>
                          <span className="text-xs text-gray-600">({fee.description})</span>
                        </span>
                        <span className="font-medium">+{fee.amount} credits</span>
                      </div>
                    ))}
                    <div className="flex justify-between items-center pt-1 border-t border-orange-300 font-medium">
                      <span>Total Surcharges:</span>
                      <span>+{feeBreakdown.totalSurcharge} credits (+{feeBreakdown.totalPercentage}%)</span>
                    </div>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {feeBreakdown.capped && (
            <Alert variant="destructive" className="bg-amber-50 border-amber-300">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-700">
                <div className="space-y-1">
                  <p className="font-medium">Fee Cap Applied</p>
                  <p className="text-sm">{feeBreakdown.capReason}</p>
                  <p className="text-xs">
                    This ensures fair pricing and prevents excessive surcharges.
                  </p>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {feeBreakdown.fees.length === 0 && (
            <Alert className="bg-green-50 border-green-200">
              <Info className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-700">
                <p className="font-medium">No Additional Fees</p>
                <p className="text-sm">This booking qualifies for standard pricing with no surcharges.</p>
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {/* Pricing Transparency Note */}
      {showDetails && feeBreakdown.fees.length > 0 && (
        <div className="text-xs text-gray-500 italic">
          <p>
            💡 Dynamic fees help maintain service reliability during high-demand periods 
            and support specialized services. All fees are transparently calculated and capped.
          </p>
        </div>
      )}
    </div>
  );
}

interface FeeSummaryProps {
  baseAmount: number;
  finalAmount: number;
  feeBreakdown: FeeBreakdown;
  className?: string;
}

export function FeeSummary({ 
  baseAmount, 
  finalAmount, 
  feeBreakdown, 
  className = "" 
}: FeeSummaryProps) {
  const hasFees = feeBreakdown.fees.length > 0;
  const savings = baseAmount - finalAmount;

  return (
    <div className={`p-3 bg-gray-50 rounded-lg border ${className}`}>
      <div className="space-y-2">
        <div className="flex justify-between items-center text-sm">
          <span>Base Price:</span>
          <span>{baseAmount} credits</span>
        </div>
        
        {hasFees && (
          <div className="flex justify-between items-center text-sm text-orange-600">
            <span className="flex items-center gap-1">
              <Info className="h-3 w-3" />
              Surcharges:
            </span>
            <span>+{feeBreakdown.totalSurcharge} credits</span>
          </div>
        )}
        
        <div className="flex justify-between items-center font-medium text-base pt-2 border-t">
          <span>Total:</span>
          <span className={hasFees ? "text-orange-600" : "text-green-600"}>
            {finalAmount} credits
          </span>
        </div>

        {hasFees && (
          <div className="pt-2 border-t">
            <FeeChips 
              feeBreakdown={feeBreakdown} 
              size="sm"
            />
          </div>
        )}
      </div>
    </div>
  );
}