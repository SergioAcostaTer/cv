import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import { loadEnv } from "./lib/env-loader";

// Load environment variables from .env
loadEnv();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// ANSI Colors & Styles
const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  
  bgBlue: '\x1b[44m',
  bgCyan: '\x1b[46m',
  bgGray: '\x1b[100m',
};

type Color = keyof typeof COLORS;

const style = (text: string, ...styles: Color[]): string => {
  return styles.reduce((acc, s) => COLORS[s] + acc, text) + COLORS.reset;
};

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

class CVChat {
  private conversationHistory: ChatMessage[] = [];
  private cvContext: string = "";
  private rl: readline.Interface;
  private sourceFile: string = "";

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  private loadCVContext(): void {
    // Try to load LinkedIn profile first
    const linkedinPath = path.join(__dirname, "dist", "linkedin.json");
    if (fs.existsSync(linkedinPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(linkedinPath, "utf-8"));
        this.cvContext = JSON.stringify(data, null, 2);
        this.sourceFile = "LinkedIn Profile";
        console.log(style("  ✓ Loaded ", "green") + style("LinkedIn Profile", "cyan", "bright") + style(" from dist/linkedin.json", "dim"));
        return;
      } catch {
        // fallback to resume
      }
    }

    // Fallback to resume.json
    const resumePath = path.join(__dirname, "src", "backend", "en", "resume.json");
    if (fs.existsSync(resumePath)) {
      try {
        const data = JSON.parse(fs.readFileSync(resumePath, "utf-8"));
        this.cvContext = JSON.stringify(data, null, 2);
        this.sourceFile = "Resume";
        console.log(style("  ✓ Loaded ", "green") + style("Resume", "cyan", "bright") + style(" from src/backend/en/resume.json", "dim"));
        return;
      } catch {
        console.warn(style("  ⚠ Could not parse resume.json", "yellow"));
      }
    }

    console.warn(style("  ⚠ No CV data found. Run ", "yellow") + style("pnpm build", "bright") + style(" or ", "yellow") + style("pnpm linkedin", "bright") + style(" first.", "yellow"));
  }

  private async requestOpenAI(userMessage: string): Promise<string> {
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY environment variable not set. Please set it in your .env file.");
    }

    // Add user message to history
    this.conversationHistory.push({
      role: "user",
      content: userMessage,
    });

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1",
        messages: this.conversationHistory,
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OpenAI API: ${error.error?.message || response.statusText}`);
    }

    const data: any = await response.json();
    const assistantMessage = data.choices[0]?.message?.content || "";

    // Add assistant response to history
    this.conversationHistory.push({
      role: "assistant",
      content: assistantMessage,
    });

    return assistantMessage;
  }

  private buildSystemPrompt(): string {
    const basePrompt = `You are an expert career advisor and professional communicator having a conversation with the user based on their CV/LinkedIn profile.

Your role is to:
- Answer questions about their career, experience, and skills
- Provide career advice and insights
- Suggest improvements or opportunities
- Help with career strategy and positioning
- Be conversational, helpful, and professional
- Keep responses concise but insightful

Here is the user's CV/LinkedIn profile data:

\`\`\`json
${this.cvContext}
\`\`\`

Use this information to provide contextual, personalized advice and discussion.`;

    return basePrompt;
  }

  private prompt(question: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(question, (answer) => {
        resolve(answer);
      });
    });
  }

  private displayHelp(): void {
    console.log();
    console.log(style("  📋 Available Commands", "cyan", "bright"));
    console.log(style("  " + "─".repeat(40), "dim"));
    console.log(style("  /clear  ", "yellow") + style("Clear conversation history", "dim"));
    console.log(style("  /help   ", "yellow") + style("Show this message", "dim"));
    console.log(style("  /reload ", "yellow") + style("Reload CV data", "dim"));
    console.log(style("  /exit   ", "yellow") + style("Exit chat", "dim"));
    console.log(style("  " + "─".repeat(40), "dim"));
    console.log();
  }

  private printHeader(): void {
    console.clear();
    console.log();
    const width = 52;
    const line = '─'.repeat(width);
    
    console.log(style("  " + line, "cyan", "dim"));
    console.log(style("  │", "cyan", "dim") + style("  Career Advisor AI Chat", "bright", "cyan") + style("  │", "cyan", "dim"));
    console.log(style("  │", "cyan", "dim") + style("  Powered by GPT-4.1", "dim", "cyan") + style("  │", "cyan", "dim"));
    console.log(style("  " + line, "cyan", "dim"));
    console.log();
  }

  async start(): Promise<void> {
    this.printHeader();
    
    this.loadCVContext();

    if (!this.cvContext) {
      console.log();
      console.error(style("  ✗ Error: No CV context available.", "red", "bright"));
      console.log();
      this.rl.close();
      process.exit(1);
    }

    console.log();

    // Initialize with system prompt
    this.conversationHistory = [
      {
        role: "system",
        content: this.buildSystemPrompt(),
      },
    ];

    console.log(style("  Type /help for commands or /exit to quit", "dim"));
    console.log();

    while (true) {
      const userInput = await this.prompt(style("  You: ", "green", "bright"));

      if (!userInput.trim()) {
        continue;
      }

      console.log();

      // Handle commands
      if (userInput.startsWith("/")) {
        switch (userInput.toLowerCase()) {
          case "/exit":
            console.log(style("  👋 Thank you for using Career Advisor AI!", "cyan", "dim"));
            console.log();
            this.rl.close();
            return;
          case "/clear":
            console.log(style("  ↻ Conversation history cleared.", "yellow"));
            this.conversationHistory = [
              {
                role: "system",
                content: this.buildSystemPrompt(),
              },
            ];
            console.log();
            continue;
          case "/help":
            this.displayHelp();
            continue;
          case "/reload":
            console.log(style("  ⟳ Reloading CV data...", "cyan"));
            this.loadCVContext();
            this.conversationHistory = [
              {
                role: "system",
                content: this.buildSystemPrompt(),
              },
            ];
            console.log();
            continue;
          default:
            console.log(style("  ✗ Unknown command. Type ", "red") + style("/help", "bright") + style(" for available commands.", "red"));
            console.log();
            continue;
        }
      }

      try {
        process.stdout.write(style("  ⟳ ", "cyan", "dim"));
        let dotCount = 0;
        const dotInterval = setInterval(() => {
          process.stdout.write(style(".", "cyan", "dim"));
          dotCount++;
          if (dotCount >= 3) {
            clearInterval(dotInterval);
            process.stdout.write("\r" + "  ".repeat(20) + "\r");
          }
        }, 300);

        const response = await this.requestOpenAI(userInput);
        clearInterval(dotInterval);
        process.stdout.write("\r" + "  ".repeat(20) + "\r");

        console.log();
        console.log(style("  Assistant: ", "magenta", "bright") + style(response, "white"));
        console.log();
      } catch (error) {
        console.log();
        console.error(style("  ✗ Error: ", "red", "bright") + style(error instanceof Error ? error.message : String(error), "red"));
        console.log();
      }
    }
  }
}

// Main execution
const chat = new CVChat();
chat.start().catch((error) => {
  console.error(style("  ✗ Fatal error: ", "red", "bright") + error);
  process.exit(1);
});
