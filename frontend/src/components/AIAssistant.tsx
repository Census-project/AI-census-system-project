import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageCircle, Send, Bot, User } from "lucide-react";
import { api } from "@/lib/api";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const assistantResponses: Record<string, string> = {
  "what questions": "Based on the current household data, you should ask about: 1) Household composition and relationships, 2) Employment status and income sources, 3) Education levels of all members, 4) Health conditions and disabilities, 5) Housing conditions and ownership.",
  "next question": "For this household, the next logical question would be about employment status. Ask: 'What is the primary occupation of the head of household?'",
  "help with form": "I can help you fill out the census form. Try asking me specific questions like 'What should I enter for household ID?' or 'How do I record GPS coordinates?'",
  "offline sync": "To sync offline submissions, ensure you're connected to the internet and the backend is running. The app will automatically sync pending records when you log in.",
  "gps not working": "If GPS isn't working, you can manually enter the address. The system will still accept the submission, but coordinate data helps with mapping accuracy.",
  "duplicate household": "Check the household ID carefully. Each household should have a unique ID. Use the auto-generate button if you're unsure.",
  "age validation": "Age should be between 0 and 150. If someone appears much older, double-check the entry or note it for follow-up verification.",
  "phone format": "Phone numbers should include country code (e.g., +234xxxxxxxxxx). This helps with contact tracing and service delivery.",
  "location accuracy": "For best results, capture GPS coordinates when possible. If indoors, step outside briefly to get a clear satellite signal.",
  "submission failed": "Check your internet connection and login status. If the problem persists, save as offline and sync later when connected.",
};

function findBestResponse(query: string): string {
  const lowerQuery = query.toLowerCase();

  for (const [key, response] of Object.entries(assistantResponses)) {
    if (lowerQuery.includes(key)) {
      return response;
    }
  }

  // Default responses based on keywords
  if (lowerQuery.includes("question") || lowerQuery.includes("ask")) {
    return assistantResponses["what questions"];
  }
  if (lowerQuery.includes("sync") || lowerQuery.includes("offline")) {
    return assistantResponses["offline sync"];
  }
  if (lowerQuery.includes("gps") || lowerQuery.includes("location")) {
    return assistantResponses["location accuracy"];
  }
  if (lowerQuery.includes("form") || lowerQuery.includes("fill")) {
    return assistantResponses["help with form"];
  }

  return "I'm here to help with census data collection. Try asking about form questions, GPS coordinates, offline sync, or data validation. For example: 'What should I ask next?' or 'How do I sync offline data?'";
}

export default function AIAssistant() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content: "Hello! I'm your AI census assistant. I can help with form questions, data validation, GPS coordinates, and offline sync. What would you like to know?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);

    const token = localStorage.getItem('token');
    if (!token) {
      const response = findBestResponse(input);
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: response,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setIsTyping(false);
      return;
    }

    try {
      const data = await api.processNaturalQuery(input, token);
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.answer || data.result?.title || data.message || 'I am not sure how to answer that right now.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const response = findBestResponse(input);
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: response,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15 }}
      className="glass-card overflow-hidden"
    >
      <CardHeader className="bg-primary px-6 py-4">
        <CardTitle className="flex items-center gap-2 text-primary-foreground">
          <Bot className="h-5 w-5" />
          AI Census Assistant
        </CardTitle>
      </CardHeader>

      <CardContent className="flex flex-col h-[500px] p-0">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {message.role === "assistant" && (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary flex-shrink-0">
                  <Bot className="h-4 w-4" />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground ml-auto"
                    : "bg-muted text-foreground"
                }`}
              >
                {message.content}
              </div>
              {message.role === "user" && (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground flex-shrink-0">
                  <User className="h-4 w-4" />
                </div>
              )}
            </motion.div>
          ))}
          {isTyping && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex gap-3 justify-start"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary flex-shrink-0">
                <Bot className="h-4 w-4" />
              </div>
              <div className="bg-muted rounded-2xl px-4 py-3 text-sm text-muted-foreground">
                Thinking...
              </div>
            </motion.div>
          )}
        </div>

        <div className="border-t border-border p-4">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask me about census forms, GPS, sync, or validation..."
              className="flex-1"
            />
            <Button onClick={handleSend} disabled={!input.trim() || isTyping} size="icon">
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Try: "What should I ask next?" or "How do I sync offline data?"
          </p>
        </div>
      </CardContent>
    </motion.div>
  );
}