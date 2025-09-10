"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Shield, CheckCircle, Smile, HandHeart, MessageCircle, Users,
  Star, Heart, TrendingUp
} from "lucide-react";

interface UserTraits {
  [key: string]: {
    count: number;
    percentage: number;
    recentCount: number; // Last 30 days
  };
}

interface UserTraitsDisplayProps {
  userId: string;
  compact?: boolean;
}

const TRAIT_CONFIG = {
  RELIABLE: {
    label: "Reliable",
    icon: Shield,
    color: "bg-blue-100 text-blue-800 border-blue-200"
  },
  CAREFUL: {
    label: "Careful",
    icon: CheckCircle,
    color: "bg-green-100 text-green-800 border-green-200"
  },
  CHEERFUL: {
    label: "Cheerful",
    icon: Smile,
    color: "bg-yellow-100 text-yellow-800 border-yellow-200"
  },
  HELPFUL: {
    label: "Helpful",
    icon: HandHeart,
    color: "bg-purple-100 text-purple-800 border-purple-200"
  },
  RESPONSIVE: {
    label: "Responsive",
    icon: MessageCircle,
    color: "bg-indigo-100 text-indigo-800 border-indigo-200"
  },
  FRIENDLY: {
    label: "Friendly",
    icon: Users,
    color: "bg-pink-100 text-pink-800 border-pink-200"
  }
};

export function UserTraitsDisplay({ userId, compact = false }: UserTraitsDisplayProps) {
  const [traits, setTraits] = useState<UserTraits>({});
  const [totalReviews, setTotalReviews] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUserTraits();
  }, [userId]);

  const fetchUserTraits = async () => {
    try {
      const response = await fetch(`/api/users/${userId}/traits`);
      if (response.ok) {
        const data = await response.json();
        setTraits(data.traits || {});
        setTotalReviews(data.totalReviews || 0);
      }
    } catch (error) {
      console.error("Error fetching user traits:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className={compact ? "h-32" : ""}>
        <CardContent className="flex items-center justify-center h-full">
          <div className="text-center">
            <Star className="h-6 w-6 animate-pulse mx-auto mb-2 text-gray-400" />
            <p className="text-sm text-gray-600">Loading traits...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (totalReviews === 0) {
    return (
      <Card className={compact ? "h-32" : ""}>
        <CardContent className="flex items-center justify-center h-full">
          <div className="text-center">
            <Heart className="h-8 w-8 mx-auto mb-2 text-gray-400" />
            <p className="text-sm text-gray-600">No feedback yet</p>
            <p className="text-xs text-gray-500">Complete sessions to receive positive traits</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Sort traits by count
  const sortedTraits = Object.entries(traits)
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, compact ? 3 : 6);

  if (compact) {
    return (
      <Card className="h-32">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Star className="h-4 w-4 text-yellow-500" />
            Top Traits
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-wrap gap-1">
            {sortedTraits.map(([trait, data]) => {
              const config = TRAIT_CONFIG[trait as keyof typeof TRAIT_CONFIG];
              if (!config) return null;
              
              return (
                <Badge 
                  key={trait} 
                  variant="outline" 
                  className={`text-xs ${config.color}`}
                >
                  {config.label} {data.count}
                </Badge>
              );
            })}
          </div>
          {totalReviews > 0 && (
            <p className="text-xs text-gray-500 mt-2">
              From {totalReviews} review{totalReviews !== 1 ? 's' : ''}
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Star className="h-5 w-5 text-yellow-500" />
          Positive Traits
        </CardTitle>
        <CardDescription>
          What others appreciate about your help ({totalReviews} review{totalReviews !== 1 ? 's' : ''})
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {sortedTraits.length > 0 ? (
          <div className="grid gap-3">
            {sortedTraits.map(([trait, data]) => {
              const config = TRAIT_CONFIG[trait as keyof typeof TRAIT_CONFIG];
              if (!config) return null;
              
              const Icon = config.icon;
              const isPopular = data.percentage > 50;
              
              return (
                <div key={trait} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Icon className="h-5 w-5 text-gray-600" />
                    <div>
                      <div className="font-medium text-sm">{config.label}</div>
                      <div className="text-xs text-gray-600">
                        {data.count} time{data.count !== 1 ? 's' : ''} • {data.percentage}% of reviews
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {data.recentCount > 0 && (
                      <Badge variant="outline" className="text-xs bg-green-50 text-green-700">
                        <TrendingUp className="h-3 w-3 mr-1" />
                        +{data.recentCount}
                      </Badge>
                    )}
                    {isPopular && (
                      <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700">
                        ⭐ Popular
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-6">
            <Heart className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-600 mb-2">No traits recorded yet</p>
            <p className="text-sm text-gray-500">
              Others will share positive feedback after completing sessions with you
            </p>
          </div>
        )}

        {/* Summary stats */}
        {totalReviews > 0 && (
          <div className="border-t pt-4">
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-900">{totalReviews}</div>
              <div className="text-sm text-gray-600">
                positive review{totalReviews !== 1 ? 's' : ''} received
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}