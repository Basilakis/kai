/**
 * Prompt Success Tracker
 *
 * Utility for tracking prompt success based on user behavior.
 * This helps improve prompt quality over time by automatically
 * detecting whether a prompt was successful based on user interactions.
 */

import axios from 'axios';

/**
 * Enhanced user actions interface
 */
interface EnhancedUserActions {
  timeSpentOnPage?: number;
  scrollDepth?: number;
  clickedLinks?: number;
  copiedText?: boolean;
  followupQuestions?: number;
  interactionCount?: number;
  interactionDurationMs?: number;
  interactionPattern?: string[];
  followUpSentiment?: string;
  sentimentScore?: number;
}

/**
 * Prompt success tracker class
 */
export class PromptSuccessTracker {
  private trackingId: string;
  private startTime: number;
  private interactionStartTime: number;
  private maxScrollDepth: number = 0;
  private clickedLinks: number = 0;
  private copiedText: boolean = false;
  private followupQuestions: number = 0;
  private interactionCount: number = 0;
  private interactionDuration: number = 0;
  private interactionPattern: string[] = [];
  private followUpTexts: string[] = [];
  private responseTimeMs: number;
  private apiUrl: string;

  /**
   * Constructor
   * @param trackingId Tracking ID from the prompt service
   * @param responseTimeMs Response time in milliseconds
   * @param apiUrl API URL for the prompt monitoring service
   */
  constructor(trackingId: string, responseTimeMs: number, apiUrl: string = '/api/admin/prompt-monitoring') {
    this.trackingId = trackingId;
    this.responseTimeMs = responseTimeMs;
    this.startTime = Date.now();
    this.interactionStartTime = Date.now();
    this.apiUrl = apiUrl;

    // Initialize event listeners
    this.initEventListeners();
  }

  /**
   * Initialize event listeners
   */
  private initEventListeners(): void {
    // Track scroll depth
    window.addEventListener('scroll', this.handleScroll);

    // Track link clicks
    document.addEventListener('click', this.handleLinkClick);

    // Track text copying
    document.addEventListener('copy', this.handleCopy);

    // Track mouse movements
    document.addEventListener('mousemove', this.handleMouseMove);

    // Track keyboard input
    document.addEventListener('keydown', this.handleKeyDown);

    // Track focus/blur
    window.addEventListener('focus', this.handleFocus);
    window.addEventListener('blur', this.handleBlur);

    // Track visibility changes
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  /**
   * Remove event listeners
   */
  private removeEventListeners(): void {
    window.removeEventListener('scroll', this.handleScroll);
    document.removeEventListener('click', this.handleLinkClick);
    document.removeEventListener('copy', this.handleCopy);
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('focus', this.handleFocus);
    window.removeEventListener('blur', this.handleBlur);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
  }

  /**
   * Handle scroll event
   */
  private handleScroll = (): void => {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    const scrollDepth = scrollHeight > 0 ? scrollTop / scrollHeight : 0;

    if (scrollDepth > this.maxScrollDepth) {
      this.maxScrollDepth = scrollDepth;
    }

    this.recordInteraction('scroll');
  };

  /**
   * Handle link click event
   */
  private handleLinkClick = (event: MouseEvent): void => {
    const target = event.target as HTMLElement;
    const link = target.closest('a');

    if (link) {
      this.clickedLinks++;
      this.recordInteraction('click_link');
    } else {
      // Check for other interactive elements
      const button = target.closest('button');
      if (button) {
        this.recordInteraction('click_button');
      } else {
        this.recordInteraction('click_other');
      }
    }
  };

  /**
   * Handle copy event
   */
  private handleCopy = (): void => {
    this.copiedText = true;
    this.recordInteraction('copy_text');
  };

  /**
   * Handle mouse move event
   */
  private handleMouseMove = (): void => {
    // We don't need to track every mouse movement
    // Just record that there was some activity
    this.recordInteraction('mouse_activity', false);
  };

  /**
   * Handle key down event
   */
  private handleKeyDown = (event: KeyboardEvent): void => {
    // Check for specific keys
    if (event.key === 'Escape') {
      this.recordInteraction('press_escape');
    } else if (event.ctrlKey && event.key === 'f') {
      this.recordInteraction('search_in_page');
    } else {
      this.recordInteraction('keyboard_activity', false);
    }
  };

  /**
   * Handle focus event
   */
  private handleFocus = (): void => {
    this.recordInteraction('page_focus');
  };

  /**
   * Handle blur event
   */
  private handleBlur = (): void => {
    this.recordInteraction('page_blur');
  };

  /**
   * Handle visibility change event
   */
  private handleVisibilityChange = (): void => {
    if (document.visibilityState === 'visible') {
      this.recordInteraction('page_visible');
    } else {
      this.recordInteraction('page_hidden');
    }
  };

  /**
   * Record an interaction
   * @param type Interaction type
   * @param countAsInteraction Whether to count this as a distinct interaction
   */
  private recordInteraction(type: string, countAsInteraction: boolean = true): void {
    // Add to interaction pattern
    this.interactionPattern.push(type);

    // Only count certain interactions
    if (countAsInteraction) {
      this.interactionCount++;

      // Update interaction duration
      const now = Date.now();
      this.interactionDuration += now - this.interactionStartTime;
      this.interactionStartTime = now;
    }
  }

  /**
   * Record a follow-up question
   * @param text Optional follow-up question text
   */
  public recordFollowupQuestion(text?: string): void {
    this.followupQuestions++;
    this.recordInteraction('followup_question');

    if (text) {
      this.followUpTexts.push(text);
    }
  }

  /**
   * Analyze sentiment of follow-up questions
   * @returns Sentiment score between -1 and 1
   */
  private analyzeSentiment(): number {
    if (this.followUpTexts.length === 0) {
      return 0;
    }

    // Simple sentiment analysis based on keywords
    const positiveWords = ['thanks', 'thank', 'good', 'great', 'excellent', 'helpful', 'useful', 'clear', 'perfect', 'awesome'];
    const negativeWords = ['not', 'wrong', 'incorrect', 'bad', 'unclear', 'confusing', 'useless', 'error', 'mistake', 'terrible'];

    let positiveCount = 0;
    let negativeCount = 0;

    // Check each follow-up text
    for (const text of this.followUpTexts) {
      const lowerText = text.toLowerCase();

      // Count positive words
      for (const word of positiveWords) {
        if (lowerText.includes(word)) {
          positiveCount++;
        }
      }

      // Count negative words
      for (const word of negativeWords) {
        if (lowerText.includes(word)) {
          negativeCount++;
        }
      }
    }

    // Calculate sentiment score
    const total = positiveCount + negativeCount;
    if (total === 0) {
      return 0;
    }

    return (positiveCount - negativeCount) / total;
  }

  /**
   * Submit explicit feedback
   * @param isSuccessful Whether the prompt was successful
   * @param feedback Optional feedback text
   * @param rating Optional rating (1-5)
   * @param category Optional feedback category
   * @param tags Optional feedback tags
   */
  public async submitFeedback(
    isSuccessful: boolean,
    feedback?: string,
    rating?: number,
    category?: string,
    tags?: string[]
  ): Promise<boolean> {
    try {
      const response = await axios.post(`${this.apiUrl}/feedback/${this.trackingId}`, {
        isSuccessful,
        feedback,
        feedbackRating: rating,
        feedbackCategory: category,
        feedbackTags: tags,
        responseTimeMs: this.responseTimeMs
      });

      return response.data.success;
    } catch (error) {
      console.error('Failed to submit feedback:', error);
      return false;
    } finally {
      this.removeEventListeners();
    }
  }

  /**
   * Auto-detect success based on user behavior
   */
  public async autoDetectSuccess(): Promise<boolean> {
    try {
      const timeSpentOnPage = Date.now() - this.startTime;
      const sentimentScore = this.analyzeSentiment();
      const followUpSentiment = sentimentScore > 0.5 ? 'positive' :
                               sentimentScore < -0.5 ? 'negative' : 'neutral';

      // Limit the interaction pattern to the last 50 interactions to avoid excessive data
      const limitedInteractionPattern = this.interactionPattern.slice(-50);

      const enhancedUserActions: EnhancedUserActions = {
        timeSpentOnPage,
        scrollDepth: this.maxScrollDepth,
        clickedLinks: this.clickedLinks,
        copiedText: this.copiedText,
        followupQuestions: this.followupQuestions,
        interactionCount: this.interactionCount,
        interactionDurationMs: this.interactionDuration,
        interactionPattern: limitedInteractionPattern,
        followUpSentiment,
        sentimentScore
      };

      const response = await axios.post(`${this.apiUrl}/auto-detect/${this.trackingId}`, {
        responseTimeMs: this.responseTimeMs,
        userActions: enhancedUserActions
      });

      return response.data.success;
    } catch (error) {
      console.error('Failed to auto-detect success:', error);
      return false;
    } finally {
      this.removeEventListeners();
    }
  }
}

/**
 * Create a new prompt success tracker
 * @param trackingId Tracking ID from the prompt service
 * @param responseTimeMs Response time in milliseconds
 * @param apiUrl API URL for the prompt monitoring service
 * @returns Prompt success tracker instance
 */
export function createPromptSuccessTracker(
  trackingId: string,
  responseTimeMs: number,
  apiUrl?: string
): PromptSuccessTracker {
  return new PromptSuccessTracker(trackingId, responseTimeMs, apiUrl);
}

export default {
  createPromptSuccessTracker
};
