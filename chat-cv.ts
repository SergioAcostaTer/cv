import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

class CVChat {
  private conversationHistory: ChatMessage[] = [];
  private cvContext: string = "";
  private rl: readline.Interface;

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
        console.log("✓ Loaded LinkedIn profile from dist/linkedin.json\n");
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
        console.log("✓ Loaded resume from src/backend/en/resume.json\n");
        return;
      } catch {
        console.warn("⚠ Could not parse resume.json, continuing without CV context\n");
      }
    }

    console.warn("⚠ No CV data found. Run 'pnpm build' or 'pnpm linkedin' first.\n");
  }

  private async requestOpenAI(userMessage: string): Promise<string> {
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY environment variable not set");
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
      throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
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
    console.log("\n📋 Chat Commands:");
    console.log("  /clear    - Clear conversation history");
    console.log("  /help     - Show this help message");
    console.log("  /reload   - Reload CV data");
    console.log("  /exit     - Exit chat\n");
  }

  async start(): Promise<void> {
    console.log("╔════════════════════════════════════════╗");
    console.log("║  🤖 CV Chat - Career Advisor           ║");
    console.log("╚════════════════════════════════════════╝\n");

    this.loadCVContext();

    if (!this.cvContext) {
      console.error("Error: No CV context available. Exiting.\n");
      this.rl.close();
      process.exit(1);
    }

    // Initialize with system prompt
    this.conversationHistory = [
      {
        role: "system",
        content: this.buildSystemPrompt(),
      },
    ];

    console.log('Type your question or /help for commands. Type /exit to quit.\n');

    while (true) {
      const userInput = await this.prompt("You: ");

      if (!userInput.trim()) {
        continue;
      }

      // Handle commands
      if (userInput.startsWith("/")) {
        switch (userInput.toLowerCase()) {
          case "/exit":
            console.log("\n👋 Goodbye!\n");
            this.rl.close();
            return;
          case "/clear":
            console.log("🗑️  Conversation history cleared.\n");
            this.conversationHistory = [
              {
                role: "system",
                content: this.buildSystemPrompt(),
              },
            ];
            continue;
          case "/help":
            this.displayHelp();
            continue;
          case "/reload":
            console.log("🔄 Reloading CV data...");
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
            console.log('❓ Unknown command. Type /help for available commands.\n');
            continue;
        }
      }

      try {
        console.log("\n🤔 Thinking...");
        const response = await this.requestOpenAI(userInput);
        console.log(`\nAssistant: ${response}\n`);
      } catch (error) {
        console.error(`\n❌ Error: ${error instanceof Error ? error.message : String(error)}\n`);
      }
    }
  }
}

// Main execution
const chat = new CVChat();
chat.start().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
