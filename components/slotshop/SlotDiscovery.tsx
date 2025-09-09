"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Search, Filter, Clock, DollarSign, MapPin, User, 
  Calendar, Star, Zap, AlertCircle 
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { toast } from "sonner";

interface Slot {
  id: string;
  title: string;
  description: string | null;
  category: string;
  start: string;
  end: string;
  location: string | null;
  pricePerMinute: number;
  minDuration: number;
  maxDuration: number | null;
  provider: {
    id: string;
    name: string;
    city: string | null;
  };
  createdAt: string;
}

interface SlotDiscoveryProps {
  circleId: string;
  userHasProAccess?: boolean;
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

export function SlotDiscovery({ circleId, userHasProAccess = false }: SlotDiscoveryProps) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [priceRange, setPriceRange] = useState<string>("");
  const [timeFilter, setTimeFilter] = useState<string>("");
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");

  useEffect(() => {
    fetchSlots();
  }, [circleId, selectedCategory, priceRange, timeFilter]);

  const fetchSlots = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedCategory) params.set("category", selectedCategory);
      if (priceRange) params.set("priceRange", priceRange);
      if (timeFilter) params.set("timeFilter", timeFilter);

      const response = await fetch(`/api/circles/${circleId}/slots?${params}`);
      if (response.ok) {
        const data = await response.json();
        setSlots(data);
      }
    } catch (error) {
      console.error("Error fetching slots:", error);
      toast.error("Failed to load available slots");
    } finally {
      setLoading(false);
    }
  };

  const filteredSlots = slots.filter(slot => {
    if (!searchQuery) return true;
    return slot.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
           slot.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
           slot.provider.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const calculateSlotDuration = (slot: Slot) => {
    const start = new Date(slot.start);
    const end = new Date(slot.end);
    return Math.round((end.getTime() - start.getTime()) / (1000 * 60));
  };

  const isSlotAvailable = (slot: Slot) => {
    return new Date(slot.start) > new Date();
  };

  const handleBookSlot = async (slotId: string, duration: number) => {
    try {
      const response = await fetch(`/api/slots/${slotId}/book`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ duration })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to book slot");
      }

      toast.success("Slot booked successfully!");
      fetchSlots(); // Refresh the list
    } catch (error: any) {
      toast.error(error.message || "Failed to book slot");
    }
  };

  const SlotCard = ({ slot }: { slot: Slot }) => {
    const duration = calculateSlotDuration(slot);
    const minCost = slot.minDuration * slot.pricePerMinute;
    const maxCost = Math.min(duration, slot.maxDuration || duration) * slot.pricePerMinute;
    const available = isSlotAvailable(slot);

    return (
      <Card key={slot.id} className={`hover:shadow-md transition-shadow ${!available ? 'opacity-60' : ''}`}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <CardTitle className="text-lg line-clamp-1">{slot.title}</CardTitle>
                {!available && (
                  <Badge variant="secondary" className="bg-gray-100 text-gray-600">
                    Past
                  </Badge>
                )}
              </div>
              {slot.description && (
                <CardDescription className="line-clamp-2 mb-2">
                  {slot.description}
                </CardDescription>
              )}
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <User className="h-4 w-4" />
                <span>{slot.provider.name}</span>
                {slot.provider.city && (
                  <>
                    <span>•</span>
                    <span>{slot.provider.city}</span>
                  </>
                )}
              </div>
            </div>
            <Badge variant="outline" className="bg-green-50 text-green-700">
              {slot.pricePerMinute} credits/min
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* Time and Duration */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-400" />
                <div>
                  <div className="font-medium">{format(new Date(slot.start), "MMM d")}</div>
                  <div className="text-gray-600">{format(new Date(slot.start), "h:mm a")}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-400" />
                <div>
                  <div className="font-medium">{duration} min available</div>
                  <div className="text-gray-600">{slot.minDuration}-{slot.maxDuration || duration} min bookings</div>
                </div>
              </div>
            </div>

            {/* Category and Location */}
            <div className="flex items-center justify-between">
              <Badge variant="outline">
                {slot.category.replace('_', ' ')}
              </Badge>
              {slot.location && (
                <div className="flex items-center gap-1 text-sm text-gray-600">
                  <MapPin className="h-3 w-3" />
                  <span className="truncate max-w-[120px]">{slot.location}</span>
                </div>
              )}
            </div>

            {/* Cost Range */}
            <div className="bg-gray-50 p-3 rounded text-sm">
              <div className="font-medium text-gray-700 mb-1">Cost Range:</div>
              <div className="text-green-700">
                {minCost === maxCost 
                  ? `${minCost} credits` 
                  : `${minCost} - ${maxCost} credits`
                }
                <span className="text-gray-600 ml-1">
                  ({slot.minDuration}{slot.maxDuration && ` - ${Math.min(slot.maxDuration, duration)}`} min)
                </span>
              </div>
            </div>

            {/* Action */}
            <div className="pt-2 border-t">
              {available ? (
                <Button 
                  className="w-full" 
                  onClick={() => handleBookSlot(slot.id, slot.minDuration)}
                >
                  <DollarSign className="h-4 w-4 mr-2" />
                  Book {slot.minDuration} min for {minCost} credits
                </Button>
              ) : (
                <Button variant="outline" className="w-full" disabled>
                  No Longer Available
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Available Slots</h2>
          <p className="text-gray-600">Book time with your circle members</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
            {!userHasProAccess && (
              <Badge variant="outline" className="bg-blue-50 text-blue-700">
                <Zap className="h-3 w-3 mr-1" />
                Pro
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search slots..."
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
              <label className="text-sm font-medium">Price Range</label>
              <Select 
                value={priceRange} 
                onValueChange={setPriceRange}
                disabled={!userHasProAccess}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All prices" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All prices</SelectItem>
                  <SelectItem value="1-2">1-2 credits/min</SelectItem>
                  <SelectItem value="3-5">3-5 credits/min</SelectItem>
                  <SelectItem value="6-10">6-10 credits/min</SelectItem>
                  <SelectItem value="10+">10+ credits/min</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Time</label>
              <Select 
                value={timeFilter} 
                onValueChange={setTimeFilter}
                disabled={!userHasProAccess}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Any time" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Any time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="tomorrow">Tomorrow</SelectItem>
                  <SelectItem value="this-week">This week</SelectItem>
                  <SelectItem value="next-week">Next week</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {!userHasProAccess && (
            <Alert className="mt-4">
              <Zap className="h-4 w-4" />
              <AlertDescription>
                <strong>Upgrade to Pro</strong> to access advanced filters like price range, 
                time filtering, and proximity search.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Content */}
      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
        <TabsList>
          <TabsTrigger value="list">List View</TabsTrigger>
          <TabsTrigger value="calendar">Calendar View</TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          {loading ? (
            <div className="text-center py-8">Loading available slots...</div>
          ) : filteredSlots.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <div className="space-y-4">
                  <div className="text-6xl">⏰</div>
                  <div>
                    <h3 className="text-lg font-semibold mb-2">No Available Slots</h3>
                    <p className="text-gray-600 mb-4">
                      {searchQuery || selectedCategory || priceRange || timeFilter
                        ? "Try adjusting your filters to find more slots."
                        : "No one has published availability yet."
                      }
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm text-gray-600">
                <span>
                  Showing {filteredSlots.length} available slots
                </span>
                <span>
                  {filteredSlots.filter(s => isSlotAvailable(s)).length} currently bookable
                </span>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                {filteredSlots.map(slot => (
                  <SlotCard key={slot.id} slot={slot} />
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="calendar">
          <Card>
            <CardHeader>
              <CardTitle>Calendar View</CardTitle>
              <CardDescription>
                Interactive calendar showing slot availability
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-96 bg-gray-100 rounded-lg flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium mb-2">Calendar View Coming Soon</p>
                  <p>Interactive calendar with slot time blocks</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}