export type EmailSendInput = {
  to: string;
  subject: string;
  text: string;
};

export interface IEmailSender {
  send(input: EmailSendInput): Promise<void>;
}
