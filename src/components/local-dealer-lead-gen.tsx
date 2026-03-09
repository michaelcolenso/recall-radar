"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface LocalDealerLeadGenProps {
  makeName: string;
}

export function LocalDealerLeadGen({ makeName }: LocalDealerLeadGenProps) {
  return (
    <Card className="bg-blue-50 border-blue-200 mb-6">
      <CardContent className="pt-6">
        <h2 className="text-lg font-semibold text-blue-900 mb-1">
          Get this fixed for free at a certified dealer
        </h2>
        <p className="text-sm text-blue-700 mb-4">
          Find a certified {makeName} dealer near you to fix this recall at no
          cost to you. All recall repairs are FREE by law.
        </p>
        <div className="flex gap-2">
          <Input
            type="text"
            placeholder="Enter your ZIP code"
            className="max-w-[200px] border-blue-300 bg-white"
          />
          <Button className="bg-blue-600 hover:bg-blue-700 text-white">
            Find Nearby Dealers
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
