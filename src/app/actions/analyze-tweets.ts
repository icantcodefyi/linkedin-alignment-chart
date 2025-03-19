"use server"
import "server-only"
import { dedent } from "ts-dedent"
import { google } from "@ai-sdk/google"
import { CoreMessage, generateObject } from "ai"
import { z } from "zod"
import { getCachedData, setCachedData } from "../../lib/redis"
import { fetchLinkedInProfile } from "../../lib/fetch-linkedin-profile"
import { logger } from "@/lib/logger"
import { track } from '@vercel/analytics/server';
import { waitUntil } from "@vercel/functions";

const AlignmentSchema = z.object({
  explanation: z.string().describe("Your brief-ish explanation/reasoning for the given alignment assessment"),
  lawfulChaotic: z.number().min(-100).max(100).describe("A score from -100 (lawful) to 100 (chaotic)"),
  goodEvil: z.number().min(-100).max(100).describe("A score from -100 (good) to 100 (evil)"),
  authorImage: z.string().optional().describe("URL to the author's profile image"),
  authorName: z.string().optional().describe("Name of the LinkedIn profile author"),
});

export type AlignmentAnalysis = z.infer<typeof AlignmentSchema>

export async function analyseUser(username: string): Promise<AlignmentAnalysis & { cached: boolean; isError: boolean }> {
  // Construct LinkedIn URL from username
  const cleanUsername = username.trim().replace(/^@/, "");
  const linkedInUrl = `https://www.linkedin.com/in/${cleanUsername}`;
  const cacheKey = `analysis-linkedin-v1:${linkedInUrl}`;

  try {
    const cachedAnalysis = await getCachedData<AlignmentAnalysis>(cacheKey);

    if (cachedAnalysis) {
      logger.info(`Using cached analysis for ${linkedInUrl}`);
      logger.info(cachedAnalysis);

      waitUntil(track("analysis_cached", {
        linkedInUrl: linkedInUrl,
        lawful_chaotic: cachedAnalysis.lawfulChaotic,
        good_evil: cachedAnalysis.goodEvil,
      }));
      return { ...cachedAnalysis, cached: true, isError: false };
    }

    logger.info(`Analyzing LinkedIn posts for ${linkedInUrl}`);

    const profile = await fetchLinkedInProfile(linkedInUrl);
    logger.info(`Profile fetched for ${linkedInUrl}:`, { 
      success: !!profile,
      postsCount: profile?.posts?.length || 0
    })
    
    if (!profile) {
      throw new Error(`No profile found for ${linkedInUrl}`)
    }

    // Extract author image and name from the first post if available
    let authorImage: string | undefined
    let authorName: string | undefined
    if (profile.posts.length > 0 && profile.posts[0].author) {
      if (profile.posts[0].author.authorImage) {
        authorImage = profile.posts[0].author.authorImage
        logger.info(`Found author image: ${authorImage}`)
      }
      if (profile.posts[0].author.authorName) {
        authorName = profile.posts[0].author.authorName
        logger.info(`Found author name: ${authorName}`)
      }
    }

    const postTexts = profile.posts.map((post) =>
      `<post>
${post.text}
${post.reactionsCount} reactions, ${post.commentsCount} comments
${post.activityDate}
</post>`
    ).join("\n\n")

    const messages = [
      {
        role: "system",
        content: dedent`
        Analyze the following posts from the given LinkedIn user and determine their alignment on a D&D-style alignment chart.
        
        For lawful-chaotic axis:
        - Lawful (-100): Follows rules, traditions, and social norms. They value tradition, loyalty, and order.
        - Neutral (0): Balanced approach to rules and freedom
        - Chaotic (100): Rebels against convention, valuing personal freedom - follows their own moral compass regardless of rules or traditions
        
        For good-evil axis:
        - Good (-100): Altruistic, compassionate, puts others first
        - Neutral (0): Balanced self-interest and concern for others
        - Evil (100): Selfish, manipulative, or harmful to others. Some are motivated by greed, hatred, or lust for power.
        
        Based only on these LinkedIn posts, provide a numerical assessment of this user's alignment. Be willing to move to any side/extreme!

        Since this is a bit of fun, be willing to overly exaggerate if the user has a specific trait expressed barely - e.g. if they are evil at some point then make sure to express it! - I don't just want everyone to end up as chaotic-neutral in the end... However don't always exaggerate a user's chaotic characteristic, you can also try to exaggerate their lawful or good/evil traits if they are more pronounced. Just be fun with it.
        
        For the explanation, try to avoid overly waffling - but show your reasoning behind your judgement. You can mention specific things about their user like mentioned traits/remarks or projects/etc - the more personalised the better.
      `.trim()
      },
      {
        role: "user",
        content:
          dedent`LinkedIn Username: ${cleanUsername}

<user_posts>
${postTexts}
</user_posts>`.trim()
      }
    ] satisfies CoreMessage[]


    const { object } = await generateObject({
      model: google("gemini-2.0-flash"),
      temperature: 0.8,
      schema: AlignmentSchema,
      messages
    })

    // Add the author image and name to the analysis
    const analysisWithImage = {
      ...object,
      authorImage,
      authorName
    }

    // Cache for 2 weeks
    await setCachedData(cacheKey, analysisWithImage, 604_800)

    waitUntil(track("analysis_complete", {
      linkedInUrl: linkedInUrl,
      lawful_chaotic: object.lawfulChaotic,
      good_evil: object.goodEvil,
    }))

    return { ...analysisWithImage, cached: false, isError: false }
  } catch (error) {
    logger.error(`Error analyzing LinkedIn posts for ${linkedInUrl}:`, error)
    // Add more detailed error information
    if (error instanceof Error) {
      logger.error(`Error details: ${error.message}`)
      logger.error(`Error stack: ${error.stack}`)
    }
    
    // Try to log more specific error information based on where it might have occurred
    try {
      const profile = await fetchLinkedInProfile(linkedInUrl)
      logger.info(`LinkedIn profile fetch attempt during error handling:`, { 
        success: !!profile,
        postsCount: profile?.posts?.length || 0 
      })
    } catch (fetchError) {
      logger.error(`Error during LinkedIn profile fetch: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}`)
    }

    return {
      lawfulChaotic: 0,
      goodEvil: 0,
      explanation: `Error analyzing LinkedIn profile for username '${cleanUsername}'... Please check that you entered a valid LinkedIn username and try again later.`,
      cached: false,
      isError: true,
    }
  }
}

