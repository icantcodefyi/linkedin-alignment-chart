"use client";

import type React from "react";

import { useState, useRef, useEffect } from "react";
import NextImage from "next/image";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { X, Sparkles, Lock, Dices } from "lucide-react";
import { analyseUser, type AlignmentAnalysis } from "./actions/analyze-tweets";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AnalysisPanel } from "./components/analysis-panel";
import { ScrollArea } from "@radix-ui/react-scroll-area";
import { Separator } from "@radix-ui/react-separator";
import { toast } from "sonner";

interface Position {
  x: number;
  y: number;
}

interface ImageItem {
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
  const [images, setImages] = useState<ImageItem[]>([]);
  const [username, setUsername] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState(60); // Default size, will be updated based on chart width
  const [chartSize, setChartSize] = useState({ width: 0, height: 0 });
  const [isMobile, setIsMobile] = useState(false);
  const [newAnalysisId, setNewAnalysisId] = useState<string | null>(null);

  // Detect mobile devices
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

  // Prevent scrolling on mobile
  useEffect(() => {
    const handleTouchMove = (e: TouchEvent) => {
      // Only prevent default if we're not in an input field
      if (
        e.target instanceof HTMLElement &&
        e.target.tagName !== "INPUT" &&
        !e.target.closest(".scrollable")
      ) {
        e.preventDefault();
      }
    };

    document.addEventListener("touchmove", handleTouchMove, { passive: false });

    // Set body overflow to hidden
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("touchmove", handleTouchMove);
      document.body.style.overflow = "";
    };
  }, []);

  // Update chart size to fit the screen
  useEffect(() => {
    const updateChartSize = () => {
      if (containerRef.current && chartRef.current) {
        // Get viewport dimensions
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;
        const isMobileView = viewportWidth < 768;

        // Reserve space for input and padding (adjusted for mobile)
        const reservedVerticalSpace = isMobileView ? 120 : 140;
        const topPadding = isMobileView ? 20 : 0; // Add top padding for mobile
        const availableHeight =
          viewportHeight - reservedVerticalSpace - topPadding;

        // Calculate available width (with padding)
        const horizontalPadding = isMobileView
          ? Math.max(40, viewportWidth * 0.1) // More padding on mobile: at least 50px or 10% of viewport
          : Math.max(20, viewportWidth * 0.05); // Desktop: at least 20px or 5% of viewport
        const availableWidth = viewportWidth - horizontalPadding * 2;

        // Determine chart size (square but constrained by available space)
        const size = Math.min(availableWidth, availableHeight);

        setChartSize({ width: size, height: size });

        // Update image size based on new chart dimensions
        const newImageSize = Math.max(40, Math.min(80, size / 7.5));
        setImageSize(newImageSize);
      }
    };

    // Set up ResizeObserver to monitor container size changes
    if (containerRef.current) {
      const resizeObserver = new ResizeObserver(() => {
        updateChartSize();
      });

      resizeObserver.observe(containerRef.current);

      // Initial size calculation
      updateChartSize();

      return () => {
        if (containerRef.current) {
          resizeObserver.unobserve(containerRef.current);
        }
        resizeObserver.disconnect();
      };
    }

    // Fallback for window resize
    window.addEventListener("resize", updateChartSize);
    return () => window.removeEventListener("resize", updateChartSize);
  }, []);

  // Convert alignment scores to chart position (using percentages)
  const alignmentToPosition = (analysis: AlignmentAnalysis): Position => {
    // Convert from -100 to 100 scale to percentage coordinates (0% to 100%)
    const xPercent = ((analysis.lawfulChaotic + 100) / 200) * 100;
    const yPercent = ((analysis.goodEvil + 100) / 200) * 100;

    return { x: xPercent, y: yPercent };
  };

  // Generate random position within chart bounds (using percentages)
  const getRandomPosition = () => {
    // Generate random coordinates as percentages (with some padding)
    const padding = 10; // 10% padding from edges
    const x = Math.random() * (100 - 2 * padding) + padding;
    const y = Math.random() * (100 - 2 * padding) + padding;

    return { x, y };
  };

  // Function to load an image and return a promise
  const loadImage = (url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";

      const timeout = setTimeout(() => {
        reject(new Error("Image load timeout"));
      }, 5000);

      img.onload = () => {
        clearTimeout(timeout);
        resolve(img);
      };

      img.onerror = () => {
        clearTimeout(timeout);
        reject(new Error("Image load error"));
      };

      img.src = url;
    });
  };

  // Generate a profile image when a username is submitted
  const handleAddImage = async () => {
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

    // Clean the username (remove @ if user already included it)
    const cleanUsername = username.trim().replace(/^@/, "");

    // Get random position for the new image
    const randomPosition = getRandomPosition();

    // Try both URL formats
    const withAtUrl = `https://unavatar.io/x/@${cleanUsername}`;
    const withoutAtUrl = `https://unavatar.io/x/${cleanUsername}`;

    // Create a temporary image with loading state
    const tempImageId = `image-${Date.now()}`;
    const tempImage: ImageItem = {
      id: tempImageId,
      src: withoutAtUrl,
      position: randomPosition,
      isDragging: false,
      loading: true,
      username: cleanUsername,
      isAiPlaced: false,
      timestamp: new Date(),
    };

    setImages((prev) => [...prev, tempImage]);
    setUsername("");

    // Default to without @ URL
    let finalUrl = withoutAtUrl;

    // Create an invisible div to hold the images for analysis
    const analysisDiv = document.createElement("div");
    analysisDiv.style.position = "absolute";
    analysisDiv.style.visibility = "hidden";
    analysisDiv.style.pointerEvents = "none";
    document.body.appendChild(analysisDiv);

    try {
      // Try to load both images
      const withAtImg = document.createElement("img");
      const withoutAtImg = document.createElement("img");

      withAtImg.crossOrigin = "anonymous";
      withoutAtImg.crossOrigin = "anonymous";

      // Set up load handlers
      const withAtPromise = new Promise<void>((resolve) => {
        withAtImg.onload = () => resolve();
        withAtImg.onerror = () => resolve(); // Resolve even on error
        setTimeout(() => resolve(), 3000); // Timeout fallback
      });

      const withoutAtPromise = new Promise<void>((resolve) => {
        withoutAtImg.onload = () => resolve();
        withoutAtImg.onerror = () => resolve(); // Resolve even on error
        setTimeout(() => resolve(), 3000); // Timeout fallback
      });

      // Start loading both images
      withAtImg.src = withAtUrl;
      withoutAtImg.src = withoutAtUrl;

      // Add images to the analysis div
      analysisDiv.appendChild(withAtImg);
      analysisDiv.appendChild(withoutAtImg);

      // Wait for both images to load or timeout
      await Promise.all([withAtPromise, withoutAtPromise]);

      // Create canvases for analysis
      const withAtCanvas = document.createElement("canvas");
      const withoutAtCanvas = document.createElement("canvas");

      // Function to safely analyze an image by counting unique colors
      const analyzeColorfulness = (
        img: HTMLImageElement,
        canvas: HTMLCanvasElement
      ): number => {
        try {
          if (!img.complete || img.naturalWidth === 0) {
            return 0; // Image didn't load properly
          }

          const ctx = canvas.getContext("2d");
          if (!ctx) return 0;

          // Set canvas size
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;

          // Draw image on canvas
          ctx.drawImage(img, 0, 0);

          // Sample pixels to count unique colors
          const sampleSize = 20; // Increase sample size for better coverage
          const uniqueColors = new Set<string>();

          for (let y = 0; y < sampleSize; y++) {
            for (let x = 0; x < sampleSize; x++) {
              const sampleX = Math.floor((x / sampleSize) * canvas.width);
              const sampleY = Math.floor((y / sampleSize) * canvas.height);

              try {
                const data = ctx.getImageData(sampleX, sampleY, 1, 1).data;
                const r = data[0];
                const g = data[1];
                const b = data[2];

                // Create a string representation of the color
                const colorKey = `${r},${g},${b}`;
                uniqueColors.add(colorKey);
              } catch (error) {
                // Ignore errors for individual pixels
              }
            }
          }

          // Return the number of unique colors found
          return uniqueColors.size;
        } catch (error) {
          // If any error occurs, return 0
          return 0;
        }
      };

      // Analyze both images
      const withAtColorfulness = analyzeColorfulness(withAtImg, withAtCanvas);
      const withoutAtColorfulness = analyzeColorfulness(
        withoutAtImg,
        withoutAtCanvas
      );

      console.log("Unique colors count:", {
        withAt: withAtColorfulness,
        withoutAt: withoutAtColorfulness,
      });

      // Choose the image with more unique colors
      if (withAtColorfulness > withoutAtColorfulness) {
        finalUrl = withAtUrl;
        console.log("Using with @ URL (more unique colors)");
      } else {
        finalUrl = withoutAtUrl;
        console.log("Using without @ URL (more unique colors or equal)");
      }
    } catch (error) {
      console.error("Error analyzing images:", error);
      // On error, use the default URL
    } finally {
      // Clean up
      if (analysisDiv && analysisDiv.parentNode) {
        document.body.removeChild(analysisDiv);
      }

      // Update the image with the final URL
      setImages((prev) =>
        prev.map((img) =>
          img.id === tempImageId
            ? { ...img, src: finalUrl, loading: false }
            : img
        )
      );
    }
  };

  // Auto-analyze and place the image based on tweets
  const handleAutoAnalyze = async () => {
    if (!username.trim()) return;

    setIsAnalyzing(true);

    // Clean the username (remove @ if user already included it)
    const cleanUsername = username.trim().replace(/^@/, "");

    try {
      // Create a temporary image with loading state
      const tempImageId = `image-${Date.now()}`;
      const tempImage: ImageItem = {
        id: tempImageId,
        src: `/placeholder.svg?height=100&width=100&text=Analyzing...`,
        position: getRandomPosition(),
        isDragging: false,
        loading: true,
        username: cleanUsername,
        isAiPlaced: true,
        timestamp: new Date(),
      };

      setImages((prev) => [...prev, tempImage]);
      setUsername("");

      // Analyze the tweets
      const analysis = await analyseUser(cleanUsername);

      // Determine the position based on the analysis
      const position = alignmentToPosition(analysis);

      // Get the profile image URL
      const withAtUrl = `https://unavatar.io/x/@${cleanUsername}`;
      const withoutAtUrl = `https://unavatar.io/x/${cleanUsername}`;

      // Default to without @ URL
      let finalUrl = withoutAtUrl;

      // Try to load both images to determine which one is better
      try {
        const withAtImg = await loadImage(withAtUrl).catch(() => null);
        const withoutAtImg = await loadImage(withoutAtUrl).catch(() => null);

        if (withAtImg && !withoutAtImg) {
          finalUrl = withAtUrl;
        } else if (!withAtImg && withoutAtImg) {
          finalUrl = withoutAtUrl;
        }
        // If both loaded or both failed, use the default (withoutAtUrl)
      } catch (error) {
        console.error("Error loading profile images:", error);
      }

      // Update the image with the final URL, position, and analysis
      setImages((prev) =>
        prev.map((img) =>
          img.id === tempImageId
            ? {
                ...img,
                src: finalUrl,
                position,
                loading: false,
                analysis,
                isAiPlaced: true,
                timestamp: new Date(),
              }
            : img
        )
      );

      // Set the new analysis ID to trigger notification
      setNewAnalysisId(tempImageId);

      // Clear the new analysis ID after a delay
      setTimeout(() => {
        setNewAnalysisId(null);
      }, 5000);
    } catch (error) {
      console.error("Error auto-analyzing:", error);

      // Remove the temporary image on error
      setImages((prev) => prev.filter((img) => img.username !== cleanUsername));

      // Show error message
      alert(
        `Error analyzing tweets for @${cleanUsername}: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Handle mouse down on an image
  const handleMouseDown = (e: React.MouseEvent, id: string) => {
    e.preventDefault();

    // Find the image
    const image = images.find((img) => img.id === id);
    if (!image || image.loading || image.isAiPlaced) return;

    // Set the image as dragging
    setActiveDragId(id);

    // Update the image state
    setImages(
      images.map((img) => (img.id === id ? { ...img, isDragging: true } : img))
    );
  };

  // Handle touch start on an image (for mobile)
  const handleTouchStart = (e: React.TouchEvent, id: string) => {
    // Find the image
    const image = images.find((img) => img.id === id);
    if (!image || image.loading || image.isAiPlaced) return;

    // Set the image as dragging
    setActiveDragId(id);

    // Update the image state
    setImages(
      images.map((img) => (img.id === id ? { ...img, isDragging: true } : img))
    );
  };

  // Handle mouse move
  const handleMouseMove = (e: MouseEvent) => {
    if (!activeDragId || !chartRef.current) return;

    // Get the chart bounds
    const chartRect = chartRef.current.getBoundingClientRect();

    // Calculate the new position as percentages
    const x = ((e.clientX - chartRect.left) / chartRect.width) * 100;
    const y = ((e.clientY - chartRect.top) / chartRect.height) * 100;

    // Update the image position
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

  // Handle touch move (for mobile)
  const handleTouchMove = (e: TouchEvent) => {
    if (!activeDragId || !chartRef.current) return;

    // Prevent default to stop scrolling while dragging
    e.preventDefault();

    // Get the first touch
    const touch = e.touches[0];

    // Get the chart bounds
    const chartRect = chartRef.current.getBoundingClientRect();

    // Calculate the new position as percentages
    const x = ((touch.clientX - chartRect.left) / chartRect.width) * 100;
    const y = ((touch.clientY - chartRect.top) / chartRect.height) * 100;

    // Update the image position
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

  // Handle mouse up
  const handleMouseUp = () => {
    if (!activeDragId) return;

    // Set the image as not dragging
    setImages(
      images.map((img) =>
        img.id === activeDragId ? { ...img, isDragging: false } : img
      )
    );

    // Reset the active drag
    setActiveDragId(null);
  };

  // Handle touch end (for mobile)
  const handleTouchEnd = () => {
    if (!activeDragId) return;

    // Set the image as not dragging
    setImages(
      images.map((img) =>
        img.id === activeDragId ? { ...img, isDragging: false } : img
      )
    );

    // Reset the active drag
    setActiveDragId(null);
  };

  // Remove an image
  const handleRemoveImage = (id: string) => {
    setImages(images.filter((img) => img.id !== id));
  };

  // Add event listeners for mouse/touch move and mouse/touch up
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

  // Prepare analyses for the panel
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
            placeholder="Enter X username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
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
                    onClick={handleAddImage}
                    size="icon"
                    className="h-7 w-7 rounded-full bg-black hover:bg-black/90 text-white p-0"
                    disabled={!username.trim() || isAnalyzing}
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
                    disabled={!username.trim() || isAnalyzing}
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
          {/* Axis Labels */}
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
              {/* Axes */}
              <div className="absolute top-0 left-0 w-full h-full">
                <div className="absolute top-0 left-0 w-full h-full border-b-2 border-r-2 border-black" />
                <div className="absolute top-1/2 left-0 w-full h-0 border-t-2 border-black" />
                <div className="absolute top-0 left-1/2 w-0 h-full border-l-2 border-black" />
              </div>

              {/* Draggable Images */}
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
                      src={img.src || "/placeholder.svg"}
                      alt={`X avatar for ${img.username || "user"}`}
                      width={100}
                      height={100}
                      className={`object-cover w-full h-full ${
                        img.loading ? "animate-pulse" : ""
                      }`}
                      unoptimized
                    />

                    {/* Loading spinner overlay for AI-placed images */}
                    {img.loading && img.isAiPlaced && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-solid border-purple-500 border-r-transparent"></div>
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

                    {/* Lock icon for AI-placed images */}
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

                    {/* Username tooltip */}
                    <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs p-1 opacity-0 group-hover:opacity-100 transition-opacity overflow-hidden">
                      @{img.username}
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
        <span className="text-center text-sm max-sm:flex max-sm:flex-col max-sm:items-center">
          <span className="font-medium text-purple-500">dub.sh/xchart</span>
          <span className="max-sm:hidden"> • </span>
          <span className="text-gray-500 max-sm:text-xs">
            original by{" "}
            <a
              href="https://x.com/rauchg/status/1899895262023467035"
              className="underline hover:text-purple-500 transition-colors"
            >
              rauchg
            </a>
            ; forked by{" "}
            <a
              href="https://x.com/vishyfishy2/status/1899929030620598508"
              className="underline hover:text-purple-500 transition-colors"
            >
              f1shy-dev
            </a>
          </span>
        </span>
      </div>

      {/* Analysis Panel */}
      <AnalysisPanel
        analyses={analysesForPanel}
        newAnalysisId={newAnalysisId}
      />
    </div>
  );
}
