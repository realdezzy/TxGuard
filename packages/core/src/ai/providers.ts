import type { AIProvider, TransactionAnalysis } from '../types/index.js';
import { buildPrompt } from './explainer.js';

export class OpenAIProvider implements AIProvider {
  name = 'openai';
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor(config: { apiKey: string; model?: string; baseUrl?: string }) {
    this.apiKey = config.apiKey;
    this.model = config.model || 'gpt-4o';
    this.baseUrl = config.baseUrl || 'https://api.openai.com/v1';
  }

  async explain(analysis: Omit<TransactionAnalysis, 'explanation'>): Promise<string> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: 'user', content: buildPrompt(analysis) }],
        max_tokens: 300,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = (await response.json()) as {
      choices: { message: { content: string } }[];
    };
    return data.choices[0]?.message.content ?? '';
  }
}

export class AnthropicProvider implements AIProvider {
  name = 'anthropic';
  private apiKey: string;
  private model: string;

  constructor(config: { apiKey: string; model?: string }) {
    this.apiKey = config.apiKey;
    this.model = config.model || 'claude-3-5-sonnet-20240620';
  }

  async explain(analysis: Omit<TransactionAnalysis, 'explanation'>): Promise<string> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 300,
        messages: [{ role: 'user', content: buildPrompt(analysis) }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = (await response.json()) as {
      content: { type: string; text: string }[];
    };
    return data.content.find((c) => c.type === 'text')?.text ?? '';
  }
}

export class GroqProvider implements AIProvider {
  name = 'groq';
  private apiKey: string;
  private model: string;

  constructor(config: { apiKey: string; model?: string }) {
    this.apiKey = config.apiKey;
    this.model = config.model || 'llama-3.3-70b-versatile';
  }

  async explain(analysis: Omit<TransactionAnalysis, 'explanation'>): Promise<string> {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: 'user', content: buildPrompt(analysis) }],
        max_tokens: 300,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      throw new Error(`Groq API error: ${response.status}`);
    }

    const data = (await response.json()) as {
      choices: { message: { content: string } }[];
    };
    return data.choices[0]?.message.content ?? '';
  }
}

export class OllamaProvider implements AIProvider {
  name = 'ollama';
  private baseUrl: string;
  private model: string;

  constructor(config: { baseUrl?: string; model?: string }) {
    this.baseUrl = config.baseUrl ?? 'http://localhost:11434';
    this.model = config.model ?? 'llama3.1';
  }

  async explain(analysis: Omit<TransactionAnalysis, 'explanation'>): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          prompt: buildPrompt(analysis),
          stream: false,
          options: { temperature: 0.3, num_predict: 300 },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Ollama error: ${response.status}`);
      }

      const data = (await response.json()) as { response: string };
      return data.response;
    } finally {
      clearTimeout(timeout);
    }
  }
}
