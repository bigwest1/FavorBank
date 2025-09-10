"use client";

import { Badge } from "@/components/ui/badge";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Crown, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface PlusBadgeProps {
  className?: string;
  size?: "sm" | "default" | "lg";
  showText?: boolean;
  variant?: "crown" | "badge" | "icon";
}

export function PlusBadge({ 
  className, 
  size = "default", 
  showText = true,
  variant = "badge"
}: PlusBadgeProps) {
  const sizeClasses = {
    sm: "h-3 w-3",
    default: "h-4 w-4", 
    lg: "h-5 w-5"
  };

  const textSizes = {
    sm: "text-xs",
    default: "text-sm",
    lg: "text-base"
  };

  if (variant === "crown") {
    // Simple crown icon for avatar overlay
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn(
              "absolute -top-1 -right-1 bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-full p-1",
              className
            )}>
              <Crown className={cn("text-white", sizeClasses[size])} />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p className="font-medium">FavorBank Plus</p>
            <p className="text-xs text-gray-600">Premium member benefits active</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (variant === "icon") {
    // Just the icon for compact spaces
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Crown className={cn(
              "text-yellow-500",
              sizeClasses[size],
              className
            )} />
          </TooltipTrigger>
          <TooltipContent>
            <p className="font-medium">FavorBank Plus</p>
            <p className="text-xs text-gray-600">Premium member benefits active</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Default badge variant
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            className={cn(
              "bg-gradient-to-r from-yellow-400 to-yellow-600 text-white border-yellow-300 hover:from-yellow-500 hover:to-yellow-700 transition-colors",
              textSizes[size],
              className
            )}
          >
            <Crown className={cn("mr-1", sizeClasses[size])} />
            {showText && "Plus"}
            <Sparkles className={cn("ml-1", sizeClasses[size])} />
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1">
            <p className="font-medium">FavorBank Plus Active</p>
            <div className="text-xs text-gray-600 space-y-0.5">
              <p>✨ 100 monthly credits</p>
              <p>💳 No platform fees on purchases</p>
              <p>📅 2-week scheduling horizon</p>
              <p>⚡ Auto-win small disputes</p>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface PlusStatusProps {
  isActive: boolean;
  subscription?: {
    currentPeriodEnd: Date;
    status: string;
  } | null;
  className?: string;
}

export function PlusStatus({ isActive, subscription, className }: PlusStatusProps) {
  if (!isActive || !subscription) {
    return null;
  }

  const daysLeft = Math.ceil(
    (subscription.currentPeriodEnd.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
  );

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <PlusBadge size="sm" />
      <div className="text-sm">
        <div className="font-medium text-green-700">Plus Active</div>
        <div className="text-xs text-gray-600">
          {daysLeft > 0 ? `${daysLeft} days remaining` : 'Expires soon'}
        </div>
      </div>
    </div>
  );
}

interface PlusFeatureNoticeProps {
  feature: "credits" | "fees" | "scheduling" | "disputes";
  className?: string;
}

export function PlusFeatureNotice({ feature, className }: PlusFeatureNoticeProps) {
  const features = {
    credits: {
      icon: "💰",
      title: "Plus Credit Grant",
      description: "You received 100 monthly credits as a Plus member"
    },
    fees: {
      icon: "💳", 
      title: "Plus Fee Waiver",
      description: "Platform fees waived for Plus members"
    },
    scheduling: {
      icon: "📅",
      title: "Plus Extended Scheduling", 
      description: "Plus members can schedule up to 2 weeks in advance"
    },
    disputes: {
      icon: "⚡",
      title: "Plus Auto-Win",
      description: "Small disputes auto-resolved in your favor (once per month)"
    }
  };

  const config = features[feature];

  return (
    <div className={cn("bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200 rounded-lg p-3", className)}>
      <div className="flex items-center gap-2">
        <span className="text-lg">{config.icon}</span>
        <div>
          <div className="font-medium text-yellow-800">{config.title}</div>
          <div className="text-sm text-yellow-700">{config.description}</div>
        </div>
        <Crown className="h-4 w-4 text-yellow-600 ml-auto" />
      </div>
    </div>
  );
}