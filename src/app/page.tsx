"use client";

import type React from "react";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useTransition,
  startTransition,
} from "react";
import NextImage from "next/image";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  X,
  Sparkles,
  Lock,
  Dices,
  GithubIcon,
  Save,
  Database,
  MessageSquare,
  Trash,
} from "lucide-react";
import { analyseUser, type AlignmentAnalysis } from "./actions/analyze-tweets";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AnalysisPanel } from "./components/analysis-panel";
import { toast } from "sonner";
import { cn, getRandomPosition } from "@/lib/utils";
import { getBestAvatarUrl } from "@/lib/load-avatar";
import {
  initIndexedDB,
  cachePlacementsLocally,
  loadCachedPlacements,
  removeCachedPlacement,
  clearLocalCache,
  StoredPlacement,
} from "@/lib/indexed-db";
import { useDebounce } from "@/hooks/use-debounce";
import { logger } from "@/lib/logger";
import {
  AlertDialogHeader,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

interface Position {
  x: number;
  y: number;
}

export interface Placement {
  id: string;
  src: string;
  position: Position;
  isDragging: boolean;
  loading?: boolean;
  username?: string;
  analysis?: AlignmentAnalysis;
  isAiPlaced?: boolean;
  timestamp?: Date;
}

export default function AlignmentChart() {
  const hasDoneFirstRandomPlace = useRef(false);
  const [images, setImages] = useState<Placement[]>([]);
  const [username, setUsername] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const chartRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState(60);
  const [chartSize, setChartSize] = useState({ width: 0, height: 0 });
  const [isMobile, setIsMobile] = useState(false);
  const [newAnalysisId, setNewAnalysisId] = useState<string | null>(null);
  const [linkedInUrl, setLinkedInUrl] = useState("");

  const debouncedSave = useDebounce(cachePlacementsLocally, 500);

  useEffect(() => {
    async function loadCachedUsers() {
      try {
        setIsLoading(true);
        await initIndexedDB();
        const cachedPlacements = await loadCachedPlacements();

        if (cachedPlacements.length > 0) {
          const loadedImages: Placement[] = cachedPlacements.map((item) => ({
            ...item,
            isDragging: false,
            loading: false,
            position: item.position,
            timestamp: item.timestamp ? new Date(item.timestamp) : new Date(),
          }));

          setImages(loadedImages);
          toast.success(`Loaded ${loadedImages.length} saved placements`);
        }
      } catch (error) {
        logger.error("Failed to load users from IndexedDB:", error);
      } finally {
        setIsLoading(false);
      }
    }

    loadCachedUsers();
  }, []);

  // Save users to IndexedDB whenever the images state changes
  useEffect(() => {
    if (isLoading) return;

    // Call our debounced save function
    debouncedSave(images);
  }, [images, isLoading, debouncedSave]);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);

    return () => {
      window.removeEventListener("resize", checkMobile);
    };
  }, []);

  useEffect(() => {
    const handleTouchMove = (e: TouchEvent) => {
      if (
        e.target instanceof HTMLElement &&
        e.target.tagName !== "INPUT" &&
        !e.target.closest(".scrollable")
      ) {
        e.preventDefault();
      }
    };

    document.addEventListener("touchmove", handleTouchMove, { passive: false });

    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("touchmove", handleTouchMove);
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    const updateChartSize = () => {
      if (containerRef.current && chartRef.current) {
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;
        const isMobileView = viewportWidth < 768;

        const reservedVerticalSpace = isMobileView ? 120 : 140;
        const topPadding = isMobileView ? 20 : 0;
        const availableHeight =
          viewportHeight - reservedVerticalSpace - topPadding;

        const horizontalPadding = isMobileView
          ? Math.max(40, viewportWidth * 0.1)
          : Math.max(20, viewportWidth * 0.05);
        const availableWidth = viewportWidth - horizontalPadding * 2;

        const size = Math.min(availableWidth, availableHeight); //constrained square

        setChartSize({ width: size, height: size });

        const newImageSize = Math.max(40, Math.min(80, size / 7.5));
        setImageSize(newImageSize);
      }
    };

    if (containerRef.current) {
      const resizeObserver = new ResizeObserver(() => {
        updateChartSize();
      });

      resizeObserver.observe(containerRef.current);

      updateChartSize();

      return () => {
        if (containerRef.current) {
          resizeObserver.unobserve(containerRef.current);
        }
        resizeObserver.disconnect();
      };
    }

    window.addEventListener("resize", updateChartSize);
    return () => window.removeEventListener("resize", updateChartSize);
  }, []);

  const alignmentToPosition = (analysis: AlignmentAnalysis): Position => {
    const xPercent = ((analysis.lawfulChaotic + 100) / 200) * 100;
    const yPercent = ((analysis.goodEvil + 100) / 200) * 100;

    return { x: xPercent, y: yPercent };
  };

  // Generate a profile image when a username is submitted
  const handleRandomAnalyze = async () => {
    if (!username.trim()) return;

    if (!hasDoneFirstRandomPlace.current) {
      hasDoneFirstRandomPlace.current = true;
      toast("Note", {
        description:
          "Heads up! You just used random placement mode (grey button). If you wanted to use the AI analysis, use the auto-analyze button (purple button)!",
        duration: 10000,
      });
      return;
    }

    const cleanUsername = username.trim().replace(/^@/, "");
    const randomPosition = getRandomPosition();

    const tempImageId = `image-${Date.now()}`;
    const tempImage: Placement = {
      id: tempImageId,
      src: `https://unavatar.io/x/${cleanUsername}`, // Default initial URL
      position: randomPosition,
      isDragging: false,
      loading: true,
      username: cleanUsername,
      isAiPlaced: false,
      timestamp: new Date(),
    };

    setImages((prev) => [...prev, tempImage]);
    setUsername("");

    try {
      const finalUrl = await getBestAvatarUrl(cleanUsername);

      setImages((prev) =>
        prev.map((img) =>
          img.id === tempImageId
            ? { ...img, src: finalUrl, loading: false }
            : img
        )
      );
    } catch (error) {
      logger.error("Error loading profile image:", error);

      setImages((prev) =>
        prev.map((img) =>
          img.id === tempImageId ? { ...img, loading: false } : img
        )
      );
    }
  };

  const handleAutoAnalyze = async () => {
    if (!linkedInUrl.trim()) return;

    setIsAnalyzing(true);

    const username = linkedInUrl.trim();

    try {
      const tempImageId = `image-${Date.now()}`;
      const tempImage: Placement = {
        id: tempImageId,
        src: `/grid.svg?height=100&width=100&text=Analyzing...`,
        position: getRandomPosition(),
        isDragging: false,
        loading: true,
        username: username,
        isAiPlaced: true,
        timestamp: new Date(),
      };

      setImages((prev) => [...prev, tempImage]);
      setLinkedInUrl("");

      const analysis = await analyseUser(username);
      if (analysis.isError) {
        toast.error(`Error`, {
          description: analysis.explanation,
          position: "top-right",
          duration: 4000,
        });

        setImages((prev) =>
          prev.filter((img) => img.username !== username)
        );
        return;
      }
      const position = alignmentToPosition(analysis);

      // Use author image from LinkedIn if available
      const authorImage = analysis.authorImage || `/grid.svg?height=100&width=100&text=${username.slice(0, 2).toUpperCase()}`;
      // Use author name if available, otherwise use profile ID
      const displayName = analysis.authorName || username;

      setImages((prev) =>
        prev.map((img) =>
          img.id === tempImageId
            ? {
                ...img,
                src: authorImage,
                username: displayName,
                position,
                loading: false,
                analysis,
                isAiPlaced: true,
                timestamp: new Date(),
              }
            : img
        )
      );

      setNewAnalysisId(tempImageId);

      setTimeout(() => {
        setNewAnalysisId(null);
      }, 5000);
    } catch (error) {
      logger.error("Error auto-analyzing:", error);

      setImages((prev) => prev.filter((img) => img.username !== username));

      toast.error(`Error`, {
        description: `Couldn't analyze LinkedIn profile ${username}: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        position: "top-right",
        duration: 4000,
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleMouseDown = (e: React.MouseEvent, id: string) => {
    e.preventDefault();

    const image = images.find((img) => img.id === id);
    if (!image || image.loading || image.isAiPlaced) return;

    setActiveDragId(id);
    setImages(
      images.map((img) => (img.id === id ? { ...img, isDragging: true } : img))
    );
  };

  const handleTouchStart = (e: React.TouchEvent, id: string) => {
    const image = images.find((img) => img.id === id);
    if (!image || image.loading || image.isAiPlaced) return;

    setActiveDragId(id);
    setImages(
      images.map((img) => (img.id === id ? { ...img, isDragging: true } : img))
    );
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!activeDragId || !chartRef.current) return;

    const chartRect = chartRef.current.getBoundingClientRect();
    const x = ((e.clientX - chartRect.left) / chartRect.width) * 100;
    const y = ((e.clientY - chartRect.top) / chartRect.height) * 100;

    setImages(
      images.map((img) =>
        img.id === activeDragId
          ? {
              ...img,
              position: {
                x: Math.max(0, Math.min(x, 100)),
                y: Math.max(0, Math.min(y, 100)),
              },
            }
          : img
      )
    );
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!activeDragId || !chartRef.current) return;
    e.preventDefault();

    const touch = e.touches[0];
    const chartRect = chartRef.current.getBoundingClientRect();
    const x = ((touch.clientX - chartRect.left) / chartRect.width) * 100;
    const y = ((touch.clientY - chartRect.top) / chartRect.height) * 100;

    setImages(
      images.map((img) =>
        img.id === activeDragId
          ? {
              ...img,
              position: {
                x: Math.max(0, Math.min(x, 100)),
                y: Math.max(0, Math.min(y, 100)),
              },
            }
          : img
      )
    );
  };

  const handleMouseUp = () => {
    if (!activeDragId) return;

    setImages(
      images.map((img) =>
        img.id === activeDragId ? { ...img, isDragging: false } : img
      )
    );

    setActiveDragId(null);
  };

  const handleTouchEnd = () => {
    if (!activeDragId) return;

    setImages(
      images.map((img) =>
        img.id === activeDragId ? { ...img, isDragging: false } : img
      )
    );

    setActiveDragId(null);
  };

  const handleRemoveImage = async (id: string) => {
    setImages(images.filter((img) => img.id !== id));

    removeCachedPlacement(id).catch((error) => {
      logger.error("Error removing placement from IndexedDB:", error);
    });
  };

  useEffect(() => {
    if (activeDragId) {
      // Mouse events
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);

      // Touch events for mobile
      window.addEventListener("touchmove", handleTouchMove, { passive: false });
      window.addEventListener("touchend", handleTouchEnd);
      window.addEventListener("touchcancel", handleTouchEnd);
    }

    return () => {
      // Remove mouse events
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);

      // Remove touch events
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [activeDragId, images]);

  const analysesForPanel = images
    .filter((img) => img.isAiPlaced && img.analysis && !img.loading)
    .map((img) => ({
      id: img.id,
      username: img.username || "unknown",
      imageSrc: img.src,
      analysis: img.analysis!,
      timestamp: img.timestamp || new Date(),
    }))
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  return (
    <div
      className={`flex flex-col ${
        isMobile ? "justify-start pt-4 px-2 md:px-8" : "justify-center"
      } min-h-screen w-full overflow-hidden`}
      ref={containerRef}
    >
      <div className="flex flex-col items-center gap-7 w-full px-4">
        <form
          className="relative w-full max-w-md"
          onSubmit={(e) => {
            e.preventDefault();
            handleAutoAnalyze();
          }}
        >
          <Input
            placeholder="Enter LinkedIn Username"
            value={linkedInUrl}
            onChange={(e) => setLinkedInUrl(e.target.value)}
            className="pr-20 rounded-full pl-4"
            autoCapitalize="none"
            spellCheck="false"
            type="text"
            disabled={isAnalyzing}
          />
          <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex space-x-1">
            <TooltipProvider>
              <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    onClick={handleRandomAnalyze}
                    size="icon"
                    className="h-7 w-7 rounded-full bg-black hover:bg-black/90 text-white p-0"
                    disabled={!linkedInUrl.trim() || isAnalyzing}
                  >
                    <Dices className="h-3.5 w-3.5" />
                    <span className="sr-only">Add Image</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>Randomly place a user on the chart</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="icon"
                    className="h-7 w-7 rounded-full bg-purple-600 hover:bg-purple-700 text-white flex items-center justify-center"
                    onClick={handleAutoAnalyze}
                    disabled={!linkedInUrl.trim() || isAnalyzing}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span className="sr-only">Auto-Analyze</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>Analyze a user's tweets and place them on the chart</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </form>

        <div className="relative">
          <button
            onClick={() =>
              toast("Good", {
                description:
                  "Characters who are altruistic, compassionate, always strive to put others first.",
              })
            }
            className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-3 py-1 font-bold md:text-lg text-sm border border-black rounded-full z-10"
          >
            Good
          </button>
          <button
            onClick={() =>
              toast("Evil", {
                description:
                  "Characters who are selfish, manipulative, or harmful to others. Some are motivated by greed, hatred, or lust for power.",
              })
            }
            className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 bg-white px-3 py-1 font-bold md:text-lg text-sm border border-black rounded-full z-10"
          >
            Evil
          </button>
          <button
            onClick={() =>
              toast("Lawful", {
                description:
                  "Characters who are lawful, follow rules, traditions, and social norms. They value tradition, loyalty, and order.",
              })
            }
            className="absolute top-1/2 left-0 -translate-x-1/2 -translate-y-1/2 bg-white px-3 py-1 font-bold md:text-lg text-sm border border-black rounded-full z-10 whitespace-nowrap mx-2"
          >
            Lawful
          </button>
          <button
            onClick={() =>
              toast("Chaotic", {
                description:
                  "Characters who rebel against convention, value personal freedom, and follow their own moral compass regardless of rules or traditions.",
              })
            }
            className="absolute top-1/2 right-0 translate-x-1/2 -translate-y-1/2 bg-white px-3 py-1 font-bold md:text-lg text-sm border border-black rounded-full z-10 whitespace-nowrap mx-2"
          >
            Chaotic
          </button>

          <Card
            className="relative border-2 border-black overflow-hidden"
            ref={chartRef}
            style={{
              width: `${chartSize.width}px`,
              height: `${chartSize.height}px`,
            }}
          >
            <div
              className="w-full h-full relative"
              style={{
                backgroundImage: `
                  linear-gradient(to right, rgba(0,0,0,0.1) 1px, transparent 1px),
                  linear-gradient(to bottom, rgba(0,0,0,0.1) 1px, transparent 1px)
                `,
                backgroundSize: "20px 20px",
              }}
            >
              <div className="absolute top-0 left-0 w-full h-full">
                <div className="absolute top-0 left-0 w-full h-full border-b-2 border-r-2 border-black" />
                <div className="absolute top-1/2 left-0 w-full h-0 border-t-2 border-black" />
                <div className="absolute top-0 left-1/2 w-0 h-full border-l-2 border-black" />
              </div>

              {images.map((img) => (
                <motion.div
                  key={img.id}
                  id={img.id}
                  className={`absolute ${
                    img.isAiPlaced
                      ? "cursor-not-allowed"
                      : img.loading
                      ? "cursor-wait"
                      : "cursor-grab"
                  } ${img.isDragging ? "z-10" : "z-0"} group`}
                  style={{
                    left: `${img.position.x}%`,
                    top: `${img.position.y}%`,
                    width: `${imageSize}px`,
                    height: `${imageSize}px`,
                    transform: `translate(-50%, -50%) ${
                      img.isDragging ? "scale(1.05)" : "scale(1)"
                    }`,
                    transition: img.isDragging ? "none" : "transform 0.1s ease",
                    opacity: img.loading ? 0.7 : 1,
                  }}
                  initial={img.isAiPlaced ? { scale: 0.8, opacity: 0 } : {}}
                  animate={img.isAiPlaced ? { scale: 1, opacity: 1 } : {}}
                  transition={{ duration: 0.5, type: "spring" }}
                  onMouseDown={(e) => handleMouseDown(e, img.id)}
                  onTouchStart={(e) => handleTouchStart(e, img.id)}
                >
                  <div
                    className={`relative w-full h-full rounded-md overflow-hidden bg-white
                      ${
                        img.isAiPlaced
                          ? "border-2 border-transparent shadow-lg"
                          : "border-2 border-gray-300"
                      }`}
                    style={{
                      boxShadow: img.isAiPlaced
                        ? "0 0 10px rgba(147, 51, 234, 0.5), 0 0 20px rgba(79, 70, 229, 0.3)"
                        : "",
                      background: img.isAiPlaced
                        ? "linear-gradient(white, white) padding-box, linear-gradient(to right, #9333ea, #4f46e5, #8b5cf6) border-box"
                        : "",
                    }}
                  >
                    <NextImage
                      src={img.src || "/grid.svg"}
                      alt={`LinkedIn profile image for ${img.username || "user"}`}
                      width={100}
                      height={100}
                      className={`object-cover w-full h-full ${
                        img.loading ? "animate-pulse" : ""
                      }`}
                      unoptimized
                    />

                    {img.loading && img.isAiPlaced && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="h-6 w-6 sm:h-8 sm:w-8 animate-spin rounded-full border-4 border-solid border-purple-500 border-r-transparent"></div>
                      </div>
                    )}

                    {!img.loading && (
                      <button
                        className="absolute top-0 right-0 bg-red-500 text-white rounded-bl-md p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{
                          fontSize: `${Math.max(10, imageSize / 8)}px`,
                          padding: `${Math.max(2, imageSize / 20)}px`,
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveImage(img.id);
                        }}
                      >
                        <X
                          style={{
                            width: `${Math.max(8, imageSize / 10)}px`,
                            height: `${Math.max(8, imageSize / 10)}px`,
                          }}
                        />
                      </button>
                    )}

                    {img.isAiPlaced && !img.loading && (
                      <div className="absolute top-0 left-0 bg-purple-600 text-white rounded-br-md p-1">
                        <Lock
                          className="w-3 h-3"
                          style={{
                            width: `${Math.max(8, imageSize / 10)}px`,
                            height: `${Math.max(8, imageSize / 10)}px`,
                          }}
                        />
                      </div>
                    )}

                    <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs p-1 opacity-0 group-hover:opacity-100 transition-opacity overflow-hidden">
                      {img.username}
                      {img.isAiPlaced && (
                        <span className="flex items-center gap-0.5 text-purple-300 text-[10px]">
                          <Sparkles className="h-2 w-2" /> AI Placed
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </Card>
        </div>
        <span className="text-center text-sm max-sm:flex max-sm:flex-col max-sm:items-center inline-flex items-center gap-1.5">
          <a
            className="flex items-center gap-1 font-medium text-purple-500"
            href="https://git.new/lchart"
          >
            <GithubIcon className="w-4 h-4" />
            <span>dub.sh/lchart</span>
          </a>
          <span className="max-sm:hidden"> • </span>
          <span className="text-gray-500 max-sm:text-xs">
            original by{" "}
            <a
              href="https://x.com/vishyfishy2/status/1899929030620598508"
              className="underline hover:text-purple-500 transition-colors"
            >
              f1shy-dev
            </a>
            ; linkedin version by{" "}
            <a
              href="https://x.com/icantcodefyi/"
              className="underline hover:text-purple-500 transition-colors"
            >
              aniruddh
            </a>
          </span>
        </span>
      </div>

      <AnalysisPanel analyses={analysesForPanel} newAnalysisId={newAnalysisId}>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              size="sm"
              className="relative group h-12 min-w-12 rounded-full shadow-lg bg-red-500 hover:bg-red-800 transition-all duration-200"
              disabled={images.length === 0}
            >
              <Trash className="!size-5 text-white" />
              <span className="text-base text-white hidden xs:block">
                Clear
              </span>
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will remove {images.length > 1 ? "all of your" : "your"}{" "}
                {images.length} saved placements from the chart.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  setImages([]);
                  clearLocalCache().catch(logger.error);
                }}
              >
                Continue
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </AnalysisPanel>

      {/* {isLoading && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-5 rounded-lg flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-solid border-purple-500 border-r-transparent"></div>
            <p>Loading saved users...</p>
          </div>
        </div>
      )} */}
    </div>
  );
}
