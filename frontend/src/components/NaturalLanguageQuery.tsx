import React, { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, BarChart3, Users, MapPin, TrendingUp } from "lucide-react";
import type { CensusData } from "@/lib/api";
import { api } from "@/lib/api";

interface QueryResult {
  type: "count" | "average" | "list" | "percentage" | "trend";
  title: string;
  value: string | number;
  details?: string;
  data?: [string, number][] | { date: string; count: number }[];
}

export default function NaturalLanguageQuery({ records }: { records: CensusData[] }) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<QueryResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const handleQuery = async () => {
    if (!query.trim()) return;

    setIsSearching(true);
    const token = localStorage.getItem('token');
    if (!token) {
      setResult({ type: "count", title: "Error", value: "Authentication required" });
      setIsSearching(false);
      return;
    }

    try {
      const response = await api.processNaturalQuery(query, token);
      if (response.success) {
        setResult(response.result);
      } else {
        setResult({ type: "count", title: "Query Not Understood", value: response.message });
      }
    } catch (error) {
      console.error('AI query error:', error);
      setResult({ type: "count", title: "Error", value: "Failed to process query" });
    }
    setIsSearching(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleQuery();
    }
  };

  const getIcon = (type: QueryResult["type"]) => {
    switch (type) {
      case "count": return Users;
      case "average": return TrendingUp;
      case "percentage": return BarChart3;
      case "list": return MapPin;
      case "trend": return TrendingUp;
      default: return Search;
    }
  };

  return (
    <Card className="glass-card-hover border-border/80 bg-card/90">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <Search className="h-5 w-5 text-primary" />
          Natural Language Query
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask questions like: 'How many males?' or 'Average age?' or 'Top locations?'"
            className="flex-1"
          />
          <Button onClick={handleQuery} disabled={isSearching || !query.trim()}>
            {isSearching ? "Searching..." : "Ask"}
          </Button>
        </div>

        {result && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-lg border border-border bg-background p-4"
          >
            <div className="flex items-center gap-3 mb-3">
              {React.createElement(getIcon(result.type), { className: "h-5 w-5 text-primary" })}
              <h4 className="font-semibold text-foreground">{result.title}</h4>
            </div>

            <div className="text-2xl font-bold text-primary mb-2">{result.value}</div>

            {result.details && (
              <p className="text-sm text-muted-foreground mb-3">{result.details}</p>
            )}

            {result.data && result.type === "list" && (
              <div className="space-y-2">
                {(result.data as [string, number][]).map(([key, value], index) => (
                  <div key={index} className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">{key}</span>
                    <span className="font-medium">{value}</span>
                  </div>
                ))}
              </div>
            )}

            {result.data && result.type === "trend" && (
              <div className="space-y-2">
                {(result.data as { date: string; count: number }[]).map((item, index: number) => (
                  <div key={index} className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">{item.date}</span>
                    <span className="font-medium">{item.count} submissions</span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        <div className="text-xs text-muted-foreground">
          <p className="font-medium mb-1">Try asking:</p>
          <ul className="space-y-1">
            <li>• "How many males are there?"</li>
            <li>• "What's the average age?"</li>
            <li>• "Show me the top locations"</li>
            <li>• "What's the age distribution?"</li>
            <li>• "How many records are geotagged?"</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}