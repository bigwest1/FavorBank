"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { 
  TrendingUp, TrendingDown, Heart, Scale, Clock,
  Lightbulb, Target, Gift, ArrowRightLeft
} from "lucide-react";
import Link from "next/link";

interface ReciprocityData {
  totalGiven: number;
  totalReceived: number;
  reciprocityRatio: number;
  isInSweetSpot: boolean;
  isOverAsking: boolean;
  recentActivity: {
    provided: number;
    received: number;
    days: number;
  };
  circleBreakdown: {
    id: string;
    name: string;
    given: number;
    received: number;
  }[];
  totalSessions: number;
  nudgeMessage: string | null;
}

interface ReciprocityMeterProps {
  userId: string;
  compact?: boolean;
}

export function ReciprocityMeter({ userId, compact = false }: ReciprocityMeterProps) {
  const [data, setData] = useState<ReciprocityData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReciprocityData();
  }, [userId]);

  const fetchReciprocityData = async () => {
    try {
      const response = await fetch(`/api/users/${userId}/reciprocity`);
      if (response.ok) {
        const reciprocityData = await response.json();
        setData(reciprocityData);
      }
    } catch (error) {
      console.error("Error fetching reciprocity data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getMeterColor = (ratio: number, isInSweetSpot: boolean) => {
    if (isInSweetSpot) return "bg-green-500";
    if (ratio < 0.5) return "bg-red-500";
    if (ratio < 0.8) return "bg-yellow-500";
    if (ratio > 1.5) return "bg-blue-500";
    return "bg-green-500";
  };

  const getMeterMessage = (ratio: number, isInSweetSpot: boolean, isOverAsking: boolean) => {
    if (isInSweetSpot) return "Perfect balance! 🎯";
    if (isOverAsking) return "Consider helping others more";
    if (ratio < 0.8) return "Try offering some help";
    if (ratio > 1.5) return "You're super generous!";
    return "Good balance";
  };

  if (loading) {
    return (
      <Card className={compact ? "h-32" : ""}>
        <CardContent className="flex items-center justify-center h-full">
          <div className="text-center">
            <Clock className="h-6 w-6 animate-spin mx-auto mb-2 text-gray-400" />
            <p className="text-sm text-gray-600">Loading reciprocity data...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.totalSessions === 0) {
    return (
      <Card className={compact ? "h-32" : ""}>
        <CardContent className="flex items-center justify-center h-full">
          <div className="text-center">
            <Scale className="h-8 w-8 mx-auto mb-2 text-gray-400" />
            <p className="text-sm text-gray-600">Complete your first session to see your reciprocity balance!</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (compact) {
    return (
      <Card className="h-32">
        <CardContent className="p-4 h-full flex items-center">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Reciprocity</span>
              <Badge 
                variant={data.isInSweetSpot ? "default" : "secondary"}
                className={
                  data.isInSweetSpot 
                    ? "bg-green-100 text-green-800" 
                    : data.isOverAsking 
                      ? "bg-red-100 text-red-800"
                      : "bg-yellow-100 text-yellow-800"
                }
              >
                {data.reciprocityRatio.toFixed(1)}
              </Badge>
            </div>
            
            {/* Mini meter */}
            <div className="relative h-3 bg-gray-200 rounded-full mb-2">
              {/* Sweet spot indicator */}
              <div className="absolute left-[35%] w-[30%] h-full bg-green-200 rounded-full" />
              
              {/* Current position */}
              <div 
                className={`h-full rounded-full transition-all ${getMeterColor(data.reciprocityRatio, data.isInSweetSpot)}`}
                style={{ 
                  width: `${Math.min(Math.max(data.reciprocityRatio * 50, 2), 98)}%` 
                }}
              />
            </div>
            
            <p className="text-xs text-gray-600">
              {getMeterMessage(data.reciprocityRatio, data.isInSweetSpot, data.isOverAsking)}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const meterPosition = Math.min(Math.max(data.reciprocityRatio * 50, 2), 98);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Scale className="h-5 w-5" />
          Reciprocity Balance
        </CardTitle>
        <CardDescription>
          Your giving vs receiving balance across all circles
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Main Stats */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="space-y-1">
            <div className="text-2xl font-bold text-green-700">{data.totalGiven}</div>
            <div className="text-xs text-gray-600">Credits Given</div>
            <Gift className="h-4 w-4 mx-auto text-green-600" />
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold text-gray-700">{data.reciprocityRatio.toFixed(1)}</div>
            <div className="text-xs text-gray-600">Ratio</div>
            <ArrowRightLeft className="h-4 w-4 mx-auto text-gray-600" />
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold text-blue-700">{data.totalReceived}</div>
            <div className="text-xs text-gray-600">Credits Received</div>
            <Heart className="h-4 w-4 mx-auto text-blue-600" />
          </div>
        </div>

        {/* Visual Meter */}
        <div className="space-y-3">
          <div className="flex justify-between text-xs text-gray-500">
            <span>Asking more</span>
            <span className="font-medium text-green-700">Sweet Spot</span>
            <span>Giving more</span>
          </div>
          
          <div className="relative h-6 bg-gray-200 rounded-full">
            {/* Sweet spot zone (0.8 - 1.2 ratio, positioned at 40%-60% of meter) */}
            <div className="absolute left-[35%] w-[30%] h-full bg-green-200 rounded-full" />
            <div className="absolute left-[35%] w-[30%] h-2 top-2 bg-green-300 rounded-full" />
            
            {/* Current position indicator */}
            <div 
              className={`absolute h-full rounded-full transition-all duration-300 ${getMeterColor(data.reciprocityRatio, data.isInSweetSpot)}`}
              style={{ width: `${meterPosition}%` }}
            />
            
            {/* Needle indicator */}
            <div 
              className="absolute top-0 w-1 h-full bg-white border-2 border-gray-800 rounded-full shadow-sm transition-all duration-300"
              style={{ left: `${meterPosition}%`, transform: 'translateX(-50%)' }}
            />
          </div>
          
          <div className="flex justify-between text-xs">
            <span className="text-red-600">0.0</span>
            <span className="text-green-600 font-medium">1.0</span>
            <span className="text-blue-600">2.0+</span>
          </div>
        </div>

        {/* Status Message */}
        <div className="text-center">
          <Badge 
            variant={data.isInSweetSpot ? "default" : "secondary"}
            className={`text-sm px-3 py-1 ${
              data.isInSweetSpot 
                ? "bg-green-100 text-green-800" 
                : data.isOverAsking 
                  ? "bg-red-100 text-red-800"
                  : "bg-yellow-100 text-yellow-800"
            }`}
          >
            {data.isInSweetSpot && <Target className="h-3 w-3 mr-1" />}
            {getMeterMessage(data.reciprocityRatio, data.isInSweetSpot, data.isOverAsking)}
          </Badge>
        </div>

        {/* Nudge for over-asking */}
        {data.nudgeMessage && (
          <Alert>
            <Lightbulb className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>{data.nudgeMessage}</span>
              <Link href="/app/slotshop">
                <Button size="sm" variant="outline">
                  Publish 5min slot
                </Button>
              </Link>
            </AlertDescription>
          </Alert>
        )}

        {/* Recent Activity */}
        <div className="bg-gray-50 p-3 rounded-lg">
          <div className="text-sm font-medium mb-2">Last 30 days</div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <span>{data.recentActivity.provided} sessions provided</span>
            </div>
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-blue-600" />
              <span>{data.recentActivity.received} sessions received</span>
            </div>
          </div>
        </div>

        {/* Circle Breakdown */}
        {data.circleBreakdown.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium">By Circle</div>
            {data.circleBreakdown.map((circle) => (
              <div key={circle.id} className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded">
                <span className="font-medium">{circle.name}</span>
                <div className="flex gap-3 text-xs">
                  <span className="text-green-700">+{circle.given}</span>
                  <span className="text-blue-700">-{circle.received}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}