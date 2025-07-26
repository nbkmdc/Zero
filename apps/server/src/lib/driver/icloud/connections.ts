import type { ImapConfig, SmtpConfig } from './types';
import Imap from 'node-imap';
import * as nodemailer from 'nodemailer';
import { promisify } from 'util';

export interface ImapMessage {
  headers: string;
  body: string;
  uid: number;
  flags: string[];
  struct: any;
  envelope: any;
}

export interface FetchOptions {
  bodies?: string | string[];
  struct?: boolean;
  envelope?: boolean;
  markSeen?: boolean;
}

export class ImapConnection {
  private config: ImapConfig;
  private imap: Imap | null = null;
  private connected = false;
  private selectedFolder: string | null = null;

  constructor(config: ImapConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    if (this.connected && this.imap) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.imap = new Imap({
        user: this.config.username,
        password: this.config.password,
        host: this.config.host,
        port: this.config.port,
        tls: this.config.secure,
        tlsOptions: { rejectUnauthorized: false },
        keepalive: true,
        connTimeout: 30000,
        authTimeout: 30000
      });

      this.imap.once('ready', () => {
        this.connected = true;
        resolve();
      });

      this.imap.once('error', (err: Error) => {
        this.connected = false;
        reject(new Error(`IMAP connection failed: ${err.message}`));
      });

      this.imap.once('end', () => {
        this.connected = false;
      });

      this.imap.connect();
    });
  }

  isConnected(): boolean {
    return this.connected && this.imap !== null;
  }

  async selectFolder(folder: string): Promise<void> {
    if (!this.connected || !this.imap) {
      throw new Error('IMAP not connected');
    }

    if (this.selectedFolder === folder) {
      return; // Already selected
    }

    return new Promise((resolve, reject) => {
      this.imap!.openBox(folder, false, (err: Error, box: any) => {
        if (err) {
          reject(new Error(`Failed to select folder ${folder}: ${err.message}`));
        } else {
          this.selectedFolder = folder;
          resolve();
        }
      });
    });
  }

  async search(criteria: string[]): Promise<string[]> {
    if (!this.connected || !this.imap) {
      throw new Error('IMAP not connected');
    }

    if (!this.selectedFolder) {
      throw new Error('No folder selected');
    }

    return new Promise((resolve, reject) => {
      this.imap!.search(criteria, (err: Error, results: number[]) => {
        if (err) {
          reject(new Error(`IMAP search failed: ${err.message}`));
        } else {
          resolve(results.map(id => id.toString()));
        }
      });
    });
  }

  async fetch(messageIds: string[], options: FetchOptions = {}): Promise<ImapMessage[]> {
    if (!this.connected || !this.imap) {
      throw new Error('IMAP not connected');
    }

    if (!this.selectedFolder) {
      throw new Error('No folder selected');
    }

    const numericIds = messageIds.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
    
    if (numericIds.length === 0) {
      return [];
    }

    const fetchOptions: any = {
      markSeen: options.markSeen !== false
    };

    if (options.bodies) {
      fetchOptions.bodies = options.bodies;
    }

    if (options.struct) {
      fetchOptions.struct = true;
    }

    if (options.envelope) {
      fetchOptions.envelope = true;
    }

    return new Promise((resolve, reject) => {
      const messages: ImapMessage[] = [];
      const fetch = this.imap!.fetch(numericIds, fetchOptions);

      fetch.on('message', (msg: any, seqno: number) => {
        const message: Partial<ImapMessage> = {
          uid: seqno,
          headers: '',
          body: '',
          flags: [],
          struct: null,
          envelope: null
        };

        msg.on('body', (stream: any, info: any) => {
          let data = '';
          stream.on('data', (chunk: Buffer) => {
            data += chunk.toString('utf8');
          });
          stream.once('end', () => {
            if (info.which === 'TEXT') {
              message.body = data;
            } else {
              message.headers = data;
            }
          });
        });

        msg.once('attributes', (attrs: any) => {
          message.flags = attrs.flags || [];
          message.struct = attrs.struct;
          message.envelope = attrs.envelope;
          message.uid = attrs.uid;
        });

        msg.once('end', () => {
          messages.push(message as ImapMessage);
        });
      });

      fetch.once('error', (err: Error) => {
        reject(new Error(`IMAP fetch failed: ${err.message}`));
      });

      fetch.once('end', () => {
        resolve(messages);
      });
    });
  }

  async getBoxes(): Promise<any> {
    if (!this.connected || !this.imap) {
      throw new Error('IMAP not connected');
    }

    return new Promise((resolve, reject) => {
      this.imap!.getBoxes((err: Error, boxes: any) => {
        if (err) {
          reject(new Error(`Failed to get boxes: ${err.message}`));
        } else {
          resolve(boxes);
        }
      });
    });
  }

  async addFlags(messageIds: string[], flags: string[]): Promise<void> {
    if (!this.connected || !this.imap) {
      throw new Error('IMAP not connected');
    }

    const numericIds = messageIds.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
    
    if (numericIds.length === 0) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.imap!.addFlags(numericIds, flags, (err: Error) => {
        if (err) {
          reject(new Error(`Failed to add flags: ${err.message}`));
        } else {
          resolve();
        }
      });
    });
  }

  async delFlags(messageIds: string[], flags: string[]): Promise<void> {
    if (!this.connected || !this.imap) {
      throw new Error('IMAP not connected');
    }

    const numericIds = messageIds.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
    
    if (numericIds.length === 0) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.imap!.delFlags(numericIds, flags, (err: Error) => {
        if (err) {
          reject(new Error(`Failed to remove flags: ${err.message}`));
        } else {
          resolve();
        }
      });
    });
  }

  async copy(messageIds: string[], targetFolder: string): Promise<void> {
    if (!this.connected || !this.imap) {
      throw new Error('IMAP not connected');
    }

    const numericIds = messageIds.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
    
    if (numericIds.length === 0) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.imap!.copy(numericIds, targetFolder, (err: Error) => {
        if (err) {
          reject(new Error(`Failed to copy messages: ${err.message}`));
        } else {
          resolve();
        }
      });
    });
  }

  async move(messageIds: string[], targetFolder: string): Promise<void> {
    if (!this.connected || !this.imap) {
      throw new Error('IMAP not connected');
    }

    const numericIds = messageIds.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
    
    if (numericIds.length === 0) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.imap!.move(numericIds, targetFolder, (err: Error) => {
        if (err) {
          reject(new Error(`Failed to move messages: ${err.message}`));
        } else {
          resolve();
        }
      });
    });
  }

  async expunge(): Promise<void> {
    if (!this.connected || !this.imap) {
      throw new Error('IMAP not connected');
    }

    return new Promise((resolve, reject) => {
      this.imap!.expunge((err: Error) => {
        if (err) {
          reject(new Error(`Failed to expunge: ${err.message}`));
        } else {
          resolve();
        }
      });
    });
  }

  async append(message: string, folder: string, flags: string[] = [], date?: Date): Promise<void> {
    if (!this.connected || !this.imap) {
      throw new Error('IMAP not connected');
    }

    return new Promise((resolve, reject) => {
      this.imap!.append(message, {
        mailbox: folder,
        flags: flags,
        date: date
      }, (err: Error) => {
        if (err) {
          reject(new Error(`Failed to append message: ${err.message}`));
        } else {
          resolve();
        }
      });
    });
  }

  async close(): Promise<void> {
    if (this.imap && this.connected) {
      return new Promise((resolve) => {
        this.imap!.once('end', () => {
          this.connected = false;
          this.selectedFolder = null;
          resolve();
        });
        this.imap!.end();
      });
    }
    this.connected = false;
    this.selectedFolder = null;
  }
}

export class SmtpConnection {
  private config: SmtpConfig;
  private transporter: nodemailer.Transporter | null = null;
  private connected = false;

  constructor(config: SmtpConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    if (this.connected && this.transporter) {
      return;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host: this.config.host,
        port: this.config.port,
        secure: this.config.secure,
        auth: {
          user: this.config.username,
          pass: this.config.password
        },
        tls: {
          rejectUnauthorized: false
        }
      });

      // Verify the connection
      if (this.transporter) {
        await this.transporter.verify();
        this.connected = true;
      }
    } catch (error) {
      this.connected = false;
      throw new Error(`SMTP connection failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  isConnected(): boolean {
    return this.connected && this.transporter !== null;
  }

  async sendMessage(message: string, envelope?: {
    from: string;
    to: string[];
  }): Promise<nodemailer.SentMessageInfo> {
    if (!this.connected || !this.transporter) {
      throw new Error('SMTP not connected');
    }

    try {
      const info = await this.transporter.sendMail({
        raw: message,
        envelope: envelope
      });
      
      return info;
    } catch (error) {
      throw new Error(`Failed to send message: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async sendMailData(mailData: nodemailer.SendMailOptions): Promise<nodemailer.SentMessageInfo> {
    if (!this.connected || !this.transporter) {
      throw new Error('SMTP not connected');
    }

    try {
      const info = await this.transporter.sendMail(mailData);
      return info;
    } catch (error) {
      throw new Error(`Failed to send mail: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async close(): Promise<void> {
    if (this.transporter) {
      this.transporter.close();
      this.transporter = null;
    }
    this.connected = false;
  }
}
