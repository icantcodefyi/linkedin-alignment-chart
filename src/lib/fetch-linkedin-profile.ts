"use server"

import { LinkedInProfile, LinkedInApiResponse, parseLinkedInResponse } from "@/lib/parse-linkedin-profile"
import { logger } from "@/lib/logger"

export async function fetchLinkedInProfile(linkedInUrl: string): Promise<LinkedInProfile | null> {
  if (!linkedInUrl) return null
  const cleanLinkedInUrl = linkedInUrl.trim()
  console.log(linkedInUrl)
  try {
    logger.info(`Fetching LinkedIn posts for ${cleanLinkedInUrl}`)

    const response = await fetch(`https://api.scrapin.io/enrichment/persons/activities/posts?apikey=${process.env.LINKEDIN_API_KEY || ""}&linkedInUrl=${encodeURIComponent(cleanLinkedInUrl)}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json"
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`LinkedIn API error: ${response.status} ${errorText}`)
    }

    const data: LinkedInApiResponse = await response.json()
    
    if (!data.success || data.posts.length === 0) {
      logger.info(`No LinkedIn posts found for ${cleanLinkedInUrl}`)
      return null
    }

    const profile = parseLinkedInResponse(data)
    if (!profile) {
      logger.error("Error parsing LinkedIn response")
      return null
    }

    logger.info(`Found ${profile.posts.length} LinkedIn posts for ${cleanLinkedInUrl}`)
    logger.debug(profile.posts.slice(0, 20).map((post) =>
      `${post.text}

    👍 ${post.reactionsCount}, 💬 ${post.commentsCount}
    --------------------------------`
    ).join("\n"))

    return profile
  } catch (error) {
    logger.error(`Error fetching LinkedIn posts for ${cleanLinkedInUrl}:`, error)
    return null
  }
} 