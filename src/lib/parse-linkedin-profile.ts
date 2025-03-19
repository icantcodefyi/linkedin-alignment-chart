export interface LinkedInPost {
  activityId: string;
  text: string;
  reactionsCount: number;
  commentsCount: number;
  activityDate: string;
  author: {
    authorId: string;
    authorName: string;
    authorPublicIdentifier: string;
    authorHeadline: string;
    authorImage: string;
    authorUrl: string;
  };
  activityUrl: string;
  shareUrl: string;
  relatedPost?: {
    text: string;
    activityDate: string;
    author: {
      authorId: string;
      authorName: string;
      authorPublicIdentifier: string;
      authorHeadline: string;
      authorImage: string;
      authorUrl: string;
    };
    activityUrl: string;
    shareUrl: string;
  };
}

export interface LinkedInProfile {
  posts: LinkedInPost[];
}

export interface LinkedInApiResponse {
  success: boolean;
  credits_left: number;
  rate_limit_left: number;
  posts: LinkedInPost[];
}

export function parseLinkedInResponse(response: LinkedInApiResponse): LinkedInProfile | null {
  try {
    if (!response.success || !response.posts || response.posts.length === 0) {
      return null;
    }

    return {
      posts: response.posts
    };
  } catch (error) {
    console.error("Error parsing LinkedIn response:", error);
    return null;
  }
} 