import type { AIProvider } from '@txguard/core';
import {
  OpenAIProvider,
  AnthropicProvider,
  GroqProvider,
  OllamaProvider,
} from '@txguard/core';

export function buildProviderChain(): AIProvider[] {
  const priority = (process.env['AI_PROVIDER_PRIORITY'] ?? 'openai,anthropic,groq,ollama')
    .split(',')
    .map((s) => s.trim().toLowerCase());

  const providers: AIProvider[] = [];

  for (const name of priority) {
    switch (name) {
      case 'openai': {
        const key = process.env['OPENAI_API_KEY'];
        if (key) {
          providers.push(new OpenAIProvider({ apiKey: key, model: process.env['OPENAI_MODEL'] }));
        }
        break;
      }
      case 'anthropic': {
        const key = process.env['ANTHROPIC_API_KEY'];
        if (key) {
          providers.push(
            new AnthropicProvider({ apiKey: key, model: process.env['ANTHROPIC_MODEL'] }),
          );
        }
        break;
      }
      case 'groq': {
        const key = process.env['GROQ_API_KEY'];
        if (key) {
          providers.push(new GroqProvider({ apiKey: key, model: process.env['GROQ_MODEL'] }));
        }
        break;
      }
      case 'ollama': {
        providers.push(
          new OllamaProvider({
            baseUrl: process.env['OLLAMA_BASE_URL'],
            model: process.env['OLLAMA_MODEL'],
          }),
        );
        break;
      }
    }
  }

  return providers;
}
