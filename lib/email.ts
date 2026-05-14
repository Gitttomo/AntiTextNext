import nodemailer from "nodemailer";

// SMTP設定（環境変数から取得）
const smtpConfig = {
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT) || 465,
  secure: true, // 465の場合はtrue, 587の場合はfalse
  auth: {
    user: process.env.SMTP_USER, // textnextbbs@gmail.com
    pass: process.env.SMTP_PASS, // アプリパスワード
  },
};

// 送信元情報
const FROM_EMAIL = `"TextNext 運営" <${process.env.SMTP_USER}>`;

// nodemailerトランスポーターを作成
const transporter = nodemailer.createTransport(smtpConfig);

type SendEmailOptions = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

/**
 * 汎用メール送信関数
 */
export async function sendEmail({ to, subject, text, html }: SendEmailOptions) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn("SMTP settings are not configured. Email will not be sent.");
    console.warn(`[Mock Email] To: ${to}, Subject: ${subject}`);
    return false;
  }

  try {
    const info = await transporter.sendMail({
      from: FROM_EMAIL,
      to,
      subject,
      text,
      html,
    });
    console.log("Message sent: %s", info.messageId);
    return true;
  } catch (error) {
    console.error("Error sending email:", error);
    return false;
  }
}

/**
 * 管理者からのお知らせ・警告等のメール（設定によらず送信）
 */
export async function sendAdminNoticeEmail(to: string, title: string, content: string, locale: string = "ja") {
  const subject = locale === "en" ? `[TextNext] ${title}` : `【TextNext】${title}`;
  const text = locale === "en" 
    ? `Hello,\n\nThis is a notification from TextNext.\n\n${content}\n\n--\nTextNext Support`
    : `いつもTextNextをご利用いただきありがとうございます。\n\n運営よりお知らせがございます。\n\n${content}\n\n--\nTextNext 運営チーム`;
  
  return sendEmail({ to, subject, text });
}

/**
 * お問い合わせへの返信（設定によらず送信）
 */
export async function sendInquiryReplyEmail(to: string, replyMessage: string, locale: string = "ja") {
  const subject = locale === "en" ? "[TextNext] Reply to your inquiry" : "【TextNext】お問い合わせについてのご案内";
  const text = locale === "en"
    ? `Hello,\n\nThank you for contacting TextNext.\nHere is our reply to your inquiry:\n\n${replyMessage}\n\n--\nTextNext Support`
    : `${replyMessage}`;
  
  return sendEmail({ to, subject, text });
}

/**
 * 探している教科書の新着通知
 */
export async function sendWatchKeywordEmail(to: string, keyword: string, itemTitle: string, itemUrl: string, locale: string = "ja") {
  const subject = locale === "en" ? "[TextNext] New item matching your keywords!" : "【TextNext】探している教科書が出品されました！";
  const text = locale === "en"
    ? `A new item matching your keyword "${keyword}" has been listed.\n\nItem: ${itemTitle}\nCheck it out here: ${itemUrl}\n\n* You can change your email preferences in My Page -> Settings.`
    : `あなたが探している教科書のキーワード「${keyword}」に一致する新着出品がありました。\n\n商品名: ${itemTitle}\n詳細はこちら: ${itemUrl}\n\n※この通知はマイページの設定から停止できます。`;

  return sendEmail({ to, subject, text });
}

/**
 * 取引進展の通知
 */
export async function sendTransactionProgressEmail(to: string, title: string, content: string, actionUrl: string, locale: string = "ja") {
  const subject = locale === "en" ? `[TextNext] ${title}` : `【TextNext】${title}`;
  const text = locale === "en"
    ? `There is an update on your transaction.\n\n${content}\n\nPlease check the details here: ${actionUrl}\n\n* You can change your email preferences in My Page -> Settings.`
    : `取引に進展がありました。\n\n${content}\n\n詳細はこちらからご確認ください:\n${actionUrl}\n\n※この通知はマイページの設定から停止できます。`;

  return sendEmail({ to, subject, text });
}

/**
 * 新規メッセージの通知
 */
export async function sendNewMessageEmail(to: string, senderName: string, chatUrl: string, locale: string = "ja") {
  const subject = locale === "en" ? "[TextNext] New Message Received" : "【TextNext】新着メッセージがあります";
  const text = locale === "en"
    ? `You have received a new message from ${senderName}.\n\nReply here: ${chatUrl}\n\n* You can change your email preferences in My Page -> Settings.`
    : `${senderName}さんから新着メッセージが届いています。\n\nこちらから返信してください:\n${chatUrl}\n\n※この通知はマイページの設定から停止できます。`;

  return sendEmail({ to, subject, text });
}

/**
 * 取引前日のリマインド通知
 */
export async function sendTransactionReminderEmail(to: string, partnerName: string, itemTitle: string, time: string, location: string, chatUrl: string, locale: string = "ja") {
  const subject = locale === "en" ? "[TextNext] Reminder: Transaction Tomorrow" : "【TextNext】明日、商品の受け渡し予定があります";
  const text = locale === "en"
    ? `This is a reminder for your transaction scheduled for tomorrow.\n\nItem: ${itemTitle}\nPartner: ${partnerName}\nTime: ${time}\nLocation: ${location}\n\nPlease check the chat for details: ${chatUrl}\n\n* You can change your email preferences in My Page -> Settings.`
    : `明日は以下の商品の受け渡し予定日です。\n\n商品名: ${itemTitle}\n取引相手: ${partnerName}さん\n予定日時: ${time}\n待ち合わせ場所: ${location}\n\n詳細はチャットをご確認ください:\n${chatUrl}\n\n※この通知はマイページの設定から停止できます。`;

  return sendEmail({ to, subject, text });
}
