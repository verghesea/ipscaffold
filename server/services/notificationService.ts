import { supabaseAdmin } from "../lib/supabase";

type NotificationType = 'artifact_complete' | 'processing_error' | 'low_credits' | 'patent_ready';

export interface Notification {
  id: string;
  user_id: string;
  notification_type: NotificationType;
  payload: Record<string, any>;
  read: boolean;
  created_at: string;
}

export class NotificationService {
  private static async createNotification(
    userId: string,
    type: NotificationType,
    payload: Record<string, any>
  ): Promise<void> {
    try {
      await supabaseAdmin.from('webhook_notifications').insert({
        user_id: userId,
        notification_type: type,
        payload,
      });
    } catch (error) {
      console.error('Failed to create notification:', error);
    }
  }

  static async sendArtifactComplete(
    userId: string,
    patentId: string,
    artifactType: string,
    patentTitle: string | null
  ): Promise<void> {
    await this.createNotification(userId, 'artifact_complete', {
      patent_id: patentId,
      patent_title: patentTitle,
      artifact_type: artifactType,
      message: `${artifactType.replace('_', ' ')} has been generated for "${patentTitle || 'your patent'}"`,
    });
  }

  static async sendProcessingError(
    userId: string,
    patentId: string,
    patentTitle: string | null,
    errorMessage: string
  ): Promise<void> {
    await this.createNotification(userId, 'processing_error', {
      patent_id: patentId,
      patent_title: patentTitle,
      error_message: errorMessage,
      message: `Error processing "${patentTitle || 'your patent'}". You can retry from your dashboard.`,
    });
  }

  static async sendLowCreditsWarning(userId: string, currentCredits: number): Promise<void> {
    await this.createNotification(userId, 'low_credits', {
      current_credits: currentCredits,
      message: `You have ${currentCredits} credits remaining. Each patent analysis requires 10 credits.`,
    });
  }

  static async sendPatentReady(
    userId: string,
    patentId: string,
    patentTitle: string | null
  ): Promise<void> {
    await this.createNotification(userId, 'patent_ready', {
      patent_id: patentId,
      patent_title: patentTitle,
      message: `All artifacts for "${patentTitle || 'your patent'}" are ready! View them in your dashboard.`,
    });
  }

  static async getUserNotifications(userId: string, unreadOnly: boolean = false): Promise<Notification[]> {
    let query = supabaseAdmin
      .from('webhook_notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (unreadOnly) {
      query = query.eq('read', false);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return data || [];
  }

  static async getUnreadCount(userId: string): Promise<number> {
    const { count, error } = await supabaseAdmin
      .from('webhook_notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false);

    if (error) return 0;
    return count || 0;
  }

  static async markAsRead(notificationId: string, userId: string): Promise<void> {
    await supabaseAdmin
      .from('webhook_notifications')
      .update({ read: true })
      .eq('id', notificationId)
      .eq('user_id', userId);
  }

  static async markAllAsRead(userId: string): Promise<void> {
    await supabaseAdmin
      .from('webhook_notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false);
  }
}
