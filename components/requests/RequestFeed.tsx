"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Search, Filter, MapPin, Clock, Star, Zap, Shield, 
  Image as ImageIcon, User, Calendar, AlertCircle 
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";

interface Request {
  id: string;
  title: string;
  description: string;
  category: string;
  photoBase64?: string;
  effortLevel: number;
  creditsOffered: number;
  tier: string;
  timeWindowStart?: string;
  timeWindowEnd?: string;
  expiresAt?: string;
  locationRadius?: number;
  city?: string;
  equipmentNeeded?: string[];
  specialRequirements?: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
  _count: {
    bookings: number;
  };
  createdAt: string;
  status: string;
}

interface RequestFeedProps {
  circleId: string;
  showCreateButton?: boolean;
}

const CATEGORIES = [
  { value: "HOUSEHOLD_TASKS", label: "Household Tasks" },
  { value: "YARD_WORK", label: "Yard Work" },
  { value: "PET_CARE", label: "Pet Care" },
  { value: "CHILD_CARE", label: "Child Care" },
  { value: "ELDER_CARE", label: "Elder Care" },
  { value: "TRANSPORTATION", label: "Transportation" },
  { value: "TECH_SUPPORT", label: "Tech Support" },
  { value: "HOME_REPAIR", label: "Home Repair" },
  { value: "MOVING_HELP", label: "Moving Help" },
  { value: "ERRANDS", label: "Errands" },
  { value: "COOKING", label: "Cooking" },
  { value: "TUTORING", label: "Tutoring" },
  { value: "CREATIVE_PROJECTS", label: "Creative Projects" },
  { value: "EVENT_HELP", label: "Event Help" },
  { value: "OTHER", label: "Other" }
];

const EFFORT_LABELS = {
  1: "Very Light",
  2: "Light", 
  3: "Medium",
  4: "Heavy",
  5: "Very Heavy"
};

export function RequestFeed({ circleId, showCreateButton = true }: RequestFeedProps) {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedTier, setSelectedTier] = useState<string>("");
  const [viewMode, setViewMode] = useState<"list" | "map">("list");

  useEffect(() => {
    fetchRequests();
  }, [circleId, selectedCategory, selectedTier]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedCategory) params.set("category", selectedCategory);
      if (selectedTier) params.set("tier", selectedTier);

      const response = await fetch(`/api/circles/${circleId}/requests?${params}`);
      if (response.ok) {
        const data = await response.json();
        setRequests(data);
      }
    } catch (error) {
      console.error("Error fetching requests:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredRequests = requests.filter(request => {
    if (!searchQuery) return true;
    return request.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
           request.description?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case "PRIORITY": return <Zap className="h-4 w-4" />;
      case "GUARANTEED": return <Shield className="h-4 w-4" />;
      default: return <Star className="h-4 w-4" />;
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case "PRIORITY": return "bg-blue-100 text-blue-800";
      case "GUARANTEED": return "bg-green-100 text-green-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const RequestCard = ({ request }: { request: Request }) => (
    <Card key={request.id} className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <CardTitle className="text-lg line-clamp-1">
                <Link 
                  href={`/app/requests/${request.id}`}
                  className="hover:underline"
                >
                  {request.title}
                </Link>
              </CardTitle>
              <Badge 
                variant="secondary" 
                className={`${getTierColor(request.tier)} flex items-center gap-1`}
              >
                {getTierIcon(request.tier)}
                {request.tier}
              </Badge>
            </div>
            <CardDescription className="line-clamp-2 mb-2">
              {request.description}
            </CardDescription>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <User className="h-4 w-4" />
              <span>{request.user.name}</span>
              <span>•</span>
              <Calendar className="h-4 w-4" />
              <span>{formatDistanceToNow(new Date(request.createdAt), { addSuffix: true })}</span>
            </div>
          </div>
          {request.photoBase64 && (
            <div className="ml-4 flex-shrink-0">
              <img 
                src={request.photoBase64} 
                alt={request.title}
                className="w-20 h-20 object-cover rounded"
              />
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Badge variant="outline">
                {request.category.replace('_', ' ')}
              </Badge>
              <Badge variant="outline">
                {EFFORT_LABELS[request.effortLevel as keyof typeof EFFORT_LABELS]}
              </Badge>
              <Badge variant="default" className="bg-green-100 text-green-800">
                {request.creditsOffered} credits
              </Badge>
            </div>
          </div>

          {(request.timeWindowStart || request.city || request.locationRadius) && (
            <div className="flex items-center gap-4 text-sm text-gray-600">
              {request.timeWindowStart && (
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  <span>
                    {new Date(request.timeWindowStart).toLocaleDateString()}
                    {request.timeWindowEnd && 
                      ` - ${new Date(request.timeWindowEnd).toLocaleDateString()}`
                    }
                  </span>
                </div>
              )}
              {request.city && (
                <div className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  <span>{request.city}</span>
                  {request.locationRadius && (
                    <span className="text-gray-500">
                      ({request.locationRadius}km radius)
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {request.equipmentNeeded && request.equipmentNeeded.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {request.equipmentNeeded.map((equipment, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {equipment}
                </Badge>
              ))}
            </div>
          )}

          {request.expiresAt && (
            <div className="flex items-center gap-2 text-sm text-orange-600">
              <AlertCircle className="h-4 w-4" />
              <span>
                Expires {formatDistanceToNow(new Date(request.expiresAt), { addSuffix: true })}
              </span>
            </div>
          )}

          <div className="pt-3 border-t">
            <Link href={`/app/requests/${request.id}`}>
              <Button variant="outline" className="w-full">
                View Details & Respond
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Requests</h2>
          <p className="text-gray-600">Help your circle members with their favor requests</p>
        </div>
        {showCreateButton && (
          <Link href={`/app/circles/${circleId}/requests/new`}>
            <Button>Post a Request</Button>
          </Link>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search requests..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Category</label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All categories</SelectItem>
                  {CATEGORIES.map((category) => (
                    <SelectItem key={category.value} value={category.value}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Tier</label>
              <Select value={selectedTier} onValueChange={setSelectedTier}>
                <SelectTrigger>
                  <SelectValue placeholder="All tiers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All tiers</SelectItem>
                  <SelectItem value="BASIC">Basic</SelectItem>
                  <SelectItem value="PRIORITY">Priority</SelectItem>
                  <SelectItem value="GUARANTEED">Guaranteed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)} className="w-full">
                <TabsList className="w-full">
                  <TabsTrigger value="list" className="flex-1">List</TabsTrigger>
                  <TabsTrigger value="map" className="flex-1">Map</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
        <TabsContent value="list">
          {loading ? (
            <div className="text-center py-8">Loading requests...</div>
          ) : filteredRequests.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <div className="space-y-4">
                  <div className="text-6xl">🤝</div>
                  <div>
                    <h3 className="text-lg font-semibold mb-2">No Requests Found</h3>
                    <p className="text-gray-600 mb-4">
                      {searchQuery || selectedCategory || selectedTier
                        ? "Try adjusting your filters to find more requests."
                        : "Be the first to post a request in this circle!"
                      }
                    </p>
                    {showCreateButton && (
                      <Link href={`/app/circles/${circleId}/requests/new`}>
                        <Button>Post the First Request</Button>
                      </Link>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm text-gray-600">
                <span>
                  Showing {filteredRequests.length} of {requests.length} requests
                </span>
                <span>
                  Total credits available: {filteredRequests.reduce((sum, r) => sum + r.creditsOffered, 0)}
                </span>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                {filteredRequests.map(request => (
                  <RequestCard key={request.id} request={request} />
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="map">
          <Card>
            <CardHeader>
              <CardTitle>Map View</CardTitle>
              <CardDescription>
                Interactive map showing request locations (city-level granularity)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-96 bg-gray-100 rounded-lg flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium mb-2">Map View Coming Soon</p>
                  <p>Interactive map with city-level request markers</p>
                  <div className="mt-4 space-y-2">
                    {filteredRequests
                      .filter(r => r.city)
                      .reduce((acc, request) => {
                        const city = request.city!;
                        if (!acc[city]) acc[city] = [];
                        acc[city].push(request);
                        return acc;
                      }, {} as Record<string, Request[]>)
                    }
                    {Object.entries(
                      filteredRequests
                        .filter(r => r.city)
                        .reduce((acc, request) => {
                          const city = request.city!;
                          if (!acc[city]) acc[city] = 0;
                          acc[city]++;
                          return acc;
                        }, {} as Record<string, number>)
                    ).map(([city, count]) => (
                      <div key={city} className="flex items-center justify-center gap-2 text-sm">
                        <MapPin className="h-4 w-4" />
                        <span>{city}: {count} requests</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}