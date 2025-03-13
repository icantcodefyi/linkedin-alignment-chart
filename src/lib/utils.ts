import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const getRandomPosition = () => {
  const padding = 10;
  const x = Math.random() * (100 - 2 * padding) + padding;
  const y = Math.random() * (100 - 2 * padding) + padding;

  return { x, y };
};


