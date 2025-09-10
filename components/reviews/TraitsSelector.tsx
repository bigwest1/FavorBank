"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { 
  Heart, Shield, Smile, HandHeart, MessageCircle, Users,
  CheckCircle, Sparkles
} from "lucide-react";

interface TraitsSelectorProps {
  revieweeName: string;
  selectedTraits: string[];
  onTraitsChange: (traits: string[]) => void;
  note: string;
  onNoteChange: (note: string) => void;
  onSubmit: () => void;
  isSubmitting?: boolean;
}

const TRAITS = [
  {
    value: "RELIABLE",
    label: "Reliable",
    description: "Always follows through",
    icon: Shield,
    color: "bg-blue-100 text-blue-800 border-blue-200"
  },
  {
    value: "CAREFUL",
    label: "Careful",
    description: "Pays attention to details",
    icon: CheckCircle,
    color: "bg-green-100 text-green-800 border-green-200"
  },
  {
    value: "CHEERFUL",
    label: "Cheerful",
    description: "Brings positive energy",
    icon: Smile,
    color: "bg-yellow-100 text-yellow-800 border-yellow-200"
  },
  {
    value: "HELPFUL",
    label: "Helpful",
    description: "Goes above and beyond",
    icon: HandHeart,
    color: "bg-purple-100 text-purple-800 border-purple-200"
  },
  {
    value: "RESPONSIVE",
    label: "Responsive",
    description: "Communicates clearly",
    icon: MessageCircle,
    color: "bg-indigo-100 text-indigo-800 border-indigo-200"
  },
  {
    value: "FRIENDLY",
    label: "Friendly",
    description: "Easy to work with",
    icon: Users,
    color: "bg-pink-100 text-pink-800 border-pink-200"
  }
];

export function TraitsSelector({
  revieweeName,
  selectedTraits,
  onTraitsChange,
  note,
  onNoteChange,
  onSubmit,
  isSubmitting = false
}: TraitsSelectorProps) {
  const handleTraitToggle = (traitValue: string) => {
    if (selectedTraits.includes(traitValue)) {
      // Remove trait
      onTraitsChange(selectedTraits.filter(t => t !== traitValue));
    } else if (selectedTraits.length < 3) {
      // Add trait (max 3)
      onTraitsChange([...selectedTraits, traitValue]);
    }
  };

  const canSubmit = selectedTraits.length > 0 && !isSubmitting;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-yellow-500" />
          Share positive feedback about {revieweeName}
        </CardTitle>
        <CardDescription>
          Select 1-3 traits that best describe their help (positive vibes only!)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Traits Selection */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">What made them great?</Label>
          <div className="grid grid-cols-2 gap-3">
            {TRAITS.map((trait) => {
              const Icon = trait.icon;
              const isSelected = selectedTraits.includes(trait.value);
              const isDisabled = !isSelected && selectedTraits.length >= 3;
              
              return (
                <button
                  key={trait.value}
                  onClick={() => handleTraitToggle(trait.value)}
                  disabled={isDisabled}
                  className={`
                    p-3 rounded-lg border-2 text-left transition-all
                    ${isSelected 
                      ? `${trait.color} border-current ring-2 ring-opacity-50` 
                      : isDisabled 
                        ? 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed'
                        : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm cursor-pointer'
                    }
                  `}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className={`h-4 w-4 ${isSelected ? 'text-current' : 'text-gray-400'}`} />
                    <span className={`font-medium text-sm ${isSelected ? 'text-current' : 'text-gray-700'}`}>
                      {trait.label}
                    </span>
                    {isSelected && (
                      <CheckCircle className="h-3 w-3 ml-auto text-current" />
                    )}
                  </div>
                  <p className={`text-xs ${isSelected ? 'text-current opacity-80' : 'text-gray-500'}`}>
                    {trait.description}
                  </p>
                </button>
              );
            })}
          </div>
          
          {/* Selected traits summary */}
          {selectedTraits.length > 0 && (
            <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg border border-green-200">
              <Heart className="h-4 w-4 text-green-600" />
              <span className="text-sm text-green-800">
                You've highlighted {selectedTraits.length} positive trait{selectedTraits.length !== 1 ? 's' : ''}
              </span>
              <div className="flex gap-1 ml-auto">
                {selectedTraits.map((trait) => {
                  const traitInfo = TRAITS.find(t => t.value === trait);
                  return (
                    <Badge key={trait} variant="outline" className="text-xs bg-white">
                      {traitInfo?.label}
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Optional Note */}
        <div className="space-y-2">
          <Label htmlFor="note">Optional note (keep it positive!)</Label>
          <Textarea
            id="note"
            placeholder={`A quick note about what made ${revieweeName} helpful...`}
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
            maxLength={200}
            rows={3}
          />
          <div className="text-xs text-gray-500 text-right">
            {note.length}/200
          </div>
        </div>

        {/* Submit */}
        <div className="flex gap-3 pt-4 border-t">
          <Button 
            onClick={onSubmit}
            disabled={!canSubmit}
            className="flex-1"
          >
            <Heart className="h-4 w-4 mr-2" />
            {isSubmitting ? "Sharing feedback..." : "Share positive feedback"}
          </Button>
        </div>

        {/* Helper text */}
        <div className="text-xs text-gray-500 text-center">
          Only positive traits are shared. This helps build trust and kindness in your circle.
        </div>
      </CardContent>
    </Card>
  );
}