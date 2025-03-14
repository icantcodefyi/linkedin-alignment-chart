"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare,
  X,
  Sparkles,
  SquareDashedMousePointer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { AlignmentAnalysis } from "../actions/analyze-tweets";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

export function AnalysisPanel({
  analyses,
  newAnalysisId,
  children,
}: {
  analyses: Array<{
    id: string;
    username: string;
    imageSrc: string;
    analysis: AlignmentAnalysis;
    timestamp: Date;
  }>;
  newAnalysisId: string | null;
  children?: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasNewAnalysis, setHasNewAnalysis] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when new analyses are added
  useEffect(() => {
    if (isOpen && scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [analyses, isOpen]);

  // Handle new analysis notification
  useEffect(() => {
    if (newAnalysisId && !isOpen) {
      setHasNewAnalysis(true);
    }
  }, [newAnalysisId, isOpen]);

  // Reset notification when panel is opened
  useEffect(() => {
    if (isOpen) {
      setHasNewAnalysis(false);
    }
  }, [isOpen]);

  // Get alignment name based on scores
  const getAlignmentName = (lawfulChaotic: number, goodEvil: number) => {
    const lawfulAxis =
      lawfulChaotic < -33
        ? "Lawful"
        : lawfulChaotic > 33
        ? "Chaotic"
        : "Neutral";
    const goodAxis =
      goodEvil < -33 ? "Good" : goodEvil > 33 ? "Evil" : "Neutral";

    // Special case for true neutral
    if (lawfulAxis === "Neutral" && goodAxis === "Neutral") {
      return "True Neutral";
    }

    return `${lawfulAxis} ${goodAxis}`;
  };

  return (
    <div className="fixed bottom-4 left-4 z-40 scrollable">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: 20, height: 0 }}
            transition={{ duration: 0.3 }}
            className="mb-2"
          >
            <Card className="w-[calc(min(90vw,28rem))] md:w-[28rem] shadow-lg overflow-hidden">
              <div className="relative flex items-center justify-between py-2 px-3">
                <div className="absolute top-0 left-0 w-full h-full bg-slate-800"></div>
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-purple-500 to-indigo-500 opacity-70"></div>
                <div className="flex items-center gap-2 text-white z-10">
                  <Sparkles className="h-4 w-4" />
                  <h3 className="font-medium">AI X alignment analysis</h3>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-white hover:bg-white/20"
                  onClick={() => setIsOpen(false)}
                >
                  <X className="!size-5" />
                </Button>
              </div>
              <div className="border-x-2 border-b-2 rounded-b-md border-purple-500/70 dark:border-purple-900 block">
                <ScrollArea
                  ref={scrollAreaRef}
                  className="w-full min-h-[16rem] h-[calc(min(100vh,_40vh))] px-3 flex-col flex min-w-0"
                >
                  {analyses.length === 0 ? (
                    <div className="flex flex-col items-start justify-start h-full text-left text-muted-foreground py-4">
                      <SquareDashedMousePointer className="h-8 w-8 mb-2 opacity-50" />
                      <p>
                        You haven't analysed any X users yet. Use the purple
                        button with the sparkles to analyze a user's vibe using
                        AI.
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col h-full">
                      <div className="flex flex-col gap-4 py-3">
                        {analyses.map((item) => (
                          <div
                            key={item.id}
                            // initial={{ opacity: 0, y: 10 }}
                            // animate={{ opacity: 1, y: 0 }}
                            className={`flex gap-2`}
                          >
                            <div className="flex-shrink-0">
                              <div className="relative h-10 w-10 rounded-md overflow-hidden border border-purple-200 dark:border-purple-800">
                                <Image
                                  src={item.imageSrc || "/placeholder.svg"}
                                  alt={`@${item.username}`}
                                  fill
                                  className="object-cover"
                                  unoptimized
                                />
                              </div>
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-sm">
                                  @{item.username}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {new Date(item.timestamp).toLocaleTimeString(
                                    [],
                                    { hour: "2-digit", minute: "2-digit" }
                                  )}
                                </span>
                              </div>
                              <div className="mt-1 text-sm bg-purple-50 dark:bg-purple-950/30 rounded-md p-2">
                                <div className="flex items-center gap-2 mb-1">
                                  <Sparkles className="h-3 w-3 text-purple-500" />
                                  <span className="font-medium">
                                    {getAlignmentName(
                                      item.analysis.lawfulChaotic,
                                      item.analysis.goodEvil
                                    )}
                                  </span>
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">
                                  <span className="block mb-1">
                                    <span className="font-medium">
                                      Lawful-Chaotic:
                                    </span>{" "}
                                    {item.analysis.lawfulChaotic}
                                  </span>
                                  <span className="block mb-1">
                                    <span className="font-medium">
                                      Good-Evil:
                                    </span>{" "}
                                    {item.analysis.goodEvil}
                                  </span>
                                  <p className="mt-2 text-xs">
                                    {item.analysis.explanation}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </ScrollArea>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex z-50 gap-2">
        <motion.div
          className={cn("relative transition-all duration-200 group")}
        >
          <Button
            onClick={() => setIsOpen(!isOpen)}
            size="sm"
            className="h-12 min-w-12 rounded-full shadow-lg bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 group-hover:from-purple-700 group-hover:to-indigo-800 transition-all duration-200"
          >
            <MessageSquare className="!size-5 text-white" />
            <span className="block text-base text-white">Analysis panel</span>
          </Button>

          {hasNewAnalysis && (
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 flex items-center justify-center text-white text-xs font-bold"
            >
              !
            </motion.div>
          )}
        </motion.div>

        {children}
      </div>
    </div>
  );
}
