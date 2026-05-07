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

  const knownNames = new Set(['openai', 'anthropic', 'groq', 'ollama']);

  for (const name of priority) {
    switch (name) {
      case 'openai': {
        const key = process.env['OPENAI_API_KEY'];
        if (key) {
          providers.push(new OpenAIProvider({ apiKey: key, model: process.env['OPENAI_MODEL'] }));
        } else {
          console.warn('AI_PROVIDER_PRIORITY includes openai but OPENAI_API_KEY is not set');
        }
        break;
      }
      case 'anthropic': {
        const key = process.env['ANTHROPIC_API_KEY'];
        if (key) {
          providers.push(
            new AnthropicProvider({ apiKey: key, model: process.env['ANTHROPIC_MODEL'] }),
          );
        } else {
          console.warn('AI_PROVIDER_PRIORITY includes anthropic but ANTHROPIC_API_KEY is not set');
        }
        break;
      }
      case 'groq': {
        const key = process.env['GROQ_API_KEY'];
        if (key) {
          providers.push(new GroqProvider({ apiKey: key, model: process.env['GROQ_MODEL'] }));
        } else {
          console.warn('AI_PROVIDER_PRIORITY includes groq but GROQ_API_KEY is not set');
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
      default:
        if (name.length > 0) {
          console.warn(`Unknown provider "${name}" in AI_PROVIDER_PRIORITY. Supported: ${[...knownNames].join(', ')}`);
        }
    }
  }

  if (providers.length === 0 && priority.some(p => p.length > 0)) {
    console.warn('No AI providers configured. Transaction explanations will use the template fallback.');
  }

  return providers;
}
